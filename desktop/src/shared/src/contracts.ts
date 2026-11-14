import { z } from 'zod';

/**
 * Schema version constants for CrewSignal contracts, scales, and unit rules.
 */
export const CREWSIGNAL_SCHEMA_VERSION = 1 as const;
export const CONVERSION_RULE_VERSION = 'crewsignal-units-v1' as const;
export const MOOD_SCALE_ID = 'crewsignal-mood-v1' as const;
export const MOOD_SCALE_VERSION = 1 as const;
export const MOOD_QUESTION_TEXT = 'How is your mood right now?' as const;
export const RULE_VERSION_SLEEP_ACTION = 'crewsignal-sleep-guidance-v1' as const;

export const MetricIdSchema = z.enum([
  'heart_rate',
  'blood_pressure',
  'blood_glucose',
  'body_temperature',
  'sleep',
  'mood',
]);
export type MetricId = z.infer<typeof MetricIdSchema>;

export const BodySystemIdSchema = z.enum([
  'sleep_cognition',
  'cardiovascular',
  'musculoskeletal',
  'immune_context',
  'nutrition_metabolism',
]);
export type BodySystemId = z.infer<typeof BodySystemIdSchema>;

export const ProfileModeSchema = z.enum(['demo', 'personal']);
export type ProfileMode = z.infer<typeof ProfileModeSchema>;

export const AppearancePreferenceSchema = z.enum(['system', 'light', 'dark']);
export type AppearancePreference = z.infer<typeof AppearancePreferenceSchema>;

export const GlucoseUnitSchema = z.enum(['mg/dL', 'mmol/L']);
export type GlucoseUnit = z.infer<typeof GlucoseUnitSchema>;

export const TemperatureUnitSchema = z.enum(['C', 'F']);
export type TemperatureUnit = z.infer<typeof TemperatureUnitSchema>;

export const SleepTypeSchema = z.enum(['main_sleep', 'nap', 'other']);
export type SleepType = z.infer<typeof SleepTypeSchema>;

export const ObservationProvenanceSchema = z.enum([
  'manual',
  'self_report',
  'csv_import',
  'backup_restore',
]);
export type ObservationProvenance = z.infer<typeof ObservationProvenanceSchema>;

export const ObservationQualitySchema = z.enum(['valid', 'questionable']);
export type ObservationQuality = z.infer<typeof ObservationQualitySchema>;
export const NEEDS_RECHECK_LABEL = 'Needs recheck';
export const NEEDS_RECHECK_HELP =
  'Use this if you doubt the reading. It stays in your log and is excluded from comparisons, references, and personalized guidance.';

export const UtcIsoStringSchema = z
  .string()
  .refine((val) => {
    if (!val.endsWith('Z') && !val.endsWith('+00:00')) return false;
    const ms = Date.parse(val);
    return Number.isFinite(ms);
  }, 'Must be a valid UTC ISO-8601 timestamp ending in Z or +00:00');

export const InstantTimingSchema = z.object({
  kind: z.literal('instant'),
  observedAtUtc: UtcIsoStringSchema,
  missionEpochUtc: UtcIsoStringSchema,
  missionDay: z.number().int().min(1),
  missionTimeLabel: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  originalTimezone: z.string().min(1),
  precision: z.enum(['minute', 'second', 'day']),
});
export type InstantTiming = z.infer<typeof InstantTimingSchema>;

export const PeriodTimingSchema = z.object({
  kind: z.literal('period'),
  sleepType: SleepTypeSchema,
  endingMissionDay: z.number().int().min(1),
  durationMinutes: z.number().int().min(0),
  reportedAtUtc: UtcIsoStringSchema,
  reportedMissionDay: z.number().int().min(1),
  reportedTimeLabel: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  missionEpochUtc: UtcIsoStringSchema,
  originalTimezone: z.string().min(1),
  precision: z.enum(['estimated_minutes', 'exact_window', 'minute']),
  windowStartUtc: UtcIsoStringSchema.nullable(),
  windowEndUtc: UtcIsoStringSchema.nullable(),
  windowStartMissionDay: z.number().int().min(1).nullable(),
  windowStartTimeLabel: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  windowEndMissionDay: z.number().int().min(1).nullable(),
  windowEndTimeLabel: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});
export type PeriodTiming = z.infer<typeof PeriodTimingSchema>;

/**
 * Discriminated union: Instant observations require observedAtUtc;
 * Period observations (sleep) store endingMissionDay, durationMinutes,
 * reportedAtUtc, and nullable exact window endpoints without fabricating an instant.
 */
export const ObservationTimingSchema = z.discriminatedUnion('kind', [
  InstantTimingSchema,
  PeriodTimingSchema,
]);
export type ObservationTiming = z.infer<typeof ObservationTimingSchema>;

export const MoodLabelSchema = z.enum([
  'Very low',
  'Low',
  'Neutral',
  'Good',
  'Very good',
]);
export type MoodLabel = z.infer<typeof MoodLabelSchema>;

export const EnteredScalarValueSchema = z.object({
  kind: z.literal('scalar'),
  value: z.number().finite(),
  unit: z.string().min(1),
  precision: z.number().int().min(0).max(6),
});

export const EnteredBloodPressureValueSchema = z.object({
  kind: z.literal('blood_pressure'),
  systolic: z.number().finite().positive(),
  diastolic: z.number().finite().positive(),
  unit: z.literal('mmHg'),
  precision: z.number().int().min(0).max(2),
});

export const EnteredSleepDurationValueSchema = z.object({
  kind: z.literal('sleep_duration'),
  durationMinutes: z.number().int().min(0),
  reportedNoSleep: z.boolean(),
  unit: z.literal('min'),
});

export const EnteredMoodOrdinalValueSchema = z.object({
  kind: z.literal('mood_ordinal'),
  score: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  label: MoodLabelSchema,
  scaleId: z.literal(MOOD_SCALE_ID),
  scaleVersion: z.literal(MOOD_SCALE_VERSION),
  questionText: z.literal(MOOD_QUESTION_TEXT),
});

export const EnteredObservationValueSchema = z.discriminatedUnion('kind', [
  EnteredScalarValueSchema,
  EnteredBloodPressureValueSchema,
  EnteredSleepDurationValueSchema,
  EnteredMoodOrdinalValueSchema,
]);
export type EnteredObservationValue = z.infer<typeof EnteredObservationValueSchema>;

export const CanonicalScalarValueSchema = EnteredScalarValueSchema.extend({
  conversionVersion: z.string().min(1),
});
export const CanonicalBloodPressureValueSchema = EnteredBloodPressureValueSchema.extend({
  conversionVersion: z.string().min(1),
});
export const CanonicalSleepDurationValueSchema = EnteredSleepDurationValueSchema.extend({
  conversionVersion: z.string().min(1),
});
export const CanonicalMoodOrdinalValueSchema = EnteredMoodOrdinalValueSchema.extend({
  conversionVersion: z.string().min(1),
});

export const CanonicalObservationValueSchema = z.discriminatedUnion('kind', [
  CanonicalScalarValueSchema,
  CanonicalBloodPressureValueSchema,
  CanonicalSleepDurationValueSchema,
  CanonicalMoodOrdinalValueSchema,
]);
export type CanonicalObservationValue = z.infer<typeof CanonicalObservationValueSchema>;

export const CorrectionEntrySchema = z.object({
  correctionId: z.string().min(1),
  correctedAtUtc: UtcIsoStringSchema,
  reason: z.string().min(1),
  previousEntered: EnteredObservationValueSchema,
  previousCanonical: CanonicalObservationValueSchema,
  previousTiming: ObservationTimingSchema,
  previousMethod: z.string().min(1),
  previousContext: z.string().min(1),
});
export type CorrectionEntry = z.infer<typeof CorrectionEntrySchema>;

export const ObservationSchema = z.object({
  observationId: z.string().min(1),
  profileId: z.string().min(1),
  metricId: MetricIdSchema,
  timing: ObservationTimingSchema,
  recordedAtUtc: UtcIsoStringSchema,
  entered: EnteredObservationValueSchema,
  canonical: CanonicalObservationValueSchema,
  method: z.string().min(1),
  context: z.string().min(1),
  provenance: ObservationProvenanceSchema,
  quality: ObservationQualitySchema,
  qualityNote: z.string().nullable(),
  note: z.string().nullable(),
  sourceDraftId: z.string().nullable(),
  importBatchId: z.string().nullable(),
  correctionHistory: z.array(CorrectionEntrySchema),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const MetricScheduleSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.number().positive(),
  configuredAtUtc: UtcIsoStringSchema,
});
export type MetricSchedule = z.infer<typeof MetricScheduleSchema>;

const SourcedMeasurementTextSchema = z.object({ text: z.string().min(1), sourceId: z.string().min(1) });

export const MetricDefinitionSchema = z.object({
  id: MetricIdSchema,
  name: z.string().min(1),
  shortLabel: z.string().min(1),
  bodySystem: BodySystemIdSchema,
  canonicalUnit: z.string().min(1),
  acceptedUnits: z.array(z.string().min(1)).min(1),
  timingMode: z.enum(['instant', 'period']),
  entryMode: z.enum(['manual', 'self_report']),
  methodOptions: z.array(z.string().min(1)).min(1),
  contextOptions: z.array(z.string().min(1)).min(1),
  purpose: z.string().min(1),
  whyItMatters: SourcedMeasurementTextSchema,
  spaceflightContext: SourcedMeasurementTextSchema,
  howToMeasure: SourcedMeasurementTextSchema,
  instructions: z.array(z.string().min(1)).min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
  supportsUnavailableInstrument: z.boolean(),
  optionalSchedulingSupported: z.boolean(),
});
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

export const DraftRawFieldsSchema = z.object({
  primary: z.string(),
  secondary: z.string().optional(),
  hours: z.string().optional(),
  minutes: z.string().optional(),
  moodScore: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .nullable(),
  sleepType: SleepTypeSchema.optional(),
  endingMissionDay: z.string().optional(),
  hasSleepWindow: z.boolean().optional(),
  windowStartDay: z.string().optional(),
  windowStartTime: z.string().optional(),
  windowEndDay: z.string().optional(),
  windowEndTime: z.string().optional(),
});
export type DraftRawFields = z.infer<typeof DraftRawFieldsSchema>;

export const DraftValidationStateSchema = z.object({
  valid: z.boolean(),
  errors: z.record(z.string(), z.string()),
  firstInvalidField: z.string().nullable(),
  announcement: z.string().nullable(),
});
export type DraftValidationState = z.infer<typeof DraftValidationStateSchema>;

export const CheckInDraftSchema = z.object({
  draftId: z.string().min(1),
  profileId: z.string().min(1),
  mode: ProfileModeSchema,
  metricId: MetricIdSchema,
  stage: z.enum(['record', 'review']),
  rawFields: DraftRawFieldsSchema,
  selectedUnit: z.string().min(1),
  rawObservedTimeText: z.string(),
  observedMissionDay: z.number().int().min(1).nullable(),
  observedTimeHHMM: z.string().nullable(),
  observedAtUtc: UtcIsoStringSchema.nullable(),
  missionEpochUtc: UtcIsoStringSchema,
  originalTimezone: z.string().min(1),
  method: z.string().min(1),
  context: z.string().min(1),
  provenance: z.enum(['manual', 'self_report']),
  quality: ObservationQualitySchema.optional(),
  note: z.string(),
  validationState: DraftValidationStateSchema,
  normalizedCandidate: CanonicalObservationValueSchema.nullable(),
  conversionVersion: z.string().min(1),
  retentionStatus: z.enum(['retained', 'memory_only', 'failed']),
  commitStatus: z.enum([
    'uncommitted',
    'pending',
    'unconfirmed',
    'committed',
    'failed',
  ]),
  committedObservationId: z.string().nullable(),
  createdAtUtc: UtcIsoStringSchema,
  updatedAtUtc: UtcIsoStringSchema,
});
export type CheckInDraft = z.infer<typeof CheckInDraftSchema>;

export const CheckInSchema = z.object({
  checkInId: z.string().min(1),
  profileId: z.string().min(1),
  status: z.enum(['in_progress', 'saved', 'skipped']),
  stage: z.enum(['choose', 'record', 'review', 'saved', 'skipped']),
  activeDraftId: z.string().nullable(),
  committedObservationIds: z.array(z.string()),
  eventIds: z.array(z.string()),
  startedAtUtc: UtcIsoStringSchema,
  completedAtUtc: UtcIsoStringSchema.nullable(),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

export const CheckInEventSchema = z.object({
  eventId: z.string().min(1),
  profileId: z.string().min(1),
  eventType: z.enum(['measurement_unavailable', 'check_in_skipped']),
  metricId: MetricIdSchema.nullable(),
  reason: z.string().nullable(),
  attemptedAtUtc: UtcIsoStringSchema,
  attemptedMissionDay: z.number().int().min(1),
  attemptedTimeLabel: z.string().regex(/^\d{2}:\d{2}$/),
  missionEpochUtc: UtcIsoStringSchema,
  keptDraftId: z.string().nullable(),
  committedCountInSession: z.number().int().min(0),
  recordedAtUtc: UtcIsoStringSchema,
});
export type CheckInEvent = z.infer<typeof CheckInEventSchema>;

export const ReferenceValueSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('scalar'),
    value: z.number().finite(),
  }),
  z.object({
    kind: z.literal('blood_pressure'),
    systolic: z.number().finite().positive(),
    diastolic: z.number().finite().positive(),
  }),
  z.object({
    kind: z.literal('sleep_duration'),
    durationMinutes: z.number().int().min(0),
  }),
]);
export type ReferenceValue = z.infer<typeof ReferenceValueSchema>;

export const ManualReferenceCaptureSchema = z.object({
  kind: z.literal('explicit_manual_v1'),
  primaryText: z.string(), secondaryText: z.string().optional(),
  unit: z.string(), method: z.string(), context: z.string(),
  confirmedPreviousReferenceId: z.string().optional(),
});
export type ManualReferenceCapture = z.infer<typeof ManualReferenceCaptureSchema>;

export const PersonalReferenceSchema = z.object({
  manualCapture: ManualReferenceCaptureSchema.optional(),
  referenceId: z.string().min(1),
  profileId: z.string().min(1),
  metricId: MetricIdSchema,
  version: z.number().int().min(1),
  provenance: z.enum([
    'entered_preflight',
    'seven_day_fallback_median',
    'user_updated',
  ]),
  method: z.string().min(1),
  context: z.string().min(1),
  unit: z.string().min(1),
  value: ReferenceValueSchema.nullable(),
  sampleCount: z.number().int().min(0),
  distinctObservedDays: z.number().int().min(0),
  selectedObservationIds: z.array(z.string()),
  ambiguousDays: z.array(z.number().int().min(1)),
  status: z.enum(['active', 'superseded', 'unavailable']),
  locked: z.boolean(),
  unavailableReason: z.string().nullable(),
  createdAtUtc: UtcIsoStringSchema,
  label: z.string().min(1),
});
export type PersonalReference = z.infer<typeof PersonalReferenceSchema>;

export const InsightSchema = z.object({
  insightId: z.string().min(1),
  profileId: z.string().min(1),
  metricId: MetricIdSchema,
  observationId: z.string().min(1),
  referenceId: z.string().nullable(),
  referenceVersion: z.number().int().min(1).nullable(),
  ruleId: z.string().min(1),
  ruleVersion: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  sourceVersions: z.record(z.string(), z.string()),
  comparisonAvailable: z.boolean(),
  unavailableReason: z.string().nullable(),
  summary: z.string().min(1),
  differenceText: z.string().nullable(),
  deltaNumeric: z.number().nullable(),
  deltaUnit: z.string().nullable(),
  status: z.enum(['active', 'reviewed']),
  reviewedAtUtc: UtcIsoStringSchema.nullable(),
  createdAtUtc: UtcIsoStringSchema,
});
export type Insight = z.infer<typeof InsightSchema>;

export const ActionContentSchema = z.object({
  actionId: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(['educational', 'data_quality', 'clinical_procedure']),
  badgeLabel: z.string().min(1),
  enabled: z.boolean(),
  disabledReason: z.string().nullable(),
  applicability: z.string().min(1),
  limitation: z.string().min(1),
  triggerSummary: z.string().min(1),
  steps: z.array(z.string().min(1)),
  sourceIds: z.array(z.string().min(1)),
  sourceVersion: z.string().min(1),
  ruleId: z.string().min(1),
  ruleVersion: z.string().min(1),
  reviewStatus: z.enum([
    'reviewed_educational',
    'requires_mission_review',
    'disabled_unreviewed',
  ]),
});
export type ActionContent = z.infer<typeof ActionContentSchema>;

export const EvidenceReferenceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  checkedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUpdatedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  summaryVersion: z.string().min(1),
  summaryText: z.string().min(1),
  limitations: z.string().min(1),
  cachedAvailable: z.boolean(),
  offlineAccessNote: z.string().min(1),
  knownUpdateAvailableVersion: z.string().nullable(),
  knownUpdateCheckedDate: z.string().nullable(),
  relatedMetricIds: z.array(MetricIdSchema),
  relatedActionIds: z.array(z.string()),
});
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

export const ProfileConfigSchema = z.object({
  profileId: z.string().min(1),
  label: z.string().min(1),
  alias: z.string().nullable(),
  mode: ProfileModeSchema,
  scenarioId: z.string().nullable(),
  missionName: z.string().min(1),
  missionEpochUtc: UtcIsoStringSchema,
  displayTimezone: z.string().min(1),
  snapshotUtc: UtcIsoStringSchema.nullable(),
  createdAtUtc: UtcIsoStringSchema,
  clockVersion: z.number().int().min(1),
  schedules: z.object({
    heart_rate: MetricScheduleSchema.nullable(),
    blood_pressure: MetricScheduleSchema.nullable(),
    blood_glucose: MetricScheduleSchema.nullable(),
    body_temperature: MetricScheduleSchema.nullable(),
    sleep: MetricScheduleSchema.nullable(),
    mood: MetricScheduleSchema.nullable(),
  }),
});
export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

export const AppPreferencesSchema = z.object({
  checkInNotifications: z.boolean().optional(),
  appearance: AppearancePreferenceSchema,
  activeProfileId: z.string().min(1),
  displayUnits: z.object({
    blood_glucose: GlucoseUnitSchema,
    body_temperature: TemperatureUnitSchema,
  }),
  helpMode: z.enum(['unconfigured', 'configured_fixture']),
  persistentStorageRequested: z.boolean().optional(),
  persistentStorageGranted: z.boolean().optional(),
});
export type AppPreferences = z.infer<typeof AppPreferencesSchema>;

export const ReportEvidenceCitationSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  summaryVersion: z.string().min(1),
  checkedDate: z.string().min(1),
  url: z.string().url(),
});

export const ReportBundleSchema = z.object({
  kind: z.literal('crewsignal-report'),
  schemaVersion: z.literal(CREWSIGNAL_SCHEMA_VERSION),
  generatedAtUtc: UtcIsoStringSchema,
  mode: ProfileModeSchema,
  profileId: z.string().min(1),
  profileLabel: z.string().min(1),
  missionName: z.string().min(1),
  missionEpochUtc: UtcIsoStringSchema,
  missionDayRange: z.object({
    startDay: z.number().int().min(1),
    endDay: z.number().int().min(1),
  }),
  includedMetricIds: z.array(MetricIdSchema),
  excludedMetricIds: z.array(MetricIdSchema),
  includeNotes: z.boolean(),
  totalObservations: z.number().int().min(0),
  includedTypesCount: z.number().int().min(0),
  countsByMetric: z
    .object({
      heart_rate: z.number().int().min(0).optional(),
      blood_pressure: z.number().int().min(0).optional(),
      blood_glucose: z.number().int().min(0).optional(),
      body_temperature: z.number().int().min(0).optional(),
      sleep: z.number().int().min(0).optional(),
      mood: z.number().int().min(0).optional(),
    })
    .optional(),
  observations: z.array(ObservationSchema),
  references: z.array(PersonalReferenceSchema),
  evidence: z.array(ReportEvidenceCitationSchema),
  disclaimers: z.array(z.string().min(1)),
});
export type ReportBundle = z.infer<typeof ReportBundleSchema>;

export const BackupBundleSchema = z.object({
  kind: z.literal('crewsignal-backup'),
  schemaVersion: z.literal(CREWSIGNAL_SCHEMA_VERSION),
  exportedAtUtc: UtcIsoStringSchema,
  confirmedFullProfileData: z.literal(true),
  profile: ProfileConfigSchema,
  preferences: AppPreferencesSchema,
  observations: z.array(ObservationSchema),
  checkInEvents: z.array(CheckInEventSchema),
  references: z.array(PersonalReferenceSchema),
  insights: z.array(InsightSchema),
  /**
   * Optional platform history carried by full backups so a restore keeps the
   * reviewed actions, mission-clock changes and correction trail. Older backups
   * without it stay valid; records are passed through to the restoring store.
   */
  history: z
    .object({
      actionReviews: z.array(z.record(z.string(), z.unknown())).default([]),
      clockHistory: z.array(z.record(z.string(), z.unknown())).default([]),
      corrections: z.array(z.record(z.string(), z.unknown())).default([]),
    })
    .optional(),
  summaryCounts: z.object({
    observationCount: z.number().int().min(0),
    moodCount: z.number().int().min(0),
    noteCount: z.number().int().min(0),
    eventCount: z.number().int().min(0),
    referenceCount: z.number().int().min(0),
  }),
});
export type BackupBundle = z.infer<typeof BackupBundleSchema>;

export const DraftRecoveryBundleSchema = z.object({
  kind: z.literal('crewsignal-draft-recovery'),
  schemaVersion: z.literal(CREWSIGNAL_SCHEMA_VERSION),
  exportedAtUtc: UtcIsoStringSchema,
  uncommitted: z.literal(true),
  profileId: z.string().min(1),
  profileLabel: z.string().min(1),
  mode: ProfileModeSchema,
  missionEpochUtc: UtcIsoStringSchema,
  includeNotes: z.boolean(),
  draft: CheckInDraftSchema,
});
export type DraftRecoveryBundle = z.infer<typeof DraftRecoveryBundleSchema>;

export const HelpProcedureCardSchema = z.object({
  mode: z.enum(['unconfigured', 'configured_fixture']),
  statusTitle: z.string().min(1),
  fixtureBanner: z.string().nullable(),
  versionLabel: z.string().nullable(),
  cachedAvailable: z.boolean(),
  body: z.string().min(1),
  contactRoute: z.string().min(1).optional(),
  steps: z.array(z.string().min(1)),
  limitation: z.string().min(1),
  offlineFacts: z.array(z.string().min(1)),
});
export type HelpProcedureCard = z.infer<typeof HelpProcedureCardSchema>;

export const BodySystemDefinitionSchema = z.object({
  id: BodySystemIdSchema,
  name: z.string().min(1),
  anchorType: z.enum(['head', 'chest', 'limb', 'whole_body']),
  coverageKind: z.enum([
    'self_report',
    'manual_observation',
    'context_only',
    'not_assessed',
  ]),
  coverageLabel: z.string().min(1),
  metricIds: z.array(MetricIdSchema),
  summary: z.string().min(1),
  limitation: z.string().min(1),
});
export type BodySystemDefinition = z.infer<typeof BodySystemDefinitionSchema>;
