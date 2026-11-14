import {
  BackupBundleSchema,
  CONVERSION_RULE_VERSION,
  CREWSIGNAL_SCHEMA_VERSION,
  DraftRecoveryBundleSchema,
  MetricIdSchema,
  ObservationQualitySchema,
  MOOD_QUESTION_TEXT,
  MOOD_SCALE_ID,
  MOOD_SCALE_VERSION,
  ReportBundleSchema,
  type BackupBundle,
  type CanonicalObservationValue,
  type CheckInDraft,
  type CheckInEvent,
  type CorrectionEntry,
  type DraftRecoveryBundle,
  type EnteredObservationValue,
  type EvidenceReference,
  type GlucoseUnit,
  type Insight,
  type MetricId,
  type Observation,
  type ObservationTiming,
  type PersonalReference,
  type ProfileConfig,
  type ReportBundle,
  type SleepType,
  type TemperatureUnit,
} from './contracts';
import {
  convertGlucose,
  convertTemperature,
  countDecimalPlaces,
} from './conversions';
import { EVIDENCE_REGISTRY } from './guidance';
import {
  ENTRY_CONFIRMED_NOTE,
  getEntryWarning,
  getMoodLabel,
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  parseStrictFiniteNumber,
  parseStrictNonNegativeInt,
} from './metrics';
import {
  buildInstantTiming,
  buildPeriodTiming,
  computeMissionDay,
  getObservedMissionDay,
  parseUtcMs,
} from './timing';

export const DEFAULT_REPORT_METRICS: readonly MetricId[] = [
  'heart_rate',
  'blood_pressure',
  'body_temperature',
  'sleep',
] as const;

export interface BuildReportOptions {
  profile: ProfileConfig;
  observations: readonly Observation[];
  references: readonly PersonalReference[];
  startDay: number;
  endDay: number;
  selectedMetricIds?: readonly MetricId[];
  selectedObservationIds?: readonly string[];
  includeMood?: boolean;
  includeNotes?: boolean;
  generatedAtUtc: string;
}

/**
 * Builds a validated, privacy-filtered ReportBundle (kind: 'crewsignal-report', v1).
 * Mood and notes are excluded by default across rows AND metadata/embedded citations.
 */
export function buildReportBundle(options: BuildReportOptions): ReportBundle {
  const includeMood = options.includeMood ?? false;
  const includeNotes = options.includeNotes ?? false;

  const requested = options.selectedMetricIds ?? DEFAULT_REPORT_METRICS;
  const includedSet = new Set<MetricId>();
  for (const id of requested) {
    if (id === 'mood' && !includeMood) continue;
    includedSet.add(id);
  }
  if (includeMood && requested.includes('mood')) {
    includedSet.add('mood');
  }

  const includedMetricIds = METRIC_ORDER.filter((m) => includedSet.has(m));
  const excludedMetricIds = METRIC_ORDER.filter((m) => !includedSet.has(m));

  const filteredObservations: Observation[] = [];
  const selectedObservations = options.selectedObservationIds && new Set(options.selectedObservationIds);
  const countsByMetric: Partial<Record<MetricId, number>> = {};

  for (const obs of options.observations) {
    if (obs.profileId !== options.profile.profileId) continue;
    if (selectedObservations && !selectedObservations.has(obs.observationId)) continue;
    if (!includedSet.has(obs.metricId)) continue;
    const day = getObservedMissionDay(obs);
    if (day < options.startDay || day > options.endDay) continue;

    filteredObservations.push({
      observationId: obs.observationId,
      profileId: obs.profileId,
      metricId: obs.metricId,
      timing: obs.timing,
      recordedAtUtc: obs.recordedAtUtc,
      entered: obs.entered,
      canonical: obs.canonical,
      method: obs.method,
      context: obs.context,
      provenance: obs.provenance,
      quality: obs.quality,
      note: includeNotes ? obs.note : null,
      qualityNote: includeNotes ? obs.qualityNote : null,
      sourceDraftId: obs.sourceDraftId,
      importBatchId: obs.importBatchId,
      correctionHistory: [],
    });
    countsByMetric[obs.metricId] = (countsByMetric[obs.metricId] ?? 0) + 1;
  }

  const coveredTypes = new Set(filteredObservations.map((o) => o.metricId));
  const filteredReferences = options.references.filter(
    (r) =>
      r.profileId === options.profile.profileId &&
      r.status === 'active' &&
      coveredTypes.has(r.metricId),
  );

  const evidenceIds = new Set<string>();
  for (const m of METRIC_ORDER.filter((id) => coveredTypes.has(id))) {
    for (const eid of METRIC_DEFINITIONS[m].evidenceIds) {
      evidenceIds.add(eid);
    }
  }
  const evidence = [...evidenceIds]
    .map((id) => EVIDENCE_REGISTRY[id])
    .filter((e): e is EvidenceReference => Boolean(e))
    .map((e) => ({
      sourceId: e.sourceId,
      title: e.title,
      summaryVersion: e.summaryVersion,
      checkedDate: e.checkedDate,
      url: e.url,
    }));

  const bundle: ReportBundle = {
    kind: 'crewsignal-report',
    schemaVersion: CREWSIGNAL_SCHEMA_VERSION,
    generatedAtUtc: options.generatedAtUtc,
    mode: options.profile.mode,
    profileId: options.profile.profileId,
    profileLabel: options.profile.label,
    missionName: options.profile.missionName,
    missionEpochUtc: options.profile.missionEpochUtc,
    missionDayRange: {
      startDay: options.startDay,
      endDay: options.endDay,
    },
    includedMetricIds,
    excludedMetricIds,
    includeNotes,
    totalObservations: filteredObservations.length,
    includedTypesCount: coveredTypes.size,
    countsByMetric,
    observations: filteredObservations,
    references: filteredReferences,
    evidence,
    disclaimers: [
      'A record handoff; not a fitness-for-duty clearance.',
      'This is a filtered report, not a complete backup.',
    ],
  };

  return ReportBundleSchema.parse(bundle);
}

export function describeReportFormats(
  report: ReportBundle,
  options: { csv: boolean; printIncludesMetadata: boolean },
): string[] {
  const references = report.references.map((r) => `${METRIC_DEFINITIONS[r.metricId].name} v${r.version}`).join(', ') || 'none';
  const citations = report.evidence.map((e) => e.title).join(', ') || 'none';
  const metadata = `References: ${references}. Citations: ${citations}.`;
  const notes = report.includeNotes ? 'Includes current reading and quality notes.' : 'Notes excluded.';
  const rowNotes = report.includeNotes ? 'Includes current reading notes only.' : 'Notes excluded.';
  return [
    `JSON. ${notes} ${metadata}`,
    ...(options.csv ? [`CSV. ${rowNotes} References and citations excluded.`] : []),
    `Print. ${rowNotes} ${options.printIncludesMetadata ? metadata : 'References and citations excluded.'}`,
    'Correction history is available in the full profile backup.',
  ];
}

export interface BackupPreviewSummary {
  observationCount: number;
  moodCount: number;
  noteCount: number;
  eventCount: number;
  referenceCount: number;
}

export function computeBackupSummaryCounts(params: {
  observations: readonly Observation[];
  checkInEvents: readonly CheckInEvent[];
  references: readonly PersonalReference[];
}): BackupPreviewSummary {
  let moodCount = 0;
  let noteCount = 0;
  for (const obs of params.observations) {
    if (obs.metricId === 'mood') moodCount += 1;
    if (obs.note !== null && obs.note.trim().length > 0) noteCount += 1;
  }
  return {
    observationCount: params.observations.length,
    moodCount,
    noteCount,
    eventCount: params.checkInEvents.length,
    referenceCount: params.references.length,
  };
}

export function buildBackupBundle(params: {
  confirmedIncludeAllProfileData: boolean;
  exportedAtUtc: string;
  profile: ProfileConfig;
  preferences: BackupBundle['preferences'];
  observations: readonly Observation[];
  checkInEvents: readonly CheckInEvent[];
  references: readonly PersonalReference[];
  insights: readonly Insight[];
  history?: {
    actionReviews?: ReadonlyArray<Record<string, unknown>>;
    clockHistory?: ReadonlyArray<Record<string, unknown>>;
    corrections?: ReadonlyArray<Record<string, unknown>>;
  };
}): BackupBundle {
  if (!params.confirmedIncludeAllProfileData) {
    throw new Error(
      'Creating a full backup requires explicit confirmation ("Include all profile data").',
    );
  }
  const pid = params.profile.profileId;
  const profileObs = params.observations.filter((o) => o.profileId === pid);
  const profileEvents = params.checkInEvents.filter((e) => e.profileId === pid);
  const profileRefs = params.references.filter((r) => r.profileId === pid);
  const profileInsights = params.insights.filter((i) => i.profileId === pid);

  const bundle: BackupBundle = {
    kind: 'crewsignal-backup',
    schemaVersion: CREWSIGNAL_SCHEMA_VERSION,
    exportedAtUtc: params.exportedAtUtc,
    confirmedFullProfileData: true,
    profile: params.profile,
    preferences: params.preferences,
    observations: profileObs,
    checkInEvents: profileEvents,
    references: profileRefs,
    insights: profileInsights,
    ...(params.history
      ? {
          history: {
            actionReviews: [...(params.history.actionReviews ?? [])],
            clockHistory: [...(params.history.clockHistory ?? [])],
            corrections: [...(params.history.corrections ?? [])],
          },
        }
      : {}),
    summaryCounts: computeBackupSummaryCounts({
      observations: profileObs,
      checkInEvents: profileEvents,
      references: profileRefs,
    }),
  };

  return BackupBundleSchema.parse(bundle);
}

export interface BackupValidationResult {
  valid: boolean;
  error: string | null;
  bundle: BackupBundle | null;
  defaultDestination: 'separate_profile';
}

/**
 * Validates a BackupBundle JSON payload before any mutation.
 * Rejects wrong bundle kinds (report/draft-recovery) and enforces demo/personal isolation.
 */
export function validateBackupImport(
  rawInput: unknown,
  options?: { rejectPersonalInPublicDemo?: boolean },
): BackupValidationResult {
  if (typeof rawInput === 'object' && rawInput !== null && 'kind' in rawInput) {
    const kindVal = (rawInput as { kind?: unknown }).kind;
    if (kindVal !== 'crewsignal-backup') {
      return {
        valid: false,
        error: `Expected bundle kind "crewsignal-backup", received "${String(kindVal)}".`,
        bundle: null,
        defaultDestination: 'separate_profile',
      };
    }
  }

  const parsed = BackupBundleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      valid: false,
      error: `Invalid backup bundle: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`,
      bundle: null,
      defaultDestination: 'separate_profile',
    };
  }

  if (
    options?.rejectPersonalInPublicDemo &&
    parsed.data.profile.mode === 'personal'
  ) {
    return {
      valid: false,
      error:
        'Personal-mode backups cannot be restored into the public synthetic demonstration.',
      bundle: null,
      defaultDestination: 'separate_profile',
    };
  }

  return {
    valid: true,
    error: null,
    bundle: parsed.data,
    defaultDestination: 'separate_profile',
  };
}

export function buildDraftRecoveryBundle(params: {
  draft: CheckInDraft;
  profileLabel: string;
  exportedAtUtc: string;
  includeNotes?: boolean;
}): DraftRecoveryBundle {
  const includeNotes = params.includeNotes ?? false;
  const sanitizedDraft: CheckInDraft = includeNotes
    ? { ...params.draft }
    : { ...params.draft, note: '' };

  const bundle: DraftRecoveryBundle = {
    kind: 'crewsignal-draft-recovery',
    schemaVersion: CREWSIGNAL_SCHEMA_VERSION,
    exportedAtUtc: params.exportedAtUtc,
    uncommitted: true,
    profileId: params.draft.profileId,
    profileLabel: params.profileLabel,
    mode: params.draft.mode,
    missionEpochUtc: params.draft.missionEpochUtc,
    includeNotes,
    draft: sanitizedDraft,
  };

  return DraftRecoveryBundleSchema.parse(bundle);
}

export interface DraftRecoveryValidationResult {
  valid: boolean;
  status: 'resume_draft' | 'already_in_log' | 'rejected';
  error: string | null;
  bundle: DraftRecoveryBundle | null;
  existingCommittedObservation: Observation | null;
}

/**
 * Validates an imported DraftRecoveryBundle.
 * Never silently commits a draft; detects if the draft identity is already in the log.
 */
export function validateDraftRecoveryImport(
  rawInput: unknown,
  options: {
    existingObservations: readonly Observation[];
    rejectPersonalInPublicDemo?: boolean;
  },
): DraftRecoveryValidationResult {
  if (typeof rawInput === 'object' && rawInput !== null && 'kind' in rawInput) {
    const kindVal = (rawInput as { kind?: unknown }).kind;
    if (kindVal !== 'crewsignal-draft-recovery') {
      return {
        valid: false,
        status: 'rejected',
        error: `Expected bundle kind "crewsignal-draft-recovery", received "${String(kindVal)}".`,
        bundle: null,
        existingCommittedObservation: null,
      };
    }
  }

  const parsed = DraftRecoveryBundleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      valid: false,
      status: 'rejected',
      error: `Invalid draft recovery file: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`,
      bundle: null,
      existingCommittedObservation: null,
    };
  }

  if (
    options.rejectPersonalInPublicDemo &&
    parsed.data.mode === 'personal'
  ) {
    return {
      valid: false,
      status: 'rejected',
      error:
        'Personal-mode draft recovery files cannot be loaded in the public synthetic demonstration.',
      bundle: null,
      existingCommittedObservation: null,
    };
  }

  const draft = parsed.data.draft;
  const existing = options.existingObservations.find(
    (obs) =>
      obs.profileId === draft.profileId &&
      (obs.sourceDraftId === draft.draftId ||
        (draft.committedObservationId !== null &&
          obs.observationId === draft.committedObservationId)),
  );

  if (existing) {
    return {
      valid: true,
      status: 'already_in_log',
      error: null,
      bundle: parsed.data,
      existingCommittedObservation: existing,
    };
  }

  return {
    valid: true,
    status: 'resume_draft',
    error: null,
    bundle: parsed.data,
    existingCommittedObservation: null,
  };
}

/**
 * Published CSV template columns derived from CrewSignal's metric and timing contracts.
 */
export const CSV_TEMPLATE_COLUMNS = [
  'observation_id',
  'metric_id',
  'timing_kind',
  'observed_at_utc',
  'mission_day',
  'sleep_type',
  'ending_mission_day',
  'duration_minutes',
  'sleep_window_start_utc',
  'sleep_window_end_utc',
  'reported_at_utc',
  'value',
  'secondary_value',
  'unit',
  'method',
  'context',
  'provenance',
  'notes',
  'quality',
] as const;

export function generateCsvTemplate(): string {
  return `${CSV_TEMPLATE_COLUMNS.join(',')}\n`;
}

function escapeCsvCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function serializeObservationsToCsv(
  observations: readonly Observation[],
  options?: { includeNotes?: boolean },
): string {
  const includeNotes = options?.includeNotes ?? false;
  const lines = [CSV_TEMPLATE_COLUMNS.join(',')];

  for (const obs of observations) {
    let value = '';
    let secondaryValue = '';
    let unit = '';
    if (obs.entered.kind === 'scalar') {
      value = String(obs.entered.value);
      unit = obs.entered.unit;
    } else if (obs.entered.kind === 'blood_pressure') {
      value = String(obs.entered.systolic);
      secondaryValue = String(obs.entered.diastolic);
      unit = 'mmHg';
    } else if (obs.entered.kind === 'sleep_duration') {
      value = String(obs.entered.durationMinutes);
      unit = 'min';
    } else if (obs.entered.kind === 'mood_ordinal') {
      value = String(obs.entered.score);
      unit = 'ordinal_1_5';
    }

    const cells =
      obs.timing.kind === 'instant'
        ? [
            obs.observationId,
            obs.metricId,
            'instant',
            obs.timing.observedAtUtc,
            String(obs.timing.missionDay),
            '',
            '',
            '',
            '',
            '',
            '',
            value,
            secondaryValue,
            unit,
            obs.method,
            obs.context,
            obs.provenance,
            includeNotes ? (obs.note ?? '') : '',
          ]
        : [
            obs.observationId,
            obs.metricId,
            'period',
            '',
            '',
            obs.timing.sleepType,
            String(obs.timing.endingMissionDay),
            String(obs.timing.durationMinutes),
            obs.timing.windowStartUtc ?? '',
            obs.timing.windowEndUtc ?? '',
            obs.timing.reportedAtUtc,
            value,
            secondaryValue,
            unit,
            obs.method,
            obs.context,
            obs.provenance,
            includeNotes ? (obs.note ?? '') : '',
          ];

    cells.push(obs.quality);
    lines.push(cells.map(escapeCsvCell).join(','));
  }

  return `${lines.join('\n')}\n`;
}

/**
 * RFC-4180 compliant CSV parser handling quoted fields, escaped quotes, and CRLF/LF.
 */
export function parseCsvTable(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i += 1;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (ch === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unterminated quoted field.');
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((r) => !(r.length === 1 && r[0]!.trim() === ''));
}

export type CsvRowClassification =
  | 'valid'
  | 'duplicate'
  | 'conflict'
  | 'possible_duplicate'
  | 'rejected';

export interface CsvReconciledRow {
  rowIndex: number; // 1-based data row number
  observationId: string;
  metricId: string;
  classification: CsvRowClassification;
  reason: string | null;
  warning?: string;
  candidate: Observation | null;
  existingObservation: Observation | null;
}

export type CsvConflictChoice = 'keep_current' | 'use_imported';
export type CsvPossibleDuplicateChoice = 'keep_separate' | 'skip';

export interface CsvReconciliationPreview {
  validHeader: boolean;
  headerError: string | null;
  rows: CsvReconciledRow[];
  counts: {
    total: number;
    valid: number;
    duplicate: number;
    conflict: number;
    possibleDuplicate: number;
    rejected: number;
  };
  summaryLine: string;
}

function isSameObservationContent(a: Observation, b: Observation): boolean {
  if (a.metricId !== b.metricId || a.quality !== b.quality) return false;
  if (a.method !== b.method || a.context !== b.context) return false;
  if (JSON.stringify(a.entered) !== JSON.stringify(b.entered)) return false;
  if (JSON.stringify(a.timing) !== JSON.stringify(b.timing)) return false;
  return true;
}

function isMatchingValueAndTime(a: Observation, b: Observation): boolean {
  if (a.metricId !== b.metricId) return false;
  if (JSON.stringify(a.canonical) !== JSON.stringify(b.canonical)) return false;
  if (a.timing.kind !== b.timing.kind) return false;
  if (a.timing.kind === 'instant' && b.timing.kind === 'instant') {
    return a.timing.observedAtUtc === b.timing.observedAtUtc;
  }
  if (a.timing.kind === 'period' && b.timing.kind === 'period') {
    return (
      a.timing.endingMissionDay === b.timing.endingMissionDay &&
      a.timing.sleepType === b.timing.sleepType
    );
  }
  return false;
}

/**
 * Parses and reconciles a CSV file against existing profile observations.
 * Enforces instant/period discrimination, strict unit checks (rejects unsupported
 * units like 'mg' for glucose), whole-pair BP conflict detection, exact duplicate
 * idempotence, and different-ID possible duplicate detection.
 */
export function parseAndReconcileCsv(params: {
  csvText: string;
  existingObservations: readonly Observation[];
  profileId: string;
  missionEpochUtc: string;
  importBatchId: string;
  nowUtc: string;
}): CsvReconciliationPreview {
  let table: string[][];
  try {
    table = parseCsvTable(params.csvText);
  } catch (err) {
    return {
      validHeader: false,
      headerError: err instanceof Error ? err.message : 'Failed to parse CSV.',
      rows: [],
      counts: {
        total: 0,
        valid: 0,
        duplicate: 0,
        conflict: 0,
        possibleDuplicate: 0,
        rejected: 0,
      },
      summaryLine: '0 valid · 0 duplicate · 0 conflict · 0 rejected',
    };
  }

  if (table.length === 0) {
    return {
      validHeader: false,
      headerError: 'CSV file is empty.',
      rows: [],
      counts: {
        total: 0,
        valid: 0,
        duplicate: 0,
        conflict: 0,
        possibleDuplicate: 0,
        rejected: 0,
      },
      summaryLine: '0 valid · 0 duplicate · 0 conflict · 0 rejected',
    };
  }

  const header = table[0]!.map((h) => h.trim());
  const expected = [...CSV_TEMPLATE_COLUMNS];
  const headerMatches =
    (header.length === expected.length || header.length === expected.length - 1) &&
    header.every((h, idx) => h === expected[idx]);

  if (!headerMatches) {
    return {
      validHeader: false,
      headerError: `CSV header mismatch. Expected columns: ${expected.join(',')}`,
      rows: [],
      counts: {
        total: 0,
        valid: 0,
        duplicate: 0,
        conflict: 0,
        possibleDuplicate: 0,
        rejected: 0,
      },
      summaryLine: '0 valid · 0 duplicate · 0 conflict · 0 rejected',
    };
  }

  const byId = new Map<string, Observation>();
  for (const obs of params.existingObservations) {
    if (obs.profileId === params.profileId) {
      byId.set(obs.observationId, obs);
    }
  }

  const reconciledRows: CsvReconciledRow[] = [];
  const counts = {
    total: 0,
    valid: 0,
    duplicate: 0,
    conflict: 0,
    possibleDuplicate: 0,
    rejected: 0,
  };

  for (let i = 1; i < table.length; i += 1) {
    const rawRow = table[i]!;
    const rowIndex = i;
    counts.total += 1;

    if (rawRow.length !== header.length) {
      counts.rejected += 1;
      reconciledRows.push({
        rowIndex,
        observationId: rawRow[0]?.trim() ?? '',
        metricId: rawRow[1]?.trim() ?? '',
        classification: 'rejected',
        reason: `Expected ${header.length} columns, found ${rawRow.length}.`,
        candidate: null,
        existingObservation: null,
      });
      continue;
    }

    const row: Record<(typeof CSV_TEMPLATE_COLUMNS)[number], string> = {
      observation_id: rawRow[0]!.trim(),
      metric_id: rawRow[1]!.trim(),
      timing_kind: rawRow[2]!.trim(),
      observed_at_utc: rawRow[3]!.trim(),
      mission_day: rawRow[4]!.trim(),
      sleep_type: rawRow[5]!.trim(),
      ending_mission_day: rawRow[6]!.trim(),
      duration_minutes: rawRow[7]!.trim(),
      sleep_window_start_utc: rawRow[8]!.trim(),
      sleep_window_end_utc: rawRow[9]!.trim(),
      reported_at_utc: rawRow[10]!.trim(),
      value: rawRow[11]!.trim(),
      secondary_value: rawRow[12]!.trim(),
      unit: rawRow[13]!.trim(),
      method: rawRow[14]!.trim() || 'Not specified',
      context: rawRow[15]!.trim() || 'Not specified',
      provenance: rawRow[16]!.trim() || 'csv_import',
      notes: rawRow[17]!.trim(),
      quality: rawRow[18]?.trim() || 'valid',
    };

    const reject = (reason: string) => {
      counts.rejected += 1;
      reconciledRows.push({
        rowIndex,
        observationId: row.observation_id,
        metricId: row.metric_id,
        classification: 'rejected',
        reason,
        candidate: null,
        existingObservation: null,
      });
    };

    if (!row.observation_id) {
      reject('Missing observation_id.');
      continue;
    }

    const quality = ObservationQualitySchema.safeParse(row.quality);
    if (!quality.success) {
      reject('Quality must be valid or questionable.');
      continue;
    }
    const metricCheck = MetricIdSchema.safeParse(row.metric_id);
    if (!metricCheck.success) {
      reject(`Unsupported metric_id "${row.metric_id}".`);
      continue;
    }
    const metricId = metricCheck.data;
    const def = METRIC_DEFINITIONS[metricId];

    // Timing parsing & validation
    let timing: ObservationTiming;
    if (row.timing_kind !== def.timingMode) {
      reject(
        `Metric "${metricId}" requires timing_kind "${def.timingMode}", found "${row.timing_kind}".`,
      );
      continue;
    }

    if (row.timing_kind === 'instant') {
      if (!row.observed_at_utc) {
        reject('Instant row requires observed_at_utc.');
        continue;
      }
      try {
        const computedDay = computeMissionDay(
          row.observed_at_utc,
          params.missionEpochUtc,
        );
        if (computedDay < 1) {
          reject('observed_at_utc precedes mission epoch.');
          continue;
        }
        if (row.mission_day) {
          const parsedDay = parseStrictNonNegativeInt(row.mission_day);
          if (parsedDay === null || parsedDay !== computedDay) {
            reject(
              `mission_day (${row.mission_day}) does not match observed_at_utc day (${computedDay}).`,
            );
            continue;
          }
        }
        timing = buildInstantTiming({
          observedAtUtc: row.observed_at_utc,
          missionEpochUtc: params.missionEpochUtc,
        });
      } catch (e) {
        reject(e instanceof Error ? e.message : 'Invalid observed_at_utc.');
        continue;
      }
    } else {
      // Period timing for sleep
      const validSleepTypes: SleepType[] = ['main_sleep', 'nap', 'other'];
      if (!validSleepTypes.includes(row.sleep_type as SleepType)) {
        reject(
          `Invalid sleep_type "${row.sleep_type}". Expected main_sleep, nap, or other.`,
        );
        continue;
      }
      const endingDay = parseStrictNonNegativeInt(row.ending_mission_day);
      if (endingDay === null || endingDay < 1) {
        reject('Period row requires integer ending_mission_day >= 1.');
        continue;
      }
      const durationMins = parseStrictNonNegativeInt(row.duration_minutes);
      if (durationMins === null) {
        reject('Period row requires integer duration_minutes >= 0.');
        continue;
      }
      if (!row.reported_at_utc) {
        reject('Period row requires reported_at_utc.');
        continue;
      }
      let winStart: string | null = null;
      let winEnd: string | null = null;
      if (row.sleep_window_start_utc || row.sleep_window_end_utc) {
        if (!row.sleep_window_start_utc || !row.sleep_window_end_utc) {
          reject('Both sleep_window_start_utc and sleep_window_end_utc are required if either is set.');
          continue;
        }
        try {
          const sMs = parseUtcMs(row.sleep_window_start_utc);
          const eMs = parseUtcMs(row.sleep_window_end_utc);
          if (eMs <= sMs) {
            reject('sleep_window_end_utc must follow sleep_window_start_utc.');
            continue;
          }
          winStart = row.sleep_window_start_utc;
          winEnd = row.sleep_window_end_utc;
        } catch (e) {
          reject(e instanceof Error ? e.message : 'Invalid sleep window UTC timestamps.');
          continue;
        }
      }
      try {
        timing = buildPeriodTiming({
          sleepType: row.sleep_type as SleepType,
          endingMissionDay: endingDay,
          durationMinutes: durationMins,
          reportedAtUtc: row.reported_at_utc,
          missionEpochUtc: params.missionEpochUtc,
          windowStartUtc: winStart,
          windowEndUtc: winEnd,
        });
      } catch (e) {
        reject(e instanceof Error ? e.message : 'Invalid period timing.');
        continue;
      }
    }

    // Value & strict unit validation
    let entered: EnteredObservationValue;
    let canonical: CanonicalObservationValue;

    if (metricId === 'heart_rate') {
      if (row.unit !== 'bpm') {
        reject(`Unsupported heart_rate unit "${row.unit}". Expected "bpm".`);
        continue;
      }
      const val = parseStrictFiniteNumber(row.value);
      if (val === null || val <= 0) {
        reject(`Invalid heart_rate value "${row.value}".`);
        continue;
      }
      entered = {
        kind: 'scalar',
        value: val,
        unit: 'bpm',
        precision: countDecimalPlaces(row.value),
      };
      canonical = { ...entered, conversionVersion: CONVERSION_RULE_VERSION };
    } else if (metricId === 'blood_pressure') {
      if (row.unit !== 'mmHg') {
        reject(`Unsupported blood_pressure unit "${row.unit}". Expected "mmHg".`);
        continue;
      }
      const sys = parseStrictFiniteNumber(row.value);
      const dia = parseStrictFiniteNumber(row.secondary_value);
      if (sys === null || sys <= 0 || dia === null || dia <= 0) {
        reject('Blood pressure requires positive systolic (value) and diastolic (secondary_value).');
        continue;
      }
      entered = {
        kind: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        unit: 'mmHg',
        precision: Math.max(
          countDecimalPlaces(row.value),
          countDecimalPlaces(row.secondary_value),
        ),
      };
      canonical = { ...entered, conversionVersion: CONVERSION_RULE_VERSION };
    } else if (metricId === 'blood_glucose') {
      // Strictly reject unsupported units like "mg" without inferring!
      if (row.unit !== 'mg/dL' && row.unit !== 'mmol/L') {
        reject(
          `Unsupported blood_glucose unit "${row.unit}". Accepted units are "mg/dL" or "mmol/L".`,
        );
        continue;
      }
      const val = parseStrictFiniteNumber(row.value);
      if (val === null || val <= 0) {
        reject(`Invalid blood_glucose value "${row.value}".`);
        continue;
      }
      const unit = row.unit as GlucoseUnit;
      const normalized = convertGlucose(val, unit, 'mg/dL');
      entered = {
        kind: 'scalar',
        value: val,
        unit,
        precision: countDecimalPlaces(row.value),
      };
      canonical = {
        kind: 'scalar',
        value: normalized.exact,
        unit: 'mg/dL',
        precision: 3,
        conversionVersion: CONVERSION_RULE_VERSION,
      };
    } else if (metricId === 'body_temperature') {
      const normalizedUnit =
        row.unit === '°C' ? 'C' : row.unit === '°F' ? 'F' : row.unit;
      if (normalizedUnit !== 'C' && normalizedUnit !== 'F') {
        reject(
          `Unsupported body_temperature unit "${row.unit}". Accepted units are "C" or "F".`,
        );
        continue;
      }
      const val = parseStrictFiniteNumber(row.value);
      if (val === null) {
        reject(`Invalid body_temperature value "${row.value}".`);
        continue;
      }
      const unit = normalizedUnit as TemperatureUnit;
      const normalized = convertTemperature(val, unit, 'C');
      entered = {
        kind: 'scalar',
        value: val,
        unit,
        precision: countDecimalPlaces(row.value),
      };
      canonical = {
        kind: 'scalar',
        value: normalized.exact,
        unit: 'C',
        precision: 2,
        conversionVersion: CONVERSION_RULE_VERSION,
      };
    } else if (metricId === 'sleep') {
      if (row.unit !== 'min') {
        reject(`Unsupported sleep unit "${row.unit}". Expected "min".`);
        continue;
      }
      const mins = parseStrictNonNegativeInt(row.value);
      if (
        mins === null ||
        (timing.kind === 'period' && mins !== timing.durationMinutes)
      ) {
        reject('Sleep value must match period duration_minutes.');
        continue;
      }
      entered = {
        kind: 'sleep_duration',
        durationMinutes: mins,
        reportedNoSleep: mins === 0,
        unit: 'min',
      };
      canonical = { ...entered, conversionVersion: CONVERSION_RULE_VERSION };
    } else {
      // mood
      if (row.unit !== 'ordinal_1_5') {
        reject(`Unsupported mood unit "${row.unit}". Expected "ordinal_1_5".`);
        continue;
      }
      const scoreNum = parseStrictNonNegativeInt(row.value);
      if (
        scoreNum === null ||
        scoreNum < 1 ||
        scoreNum > 5
      ) {
        reject(`Invalid mood score "${row.value}". Expected 1..5.`);
        continue;
      }
      const score = scoreNum as 1 | 2 | 3 | 4 | 5;
      entered = {
        kind: 'mood_ordinal',
        score,
        label: getMoodLabel(score),
        scaleId: MOOD_SCALE_ID,
        scaleVersion: MOOD_SCALE_VERSION,
        questionText: MOOD_QUESTION_TEXT,
      };
      canonical = { ...entered, conversionVersion: CONVERSION_RULE_VERSION };
    }

    const warning = getEntryWarning(entered) ?? undefined;
    const candidate: Observation = {
      observationId: row.observation_id,
      profileId: params.profileId,
      metricId,
      timing,
      recordedAtUtc: params.nowUtc,
      entered,
      canonical,
      method: row.method,
      context: row.context,
      provenance: 'csv_import',
      quality: quality.data,
      qualityNote: null,
      note: row.notes.length > 0 ? row.notes : null,
      sourceDraftId: null,
      importBatchId: params.importBatchId,
      correctionHistory: [],
    };

    // Check against existing records with same observationId
    const existingById = byId.get(candidate.observationId);
    if (existingById) {
      if (isSameObservationContent(existingById, candidate)) {
        counts.duplicate += 1;
        reconciledRows.push({
          rowIndex,
          observationId: candidate.observationId,
          metricId,
          classification: 'duplicate',
          reason: 'Exact match with existing observation ID and content.',
          warning,
          candidate,
          existingObservation: existingById,
        });
      } else {
        counts.conflict += 1;
        reconciledRows.push({
          rowIndex,
          observationId: candidate.observationId,
          metricId,
          classification: 'conflict',
          reason:
            'Same observation ID has different values or details from the existing entry.',
          warning,
          candidate,
          existingObservation: existingById,
        });
      }
      continue;
    }

    // Check for matching value/time under a DIFFERENT observationId -> possible_duplicate
    const matchingOther = [...byId.values()].find((existing) =>
      isMatchingValueAndTime(existing, candidate),
    );
    if (matchingOther) {
      counts.possibleDuplicate += 1;
      reconciledRows.push({
        rowIndex,
        observationId: candidate.observationId,
        metricId,
        classification: 'possible_duplicate',
        reason:
          'The value and observed time match an existing entry with a different ID.',
        warning,
        candidate,
        existingObservation: matchingOther,
      });
      continue;
    }

    counts.valid += 1;
    byId.set(candidate.observationId, candidate);
    reconciledRows.push({
      rowIndex,
      observationId: candidate.observationId,
      metricId,
      classification: 'valid',
      reason: null,
      warning,
      candidate,
      existingObservation: null,
    });
  }

  const summaryParts = [
    `${counts.valid} valid`,
    `${counts.duplicate} duplicate`,
    `${counts.conflict} conflict`,
  ];
  if (counts.possibleDuplicate > 0) {
    summaryParts.push(`${counts.possibleDuplicate} possible duplicate`);
  }
  summaryParts.push(`${counts.rejected} rejected`);

  return {
    validHeader: true,
    headerError: null,
    rows: reconciledRows,
    counts,
    summaryLine: summaryParts.join(' · '),
  };
}

export interface CsvCommitPlanResult {
  ready: boolean;
  error: string | null;
  nextObservations: Observation[] | null;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
}

/**
 * Resolves reviewed CSV rows into a deterministic atomic nextObservations snapshot.
 * - Requires explicit choices for every conflict and possible_duplicate
 * - Requires explicit acknowledgement when any rows are excluded/rejected/skipped
 * - Conflict resolution ('use_imported') replaces the WHOLE observation (e.g. whole BP pair)
 *   and records a CorrectionEntry in correctionHistory.
 */
export function buildCsvCommitPlan(params: {
  preview: CsvReconciliationPreview;
  existingObservations: readonly Observation[];
  conflictChoices: Record<string, CsvConflictChoice>;
  possibleDuplicateChoices: Record<string, CsvPossibleDuplicateChoice>;
  acknowledgedExclusions: boolean;
  confirmedUnusualValues?: boolean;
  nowUtc: string;
}): CsvCommitPlanResult {
  const { preview } = params;
  if (!preview.validHeader) {
    return {
      ready: false,
      error: preview.headerError ?? 'Invalid CSV header.',
      nextObservations: null,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };
  }

  for (const r of preview.rows) {
    if (r.classification === 'conflict' && !params.conflictChoices[r.observationId]) {
      return {
        ready: false,
        error: `Resolve conflict for ${r.observationId} before importing.`,
        nextObservations: null,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      };
    }
    if (
      r.classification === 'possible_duplicate' &&
      !params.possibleDuplicateChoices[r.observationId]
    ) {
      return {
        ready: false,
        error: `Choose Keep separate or Skip for ${r.observationId} before importing.`,
        nextObservations: null,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      };
    }
    const willImport = r.classification === 'valid'
      || (r.classification === 'conflict' && params.conflictChoices[r.observationId] === 'use_imported')
      || (r.classification === 'possible_duplicate' && params.possibleDuplicateChoices[r.observationId] === 'keep_separate');
    if (willImport && r.candidate && getEntryWarning(r.candidate.entered) && !params.confirmedUnusualValues) {
      return {
        ready: false,
        error: `Confirm unusual CSV values before importing row ${r.rowIndex}.`,
        nextObservations: null,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      };
    }
  }

  const hasExclusions =
    preview.counts.duplicate > 0 ||
    preview.counts.rejected > 0 ||
    preview.rows.some(
      (r) =>
        (r.classification === 'conflict' &&
          params.conflictChoices[r.observationId] === 'keep_current') ||
        (r.classification === 'possible_duplicate' &&
          params.possibleDuplicateChoices[r.observationId] === 'skip'),
    );

  if (hasExclusions && !params.acknowledgedExclusions) {
    return {
      ready: false,
      error: 'Acknowledge excluded or skipped rows before committing import.',
      nextObservations: null,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };
  }

  const nextMap = new Map<string, Observation>();
  for (const obs of params.existingObservations) {
    nextMap.set(obs.observationId, obs);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const r of preview.rows) {
    const candidate = r.candidate && getEntryWarning(r.candidate.entered)
      ? { ...r.candidate, qualityNote: ENTRY_CONFIRMED_NOTE }
      : r.candidate;
    if (r.classification === 'valid' && candidate) {
      nextMap.set(candidate.observationId, candidate);
      insertedCount += 1;
    } else if (r.classification === 'duplicate' || r.classification === 'rejected') {
      skippedCount += 1;
    } else if (r.classification === 'possible_duplicate' && candidate) {
      const choice = params.possibleDuplicateChoices[r.observationId];
      if (choice === 'keep_separate') {
        nextMap.set(candidate.observationId, candidate);
        insertedCount += 1;
      } else {
        skippedCount += 1;
      }
    } else if (r.classification === 'conflict' && candidate && r.existingObservation) {
      const choice = params.conflictChoices[r.observationId];
      if (choice === 'use_imported') {
        const prev = r.existingObservation;
        const correction: CorrectionEntry = {
          correctionId: `corr-${prev.observationId}-${prev.correctionHistory.length + 1}`,
          correctedAtUtc: params.nowUtc,
          reason: 'CSV import conflict resolved using imported whole entry',
          previousEntered: prev.entered,
          previousCanonical: prev.canonical,
          previousTiming: prev.timing,
          previousMethod: prev.method,
          previousContext: prev.context,
        };
        const replaced: Observation = {
          ...candidate,
          correctionHistory: [...prev.correctionHistory, correction],
        };
        nextMap.set(replaced.observationId, replaced);
        updatedCount += 1;
      } else {
        skippedCount += 1;
      }
    }
  }

  return {
    ready: true,
    error: null,
    nextObservations: [...nextMap.values()],
    insertedCount,
    updatedCount,
    skippedCount,
  };
}
