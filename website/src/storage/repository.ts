import {
  EVIDENCE_LIST,
  SIM_01_INSIGHTS,
  SIM_01_OBSERVATIONS,
  SIM_01_PREFERENCES,
  SIM_01_PROFILE,
  SIM_01_PROFILE_ID,
  SIM_01_REFERENCES,
  SIM_SCHEDULE_OBSERVATIONS,
  SIM_SCHEDULE_PROFILE,
  buildCsvCommitPlan,
  buildMetricInsight,
  createNewReferenceVersion,
  selectFallbackReferenceToLock,
  createWorkflowEvent,
  markInsightReviewed,
  isInsightReviewCurrent,
  planCommitDraft,
  planProfileRestore,
  resolveUnknownCommitOutcome,
  validateBackupImport,
  validateDraftRecoveryImport,
  type AppPreferences,
  type BackupBundle,
  type CheckInDraft,
  type CheckInEvent,
  type CsvConflictChoice,
  type CsvPossibleDuplicateChoice,
  type CsvReconciliationPreview,
  type EvidenceReference,
  type Insight,
  type MetricId,
  type Observation,
  type PersonalReference,
  type ProfileConfig,
  type ReferenceValue,
} from '../shared';
import { CrewSignalDatabase, defaultDb } from './db';

export const SIM_EMPTY_DEMO_PROFILE_ID = 'sim-empty-demo-01' as const;

export const SIM_EMPTY_DEMO_PROFILE: ProfileConfig = {
  profileId: SIM_EMPTY_DEMO_PROFILE_ID,
  label: 'Empty scenario',
  alias: 'SIM-EMPTY',
  mode: 'demo',
  scenarioId: 'SIM-EMPTY',
  missionName: 'Unlogged scenario',
  missionEpochUtc: '2026-11-13T00:00:00Z',
  displayTimezone: 'UTC',
  snapshotUtc: '2026-11-13T07:18:00Z',
  createdAtUtc: '2026-11-13T00:00:00Z',
  clockVersion: 1,
  schedules: {
    heart_rate: null,
    blood_pressure: null,
    blood_glucose: null,
    body_temperature: null,
    sleep: null,
    mood: null,
  },
};

export interface WorkspaceSnapshot {
  preferences: AppPreferences;
  profiles: ProfileConfig[];
  observations: Observation[];
  drafts: CheckInDraft[];
  events: CheckInEvent[];
  references: PersonalReference[];
  insights: Insight[];
  sources: EvidenceReference[];
}

export interface StorageFaultSimulation {
  failDraftWrite: boolean;
  failCommitRollback: boolean;
  failCommitAckAfterWrite: boolean;
  failPostCommitRead: boolean;
  failLogLoad: boolean;
}

export const DEFAULT_FAULT_SIMULATION: StorageFaultSimulation = {
  failDraftWrite: false,
  failCommitRollback: false,
  failCommitAckAfterWrite: false,
  failPostCommitRead: false,
  failLogLoad: false,
};

export interface CommitDraftOutcome {
  outcome: 'inserted' | 'already_in_log';
  observation: Observation;
  receiptTitle: string;
  receiptSubtitle: string;
}

export class SimulatedCommitError extends Error {
  readonly kind: 'rollback' | 'ack_lost';
  constructor(kind: 'rollback' | 'ack_lost', message: string) {
    super(message);
    this.kind = kind;
  }
}

const FALLBACK_METRICS = [
  'heart_rate',
  'blood_pressure',
  'blood_glucose',
  'body_temperature',
  'sleep',
] as const;

export function createRepository(db: CrewSignalDatabase = defaultDb) {
  let faults: StorageFaultSimulation = { ...DEFAULT_FAULT_SIMULATION };

  function setFaultSimulation(next: Partial<StorageFaultSimulation>) {
    faults = { ...faults, ...next };
  }

  function getFaultSimulation(): StorageFaultSimulation {
    return { ...faults };
  }

  function makeId(prefix: string): string {
    const rand =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now()}-${rand}`;
  }

  async function seedAllTables(): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.profiles,
        db.observations,
        db.checkInDrafts,
        db.checkInEvents,
        db.references,
        db.insights,
        db.preferences,
        db.sourceCache,
        db.meta,
      ],
      async () => {
        await Promise.all([
          db.profiles.clear(),
          db.observations.clear(),
          db.checkInDrafts.clear(),
          db.checkInEvents.clear(),
          db.references.clear(),
          db.insights.clear(),
          db.preferences.clear(),
          db.sourceCache.clear(),
        ]);

        await db.profiles.bulkPut([
          SIM_01_PROFILE,
          SIM_SCHEDULE_PROFILE,
          SIM_EMPTY_DEMO_PROFILE,
        ]);
        await db.observations.bulkPut([
          ...SIM_01_OBSERVATIONS,
          ...SIM_SCHEDULE_OBSERVATIONS,
        ]);
        await db.references.bulkPut(SIM_01_REFERENCES);
        await db.insights.bulkPut(SIM_01_INSIGHTS);
        await db.preferences.put({ id: 'singleton', ...SIM_01_PREFERENCES });
        await db.sourceCache.bulkPut(EVIDENCE_LIST);
        await db.meta.put({ key: 'seed_version', value: 'v1' });
      },
    );
  }

  async function ensureSeeded(): Promise<void> {
    const marker = await db.meta.get('seed_version');
    const profileCount = await db.profiles.count();
    if (!marker || profileCount === 0) {
      await seedAllTables();
    }
  }

  async function loadSnapshot(): Promise<WorkspaceSnapshot> {
    if (faults.failLogLoad) {
      throw new Error('Could not open the stored observations on this device.');
    }
    await ensureSeeded();
    await lockEligibleFallbackReferences();

    const [prefRow, profiles, observations, drafts, events, references, insights, sources] =
      await Promise.all([
        db.preferences.get('singleton'),
        db.profiles.toArray(),
        db.observations.toArray(),
        db.checkInDrafts.toArray(),
        db.checkInEvents.toArray(),
        db.references.toArray(),
        db.insights.toArray(),
        db.sourceCache.toArray(),
      ]);

    const preferences: AppPreferences = prefRow
      ? {
          appearance: prefRow.appearance,
          activeProfileId: prefRow.activeProfileId,
          displayUnits: prefRow.displayUnits,
          helpMode: prefRow.helpMode,
        }
      : { ...SIM_01_PREFERENCES };

    return {
      preferences,
      profiles,
      observations,
      drafts,
      events,
      references,
      insights,
      sources: [
        ...sources,
        ...EVIDENCE_LIST.filter((entry) => !sources.some((cached) => cached.sourceId === entry.sourceId)),
      ],
    };
  }

  async function saveDraftAtomically(draft: CheckInDraft): Promise<CheckInDraft> {
    if (faults.failDraftWrite) {
      throw new Error(
        'Browser storage could not write the draft. Keeping values on this screen only.',
      );
    }
    const retained: CheckInDraft = {
      ...draft,
      retentionStatus: 'retained',
      updatedAtUtc: new Date().toISOString(),
    };
    await db.transaction('rw', db.checkInDrafts, async () => {
      const existing = await db.checkInDrafts
        .where('profileId')
        .equals(draft.profileId)
        .toArray();
      // One retained draft per profile and measurement, so choosing another
      // measurement never deletes the draft the user left behind.
      for (const old of existing) {
        if (old.draftId !== retained.draftId && old.metricId === retained.metricId) {
          await db.checkInDrafts.delete(old.draftId);
        }
      }
      await db.checkInDrafts.put(retained);
    });
    return retained;
  }

  async function discardDraftAtomically(draftId: string): Promise<void> {
    await db.transaction('rw', db.checkInDrafts, async () => {
      await db.checkInDrafts.delete(draftId);
    });
  }

  async function discardProfileDraftsAtomically(profileId: string): Promise<void> {
    await db.transaction('rw', db.checkInDrafts, async () => {
      await db.checkInDrafts.where('profileId').equals(profileId).delete();
    });
  }

  async function commitDraftAtomically(
    draft: CheckInDraft,
    committedAtUtc = new Date().toISOString(),
    confirmedUnusualValue?: boolean,
  ): Promise<CommitDraftOutcome> {
    const result = await db.transaction(
      'rw',
      [db.observations, db.checkInDrafts, db.references, db.insights],
      async () => {
        const existingObservations = await db.observations
          .where('profileId')
          .equals(draft.profileId)
          .toArray();

        const plan = planCommitDraft({
          draft,
          existingObservations,
          observationId: makeId(`obs-${draft.metricId}`),
          committedAtUtc,
          confirmedUnusualValue,
        });

        if (plan.outcome === 'already_in_log' && plan.existingObservation) {
          if (plan.draftToCloseId) {
            await db.checkInDrafts.delete(plan.draftToCloseId);
          }
          return {
            outcome: 'already_in_log' as const,
            observation: plan.existingObservation,
            receiptTitle: 'Already in your log',
            receiptSubtitle: 'Stored on this device. No duplicate entry was created.',
          };
        }

        if (!plan.ok || !plan.observation) {
          throw new Error(plan.error ?? 'Entry validation failed before commit.');
        }

        if (faults.failCommitRollback) {
          throw new SimulatedCommitError(
            'rollback',
            'Could not save observation to this device. Your draft is preserved.',
          );
        }

        await db.observations.put(plan.observation);
        if (plan.draftToCloseId) {
          await db.checkInDrafts.delete(plan.draftToCloseId);
        }

        const metricId = plan.observation.metricId;
        if (metricId !== 'mood') {
          const activeReference = await db.references
            .where('[profileId+metricId]')
            .equals([draft.profileId, metricId])
            .filter((r) => r.status === 'active')
            .first();
          const insight = buildMetricInsight(metricId, {
            observation: plan.observation,
            reference: activeReference ?? null,
            createdAtUtc: committedAtUtc,
          });
          if (insight) await db.insights.put(insight);
        }

        return {
          outcome: 'inserted' as const,
          observation: plan.observation,
          receiptTitle: 'Added to your log',
          receiptSubtitle: 'Stored on this device',
        };
      },
    );

    if (faults.failCommitAckAfterWrite) {
      throw new SimulatedCommitError(
        'ack_lost',
        'Log confirmation interrupted after storage write.',
      );
    }

    return result;
  }

  async function verifyDraftCommitStatus(params: {
    draftId: string;
    profileId: string;
  }) {
    try {
      if (faults.failPostCommitRead) {
        throw new Error('Storage verification read failed.');
      }
      const existingObservations = await db.observations
        .where('profileId')
        .equals(params.profileId)
        .toArray();
      return resolveUnknownCommitOutcome({
        draftId: params.draftId,
        profileId: params.profileId,
        storageCheckSucceeded: true,
        existingObservations,
      });
    } catch {
      return resolveUnknownCommitOutcome({
        draftId: params.draftId,
        profileId: params.profileId,
        storageCheckSucceeded: false,
        existingObservations: [],
      });
    }
  }

  async function recordWorkflowEventAtomically(params: {
    profileId: string;
    eventType: 'measurement_unavailable' | 'check_in_skipped';
    metricId: MetricId | null;
    reason: string | null;
    attemptedAtUtc: string;
    attemptedMissionDay: number;
    attemptedTimeLabel: string;
    missionEpochUtc: string;
    keptDraftId: string | null;
    committedCountInSession: number;
    recordedAtUtc?: string;
  }): Promise<CheckInEvent> {
    const evt = createWorkflowEvent({
      eventId: makeId('evt'),
      profileId: params.profileId,
      eventType: params.eventType,
      metricId: params.metricId,
      reason: params.reason,
      attemptedAtUtc: params.attemptedAtUtc,
      attemptedMissionDay: params.attemptedMissionDay,
      attemptedTimeLabel: params.attemptedTimeLabel,
      missionEpochUtc: params.missionEpochUtc,
      keptDraftId: params.keptDraftId,
      committedCountInSession: params.committedCountInSession,
      recordedAtUtc: params.recordedAtUtc ?? new Date().toISOString(),
    });
    await db.transaction('rw', db.checkInEvents, async () => {
      await db.checkInEvents.put(evt);
    });
    return evt;
  }

  async function updatePreferencesAtomically(
    patch: Partial<AppPreferences>,
  ): Promise<AppPreferences> {
    return db.transaction('rw', db.preferences, async () => {
      const current = await db.preferences.get('singleton');
      const next: AppPreferences = {
        appearance: patch.appearance ?? current?.appearance ?? SIM_01_PREFERENCES.appearance,
        activeProfileId:
          patch.activeProfileId ?? current?.activeProfileId ?? SIM_01_PROFILE_ID,
        displayUnits:
          patch.displayUnits ?? current?.displayUnits ?? SIM_01_PREFERENCES.displayUnits,
        helpMode: patch.helpMode ?? current?.helpMode ?? SIM_01_PREFERENCES.helpMode,
      };
      await db.preferences.put({ id: 'singleton', ...next });
      return next;
    });
  }

  async function commitCsvBatchAtomically(params: {
    profileId: string;
    preview: CsvReconciliationPreview;
    conflictChoices: Record<string, CsvConflictChoice>;
    possibleDuplicateChoices: Record<string, CsvPossibleDuplicateChoice>;
    acknowledgedExclusions: boolean;
    confirmedUnusualValues?: boolean;
    nowUtc?: string;
  }) {
    const nowUtc = params.nowUtc ?? new Date().toISOString();
    return db.transaction('rw', db.observations, async () => {
      const existingObservations = await db.observations
        .where('profileId')
        .equals(params.profileId)
        .toArray();
      const plan = buildCsvCommitPlan({
        preview: params.preview,
        existingObservations,
        conflictChoices: params.conflictChoices,
        possibleDuplicateChoices: params.possibleDuplicateChoices,
        acknowledgedExclusions: params.acknowledgedExclusions,
        confirmedUnusualValues: params.confirmedUnusualValues,
        nowUtc,
      });
      if (!plan.ready || !plan.nextObservations) {
        throw new Error(plan.error ?? 'Resolve highlighted CSV rows before importing.');
      }

      const existingIds = new Set(existingObservations.map((o) => o.observationId));
      const nextIds = new Set(plan.nextObservations.map((o) => o.observationId));
      for (const oldId of existingIds) {
        if (!nextIds.has(oldId)) {
          await db.observations.delete(oldId);
        }
      }
      await db.observations.bulkPut(plan.nextObservations);
      return plan;
    });
  }

  async function restoreBackupAtomically(params: {
    rawInput: unknown;
    destination: 'separate_profile' | 'replace_existing';
    targetExistingProfileId?: string;
    confirmedReplace?: boolean;
  }): Promise<{ profile: ProfileConfig; bundle: BackupBundle }> {
    const validation = validateBackupImport(params.rawInput, {
      rejectPersonalInPublicDemo: true,
    });
    if (!validation.valid || !validation.bundle) {
      throw new Error(validation.error ?? 'Backup file could not be validated.');
    }
    const bundle = validation.bundle;

    return db.transaction(
      'rw',
      [
        db.profiles,
        db.observations,
        db.checkInDrafts,
        db.checkInEvents,
        db.references,
        db.insights,
        db.preferences,
      ],
      async () => {
        const existingProfiles = await db.profiles.toArray();
        const plan = planProfileRestore({
          sourceProfile: bundle.profile,
          destination: params.destination,
          existingProfiles,
          targetExistingProfileId: params.targetExistingProfileId,
          newProfileId: makeId('demo-restored'),
        });

        if (plan.targetMissing) {
          throw new Error(plan.warningMessage ?? 'The profile to replace no longer exists.');
        }

        if (plan.requiresConfirmation && !params.confirmedReplace) {
          throw new Error(
            'Replacing an existing profile requires explicit confirmation.',
          );
        }

        const pid = plan.targetProfileId;

        if (plan.destination === 'replace_existing') {
          await Promise.all([
            db.observations.where('profileId').equals(pid).delete(),
            db.checkInDrafts.where('profileId').equals(pid).delete(),
            db.checkInEvents.where('profileId').equals(pid).delete(),
            db.references.where('profileId').equals(pid).delete(),
            db.insights.where('profileId').equals(pid).delete(),
          ]);
        }

        const restoredProfile: ProfileConfig = {
          ...bundle.profile,
          profileId: pid,
          label: plan.targetLabel,
          mode: 'demo',
        };
        await db.profiles.put(restoredProfile);

        const obsPrefix =
          plan.destination === 'separate_profile' ? `${pid}-` : '';
        const remappedObs: Observation[] = bundle.observations.map((o) => ({
          ...o,
          observationId: `${obsPrefix}${o.observationId}`,
          profileId: pid,
        }));
        const remappedEvents: CheckInEvent[] = bundle.checkInEvents.map((e) => ({
          ...e,
          eventId: `${obsPrefix}${e.eventId}`,
          profileId: pid,
        }));
        const remappedRefs: PersonalReference[] = bundle.references.map((r) => ({
          ...r,
          referenceId: `${obsPrefix}${r.referenceId}`,
          profileId: pid,
        }));
        const remappedInsights: Insight[] = bundle.insights.map((i) => ({
          ...i,
          insightId: `${obsPrefix}${i.insightId}`,
          observationId: `${obsPrefix}${i.observationId}`,
          profileId: pid,
        }));

        await Promise.all([
          db.observations.bulkPut(remappedObs),
          db.checkInEvents.bulkPut(remappedEvents),
          db.references.bulkPut(remappedRefs),
          db.insights.bulkPut(remappedInsights),
        ]);

        const currentPref = await db.preferences.get('singleton');
        await db.preferences.put({
          id: 'singleton',
          appearance: currentPref?.appearance ?? SIM_01_PREFERENCES.appearance,
          activeProfileId: pid,
          displayUnits: bundle.preferences.displayUnits,
          helpMode: currentPref?.helpMode ?? SIM_01_PREFERENCES.helpMode,
        });

        return { profile: restoredProfile, bundle };
      },
    );
  }

  async function importDraftRecoveryAtomically(params: {
    rawInput: unknown;
    fallbackProfileId: string;
  }) {
    const allObservations = await db.observations.toArray();
    const validation = validateDraftRecoveryImport(params.rawInput, {
      existingObservations: allObservations,
      rejectPersonalInPublicDemo: true,
    });

    if (!validation.valid || validation.status === 'rejected' || !validation.bundle) {
      return validation;
    }

    if (validation.status === 'resume_draft') {
      const profiles = await db.profiles.toArray();
      const targetExists = profiles.some(
        (p) => p.profileId === validation.bundle!.draft.profileId,
      );
      const targetProfileId = targetExists
        ? validation.bundle.draft.profileId
        : params.fallbackProfileId;

      const draftToSave: CheckInDraft = {
        ...validation.bundle.draft,
        profileId: targetProfileId,
        retentionStatus: 'retained',
        commitStatus: 'uncommitted',
        updatedAtUtc: new Date().toISOString(),
      };
      await db.transaction('rw', db.checkInDrafts, async () => {
        await db.checkInDrafts.put(draftToSave);
      });
    }

    return validation;
  }

  /**
   * Persists the first eligible seven-day fallback reference (with its
   * representative observation IDs) for every metric that has no stored
   * reference yet. Re-checks inside the transaction, so concurrent or repeated
   * calls write at most one version 1. Once stored, later observations, earlier
   * imports and restarts resolve from the saved record.
   */
  async function lockEligibleFallbackReferences(): Promise<PersonalReference[]> {
    return db.transaction('rw', db.references, db.observations, db.profiles, async () => {
      const [profiles, references, observations] = await Promise.all([
        db.profiles.toArray(),
        db.references.toArray(),
        db.observations.toArray(),
      ]);
      const toLock: PersonalReference[] = [];
      for (const profile of profiles) {
        for (const metricId of FALLBACK_METRICS) {
          const ref = selectFallbackReferenceToLock({
            profileId: profile.profileId,
            metricId,
            references,
            observations,
            nowUtc: profile.snapshotUtc ?? new Date().toISOString(),
          });
          if (ref) toLock.push(ref);
        }
      }
      if (toLock.length > 0) await db.references.bulkPut(toLock);
      return toLock;
    });
  }

  async function createReferenceVersionAtomically(params: {
    profileId: string;
    metricId: Exclude<MetricId, 'mood'>;
    provenance: 'entered_preflight' | 'user_updated';
    method: string;
    context: string;
    unit: string;
    value: ReferenceValue;
    createdAtUtc?: string;
  }): Promise<PersonalReference[]> {
    const createdAtUtc = params.createdAtUtc ?? new Date().toISOString();
    return db.transaction('rw', db.references, async () => {
      const existing = await db.references
        .where('profileId')
        .equals(params.profileId)
        .toArray();
      const nextList = createNewReferenceVersion({
        existingReferences: existing,
        profileId: params.profileId,
        metricId: params.metricId,
        provenance: params.provenance,
        method: params.method,
        context: params.context,
        unit: params.unit,
        value: params.value,
        createdAtUtc,
      });
      await db.references.bulkPut(nextList);
      return nextList;
    });
  }

  async function acknowledgeInsightAtomically(
    insight: Insight,
    reviewedAtUtc = new Date().toISOString(),
  ): Promise<Insight> {
    const updated = markInsightReviewed(insight, reviewedAtUtc);
    return db.transaction('rw', db.insights, async () => {
      const existing = await db.insights.get(updated.insightId);
      if (existing && isInsightReviewCurrent(existing, updated)) return existing;
      await db.insights.put(updated);
      return updated;
    });
  }

  async function updateSourceCacheEntry(entry: EvidenceReference): Promise<void> {
    await db.transaction('rw', db.sourceCache, async () => {
      await db.sourceCache.put(entry);
    });
  }

  async function deleteProfileAtomically(profileId: string): Promise<string> {
    return db.transaction(
      'rw',
      [
        db.profiles,
        db.observations,
        db.checkInDrafts,
        db.checkInEvents,
        db.references,
        db.insights,
        db.preferences,
      ],
      async () => {
        const profiles = await db.profiles.toArray();
        const remaining = profiles.filter((p) => p.profileId !== profileId);
        if (remaining.length === 0) {
          throw new Error(
            'At least one demo profile must remain. Use Reset demo data to restore SIM-01.',
          );
        }
        await Promise.all([
          db.profiles.delete(profileId),
          db.observations.where('profileId').equals(profileId).delete(),
          db.checkInDrafts.where('profileId').equals(profileId).delete(),
          db.checkInEvents.where('profileId').equals(profileId).delete(),
          db.references.where('profileId').equals(profileId).delete(),
          db.insights.where('profileId').equals(profileId).delete(),
        ]);

        const nextActive = remaining[0]!.profileId;
        const currentPref = await db.preferences.get('singleton');
        if (currentPref && currentPref.activeProfileId === profileId) {
          await db.preferences.put({
            ...currentPref,
            activeProfileId: nextActive,
          });
        }
        return nextActive;
      },
    );
  }

  async function resetDemoAtomically(): Promise<void> {
    const currentPref = await db.preferences.get('singleton');
    const keepAppearance = currentPref?.appearance ?? SIM_01_PREFERENCES.appearance;
    await seedAllTables();
    await db.preferences.put({
      id: 'singleton',
      ...SIM_01_PREFERENCES,
      appearance: keepAppearance,
    });
  }

  return {
    db,
    lockEligibleFallbackReferences,
    setFaultSimulation,
    getFaultSimulation,
    ensureSeeded,
    loadSnapshot,
    saveDraftAtomically,
    discardDraftAtomically,
    discardProfileDraftsAtomically,
    commitDraftAtomically,
    verifyDraftCommitStatus,
    recordWorkflowEventAtomically,
    updatePreferencesAtomically,
    commitCsvBatchAtomically,
    restoreBackupAtomically,
    importDraftRecoveryAtomically,
    createReferenceVersionAtomically,
    acknowledgeInsightAtomically,
    updateSourceCacheEntry,
    deleteProfileAtomically,
    resetDemoAtomically,
  };
}

export const repository = createRepository(defaultDb);
export type Repository = ReturnType<typeof createRepository>;
