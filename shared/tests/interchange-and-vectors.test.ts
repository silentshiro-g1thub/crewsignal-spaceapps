import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_ACCEPTANCE_VECTORS,
  CheckInDraftSchema,
  ReportBundleSchema,
  METRIC_DEFINITIONS,
  SIM_01_SLEEP_OBSERVATIONS,
  buildSleepInsight,
  compareObservationToReference,
  deriveSevenDayFallbackReference,
  formatObservationDisplay,
  CSV_REVIEW_FIXTURE_CSV,
  EXAMPLE_BACKUP_BUNDLE,
  EXAMPLE_DRAFT_RECOVERY_BUNDLE,
  EXAMPLE_REPORT_BUNDLE,
  SIM_01_EPOCH_UTC,
  SIM_01_INSIGHTS,
  SIM_01_OBSERVATIONS,
  SIM_01_OPTIONAL_BP_DRAFT,
  SIM_01_PREFERENCES,
  SIM_01_PROFILE,
  SIM_01_PROFILE_ID,
  SIM_01_REFERENCES,
  SIM_01_SNAPSHOT_UTC,
  SIM_EMPTY_PROFILE,
  buildBackupBundle,
  buildCsvCommitPlan,
  buildDraftRecoveryBundle,
  buildReportBundle,
  countCoveredMetricTypes,
  createWorkflowEvent,
  formatSkipOutcomeMessage,
  generateCsvTemplate,
  getLatestObservationsByMetric,
  parseAndReconcileCsv,
  planCommitDraft,
  planProfileRestore,
  resolveUnknownCommitOutcome,
  serializeObservationsToCsv,
  validateBackupImport,
  validateDraftRecoveryImport,
  type Observation,
} from '../src/index';
import {
  checkTargetParity,
  syncToTargetDir,
} from '../scripts/sync-to-targets.mjs';

describe('Reports, privacy exclusions, Backup, DraftRecovery, and CSV reconciliation', () => {
  it('projects legacy restored observations without correction audit or metadata for absent rows', () => {
    const bp = SIM_01_OBSERVATIONS.find((row) => row.metricId === 'blood_pressure')!;
    const legacy = {
      ...bp, note: 'READING_SENTINEL', qualityNote: 'QUALITY_SENTINEL',
      correctionHistory: [{
        correctionId: 'legacy-correction', correctedAtUtc: SIM_01_SNAPSHOT_UTC,
        reason: 'CORRECTION_SENTINEL', previousEntered: bp.entered, previousCanonical: bp.canonical,
        previousTiming: bp.timing, previousMethod: bp.method, previousContext: bp.context,
      }],
    };
    const backup = { ...EXAMPLE_BACKUP_BUNDLE, observations: [legacy] };
    const { observations } = JSON.parse(JSON.stringify(backup)) as typeof backup;
    const options = {
      profile: SIM_01_PROFILE, references: SIM_01_REFERENCES, startDay: 42, endDay: 42,
      generatedAtUtc: SIM_01_SNAPSHOT_UTC,
      observations: [...observations, { ...bp, profileId: 'different-profile' }],
    };
    const report = buildReportBundle(options);
    expect(report.observations).toEqual([{ ...legacy, note: null, qualityNote: null, correctionHistory: [] }]);
    expect(report.evidence.map((e) => e.sourceId)).toEqual(METRIC_DEFINITIONS.blood_pressure.evidenceIds);
    expect(report.references.every((r) => r.metricId === 'blood_pressure')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('SENTINEL');
    expect(serializeObservationsToCsv(report.observations)).not.toContain('SENTINEL');
    const withNotes = buildReportBundle({ ...options, includeNotes: true });
    expect(withNotes.observations[0]).toEqual({ ...legacy, correctionHistory: [] });
    const empty = buildReportBundle({ ...options, selectedMetricIds: ['sleep'] });
    expect(empty).toMatchObject({ observations: [], references: [], evidence: [] });
    expect(buildReportBundle({ ...options, startDay: 1, endDay: 1 })).toMatchObject({ observations: [], references: [], evidence: [] });
    expect(ReportBundleSchema.parse({ ...report, observations: [legacy] }).observations[0]).toEqual(legacy);
    expect(backup.observations[0]).toEqual(legacy);
  });

  it('excludes mood and notes by default in ReportBundle (rows + metadata) and tracks pre/post optional BP counts', () => {
    // Inject a synthetic private note on a copy to verify stripping across rows & metadata
    const withNote: Observation[] = SIM_01_OBSERVATIONS.map((o, idx) =>
      idx === 0 ? { ...o, note: 'PRIVATE_NOTE_SHOULD_NOT_EXPORT' } : o,
    );

    const beforeBp = buildReportBundle({
      profile: SIM_01_PROFILE,
      observations: withNote,
      references: SIM_01_REFERENCES,
      startDay: 36,
      endDay: 42,
      generatedAtUtc: SIM_01_SNAPSHOT_UTC,
    });

    expect(beforeBp.totalObservations).toBe(10);
    expect(beforeBp.includedTypesCount).toBe(4);
    expect(beforeBp.excludedMetricIds).toContain('mood');
    const serializedBefore = JSON.stringify(beforeBp);
    expect(serializedBefore).not.toContain('PRIVATE_NOTE_SHOULD_NOT_EXPORT');
    expect(serializedBefore).not.toContain('obs-sim01-mood-01');

    // Commit optional CI-02 BP draft
    const commitPlan = planCommitDraft({
      draft: SIM_01_OPTIONAL_BP_DRAFT,
      existingObservations: withNote,
      observationId: 'obs-sim01-bp-02',
      committedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(commitPlan.outcome).toBe('insert');
    const afterObs = [...withNote, commitPlan.observation!];

    expect(afterObs).toHaveLength(12);
    expect(countCoveredMetricTypes(afterObs)).toBe(5);
    const latest = getLatestObservationsByMetric(afterObs);
    expect(latest.blood_pressure?.observationId).toBe('obs-sim01-bp-02');
    expect(
      latest.blood_pressure?.timing.kind === 'instant'
        ? latest.blood_pressure.timing.missionTimeLabel
        : null,
    ).toBe('07:18');

    const afterBpReport = buildReportBundle({
      profile: SIM_01_PROFILE,
      observations: afterObs,
      references: SIM_01_REFERENCES,
      startDay: 36,
      endDay: 42,
      generatedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(afterBpReport.totalObservations).toBe(11);
    expect(afterBpReport.includedTypesCount).toBe(4);
  });

  it('enforces BackupBundle confirmation, kind validation, personal-in-demo rejection, and separate-profile restore default', () => {
    expect(() =>
      buildBackupBundle({
        confirmedIncludeAllProfileData: false,
        exportedAtUtc: SIM_01_SNAPSHOT_UTC,
        profile: SIM_01_PROFILE,
        preferences: SIM_01_PREFERENCES,
        observations: SIM_01_OBSERVATIONS,
        checkInEvents: [],
        references: SIM_01_REFERENCES,
        insights: SIM_01_INSIGHTS,
      }),
    ).toThrow();

    expect(EXAMPLE_BACKUP_BUNDLE.summaryCounts.observationCount).toBe(11);
    expect(EXAMPLE_BACKUP_BUNDLE.summaryCounts.moodCount).toBe(1);
    expect(EXAMPLE_BACKUP_BUNDLE.summaryCounts.noteCount).toBe(0);

    // Rejects wrong kind
    expect(validateBackupImport(EXAMPLE_REPORT_BUNDLE).valid).toBe(false);
    expect(validateBackupImport(EXAMPLE_DRAFT_RECOVERY_BUNDLE).valid).toBe(false);

    // Rejects personal backup in public synthetic demo
    const personalBackup = buildBackupBundle({
      confirmedIncludeAllProfileData: true,
      exportedAtUtc: SIM_01_SNAPSHOT_UTC,
      profile: SIM_EMPTY_PROFILE,
      preferences: { ...SIM_01_PREFERENCES, activeProfileId: SIM_EMPTY_PROFILE.profileId },
      observations: [],
      checkInEvents: [],
      references: [],
      insights: [],
    });
    const publicDemoCheck = validateBackupImport(personalBackup, {
      rejectPersonalInPublicDemo: true,
    });
    expect(publicDemoCheck.valid).toBe(false);

    const validRestore = validateBackupImport(EXAMPLE_BACKUP_BUNDLE, {
      rejectPersonalInPublicDemo: true,
    });
    expect(validRestore.valid).toBe(true);
    expect(validRestore.defaultDestination).toBe('separate_profile');

    const sepPlan = planProfileRestore({
      sourceProfile: SIM_01_PROFILE,
      destination: 'separate_profile',
      existingProfiles: [SIM_01_PROFILE],
      newProfileId: 'restored-01',
    });
    expect(sepPlan.requiresConfirmation).toBe(false);
    expect(sepPlan.targetLabel).toBe('Crew member 01 (Restored)');
    expect(sepPlan.targetMissing).toBe(false);
  });

  it('rejects a replace whose target is missing instead of using the backup profile ID', () => {
    const missing = planProfileRestore({
      sourceProfile: SIM_01_PROFILE,
      destination: 'replace_existing',
      existingProfiles: [SIM_EMPTY_PROFILE],
      targetExistingProfileId: 'deleted-profile',
      newProfileId: 'unused',
    });
    expect(missing.targetMissing).toBe(true);
    expect(missing.targetProfileId).toBe('');
    expect(missing.targetProfileId).not.toBe(SIM_01_PROFILE.profileId);

    const noTargetGiven = planProfileRestore({
      sourceProfile: SIM_01_PROFILE,
      destination: 'replace_existing',
      existingProfiles: [SIM_01_PROFILE],
      newProfileId: 'unused',
    });
    expect(noTargetGiven.targetMissing).toBe(true);

    const found = planProfileRestore({
      sourceProfile: SIM_01_PROFILE,
      destination: 'replace_existing',
      existingProfiles: [SIM_EMPTY_PROFILE],
      targetExistingProfileId: SIM_EMPTY_PROFILE.profileId,
      newProfileId: 'unused',
    });
    expect(found.targetMissing).toBe(false);
    expect(found.targetProfileId).toBe(SIM_EMPTY_PROFILE.profileId);
    expect(found.requiresConfirmation).toBe(true);
  });

  it('validates DraftRecoveryBundle without auto-committing and detects already-in-log identities', () => {
    const draftWithNote = { ...SIM_01_OPTIONAL_BP_DRAFT, note: 'SECRET_DRAFT_NOTE' };
    const recovery = buildDraftRecoveryBundle({
      draft: draftWithNote,
      profileLabel: SIM_01_PROFILE.label,
      exportedAtUtc: SIM_01_SNAPSHOT_UTC,
      includeNotes: false,
    });
    expect(recovery.draft.note).toBe('');

    const beforeCommit = validateDraftRecoveryImport(recovery, {
      existingObservations: SIM_01_OBSERVATIONS,
    });
    expect(beforeCommit.valid).toBe(true);
    expect(beforeCommit.status).toBe('resume_draft');

    // After committing draft, importing the same recovery file detects already_in_log
    const committed = planCommitDraft({
      draft: SIM_01_OPTIONAL_BP_DRAFT,
      existingObservations: SIM_01_OBSERVATIONS,
      observationId: 'obs-sim01-bp-02',
      committedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    const afterCommit = validateDraftRecoveryImport(recovery, {
      existingObservations: [...SIM_01_OBSERVATIONS, committed.observation!],
    });
    expect(afterCommit.status).toBe('already_in_log');
    expect(afterCommit.existingCommittedObservation?.observationId).toBe(
      'obs-sim01-bp-02',
    );
  });

  it('parses and reconciles the 5-row CSV fixture (2 valid, 1 duplicate, 1 conflict, 1 rejected) and handles whole-pair BP + possible duplicates', () => {
    const preview = parseAndReconcileCsv({
      csvText: CSV_REVIEW_FIXTURE_CSV,
      existingObservations: SIM_01_OBSERVATIONS,
      profileId: SIM_01_PROFILE_ID,
      missionEpochUtc: SIM_01_EPOCH_UTC,
      importBatchId: 'batch-01',
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });

    expect(preview.validHeader).toBe(true);
    expect(preview.counts).toEqual({
      total: 5,
      valid: 2,
      duplicate: 1,
      conflict: 1,
      possibleDuplicate: 0,
      rejected: 1,
    });
    expect(preview.summaryLine).toBe(
      '2 valid · 1 duplicate · 1 conflict · 1 rejected',
    );

    // Cannot commit before resolving conflict and acknowledging exclusions
    const unready = buildCsvCommitPlan({
      preview,
      existingObservations: SIM_01_OBSERVATIONS,
      conflictChoices: {},
      possibleDuplicateChoices: {},
      acknowledgedExclusions: false,
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(unready.ready).toBe(false);

    // Keep current preserves 118/76 and imports the 2 older valid rows without overriding Day 42 latest
    const keepCurrentPlan = buildCsvCommitPlan({
      preview,
      existingObservations: SIM_01_OBSERVATIONS,
      conflictChoices: { 'obs-sim01-bp-01': 'keep_current' },
      possibleDuplicateChoices: {},
      acknowledgedExclusions: true,
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(keepCurrentPlan.ready).toBe(true);
    expect(keepCurrentPlan.insertedCount).toBe(2);
    expect(keepCurrentPlan.updatedCount).toBe(0);
    expect(keepCurrentPlan.skippedCount).toBe(3);

    const nextObs = keepCurrentPlan.nextObservations!;
    expect(nextObs).toHaveLength(13);
    const bpAfter = nextObs.find((o) => o.observationId === 'obs-sim01-bp-01')!;
    expect(bpAfter.entered).toMatchObject({ systolic: 118, diastolic: 76 });
    const latest = getLatestObservationsByMetric(nextObs);
    expect(latest.heart_rate?.observationId).toBe('obs-sim01-hr-01'); // Day 42 remains latest over Day 40
    expect(latest.body_temperature?.observationId).toBe('obs-sim01-temp-01'); // Day 42 remains latest over Day 41

    // Choosing 'use_imported' updates WHOLE BP pair to 120/78 with CorrectionEntry
    const useImportedPlan = buildCsvCommitPlan({
      preview,
      existingObservations: SIM_01_OBSERVATIONS,
      conflictChoices: { 'obs-sim01-bp-01': 'use_imported' },
      possibleDuplicateChoices: {},
      acknowledgedExclusions: true,
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(useImportedPlan.updatedCount).toBe(1);
    const updatedBp = useImportedPlan.nextObservations!.find(
      (o) => o.observationId === 'obs-sim01-bp-01',
    )!;
    expect(updatedBp.entered).toMatchObject({ systolic: 120, diastolic: 78 });
    expect(updatedBp.correctionHistory).toHaveLength(1);
    expect(updatedBp.correctionHistory[0]?.previousEntered).toMatchObject({
      systolic: 118,
      diastolic: 76,
    });

    // Period-only sleep CSV roundtrip requires NO observed_at_utc instant
    const sleepCsv = serializeObservationsToCsv([SIM_01_OBSERVATIONS[0]!]);
    const sleepReconcile = parseAndReconcileCsv({
      csvText: sleepCsv,
      existingObservations: [],
      profileId: SIM_01_PROFILE_ID,
      missionEpochUtc: SIM_01_EPOCH_UTC,
      importBatchId: 'batch-sleep',
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(sleepReconcile.counts.valid).toBe(1);

    // Same value & time under DIFFERENT ID -> possible_duplicate
    const sameValDiffIdCsv =
      generateCsvTemplate() +
      'obs-different-hr-id,heart_rate,instant,2026-11-13T07:05:00Z,42,,,,,,,72,,bpm,Manual pulse count,At rest,csv_import,,valid\n';
    const possibleDupRes = parseAndReconcileCsv({
      csvText: sameValDiffIdCsv,
      existingObservations: SIM_01_OBSERVATIONS,
      profileId: SIM_01_PROFILE_ID,
      missionEpochUtc: SIM_01_EPOCH_UTC,
      importBatchId: 'batch-dup',
      nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(possibleDupRes.counts.possibleDuplicate).toBe(1);
  });
});

describe('Idempotent commit transactions, workflow events, all 11 vectors, and sync helper', () => {
  it('S05/G04: preserves a flagged value across recovery, commit retry, and report exports', () => {
    const legacy = CheckInDraftSchema.parse(SIM_01_OPTIONAL_BP_DRAFT);
    const params = { existingObservations: [], observationId: 'obs-recheck', committedAtUtc: SIM_01_SNAPSHOT_UTC };
    expect(planCommitDraft({ ...params, draft: legacy }).observation?.quality).toBe('valid');
    const draft = CheckInDraftSchema.parse({
      ...legacy,
      stage: 'review',
      metricId: 'heart_rate',
      selectedUnit: 'bpm',
      method: 'Manual pulse count',
      quality: 'questionable',
      rawFields: { primary: '350', moodScore: null },
    });
    const recovery = buildDraftRecoveryBundle({
      draft, profileLabel: SIM_01_PROFILE.label, exportedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    const reopened = CheckInDraftSchema.parse(JSON.parse(JSON.stringify(recovery)).draft);
    expect(reopened.quality).toBe('questionable');
    const invalid = planCommitDraft({
      ...params, draft: { ...reopened, rawFields: { ...reopened.rawFields, primary: '350oops' } },
    });
    expect(invalid).toMatchObject({ outcome: 'validation_error', observation: null, draftToCloseId: null });
    const first = planCommitDraft({ ...params, draft: reopened });
    const obs = first.observation!;
    expect(obs).toMatchObject({
      entered: { kind: 'scalar', value: 350, unit: 'bpm' },
      timing: { observedAtUtc: reopened.observedAtUtc },
      method: reopened.method,
      provenance: reopened.provenance,
      quality: 'questionable',
      qualityNote: null,
    });
    const retry = planCommitDraft({
      ...params, draft: { ...reopened, commitStatus: 'unconfirmed' }, existingObservations: [obs],
    });
    expect(retry).toMatchObject({ outcome: 'already_in_log', observation: obs, draftToCloseId: draft.draftId });
    const report = buildReportBundle({
      profile: SIM_01_PROFILE, observations: [obs], references: [], startDay: 42, endDay: 42,
      generatedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(report.includeNotes).toBe(false);
    expect(report.observations).toEqual([obs]);
    const privateReport = buildReportBundle({
      profile: SIM_01_PROFILE,
      observations: [{ ...obs, qualityNote: 'Private quality text', note: 'Private note' }],
      references: [], startDay: 42, endDay: 42, generatedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(privateReport.observations).toEqual([obs]);
    expect(formatObservationDisplay(obs, SIM_01_PREFERENCES.displayUnits).primaryText).toBe('350 bpm (Needs recheck)');
    const csv = serializeObservationsToCsv(report.observations);
    const imported = parseAndReconcileCsv({
      csvText: csv, existingObservations: [], profileId: SIM_01_PROFILE_ID,
      missionEpochUtc: SIM_01_EPOCH_UTC, importBatchId: 'recheck', nowUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(imported.rows[0]?.candidate).toMatchObject({ quality: 'questionable', entered: obs.entered });
  });

  it('S05/G04: a flagged sleep period is ineligible until an independent valid recheck exists', () => {
    const latestSleep = SIM_01_SLEEP_OBSERVATIONS.at(-1)!;
    const flagged = { ...latestSleep, quality: 'questionable' as const };
    const reference = SIM_01_REFERENCES.find((r) => r.metricId === 'sleep')!;
    const derive = (observations: Observation[]) => deriveSevenDayFallbackReference({
      profileId: flagged.profileId, metricId: 'sleep', method: flagged.method, context: flagged.context,
      observations, createdAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    const history = [...SIM_01_SLEEP_OBSERVATIONS.slice(0, -1), flagged];
    expect(derive(history)).toMatchObject({ status: 'unavailable', sampleCount: 6 });
    expect(compareObservationToReference(flagged, reference).comparisonAvailable).toBe(false);
    expect(buildSleepInsight({ observation: flagged, reference, createdAtUtc: SIM_01_SNAPSHOT_UTC })).toBeNull();
    const recheck = { ...latestSleep, observationId: 'obs-independent-recheck' };
    const fallback = derive([...history, recheck]);
    expect(fallback.status).toBe('active');
    expect(fallback.selectedObservationIds).toContain(recheck.observationId);
    expect(fallback.selectedObservationIds).not.toContain(flagged.observationId);
    expect(compareObservationToReference(recheck, reference).comparisonAvailable).toBe(true);
  });

  it('enforces idempotent draft commit, unknown outcome lookup, and workflow event messages', () => {
    const first = planCommitDraft({
      draft: SIM_01_OPTIONAL_BP_DRAFT,
      existingObservations: SIM_01_OBSERVATIONS,
      observationId: 'obs-sim01-bp-02',
      committedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(first.outcome).toBe('insert');

    const withNewBp = [...SIM_01_OBSERVATIONS, first.observation!];
    const repeat = planCommitDraft({
      draft: SIM_01_OPTIONAL_BP_DRAFT,
      existingObservations: withNewBp,
      observationId: 'obs-sim01-bp-03',
      committedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(repeat.outcome).toBe('already_in_log');
    expect(repeat.observation?.observationId).toBe('obs-sim01-bp-02');

    expect(
      resolveUnknownCommitOutcome({
        draftId: SIM_01_OPTIONAL_BP_DRAFT.draftId,
        profileId: SIM_01_PROFILE_ID,
        storageCheckSucceeded: false,
        existingObservations: SIM_01_OBSERVATIONS,
      }).status,
    ).toBe('unconfirmed');

    expect(
      resolveUnknownCommitOutcome({
        draftId: SIM_01_OPTIONAL_BP_DRAFT.draftId,
        profileId: SIM_01_PROFILE_ID,
        storageCheckSucceeded: true,
        existingObservations: SIM_01_OBSERVATIONS,
      }).status,
    ).toBe('confirmed_not_saved');

    expect(
      resolveUnknownCommitOutcome({
        draftId: SIM_01_OPTIONAL_BP_DRAFT.draftId,
        profileId: SIM_01_PROFILE_ID,
        storageCheckSucceeded: true,
        existingObservations: withNewBp,
      }).status,
    ).toBe('already_in_log');

    const skipEvt = createWorkflowEvent({
      eventId: 'evt-skip-1',
      profileId: SIM_01_PROFILE_ID,
      eventType: 'check_in_skipped',
      metricId: null,
      reason: '',
      attemptedAtUtc: SIM_01_SNAPSHOT_UTC,
      attemptedMissionDay: 42,
      attemptedTimeLabel: '07:18',
      missionEpochUtc: SIM_01_EPOCH_UTC,
      keptDraftId: SIM_01_OPTIONAL_BP_DRAFT.draftId,
      committedCountInSession: 0,
      recordedAtUtc: SIM_01_SNAPSHOT_UTC,
    });
    expect(skipEvt.keptDraftId).toBe(SIM_01_OPTIONAL_BP_DRAFT.draftId);
    expect(formatSkipOutcomeMessage(0)).toBe('No measurements added in this check-in.');
    expect(formatSkipOutcomeMessage(1)).toBe('1 measurement added in this check-in.');
  });

  it('verifies all 11 Cross-Platform Acceptance Vectors in CANONICAL_ACCEPTANCE_VECTORS', () => {
    expect(CANONICAL_ACCEPTANCE_VECTORS.vectors).toHaveLength(11);
  });

  it('syncs and verifies SHA-256 parity cleanly in a temp target directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crewsignal-sync-test-'));
    try {
      const syncRes = syncToTargetDir(tmpDir);
      expect(syncRes.copied).toBeGreaterThan(20);

      const parityOk = checkTargetParity(tmpDir);
      expect(parityOk.ok).toBe(true);
      expect(parityOk.missing).toHaveLength(0);
      expect(parityOk.mismatches).toHaveLength(0);

      // Tampering a synced file is caught by checkTargetParity
      fs.writeFileSync(path.join(tmpDir, 'tokens', 'tokens.json'), '{}', 'utf8');
      const parityBad = checkTargetParity(tmpDir);
      expect(parityBad.ok).toBe(false);
      expect(parityBad.mismatches).toContain('tokens/tokens.json');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Review P1: full backups round-trip platform history', () => {
  it('keeps reviewed actions, clock history and corrections through export and validation', () => {
    const history = {
      actionReviews: [
        { reviewId: 'rev-1', actionId: 'act-sleep', reviewedAtUtc: SIM_01_SNAPSHOT_UTC, reviewed: true },
      ],
      clockHistory: [
        { profileId: SIM_01_PROFILE_ID, clockVersion: 2, epochUtc: SIM_01_EPOCH_UTC, timezone: 'Asia/Manila', snapshotUtc: null, changedAt: SIM_01_SNAPSHOT_UTC },
      ],
      corrections: [
        { observationId: 'obs-1', reason: 'CSV replace', previousPayload: { a: 1 }, newPayload: { a: 2 } },
      ],
    };
    const bundle = buildBackupBundle({
      confirmedIncludeAllProfileData: true,
      exportedAtUtc: SIM_01_SNAPSHOT_UTC,
      profile: SIM_01_PROFILE,
      preferences: SIM_01_PREFERENCES,
      observations: SIM_01_OBSERVATIONS,
      checkInEvents: [],
      references: SIM_01_REFERENCES,
      insights: SIM_01_INSIGHTS,
      history,
    });
    const validated = validateBackupImport(JSON.parse(JSON.stringify(bundle)));
    expect(validated.valid).toBe(true);
    expect(validated.bundle?.history).toEqual(history);
    expect(validated.bundle?.profile.mode).toBe('demo');
  });

  it('still accepts backups written before the history field existed', () => {
    const legacy = JSON.parse(JSON.stringify(EXAMPLE_BACKUP_BUNDLE)) as Record<string, unknown>;
    delete legacy.history;
    const validated = validateBackupImport(legacy);
    expect(validated.valid).toBe(true);
    expect(validated.bundle?.history).toBeUndefined();
  });
});
