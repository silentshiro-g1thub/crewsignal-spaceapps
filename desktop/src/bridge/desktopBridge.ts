import { getMetricAction, guidanceReviewIdentity, isInsightReviewCurrent, type Insight } from '../shared/src';
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  SIM_01_PREFERENCES,
  SIM_01_PROFILE,
  SIM_01_OBSERVATIONS,
  SIM_01_REFERENCES,
  SIM_01_INSIGHTS,
  SIM_01_OPTIONAL_BP_DRAFT,
  type AppPreferences,
  type CheckInDraft,
  type CheckInEvent,
  type MetricId,
  type MetricSchedule,
  type Observation,
  type PersonalReference,
  type ProfileConfig,
} from "../shared/src";

export interface DiagnosticHooks {
  simulateDraftRetentionFailure: boolean;
  simulateCommitRollback: boolean;
  simulateLostAck: boolean;
  simulateLookupUnavailable: boolean;
  simulateLogReadFailure: boolean;
  simulateFileOutcome: string | null;
}

export interface ProfileRecord {
  id: string;
  mode: string;
  alias: string;
  missionId: string;
  epochUtc: string;
  timezone: string;
  clockVersion: number;
  snapshotUtc: string | null;
  createdAt: string;
  updatedAt: string;
  settings: {
    label?: string;
    missionName?: string;
    scenarioId?: string | null;
    schedules?: ProfileConfig["schedules"];
    [key: string]: unknown;
  };
}

export function currentActionReview(reviews: ActionReviewRecord[], current: Insight | null): ActionReviewRecord | undefined {
  if (!current) return undefined;
  return reviews.find(review => review.actionId === getMetricAction(current.metricId).actionId &&
    isInsightReviewCurrent({ ...review, profileId: review.profileId ?? current.profileId,
      status: review.reviewed ? 'reviewed' : 'active' }, current));
}

export interface ActionReviewRecord {
  profileId?: string;
  referenceId?: string | null;
  ruleId?: string;
  sourceIds?: string[];
  sourceVersions?: Record<string, string>;
  reviewId: string;
  actionId: string;
  observationId: string;
  referenceVersion: number | null;
  ruleVersion: string;
  sourceVersion: string;
  reviewedAtUtc: string;
  reviewed: boolean;
}

export interface ClockHistoryEntry {
  profileId: string;
  clockVersion: number;
  epochUtc: string;
  timezone: string;
  snapshotUtc: string | null;
  changedAt: string;
}

export interface ImportBatchSummary {
  batchId: string;
  importedAt: string;
  summary: unknown;
}

export interface ProfileBundleData {
  profileId: string;
  observations: Observation[];
  corrections: unknown[];
  drafts: CheckInDraft[];
  checkinEvents: CheckInEvent[];
  references: PersonalReference[];
  actionReviews: ActionReviewRecord[];
  schedules: Array<{ metricId: MetricId; schedule: MetricSchedule }>;
  clockHistory: ClockHistoryEntry[];
  importBatches: ImportBatchSummary[];
}

export interface AppSnapshot {
  activeProfileId: string;
  profiles: ProfileRecord[];
  preferences: AppPreferences;
  profileData: ProfileBundleData;
}

export interface RuntimeEnvironmentInfo {
  platform: string;
  arch: string;
  appVersion: string;
  webview2Version: string | null;
  dbPath: string;
  sqliteJournalMode: string;
  offlineAssetsBundled: boolean;
}

/** Whether the local SQLite store opened. Startup never exits on storage errors. */
export interface StorageStatus {
  available: boolean;
  code: string | null;
  message: string | null;
  detail: string | null;
  dbPath: string | null;
}

export interface DraftGuardState {
  hasUnfinishedDraft: boolean;
  hasUnretainedDraft: boolean;
  draftSummary: string | null;
}

export interface CommitObservationOutcome {
  outcome: "committed" | "already_in_log";
  observation: Observation;
  draftClosed: boolean;
  profileObservationCount: number;
}

export interface LookupCommitOutcome {
  state: "already_in_log" | "not_found" | "unconfirmed";
  observation: Observation | null;
}

export interface FileWriteOutcome {
  status: "saved" | "cancelled" | "permission_refused" | "error";
  path: string | null;
  bytesWritten: number | null;
  message: string | null;
}

export interface FileReadOutcome {
  status: "loaded" | "cancelled" | "permission_refused" | "error";
  path: string | null;
  fileName: string | null;
  content: string | null;
  message: string | null;
}

export interface ConflictReplacementPayload {
  observationId: string;
  previousPayload: Observation;
  newPayload: Observation;
  reason: string;
  correctedAt: string;
}

export interface ProfileSeedInput {
  profile: ProfileRecord;
  observations: Observation[];
  references: PersonalReference[];
  schedules: Array<{ metricId: MetricId; schedule: MetricSchedule }>;
  checkinEvents: CheckInEvent[];
  drafts: CheckInDraft[];
  actionReviews: ActionReviewRecord[];
  clockHistory: ClockHistoryEntry[];
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __CREWSIGNAL_MOCK_FILES__?: {
      openContent?: string;
      openFileName?: string;
      saveOutcome?: FileWriteOutcome;
      openOutcome?: FileReadOutcome;
    };
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function profileConfigToRecord(
  cfg: ProfileConfig,
  updatedAt?: string,
): ProfileRecord {
  return {
    id: cfg.profileId,
    mode: cfg.mode,
    alias: cfg.alias ?? cfg.label,
    missionId: cfg.scenarioId ?? (cfg.mode === "demo" ? "SIM-01" : "PERSONAL"),
    epochUtc: cfg.missionEpochUtc,
    timezone: cfg.displayTimezone,
    clockVersion: cfg.clockVersion,
    snapshotUtc: cfg.snapshotUtc,
    createdAt: cfg.createdAtUtc,
    updatedAt: updatedAt ?? cfg.snapshotUtc ?? cfg.createdAtUtc,
    settings: {
      label: cfg.label,
      alias: cfg.alias,
      missionName: cfg.missionName,
      scenarioId: cfg.scenarioId,
      schedules: cfg.schedules,
    },
  };
}

export function profileRecordToConfig(
  rec: ProfileRecord,
  schedulesRows?: Array<{ metricId?: MetricId; metric_id?: MetricId; schedule?: MetricSchedule }>,
): ProfileConfig {
  const defaultSchedules: ProfileConfig["schedules"] = {
    heart_rate: null,
    blood_pressure: null,
    blood_glucose: null,
    body_temperature: null,
    sleep: null,
    mood: null,
  };
  const fromSettings = rec.settings?.schedules ?? {};
  const mergedSchedules: ProfileConfig["schedules"] = {
    ...defaultSchedules,
    ...fromSettings,
  };
  if (schedulesRows) {
    for (const row of schedulesRows) {
      const mId = row.metricId ?? row.metric_id;
      if (mId && row.schedule) {
        mergedSchedules[mId] = row.schedule;
      }
    }
  }

  return {
    profileId: rec.id,
    label:
      typeof rec.settings?.label === "string" && rec.settings.label.length > 0
        ? rec.settings.label
        : rec.alias || "Personal profile",
    alias:
      typeof rec.settings?.alias === "string" || rec.settings?.alias === null
        ? (rec.settings.alias as string | null)
        : rec.alias,
    mode: rec.mode === "personal" ? "personal" : "demo",
    scenarioId:
      typeof rec.settings?.scenarioId === "string"
        ? rec.settings.scenarioId
        : rec.mode === "demo"
          ? "SIM-01"
          : null,
    missionName:
      typeof rec.settings?.missionName === "string" && rec.settings.missionName.length > 0
        ? rec.settings.missionName
        : rec.mode === "demo"
          ? "Transit habitat"
          : "Local log",
    missionEpochUtc: rec.epochUtc,
    displayTimezone: rec.timezone,
    snapshotUtc: rec.snapshotUtc,
    createdAtUtc: rec.createdAt,
    clockVersion: rec.clockVersion,
    schedules: mergedSchedules,
  };
}

export function buildDemoSeedInput(includeSampleDraft = false): ProfileSeedInput {
  const profileRec = profileConfigToRecord(SIM_01_PROFILE);
  return {
    profile: profileRec,
    observations: [...SIM_01_OBSERVATIONS],
    references: [...SIM_01_REFERENCES],
    schedules: [],
    checkinEvents: [],
    drafts: includeSampleDraft ? [SIM_01_OPTIONAL_BP_DRAFT] : [],
    actionReviews: SIM_01_INSIGHTS.filter((i) => i.status === "reviewed").map((i) => ({
      reviewId: guidanceReviewIdentity(i) ?? i.insightId,
      profileId: i.profileId, referenceId: i.referenceId, ruleId: i.ruleId, sourceIds: i.sourceIds, sourceVersions: i.sourceVersions,
      actionId: "action-review-sleep-routine",
      observationId: i.observationId,
      referenceVersion: i.referenceVersion,
      ruleVersion: i.ruleVersion,
      sourceVersion: i.sourceVersions["nasa-sleep-risk"] ?? "Version 1",
      reviewedAtUtc: i.reviewedAtUtc ?? SIM_01_PROFILE.snapshotUtc ?? SIM_01_PROFILE.createdAtUtc,
      reviewed: true,
    })),
    clockHistory: [
      {
        profileId: profileRec.id,
        clockVersion: profileRec.clockVersion,
        epochUtc: profileRec.epochUtc,
        timezone: profileRec.timezone,
        snapshotUtc: profileRec.snapshotUtc,
        changedAt: profileRec.createdAt,
      },
    ],
  };
}

/**
 * Stateful in-memory fallback store used strictly when running frontend-only
 * outside Tauri (Vitest component specs and Vite Playwright verification).
 * Mirrors the exact Rust SQLite transaction, idempotence, rollback, and
 * profile-isolation contracts.
 */
class BrowserMockBackend {
  private hooks: DiagnosticHooks = {
    simulateDraftRetentionFailure: false,
    simulateCommitRollback: false,
    simulateLostAck: false,
    simulateLookupUnavailable: false,
    simulateLogReadFailure: false,
    simulateFileOutcome: null,
  };
  private profiles = new Map<string, ProfileRecord>();
  private bundles = new Map<string, ProfileBundleData>();
  private preferences: AppPreferences = { ...SIM_01_PREFERENCES };
  private activeProfileId: string = SIM_01_PROFILE.profileId;
  private seeded = false;
  private closeListeners = new Set<(state: DraftGuardState) => void>();
  private draftGuardState: DraftGuardState = {
    hasUnfinishedDraft: false,
    hasUnretainedDraft: false,
    draftSummary: null,
  };

  private emptyBundle(profileId: string): ProfileBundleData {
    return {
      profileId,
      observations: [],
      corrections: [],
      drafts: [],
      checkinEvents: [],
      references: [],
      actionReviews: [],
      schedules: [],
      clockHistory: [],
      importBatches: [],
    };
  }

  ensureDemoSeed(seed: ProfileSeedInput): AppSnapshot {
    if (this.storageUnavailable) return this.snapshot();
    if (!this.seeded || !this.profiles.has(seed.profile.id)) {
      this.seeded = true;
      this.profiles.set(seed.profile.id, structuredClone(seed.profile));
      const bundle = this.emptyBundle(seed.profile.id);
      bundle.observations = structuredClone(seed.observations);
      bundle.references = structuredClone(seed.references);
      bundle.schedules = structuredClone(seed.schedules);
      bundle.checkinEvents = structuredClone(seed.checkinEvents);
      bundle.drafts = structuredClone(seed.drafts);
      bundle.actionReviews = structuredClone(seed.actionReviews);
      bundle.clockHistory = structuredClone(seed.clockHistory);
      this.bundles.set(seed.profile.id, bundle);
      if (!this.profiles.has(this.activeProfileId)) {
        this.activeProfileId = seed.profile.id;
      }
    }
    return this.snapshot(this.activeProfileId);
  }

  snapshot(profileId?: string): AppSnapshot {
    if (this.storageUnavailable) {
      throw {
        code: "STORAGE_UNAVAILABLE",
        message: "Local storage could not be opened. Your saved file was left unchanged.",
      };
    }
    if (this.hooks.simulateLogReadFailure) {
      throw {
        code: "LOG_UNAVAILABLE",
        message: "Observation log is temporarily unavailable.",
      };
    }
    const targetId =
      profileId && this.profiles.has(profileId) ? profileId : this.activeProfileId;
    this.activeProfileId = targetId;
    return structuredClone({
      activeProfileId: targetId,
      profiles: [...this.profiles.values()],
      preferences: { ...this.preferences, activeProfileId: targetId },
      profileData: this.bundles.get(targetId) ?? this.emptyBundle(targetId),
    });
  }

  getRuntimeInfo(): RuntimeEnvironmentInfo {
    return {
      platform: "windows-browser-harness",
      arch: "x86_64",
      appVersion: "0.1.0",
      webview2Version: "Web harness",
      dbPath: "memory://crewsignal-test-store",
      sqliteJournalMode: "memory-mock",
      offlineAssetsBundled: true,
    };
  }

  getHooks(): DiagnosticHooks {
    return { ...this.hooks };
  }

  /** Test hook that mimics an unreadable or denied SQLite file at startup. */
  private storageUnavailable = false;

  setStorageUnavailable(value: boolean): void {
    this.storageUnavailable = value;
  }

  storageStatus(): StorageStatus {
    return this.storageUnavailable
      ? {
          available: false,
          code: "DB_PRAGMA_FAILED",
          message: "Local storage could not be opened.",
          detail: "file is not a database",
          dbPath: "memory://crewsignal-test-store",
        }
      : { available: true, code: null, message: null, detail: null, dbPath: "memory://crewsignal-test-store" };
  }

  setHooks(next: DiagnosticHooks): DiagnosticHooks {
    this.hooks = { ...next };
    return { ...this.hooks };
  }

  resetDemo(seed: ProfileSeedInput): AppSnapshot {
    this.seeded = false;
    this.profiles.delete(seed.profile.id);
    this.bundles.delete(seed.profile.id);
    this.activeProfileId = seed.profile.id;
    return this.ensureDemoSeed(seed);
  }

  createPersonalProfile(profile: ProfileRecord): AppSnapshot {
    this.profiles.set(profile.id, structuredClone(profile));
    const bundle = this.emptyBundle(profile.id);
    bundle.clockHistory.push({
      profileId: profile.id,
      clockVersion: profile.clockVersion,
      epochUtc: profile.epochUtc,
      timezone: profile.timezone,
      snapshotUtc: profile.snapshotUtc,
      changedAt: profile.createdAt,
    });
    this.bundles.set(profile.id, bundle);
    this.activeProfileId = profile.id;
    return this.snapshot(profile.id);
  }

  setActiveProfile(profileId: string): AppSnapshot {
    if (!this.profiles.has(profileId)) {
      throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    }
    this.activeProfileId = profileId;
    return this.snapshot(profileId);
  }

  deletePersonalProfile(profileId: string): { deletedProfileId: string; fallbackProfileId: string } {
    const rec = this.profiles.get(profileId);
    if (!rec) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    if (rec.mode === "demo") {
      throw {
        code: "CANNOT_DELETE_DEMO_PROFILE",
        message: "The SIM-01 demo profile uses Reset demo instead of deletion.",
      };
    }
    this.profiles.delete(profileId);
    this.bundles.delete(profileId);
    const demo = [...this.profiles.values()].find((p) => p.mode === "demo") ?? [...this.profiles.values()][0];
    const fallbackProfileId = demo ? demo.id : SIM_01_PROFILE.profileId;
    this.activeProfileId = fallbackProfileId;
    return { deletedProfileId: profileId, fallbackProfileId };
  }

  updatePreferences(preferences: AppPreferences): AppPreferences {
    this.preferences = structuredClone(preferences);
    return structuredClone(this.preferences);
  }

  updateProfileClock(
    profileId: string,
    epochUtc: string,
    timezone: string,
    snapshotUtc: string | null,
    changedAt: string,
  ): ProfileRecord {
    const existing = this.profiles.get(profileId);
    if (!existing) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    const nextVersion = existing.clockVersion + 1;
    const updated: ProfileRecord = {
      ...existing,
      epochUtc,
      timezone,
      snapshotUtc,
      clockVersion: nextVersion,
      updatedAt: changedAt,
    };
    this.profiles.set(profileId, updated);
    const bundle = this.bundles.get(profileId);
    bundle?.clockHistory.push({
      profileId,
      clockVersion: nextVersion,
      epochUtc,
      timezone,
      snapshotUtc,
      changedAt,
    });
    return structuredClone(updated);
  }

  updateProfileSettings(
    profileId: string,
    alias: string,
    settings: ProfileRecord["settings"],
    updatedAt: string,
  ): ProfileRecord {
    const existing = this.profiles.get(profileId);
    if (!existing) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    const updated: ProfileRecord = {
      ...existing,
      alias,
      settings: structuredClone(settings),
      updatedAt,
    };
    this.profiles.set(profileId, updated);
    return structuredClone(updated);
  }

  upsertPersonalReference(profileId: string, reference: PersonalReference): PersonalReference {
    const bundle = this.bundles.get(profileId);
    if (!bundle) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    bundle.references = bundle.references.map((r) =>
      r.metricId === reference.metricId && r.status === "active"
        ? { ...r, status: "superseded" }
        : r,
    );
    const idx = bundle.references.findIndex((r) => r.referenceId === reference.referenceId);
    if (idx >= 0) {
      bundle.references[idx] = structuredClone(reference);
    } else {
      bundle.references.push(structuredClone(reference));
    }
    return structuredClone(reference);
  }

  lockFallbackReference(profileId: string, reference: PersonalReference): boolean {
    const bundle = this.bundles.get(profileId);
    if (!bundle) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    if (bundle.references.some((r) => r.metricId === reference.metricId)) return false;
    bundle.references.push(structuredClone(reference));
    return true;
  }

  upsertSchedule(profileId: string, metricId: MetricId, schedule: MetricSchedule) {
    const bundle = this.bundles.get(profileId);
    const prof = this.profiles.get(profileId);
    if (!bundle || !prof) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    const idx = bundle.schedules.findIndex((s) => s.metricId === metricId);
    const row = { metricId, schedule: structuredClone(schedule) };
    if (idx >= 0) bundle.schedules[idx] = row;
    else bundle.schedules.push(row);
    prof.settings = {
      ...prof.settings,
      schedules: {
        ...(prof.settings.schedules ?? {
          heart_rate: null,
          blood_pressure: null,
          blood_glucose: null,
          body_temperature: null,
          sleep: null,
          mood: null,
        }),
        [metricId]: structuredClone(schedule),
      },
    };
    return row;
  }

  recordActionReview(profileId: string, review: ActionReviewRecord): ActionReviewRecord {
    const bundle = this.bundles.get(profileId);
    if (!bundle) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    const idx = bundle.actionReviews.findIndex((r) => r.reviewId === review.reviewId);
    if (idx >= 0) return structuredClone(bundle.actionReviews[idx]!);
    else bundle.actionReviews.push(structuredClone(review));
    return structuredClone(review);
  }

  saveDraft(profileId: string, draft: CheckInDraft): { retained: boolean; draft: CheckInDraft } {
    if (this.hooks.simulateDraftRetentionFailure) {
      return {
        retained: false,
        draft: { ...draft, retentionStatus: "memory_only" },
      };
    }
    const bundle = this.bundles.get(profileId);
    if (!bundle) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    const nextDraft = { ...draft, retentionStatus: "retained" as const };
    const idx = bundle.drafts.findIndex((d) => d.draftId === draft.draftId);
    if (idx >= 0) bundle.drafts[idx] = structuredClone(nextDraft);
    else bundle.drafts.push(structuredClone(nextDraft));
    return { retained: true, draft: structuredClone(nextDraft) };
  }

  deleteDraft(profileId: string, draftId: string): boolean {
    const bundle = this.bundles.get(profileId);
    if (!bundle) return false;
    const before = bundle.drafts.length;
    bundle.drafts = bundle.drafts.filter((d) => d.draftId !== draftId);
    return bundle.drafts.length < before;
  }

  commitObservation(request: {
    profileId: string;
    draftId: string;
    observation: Observation;
  }): CommitObservationOutcome {
    const bundle = this.bundles.get(request.profileId);
    if (!bundle) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    // Same scope check as the native commit: draft, payload and destination agree.
    const draftOwner = [...this.bundles.entries()].find(
      ([pid, b]) => pid !== request.profileId && b.drafts.some((d) => d.draftId === request.draftId),
    );
    if (
      request.observation.profileId !== request.profileId ||
      (request.observation.sourceDraftId !== null && request.observation.sourceDraftId !== request.draftId) ||
      draftOwner
    ) {
      throw {
        code: "COMMIT_SCOPE_MISMATCH",
        message: "This entry belongs to another profile or draft. No changes made.",
      };
    }

    const existing = bundle.observations.find(
      (o) =>
        o.observationId === request.observation.observationId ||
        o.sourceDraftId === request.draftId,
    );
    if (existing) {
      bundle.drafts = bundle.drafts.filter((d) => d.draftId !== request.draftId);
      return {
        outcome: "already_in_log",
        observation: structuredClone(existing),
        draftClosed: true,
        profileObservationCount: bundle.observations.length,
      };
    }

    if (this.hooks.simulateCommitRollback) {
      throw {
        code: "COMMIT_ROLLED_BACK",
        message: "The addition did not finish. Your entry is still here and can be saved again.",
      };
    }

    bundle.observations.push(structuredClone(request.observation));
    const draftClosed = this.deleteDraft(request.profileId, request.draftId);

    if (this.hooks.simulateLostAck) {
      throw {
        code: "UNKNOWN_OUTCOME",
        message: "Addition unconfirmed. Check the log before adding again.",
      };
    }

    return {
      outcome: "committed",
      observation: structuredClone(request.observation),
      draftClosed,
      profileObservationCount: bundle.observations.length,
    };
  }

  checkObservationStatus(params: {
    profileId: string;
    observationId?: string;
    draftId?: string;
  }): LookupCommitOutcome {
    if (this.hooks.simulateLookupUnavailable) {
      return { state: "unconfirmed", observation: null };
    }
    const bundle = this.bundles.get(params.profileId);
    if (!bundle) return { state: "not_found", observation: null };
    const found = bundle.observations.find(
      (o) =>
        (params.observationId && o.observationId === params.observationId) ||
        (params.draftId && o.sourceDraftId === params.draftId),
    );
    return found
      ? { state: "already_in_log", observation: structuredClone(found) }
      : { state: "not_found", observation: null };
  }

  commitCheckInEvent(request: {
    profileId: string;
    event: CheckInEvent;
    discardDraftId?: string | null;
  }) {
    const bundle = this.bundles.get(request.profileId);
    if (!bundle) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    const exists = bundle.checkinEvents.find((e) => e.eventId === request.event.eventId);
    if (exists) {
      return {
        outcome: "already_recorded",
        event: structuredClone(exists),
        discardedDraftId: request.discardDraftId ?? null,
      };
    }
    bundle.checkinEvents.push(structuredClone(request.event));
    if (request.discardDraftId) {
      this.deleteDraft(request.profileId, request.discardDraftId);
    }
    return {
      outcome: "recorded",
      event: structuredClone(request.event),
      discardedDraftId: request.discardDraftId ?? null,
    };
  }

  commitCsvBatch(request: {
    profileId: string;
    batchId: string;
    newObservations: Observation[];
    conflictReplacements: ConflictReplacementPayload[];
    summary: unknown;
  }) {
    const bundle = this.bundles.get(request.profileId);
    if (!bundle) throw { code: "PROFILE_NOT_FOUND", message: "Profile not found." };
    if (bundle.importBatches.some((b) => b.batchId === request.batchId)) {
      return { outcome: "already_applied", insertedCount: 0, replacedCount: 0 };
    }

    let insertedCount = 0;
    for (const obs of request.newObservations) {
      if (!bundle.observations.some((o) => o.observationId === obs.observationId)) {
        bundle.observations.push(structuredClone(obs));
        insertedCount += 1;
      }
    }

    let replacedCount = 0;
    for (const rep of request.conflictReplacements) {
      const idx = bundle.observations.findIndex((o) => o.observationId === rep.observationId);
      if (idx >= 0) {
        bundle.observations[idx] = structuredClone(rep.newPayload);
        bundle.corrections.push(rep);
        replacedCount += 1;
      }
    }

    bundle.importBatches.push({
      batchId: request.batchId,
      importedAt: new Date().toISOString(),
      summary: request.summary,
    });

    return { outcome: "committed", insertedCount, replacedCount };
  }

  restoreBackup(request: {
    targetMode: "separate_profile" | "replace_profile";
    targetProfileId?: string | null;
    profile: ProfileRecord;
    observations: Observation[];
    corrections: unknown[];
    checkinEvents: CheckInEvent[];
    references: PersonalReference[];
    actionReviews: ActionReviewRecord[];
    schedules: Array<{ metricId: MetricId; schedule: MetricSchedule }>;
    clockHistory: ClockHistoryEntry[];
  }) {
    const destId =
      request.targetMode === "replace_profile" && request.targetProfileId
        ? request.targetProfileId
        : request.profile.id;
    const replacedExisting = this.profiles.has(destId);
    // Mirror the native guards so the browser backend never mixes modes either.
    if (request.targetMode === "separate_profile" && replacedExisting) {
      throw {
        code: "RESTORE_PROFILE_ID_COLLISION",
        message: "Separate restore destination ID already exists. No changes made.",
      };
    }
    if (request.targetMode === "replace_profile") {
      const existing = this.profiles.get(destId);
      if (!existing) {
        throw { code: "RESTORE_TARGET_NOT_FOUND", message: "Replacement target profile was not found. No changes made." };
      }
      if (existing.mode !== request.profile.mode) {
        throw {
          code: "RESTORE_MODE_MISMATCH",
          message: "This backup is from a different mode than the profile it would replace. No changes made.",
        };
      }
    }
    const restoredProfile: ProfileRecord = {
      ...structuredClone(request.profile),
      id: destId,
    };
    const nextObs = request.observations.map((o) => ({ ...structuredClone(o), profileId: destId }));
    const nextRefs = request.references.map((r) => ({ ...structuredClone(r), profileId: destId }));
    const nextEvents = request.checkinEvents.map((e) => ({ ...structuredClone(e), profileId: destId }));
    this.profiles.set(destId, restoredProfile);
    this.bundles.set(destId, {
      profileId: destId,
      observations: nextObs,
      corrections: structuredClone(request.corrections),
      drafts: [],
      checkinEvents: nextEvents,
      references: nextRefs,
      actionReviews: structuredClone(request.actionReviews),
      schedules: structuredClone(request.schedules),
      clockHistory: structuredClone(request.clockHistory),
      importBatches: [],
    });
    this.activeProfileId = destId;
    return {
      restoredProfile,
      observationCount: nextObs.length,
      replacedExisting,
    };
  }

  setDraftGuardState(state: DraftGuardState) {
    this.draftGuardState = { ...state };
  }

  triggerMockCloseRequest() {
    if (
      this.draftGuardState.hasUnfinishedDraft ||
      this.draftGuardState.hasUnretainedDraft
    ) {
      for (const listener of this.closeListeners) {
        listener({ ...this.draftGuardState });
      }
      return false;
    }
    return true;
  }

  onCloseRequested(listener: (state: DraftGuardState) => void): () => void {
    this.closeListeners.add(listener);
    return () => {
      this.closeListeners.delete(listener);
    };
  }

  saveExportFile(defaultFileName: string, content: string): FileWriteOutcome {
    const injected =
      typeof window !== "undefined" ? window.__CREWSIGNAL_MOCK_FILES__?.saveOutcome : undefined;
    if (injected) return injected;
    const hook = this.hooks.simulateFileOutcome;
    if (hook === "cancelled") {
      return { status: "cancelled", path: null, bytesWritten: null, message: "Save cancelled. No file written." };
    }
    if (hook === "permission_refused") {
      return { status: "permission_refused", path: null, bytesWritten: null, message: "File access wasn't granted." };
    }
    if (hook === "error") {
      return { status: "error", path: null, bytesWritten: null, message: "Couldn't export file." };
    }
    // In browser fallback, trigger a standard download notification path cleanly
    return {
      status: "saved",
      path: `C:\\Users\\Demo\\Downloads\\${defaultFileName}`,
      bytesWritten: new TextEncoder().encode(content).length,
      message: null,
    };
  }

  openImportFile(): FileReadOutcome {
    const mock = typeof window !== "undefined" ? window.__CREWSIGNAL_MOCK_FILES__ : undefined;
    if (mock?.openOutcome) return mock.openOutcome;
    if (mock?.openContent !== undefined) {
      return {
        status: "loaded",
        path: `C:\\Users\\Demo\\Documents\\${mock.openFileName ?? "import.json"}`,
        fileName: mock.openFileName ?? "import.json",
        content: mock.openContent,
        message: null,
      };
    }
    const hook = this.hooks.simulateFileOutcome;
    if (hook === "cancelled") {
      return { status: "cancelled", path: null, fileName: null, content: null, message: "File selection cancelled." };
    }
    if (hook === "permission_refused") {
      return { status: "permission_refused", path: null, fileName: null, content: null, message: "File access wasn't granted." };
    }
    return { status: "cancelled", path: null, fileName: null, content: null, message: "No file chosen." };
  }
}

export const browserMockBackend = new BrowserMockBackend();

export const desktopBridge = {
  isTauri: isTauriRuntime,

  async getRuntimeInfo(): Promise<RuntimeEnvironmentInfo> {
    if (isTauriRuntime()) {
      return invoke<RuntimeEnvironmentInfo>("get_runtime_info");
    }
    return browserMockBackend.getRuntimeInfo();
  },

  async getStorageStatus(): Promise<StorageStatus> {
    if (isTauriRuntime()) {
      return invoke<StorageStatus>("get_storage_status");
    }
    return browserMockBackend.storageStatus();
  },

  async retryOpenStorage(): Promise<StorageStatus> {
    if (isTauriRuntime()) {
      return invoke<StorageStatus>("retry_open_storage");
    }
    return browserMockBackend.storageStatus();
  },

  async getDiagnosticHooks(): Promise<DiagnosticHooks> {
    if (isTauriRuntime()) {
      return invoke<DiagnosticHooks>("get_diagnostic_hooks");
    }
    return browserMockBackend.getHooks();
  },

  async setDiagnosticHooks(hooks: DiagnosticHooks): Promise<DiagnosticHooks> {
    if (isTauriRuntime()) {
      return invoke<DiagnosticHooks>("set_diagnostic_hooks", { hooks });
    }
    return browserMockBackend.setHooks(hooks);
  },

  async ensureDemoSeed(seed = buildDemoSeedInput()): Promise<AppSnapshot> {
    if (isTauriRuntime()) {
      return invoke<AppSnapshot>("ensure_demo_seed", { seed });
    }
    return browserMockBackend.ensureDemoSeed(seed);
  },

  async loadAppSnapshot(profileId?: string): Promise<AppSnapshot> {
    if (isTauriRuntime()) {
      return invoke<AppSnapshot>("load_app_snapshot", {
        profileId: profileId ?? null,
      });
    }
    return browserMockBackend.snapshot(profileId);
  },

  async resetDemoProfile(seed = buildDemoSeedInput()): Promise<AppSnapshot> {
    if (isTauriRuntime()) {
      return invoke<AppSnapshot>("reset_demo_profile", { seed });
    }
    return browserMockBackend.resetDemo(seed);
  },

  async createPersonalProfile(profile: ProfileRecord): Promise<AppSnapshot> {
    if (isTauriRuntime()) {
      return invoke<AppSnapshot>("create_personal_profile", { profile });
    }
    return browserMockBackend.createPersonalProfile(profile);
  },

  async setActiveProfile(profileId: string): Promise<AppSnapshot> {
    if (isTauriRuntime()) {
      return invoke<AppSnapshot>("set_active_profile", { profileId });
    }
    return browserMockBackend.setActiveProfile(profileId);
  },

  async deletePersonalProfile(
    profileId: string,
  ): Promise<{ deletedProfileId: string; fallbackProfileId: string }> {
    if (isTauriRuntime()) {
      return invoke("delete_personal_profile", { profileId });
    }
    return browserMockBackend.deletePersonalProfile(profileId);
  },

  async updatePreferences(preferences: AppPreferences): Promise<AppPreferences> {
    if (isTauriRuntime()) {
      return invoke<AppPreferences>("update_preferences", { preferences });
    }
    return browserMockBackend.updatePreferences(preferences);
  },

  async updateProfileClock(params: {
    profileId: string;
    epochUtc: string;
    timezone: string;
    snapshotUtc: string | null;
    changedAt: string;
  }): Promise<ProfileRecord> {
    if (isTauriRuntime()) {
      return invoke<ProfileRecord>("update_profile_clock", params);
    }
    return browserMockBackend.updateProfileClock(
      params.profileId,
      params.epochUtc,
      params.timezone,
      params.snapshotUtc,
      params.changedAt,
    );
  },

  async updateProfileSettings(params: {
    profileId: string;
    alias: string;
    settings: ProfileRecord["settings"];
    updatedAt: string;
  }): Promise<ProfileRecord> {
    if (isTauriRuntime()) {
      return invoke<ProfileRecord>("update_profile_settings", params);
    }
    return browserMockBackend.updateProfileSettings(
      params.profileId,
      params.alias,
      params.settings,
      params.updatedAt,
    );
  },

  async upsertPersonalReference(
    profileId: string,
    reference: PersonalReference,
  ): Promise<PersonalReference> {
    if (isTauriRuntime()) {
      return invoke<PersonalReference>("upsert_personal_reference", {
        profileId,
        reference,
      });
    }
    return browserMockBackend.upsertPersonalReference(profileId, reference);
  },

  /** Stores an automatic fallback lock only if the metric has no reference yet. */
  async lockFallbackReference(
    profileId: string,
    reference: PersonalReference,
  ): Promise<boolean> {
    if (isTauriRuntime()) {
      return invoke<boolean>("lock_fallback_reference", { profileId, reference });
    }
    return browserMockBackend.lockFallbackReference(profileId, reference);
  },

  async upsertSchedule(
    profileId: string,
    metricId: MetricId,
    schedule: MetricSchedule,
  ): Promise<unknown> {
    if (isTauriRuntime()) {
      return invoke("upsert_schedule", {
        profileId,
        schedule: { metricId, schedule },
      });
    }
    return browserMockBackend.upsertSchedule(profileId, metricId, schedule);
  },

  async recordActionReview(
    profileId: string,
    review: ActionReviewRecord,
  ): Promise<ActionReviewRecord> {
    if (review.profileId && review.profileId !== profileId) throw new Error("Review belongs to another profile.");
    if (isTauriRuntime()) {
      return invoke<ActionReviewRecord>("record_action_review", {
        profileId,
        review,
      });
    }
    return browserMockBackend.recordActionReview(profileId, review);
  },

  async saveDraft(
    profileId: string,
    draft: CheckInDraft,
  ): Promise<{ retained: boolean; draft: CheckInDraft }> {
    if (isTauriRuntime()) {
      return invoke("save_draft", { profileId, draft });
    }
    return browserMockBackend.saveDraft(profileId, draft);
  },

  async deleteDraft(profileId: string, draftId: string): Promise<boolean> {
    if (isTauriRuntime()) {
      return invoke<boolean>("delete_draft", { profileId, draftId });
    }
    return browserMockBackend.deleteDraft(profileId, draftId);
  },

  async commitObservation(request: {
    profileId: string;
    draftId: string;
    observation: Observation;
  }): Promise<CommitObservationOutcome> {
    if (isTauriRuntime()) {
      return invoke<CommitObservationOutcome>("commit_observation", { request });
    }
    return browserMockBackend.commitObservation(request);
  },

  async checkObservationStatus(params: {
    profileId: string;
    observationId?: string;
    draftId?: string;
  }): Promise<LookupCommitOutcome> {
    if (isTauriRuntime()) {
      return invoke<LookupCommitOutcome>("check_observation_status", {
        profileId: params.profileId,
        observationId: params.observationId ?? null,
        draftId: params.draftId ?? null,
      });
    }
    return browserMockBackend.checkObservationStatus(params);
  },

  async commitCheckInEvent(request: {
    profileId: string;
    event: CheckInEvent;
    discardDraftId: string | null;
  }): Promise<{ outcome: string; event: CheckInEvent; discardedDraftId: string | null }> {
    if (isTauriRuntime()) {
      return invoke("commit_checkin_event", { request });
    }
    return browserMockBackend.commitCheckInEvent(request);
  },

  async commitCsvBatch(request: {
    profileId: string;
    batchId: string;
    newObservations: Observation[];
    conflictReplacements: ConflictReplacementPayload[];
    summary: unknown;
  }): Promise<{ outcome: string; insertedCount: number; replacedCount: number }> {
    if (isTauriRuntime()) {
      return invoke("commit_csv_import_batch", { request });
    }
    return browserMockBackend.commitCsvBatch(request);
  },

  async restoreBackup(request: {
    targetMode: "separate_profile" | "replace_profile";
    targetProfileId: string | null;
    profile: ProfileRecord;
    observations: Observation[];
    corrections: unknown[];
    checkinEvents: CheckInEvent[];
    references: PersonalReference[];
    actionReviews: ActionReviewRecord[];
    schedules: Array<{ metricId: MetricId; schedule: MetricSchedule }>;
    clockHistory: ClockHistoryEntry[];
  }): Promise<{
    restoredProfile: ProfileRecord;
    observationCount: number;
    replacedExisting: boolean;
  }> {
    if (isTauriRuntime()) {
      return invoke("restore_backup", { request });
    }
    return browserMockBackend.restoreBackup(request);
  },

  async setDraftGuardState(guardState: DraftGuardState): Promise<void> {
    if (isTauriRuntime()) {
      return invoke("set_draft_guard_state", { guardState });
    }
    browserMockBackend.setDraftGuardState(guardState);
  },

  async confirmCloseApplication(): Promise<void> {
    if (isTauriRuntime()) {
      return invoke("confirm_close_application");
    }
  },

  async subscribeCloseRequested(
    handler: (state: DraftGuardState) => void,
  ): Promise<UnlistenFn> {
    if (isTauriRuntime()) {
      return listen<DraftGuardState>("crewsignal://close-requested", (ev) => {
        handler(ev.payload);
      });
    }
    return browserMockBackend.onCloseRequested(handler);
  },

  async saveExportFile(params: {
    defaultFileName: string;
    filterName: string;
    extensions: string[];
    content: string;
  }): Promise<FileWriteOutcome> {
    if (isTauriRuntime()) {
      return invoke<FileWriteOutcome>("save_export_file", params);
    }
    return browserMockBackend.saveExportFile(params.defaultFileName, params.content);
  },

  async openImportFile(params: {
    filterName: string;
    extensions: string[];
  }): Promise<FileReadOutcome> {
    if (isTauriRuntime()) {
      return invoke<FileReadOutcome>("open_import_file", params);
    }
    return browserMockBackend.openImportFile();
  },

  async openExternalUrl(url: string): Promise<void> {
    if (isTauriRuntime()) {
      return invoke("open_external_url", { url });
    }
    window.open(url, "_blank", "noopener,noreferrer");
  },
};
