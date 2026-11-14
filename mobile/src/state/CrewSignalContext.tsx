import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, BackHandler, Keyboard } from 'react-native';
import {
  DEFAULT_UNCONFIGURED_HELP,
  SIM_01_PROFILE_ID,
  applyInputUnitChange,
  buildBackupBundle,
  buildInstantTiming,
  buildPeriodTiming,
  computeMissionDay,
  convertGlucose,
  convertTemperature,
  formatSkipOutcomeMessage,
  formatUtcTimeHHMM,
  getDueMetricSchedules,
  missionDayAndTimeToUtc,
  planInputUnitChange,
  resolveHelpContent,
  validateDraftForReview,
  type AppPreferences,
  type AppearancePreference,
  type BodySystemId,
  type ResearchContext,
  type CheckInDraft,
  type CsvConflictChoice,
  type CsvPossibleDuplicateChoice,
  type CsvReconciliationPreview,
  type DraftRecoveryValidationResult,
  type GettingStartedDestination,
  type HelpProcedureCard,
  type Insight,
  type MetricId,
  type Observation,
  type PersonalReference,
  type ProfileConfig,
  type ReferenceValue,
  type ManualReferenceCapture,
  type SleepType,
} from '../shared/src';
import { defaultPlatformIo, type PlatformIoAdapter } from '../platform/files';
import {
  CrewSignalSqliteStore,
  LostCommitAcknowledgementError,
  type AppSnapshot,
  type CommitFailureSimulationMode,
  type ImportBatchCommitResult,
  type ProfileBackupData,
  type RestoreBackupResult,
  TARGET_MISSING_MESSAGE,
} from '../storage/sqliteStore';
import { backupIdentityOf, draftSignatureOf } from './backupIdentity';

export type CrewSignalRoute =
  | 'overview'
  | 'checkin'
  | 'explorer'
  | 'trends'
  | 'more'
  | 'actions'
  | 'reports'
  | 'sources'
  | 'settings'
  | 'help';

export interface UnitChangePendingState {
  nextUnit: 'mg/dL' | 'mmol/L' | 'C' | 'F';
  currentRaw: string;
  convertedPreview: string;
  currentUnit: string;
}

export interface CheckInCommitUiState {
  phase:
    | 'idle'
    | 'submitting'
    | 'saved'
    | 'unknown'
    | 'confirmed_not_saved'
    | 'unconfirmed'
    | 'storage_error';
  savedObservation: Observation | null;
  heading: string | null;
  message: string | null;
  isDuplicateReceipt: boolean;
}

export interface SkipOutcomeState {
  eventType: 'check_in_skipped' | 'measurement_unavailable';
  message: string;
  detail: string;
}

export type AppOperationKind =
  | 'safety_backup'
  | 'replace'
  | 'restore'
  | 'demo_reset'
  | 'delete_profile';

/**
 * The one destructive or file-writing operation the app is running right now.
 * It belongs to the provider, so it survives modal dismissal, route changes and
 * backgrounding; no screen owns it.
 */
export interface ActiveOperation {
  id: number;
  kind: AppOperationKind;
  profileId: string | null;
  label: string;
  phase: 'reading' | 'writing' | 'restoring' | 'refreshing' | 'working';
  /** Plain-language progress text, also used for the announcement. */
  description: string;
}

export type SafetyBackupStatus =
  | 'saved'
  | 'cancelled'
  | 'refused'
  | 'failed'
  | 'read_failed'
  | 'busy'
  | 'no_consent';

export interface SafetyBackupOutcome {
  /** Operation that produced this outcome; 0 when no operation started (busy, no consent). */
  operationId: number;
  status: SafetyBackupStatus;
  profileId: string;
  label: string;
  backupIdentity: string;
  message: string;
  savedAs: string | null;
  atUtc: string | null;
}

/** Set only when the file write returned `saved`; tied to the operation and profile that wrote it. */
export interface SavedSafetyBackup {
  operationId: number;
  profileId: string;
  backupIdentity: string;
  atUtc: string;
  savedAs: string;
}

export interface RestoreOperationResult extends RestoreBackupResult {
  draftNote?: string | null;
  /** Another operation was running; nothing was started or changed. */
  busy?: boolean;
  /** The backup or the target's drafts changed after the preview; nothing was changed. */
  stale?: boolean;
  /** The restore committed but the follow-up refresh from SQLite failed. */
  refreshFailed?: boolean;
  /** The provider ran (and now owns the outcome of) a write operation. */
  ranOperation?: boolean;
  /** Final user-facing sentence for a settled write operation. */
  summary?: string;
}

export interface RestoreOutcome {
  operationId: number;
  ok: boolean;
  /** `refreshFailed`: committed, but the screen could not be reloaded. */
  kind: 'restored' | 'rolled_back' | 'refresh_failed' | 'rejected' | 'stale' | 'target_missing';
  message: string;
}

export interface OperationActionResult {
  ok: boolean;
  busy?: boolean;
  message: string;
}

export interface CrewSignalContextValue {
  isLoading: boolean;
  loadError: string | null;
  snapshot: AppSnapshot | null;
  store: CrewSignalSqliteStore;
  io: PlatformIoAdapter;
  nowUtc: () => string;
  dueSchedules: ReturnType<typeof getDueMetricSchedules>;
  isKeyboardVisible: boolean;
  isOfflineSimulated: boolean;
  setOfflineSimulated: (offline: boolean) => void;
  activeRoute: CrewSignalRoute;
  previousRoute: CrewSignalRoute;
  selectedResearch: ResearchContext | null;
  openResearch: (context: ResearchContext) => void;
  researchReturnRoute: CrewSignalRoute;
  navigateTo: (route: CrewSignalRoute) => void;
  goBackFromHelp: () => void;
  gettingStarted: boolean;
  openGettingStarted: () => void;
  openGettingStartedStep: (destination: GettingStartedDestination) => void;
  showHelpProcedures: () => void;
  liveAnnouncement: string | null;
  announce: (message: string) => void;
  clearAnnouncement: () => void;

  // Derived active profile conveniences
  activeProfile: ProfileConfig | null;
  preferences: AppPreferences | null;
  observations: Observation[];
  references: PersonalReference[];
  insights: Insight[];
  checkInEvents: NonNullable<AppSnapshot['active']['checkInEvents']>;
  helpContent: HelpProcedureCard;

  // Navigation / View selection state preserved across theme & view switches
  selectedBodySystem: BodySystemId;
  setSelectedBodySystem: (id: BodySystemId) => void;
  selectedTrendsMetric: MetricId;
  setSelectedTrendsMetric: (id: MetricId) => void;
  trendsRangeDays: 7 | 30;
  setTrendsRangeDays: (days: 7 | 30) => void;
  selectedActionId: string;
  setSelectedActionId: (id: string) => void;

  // Check-in & Draft workflow
  activeDraft: CheckInDraft | null;
  commitState: CheckInCommitUiState;
  skipOutcome: SkipOutcomeState | null;
  unitChangeModal: UnitChangePendingState | null;
  sessionCommittedCount: number;
  startOrResumeCheckIn: (metricId?: MetricId, customDraft?: CheckInDraft) => void;
  switchCheckInMetric: (metricId: MetricId) => void;
  updateDraft: (updater: (prev: CheckInDraft) => CheckInDraft, persist?: boolean) => Promise<void>;
  requestUnitChange: (nextUnit: 'mg/dL' | 'mmol/L' | 'C' | 'F') => Promise<void>;
  confirmUnitChange: (strategy: 'convert' | 'clear') => Promise<void>;
  cancelUnitChange: () => void;
  backToRecordStage: () => Promise<void>;
  proceedToReviewStage: () => Promise<{ valid: boolean; firstInvalidField: string | null }>;
  commitCurrentDraft: (simulateMode?: CommitFailureSimulationMode, confirmedUnusualValue?: boolean) => Promise<void>;
  checkCurrentDraftCommitStatus: (simulateReadFailure?: boolean) => Promise<void>;
  discardCurrentDraft: () => Promise<void>;
  markCurrentUnavailable: (params: {
    reason: string;
    keepDraft: boolean;
  }) => Promise<void>;
  skipCurrentCheckIn: (params: {
    reason?: string;
    keepDraft: boolean;
  }) => Promise<void>;
  dismissSkipOutcome: () => void;

  // Preferences, Profiles, References, Insights, Reports/Recovery
  reload: () => Promise<void>;
  updatePreferences: (partial: Partial<AppPreferences>) => Promise<void>;
  setAppearance: (appearance: AppearancePreference) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  createPersonalProfile: (params: {
    label: string;
    alias?: string;
    missionName?: string;
    missionEpochUtc: string;
    displayTimezone?: string;
  }) => Promise<ProfileConfig>;
  updateProfile: (profile: ProfileConfig) => Promise<void>;
  savePersonalReference: (params: {
    metricId: Exclude<MetricId, 'mood'>;
    provenance: 'entered_preflight' | 'user_updated';
    method: string;
    context: string;
    unit: string;
    value: ReferenceValue;
    manualCapture?: ManualReferenceCapture;
  }) => Promise<void>;
  reviewInsight: (insight: Insight) => Promise<void>;
  commitCsvImport: (params: {
    preview: CsvReconciliationPreview;
    conflictChoices: Record<string, CsvConflictChoice>;
    possibleDuplicateChoices: Record<string, CsvPossibleDuplicateChoice>;
    acknowledgedExclusions: boolean;
    confirmedUnusualValues?: boolean;
    batchId: string;
  }) => Promise<ImportBatchCommitResult>;
  /**
   * A confirmed replace needs `expected`: the backup identity and the signature
   * of the target's drafts that the user previewed. Anything that no longer
   * matches is refused (`stale`) before a byte is written.
   */
  restoreBackup: (params: {
    rawBackup: unknown;
    destination: 'separate_profile' | 'replace_existing';
    targetExistingProfileId?: string;
    confirmedReplace?: boolean;
    expected?: { backupIdentity: string; draftSignature: string };
  }) => Promise<RestoreOperationResult>;
  importDraftRecovery: (rawBundle: unknown) => Promise<DraftRecoveryValidationResult>;
  resetDemoScenario: (profileId?: string) => Promise<OperationActionResult>;
  deletePersonalProfile: (profileId: string) => Promise<OperationActionResult>;
  /** Unfinished drafts a replacement of this profile would remove (stored and in memory). */
  loadDraftsForProfile: (
    profileId: string,
    options?: { strict?: boolean },
  ) => Promise<CheckInDraft[]>;
  /** The running safety-backup / replace / restore / reset / delete, or null. */
  activeOperation: ActiveOperation | null;
  /**
   * Reads one consistent snapshot of the target (active or not), asks the native
   * folder picker where to put it, and reports `saved` only after the write returned.
   */
  saveSafetyBackup: (params: {
    profileId: string;
    backupIdentity: string;
    consent: boolean;
  }) => Promise<SafetyBackupOutcome>;
  safetyBackupOutcome: SafetyBackupOutcome | null;
  lastSavedSafetyBackup: SavedSafetyBackup | null;
  clearSafetyBackupOutcome: () => void;
  /** Forget saved-backup credit (a new backup file was loaded, or the replace succeeded). */
  clearSavedSafetyBackup: () => void;
  restoreOutcome: RestoreOutcome | null;
  clearRestoreOutcome: () => void;
  lastBackupCreatedAtUtc: string | null;
  recordBackupExportedNow: () => void;
}

const CrewSignalContext = createContext<CrewSignalContextValue | null>(null);

const IDLE_COMMIT_STATE: CheckInCommitUiState = {
  phase: 'idle',
  savedObservation: null,
  heading: null,
  message: null,
  isDuplicateReceipt: false,
};

function computePreviewConversion(
  metricId: MetricId,
  raw: string,
  fromUnit: string,
  toUnit: string,
): string {
  const num = Number(raw.trim());
  if (!Number.isFinite(num)) return raw.trim();
  if (metricId === 'blood_glucose') {
    if ((fromUnit === 'mg/dL' || fromUnit === 'mmol/L') && (toUnit === 'mg/dL' || toUnit === 'mmol/L')) {
      const converted = convertGlucose(num, fromUnit, toUnit);
      return converted.rounded1.toFixed(1);
    }
  }
  if (metricId === 'body_temperature') {
    if ((fromUnit === 'C' || fromUnit === 'F') && (toUnit === 'C' || toUnit === 'F')) {
      const converted = convertTemperature(num, fromUnit, toUnit);
      return converted.rounded1.toFixed(1);
    }
  }
  return raw.trim();
}

export interface CrewSignalProviderProps {
  store: CrewSignalSqliteStore;
  io?: PlatformIoAdapter;
  clockOverrideUtc?: string;
  simulateLoadFailure?: boolean;
  children: React.ReactNode;
}

export function CrewSignalProvider({
  store,
  io = defaultPlatformIo,
  clockOverrideUtc,
  simulateLoadFailure = false,
  children,
}: CrewSignalProviderProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);

  const [selectedResearch, setSelectedResearch] = useState<ResearchContext | null>(null);
  const [researchReturnRoute, setResearchReturnRoute] = useState<CrewSignalRoute>('actions');
  const [activeRoute, setActiveRoute] = useState<CrewSignalRoute>('overview');
  const [previousRoute, setPreviousRoute] = useState<CrewSignalRoute>('overview');
  const [gettingStarted, setGettingStarted] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(true);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);

  const [selectedBodySystem, setSelectedBodySystem] = useState<BodySystemId>('cardiovascular');
  const [selectedTrendsMetric, setSelectedTrendsMetric] = useState<MetricId>('sleep');
  const [trendsRangeDays, setTrendsRangeDays] = useState<7 | 30>(7);
  const [selectedActionId, setSelectedActionId] = useState<string>('action-review-sleep-routine');

  const [activeDraft, setActiveDraft] = useState<CheckInDraft | null>(null);
  // Mirrors activeDraft for handoffs that run after an await.
  const activeDraftRef = useRef<CheckInDraft | null>(null);
  useEffect(() => {
    activeDraftRef.current = activeDraft;
  }, [activeDraft]);
  // ER-04: a draft that device storage refused is the only copy. When the view
  // moves to another profile it is parked here under its own profile, and it
  // returns when that profile is active again (until the app closes).
  const parkedDraftsRef = useRef<Record<string, CheckInDraft>>({});
  const [commitState, setCommitState] = useState<CheckInCommitUiState>(IDLE_COMMIT_STATE);
  const [skipOutcome, setSkipOutcome] = useState<SkipOutcomeState | null>(null);
  const [unitChangeModal, setUnitChangeModal] = useState<UnitChangePendingState | null>(null);
  const [sessionCommittedCount, setSessionCommittedCount] = useState(0);
  const [lastBackupCreatedAtUtc, setLastBackupCreatedAtUtc] = useState<string | null>(null);

  // App-level operation owner. The ref is the lock: it is read and written
  // synchronously, before any await, so two presses in the same tick cannot both
  // get in. The state mirrors it for rendering only.
  const opRef = useRef<ActiveOperation | null>(null);
  const opSeqRef = useRef(0);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation | null>(null);
  const [safetyBackupOutcome, setSafetyBackupOutcome] = useState<SafetyBackupOutcome | null>(null);
  const [lastSavedSafetyBackup, setLastSavedSafetyBackup] = useState<SavedSafetyBackup | null>(
    null,
  );
  const [restoreOutcome, setRestoreOutcome] = useState<RestoreOutcome | null>(null);
  const snapshotRef = useRef<AppSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const announce = useCallback((message: string) => {
    setLiveAnnouncement(message);
    AccessibilityInfo.announceForAccessibility?.(message);
  }, []);

  // The route can change while an operation is running, so the settle step reads
  // it from a ref rather than from the closure that started the operation.
  const activeRouteRef = useRef<CrewSignalRoute>('overview');
  activeRouteRef.current = activeRoute;

  /**
   * Outcome of a backup/restore operation. On Reports the same sentence is
   * already shown by the screen's own status banner, so only the screen reader
   * is told (no second copy of the text). Anywhere else the header live region
   * carries it, because the screen that would show it is not mounted.
   */
  const announceOperationOutcome = useCallback(
    (message: string) => {
      if (activeRouteRef.current === 'reports') {
        AccessibilityInfo.announceForAccessibility?.(message);
        return;
      }
      announce(message);
    },
    [announce],
  );

  const clearAnnouncement = useCallback(() => {
    setLiveAnnouncement(null);
  }, []);

  /**
   * Every draft write goes through here. A rejected write never throws into
   * the screen: the draft stays on screen marked memory_only and the failure
   * is announced. Only the status field is touched, keyed by draftId, so
   * keystrokes that landed during the await are kept.
   */
  const persistDraft = useCallback(
    async (draft: CheckInDraft): Promise<boolean> => {
      const setStatus = (status: CheckInDraft['retentionStatus']) =>
        setActiveDraft((prev) =>
          prev && prev.draftId === draft.draftId && prev.retentionStatus !== status
            ? { ...prev, retentionStatus: status }
            : prev,
        );
      try {
        await store.saveDraft({ ...draft, retentionStatus: 'retained' });
        setStatus('retained');
        return true;
      } catch {
        setStatus('memory_only');
        announce(
          "Couldn't save this draft on this device. It stays on this screen; export a draft backup to keep a copy.",
        );
        return false;
      }
    },
    [announce, store],
  );

  const dropParkedDraft = useCallback((profileId: string) => {
    if (!parkedDraftsRef.current[profileId]) return;
    const next = { ...parkedDraftsRef.current };
    delete next[profileId];
    parkedDraftsRef.current = next;
  }, []);

  /**
   * A confirmed save ("Added to your log" or a verified "Already in your log")
   * closes the draft: it is marked committed so no handoff, resume or reload
   * treats it as unfinished, and any parked copy of it is dropped. The receipt
   * lives in commitState and stays on screen.
   */
  const closeConfirmedDraft = useCallback(
    (draft: CheckInDraft, observationId: string | null) => {
      const close = (prev: CheckInDraft | null) =>
        prev && prev.draftId === draft.draftId
          ? { ...prev, commitStatus: 'committed' as const, committedObservationId: observationId }
          : prev;
      activeDraftRef.current = close(activeDraftRef.current);
      setActiveDraft(close);
      if (parkedDraftsRef.current[draft.profileId]?.draftId === draft.draftId) {
        dropParkedDraft(draft.profileId);
      }
    },
    [dropParkedDraft],
  );

  /**
   * Every draft that would be lost if this profile's data were replaced: the
   * open draft (when it belongs here), a parked memory-only copy, and stored
   * drafts. Works for inactive profiles too.
   */
  const loadDraftsForProfile = useCallback(
    async (profileId: string, options?: { strict?: boolean }): Promise<CheckInDraft[]> => {
      const found: CheckInDraft[] = [];
      const open = activeDraftRef.current;
      if (open && open.profileId === profileId && open.commitStatus !== 'committed') {
        found.push(open);
      }
      const parked = parkedDraftsRef.current[profileId];
      if (parked && !found.some((d) => d.draftId === parked.draftId)) found.push(parked);
      try {
        const stored = await store.loadProfileDrafts(profileId);
        for (const d of stored) {
          if (d.commitStatus !== 'committed' && !found.some((f) => f.draftId === d.draftId)) {
            found.push(d);
          }
        }
      } catch (err) {
        // A strict lookup (the replacement preview) must not pass off a partial
        // list as complete; otherwise the in-memory copies above are listed.
        if (options?.strict) throw err;
      }
      return found;
    },
    [store],
  );

  const profileLabelFor = useCallback((profileId: string | null): string => {
    if (!profileId) return 'this profile';
    return (
      snapshotRef.current?.profiles.find((p) => p.profileId === profileId)?.label ?? 'this profile'
    );
  }, []);

  /** Takes the lock, or returns null when something else already holds it. Never awaits. */
  const beginOperation = useCallback(
    (
      kind: AppOperationKind,
      profileId: string | null,
      phase: ActiveOperation['phase'],
      description: string,
    ): ActiveOperation | null => {
      if (opRef.current) return null;
      const op: ActiveOperation = {
        id: ++opSeqRef.current,
        kind,
        profileId,
        label: profileLabelFor(profileId),
        phase,
        description,
      };
      opRef.current = op;
      setActiveOperation(op);
      return op;
    },
    [profileLabelFor],
  );

  const setOperationPhase = useCallback(
    (op: ActiveOperation, phase: ActiveOperation['phase'], description: string) => {
      if (opRef.current?.id !== op.id) return;
      const next = { ...opRef.current, phase, description };
      opRef.current = next;
      setActiveOperation(next);
    },
    [],
  );

  const endOperation = useCallback((op: ActiveOperation) => {
    if (opRef.current?.id !== op.id) return;
    opRef.current = null;
    setActiveOperation(null);
  }, []);

  /** Why a request was refused: names what is running, says nothing was changed. */
  const busyMessage = useCallback(() => {
    const running = opRef.current;
    return running
      ? `${running.description} is still in progress. Wait for it to finish, then try again. Nothing was changed.`
      : 'Another operation is in progress. Wait for it to finish, then try again. Nothing was changed.';
  }, []);

  /**
   * Keeps the open draft with its own profile before the view moves away:
   * stored if the device accepts it, otherwise parked in memory.
   */
  const handOffLeavingDraft = useCallback(
    async (targetProfileId: string | null): Promise<'none' | 'stored' | 'memory_only'> => {
      const leaving = activeDraftRef.current;
      if (!leaving || leaving.commitStatus === 'committed' || leaving.profileId === targetProfileId) {
        return 'none';
      }
      // A draft whose identity is already in the log (for example after a lost
      // acknowledgement) is closed, not unfinished: never write it back.
      let alreadyCommitted = false;
      try {
        alreadyCommitted = await store.isDraftCommitted(leaving.profileId, leaving.draftId);
      } catch {
        alreadyCommitted = false;
      }
      if (alreadyCommitted) {
        dropParkedDraft(leaving.profileId);
        return 'none';
      }
      const next = { ...parkedDraftsRef.current };
      try {
        await store.saveDraft({ ...leaving, retentionStatus: 'retained' });
        delete next[leaving.profileId];
        parkedDraftsRef.current = next;
        return 'stored';
      } catch {
        next[leaving.profileId] = { ...leaving, retentionStatus: 'memory_only' };
        parkedDraftsRef.current = next;
        return 'memory_only';
      }
    },
    [dropParkedDraft, store],
  );

  /** The draft to show for the snapshot's profile: a parked one wins over storage. */
  const draftForSnapshot = useCallback((snap: AppSnapshot): CheckInDraft | null => {
    const pid = snap.active.profile.profileId;
    const parked = parkedDraftsRef.current[pid];
    if (parked) {
      const next = { ...parkedDraftsRef.current };
      delete next[pid];
      parkedDraftsRef.current = next;
      return parked;
    }
    return snap.active.drafts[0] ?? null;
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (simulateLoadFailure) {
        throw new Error('Could not open the CrewSignal local SQLite store.');
      }
      await store.initialize();
      const loaded = await store.loadAppSnapshot();
      setSnapshot(loaded);
      setActiveDraft((prev) => {
        if (
          prev &&
          prev.profileId === loaded.active.profile.profileId &&
          prev.commitStatus !== 'committed'
        ) {
          return prev;
        }
        return loaded.active.drafts[0] ?? null;
      });
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load CrewSignal data from device storage.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [simulateLoadFailure, store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeProfile = snapshot?.active.profile ?? null;
  const preferences = snapshot?.preferences ?? null;

  const [, refreshScheduleClock] = useState(0);
  useEffect(() => {
    if (clockOverrideUtc || activeProfile?.mode === 'demo') return;
    const timer = setInterval(() => refreshScheduleClock((tick) => tick + 1), 30_000);
    return () => clearInterval(timer);
  }, [activeProfile?.mode, clockOverrideUtc]);

  const nowUtc = useCallback((): string => {
    if (clockOverrideUtc) return clockOverrideUtc;
    if (activeProfile?.mode === 'demo' && activeProfile.snapshotUtc) {
      return activeProfile.snapshotUtc;
    }
    return new Date().toISOString();
  }, [activeProfile?.mode, activeProfile?.snapshotUtc, clockOverrideUtc]);

  const [scheduleNowUtc, setScheduleNowUtc] = useState(() => new Date().toISOString());
  const hasSchedules = Object.values(activeProfile?.schedules ?? {}).some((schedule) => schedule?.enabled);
  const usesFixedClock = Boolean(clockOverrideUtc || (activeProfile?.mode === 'demo' && activeProfile.snapshotUtc));
  useEffect(() => {
    if (!hasSchedules || usesFixedClock) return;
    const update = () => setScheduleNowUtc(new Date().toISOString());
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [activeProfile?.profileId, hasSchedules, usesFixedClock]);

  const dueSchedules = activeProfile && snapshot
    ? getDueMetricSchedules(
        activeProfile.schedules,
        snapshot.active.observations,
        usesFixedClock ? nowUtc() : scheduleNowUtc,
      )
    : [];

  const navigateTo = useCallback(
    (route: CrewSignalRoute) => {
      setSelectedResearch(null);
      if (route === 'help' && activeRoute !== 'help' && !gettingStarted) setPreviousRoute(activeRoute);
      setGettingStarted(false);
      setActiveRoute(route);
      if (route !== 'checkin' && route !== 'help') {
        setSkipOutcome(null);
      }
    },
    [activeRoute, gettingStarted],
  );

  function openResearch(context: ResearchContext) {
    navigateTo('sources');
    setResearchReturnRoute(activeRoute);
    setSelectedResearch(context);
  }

  const goBackFromHelp = useCallback(() => {
    setGettingStarted(false);
    setActiveRoute(previousRoute === 'help' ? 'overview' : previousRoute);
  }, [previousRoute]);

  const openGettingStarted = useCallback(() => {
    if (activeRoute !== 'help' && !gettingStarted) setPreviousRoute(activeRoute);
    setGettingStarted(true);
    setActiveRoute('help');
  }, [activeRoute, gettingStarted]);

  function openGettingStartedStep(destination: GettingStartedDestination) {
    if (activeProfile?.mode !== 'demo') return;
    if (destination === 'trends') setSelectedTrendsMetric('sleep');
    setActiveRoute(destination);
  }

  function showHelpProcedures() {
    setGettingStarted(false);
    setActiveRoute('help');
  }

  useEffect(() => {
    if (activeRoute !== 'help' && !gettingStarted) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeRoute === 'help') goBackFromHelp();
      else openGettingStarted();
      return true;
    });
    return () => subscription.remove();
  }, [activeRoute, gettingStarted, goBackFromHelp, openGettingStarted]);

  const openOrBuildDraft = useCallback(
    (metricId: MetricId, customDraft?: CheckInDraft): CheckInDraft | null => {
      if (!activeProfile || !preferences) return null;
      if (customDraft) {
        return customDraft;
      }
      const existingStored = snapshot?.active.drafts.find(
        (d) => d.profileId === activeProfile.profileId && d.metricId === metricId,
      );
      if (existingStored) return existingStored;
      return store.buildDraftForProfile({
        profile: activeProfile,
        metricId,
        preferences,
        nowUtc: nowUtc(),
      });
    },
    [activeProfile, nowUtc, preferences, snapshot?.active.drafts, store],
  );

  const startOrResumeCheckIn = useCallback(
    (metricId?: MetricId, customDraft?: CheckInDraft) => {
      setCommitState(IDLE_COMMIT_STATE);
      setSkipOutcome(null);
      if (customDraft) {
        setActiveDraft(customDraft);
        navigateTo('checkin');
        return;
      }
      if (
        !metricId &&
        activeDraft &&
        activeDraft.profileId === activeProfile?.profileId &&
        activeDraft.commitStatus !== 'committed'
      ) {
        navigateTo('checkin');
        return;
      }
      if (!metricId && snapshot?.active.drafts && snapshot.active.drafts.length > 0) {
        setActiveDraft(snapshot.active.drafts[0]!);
        navigateTo('checkin');
        return;
      }
      const targetMetric: MetricId = metricId ?? 'heart_rate';
      const draft = openOrBuildDraft(targetMetric);
      if (draft) {
        setActiveDraft(draft);
      }
      navigateTo('checkin');
    },
    [activeDraft, activeProfile?.profileId, navigateTo, openOrBuildDraft, snapshot?.active.drafts],
  );

  const switchCheckInMetric = useCallback(
    (metricId: MetricId) => {
      setCommitState(IDLE_COMMIT_STATE);
      setSkipOutcome(null);
      setUnitChangeModal(null);
      if (
        activeDraft &&
        activeDraft.metricId === metricId &&
        activeDraft.commitStatus !== 'committed'
      ) {
        return;
      }
      const next = openOrBuildDraft(metricId);
      if (next) {
        setActiveDraft(next);
      }
    },
    [activeDraft, openOrBuildDraft],
  );

  const updateDraft = useCallback(
    async (updater: (prev: CheckInDraft) => CheckInDraft, persist = true) => {
      const previous = activeDraftRef.current;
      if (!previous) return;
      const nextDraft = updater({ ...previous, updatedAtUtc: nowUtc() });
      activeDraftRef.current = nextDraft;
      setActiveDraft(nextDraft);
      if (persist) {
        if (await persistDraft(nextDraft)) {
          const reloaded = await store.loadAppSnapshot();
          setSnapshot(reloaded);
        }
      }
    },
    [nowUtc, persistDraft, store],
  );

  const requestUnitChange = useCallback(
    async (nextUnit: 'mg/dL' | 'mmol/L' | 'C' | 'F') => {
      if (!activeDraft) return;
      const plan = planInputUnitChange(
        activeDraft.rawFields.primary,
        activeDraft.selectedUnit,
        nextUnit,
      );
      if (!plan.requiresConfirmation) {
        const applied = applyInputUnitChange(activeDraft, nextUnit, true, nowUtc());
        setActiveDraft(applied);
        await persistDraft(applied);
        return;
      }

      setUnitChangeModal({
        nextUnit,
        currentRaw: plan.currentRawValue,
        convertedPreview: computePreviewConversion(
          activeDraft.metricId,
          plan.currentRawValue,
          plan.fromUnit,
          plan.toUnit,
        ),
        currentUnit: plan.fromUnit,
      });
    },
    [activeDraft, nowUtc, persistDraft],
  );

  const confirmUnitChange = useCallback(
    async (strategy: 'convert' | 'clear') => {
      if (!activeDraft || !unitChangeModal) return;
      const cleared = applyInputUnitChange(
        activeDraft,
        unitChangeModal.nextUnit,
        true,
        nowUtc(),
      );
      const nextDraft: CheckInDraft =
        strategy === 'convert'
          ? {
              ...cleared,
              rawFields: {
                ...cleared.rawFields,
                primary: unitChangeModal.convertedPreview,
              },
            }
          : cleared;
      setUnitChangeModal(null);
      setActiveDraft(nextDraft);
      const saved = await persistDraft(nextDraft);
      if (saved) announce(
        strategy === 'convert'
          ? `Converted measurement unit to ${unitChangeModal.nextUnit}.`
          : `Cleared entry and switched unit to ${unitChangeModal.nextUnit}.`,
      );
    },
    [activeDraft, announce, nowUtc, persistDraft, unitChangeModal],
  );

  const cancelUnitChange = useCallback(() => {
    setUnitChangeModal(null);
  }, []);

  const backToRecordStage = useCallback(async () => {
    if (!activeDraft) return;
    setCommitState(IDLE_COMMIT_STATE);
    const updated: CheckInDraft = {
      ...activeDraft,
      stage: 'record',
      updatedAtUtc: nowUtc(),
    };
    setActiveDraft(updated);
    await persistDraft(updated);
  }, [activeDraft, nowUtc, persistDraft]);

  const proceedToReviewStage = useCallback(async (): Promise<{
    valid: boolean;
    firstInvalidField: string | null;
  }> => {
    if (!activeDraft) {
      return { valid: false, firstInvalidField: null };
    }
    const result = validateDraftForReview(activeDraft, nowUtc());
    const resolvedObservedAtUtc = result.timing
      ? result.timing.kind === 'instant'
        ? result.timing.observedAtUtc
        : result.timing.reportedAtUtc
      : activeDraft.observedAtUtc;

    const normalizedDraft: CheckInDraft = {
      ...activeDraft,
      stage: result.validationState.valid ? 'review' : 'record',
      observedAtUtc: resolvedObservedAtUtc,
      validationState: result.validationState,
      normalizedCandidate: result.canonical,
      updatedAtUtc: nowUtc(),
    };
    setActiveDraft(normalizedDraft);
    const saved = await persistDraft(normalizedDraft);

    if (!result.validationState.valid) {
      const msg =
        result.validationState.announcement ??
        Object.values(result.validationState.errors)[0] ??
        'Check highlighted fields before reviewing.';
      announce(msg);
      return {
        valid: false,
        firstInvalidField: result.validationState.firstInvalidField,
      };
    }

    setCommitState(IDLE_COMMIT_STATE);
    // A failed write already announced itself; don't talk over it.
    if (saved) announce('Ready to review measurement before adding to log.');
    return { valid: true, firstInvalidField: null };
  }, [activeDraft, announce, nowUtc, persistDraft]);

  const commitCurrentDraft = useCallback(
    async (simulateMode: CommitFailureSimulationMode = 'none', confirmedUnusualValue?: boolean) => {
      if (!activeDraft) return;
      setCommitState({
        phase: 'submitting',
        savedObservation: null,
        heading: null,
        message: 'Saving to local SQLite log…',
        isDuplicateReceipt: false,
      });

      try {
        const res = await store.commitDraftObservation({
          draft: activeDraft,
          committedAtUtc: nowUtc(),
          simulateFailureMode: simulateMode,
          confirmedUnusualValue,
        });

        if (res.outcome === 'validation_error') {
          setCommitState(IDLE_COMMIT_STATE);
          announce(res.error ?? 'Entry validation failed.');
          return;
        }

        const refreshed = await store.loadAppSnapshot();
        setSnapshot(refreshed);
        if (res.outcome === 'insert') {
          setSessionCommittedCount((c) => c + 1);
        }

        const isDup = res.outcome === 'already_in_log';
        closeConfirmedDraft(activeDraft, res.observation?.observationId ?? null);
        setCommitState({
          phase: 'saved',
          savedObservation: res.observation,
          heading: isDup ? 'Already in your log' : 'Added to your log',
          message: isDup
            ? 'Stored on this device. No duplicate entry was created.'
            : 'Saved on this device in one atomic transaction.',
          isDuplicateReceipt: isDup,
        });
        announce(
          isDup
            ? 'Already in your log. No duplicate entry created.'
            : 'Added to your log on this device.',
        );
      } catch (err) {
        if (err instanceof LostCommitAcknowledgementError) {
          setCommitState({
            phase: 'unknown',
            savedObservation: null,
            heading: 'Saving status unknown',
            message: 'Check the log for this entry before adding again.',
            isDuplicateReceipt: false,
          });
          announce('Saving status unknown. Check the log before trying again.');
          return;
        }

        setCommitState({
          phase: 'storage_error',
          savedObservation: null,
          heading: "Didn't save to the log",
          message:
            'Your draft is still ready on this device. Try adding again, or export your draft backup.',
          isDuplicateReceipt: false,
        });
        announce("Didn't save to the log. Your draft is still preserved.");
      }
    },
    [activeDraft, announce, closeConfirmedDraft, nowUtc, store],
  );

  const checkCurrentDraftCommitStatus = useCallback(
    async (simulateReadFailure = false) => {
      if (!activeDraft) return;
      const resolution = await store.checkDraftCommitStatus({
        profileId: activeDraft.profileId,
        draftId: activeDraft.draftId,
        simulateStorageReadFailure: simulateReadFailure,
      });

      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);

      if (resolution.status === 'already_in_log') {
        closeConfirmedDraft(
          activeDraft,
          resolution.existingObservation?.observationId ?? null,
        );
        setCommitState({
          phase: 'saved',
          savedObservation: resolution.existingObservation,
          heading: resolution.heading,
          message: resolution.message,
          isDuplicateReceipt: true,
        });
        announce('Already in your log. No duplicate entry was created.');
        return;
      }

      if (resolution.status === 'confirmed_not_saved') {
        setCommitState({
          phase: 'confirmed_not_saved',
          savedObservation: null,
          heading: resolution.heading,
          message: resolution.message,
          isDuplicateReceipt: false,
        });
        announce('Log addition did not complete. Your draft is still ready.');
        return;
      }

      setCommitState({
        phase: 'unconfirmed',
        savedObservation: null,
        heading: resolution.heading,
        message: resolution.message,
        isDuplicateReceipt: false,
      });
      announce('Addition unconfirmed. Check the log before adding again.');
    },
    [activeDraft, announce, closeConfirmedDraft, store],
  );

  const discardCurrentDraft = useCallback(async () => {
    if (!activeDraft || !activeProfile || !preferences) return;
    await store.discardDraft(activeProfile.profileId, activeDraft.draftId);
    const refreshed = await store.loadAppSnapshot();
    setSnapshot(refreshed);
    const freshDraft = store.buildDraftForProfile({
      profile: refreshed.active.profile,
      metricId: activeDraft.metricId,
      preferences: refreshed.preferences,
      nowUtc: nowUtc(),
    });
    setActiveDraft(freshDraft);
    setCommitState(IDLE_COMMIT_STATE);
    announce('Draft discarded.');
  }, [activeDraft, activeProfile, announce, nowUtc, preferences, store]);

  const markCurrentUnavailable = useCallback(
    async (params: { reason: string; keepDraft: boolean }) => {
      if (!activeProfile) return;
      const timestamp = nowUtc();
      const attemptedMissionDay = computeMissionDay(timestamp, activeProfile.missionEpochUtc);
      const timeLabel = formatUtcTimeHHMM(timestamp);
      const metricId = activeDraft?.metricId ?? 'heart_rate';

      const event = {
        eventId: `ev-unavail-${Date.now()}`,
        profileId: activeProfile.profileId,
        eventType: 'measurement_unavailable' as const,
        metricId,
        reason: params.reason.trim() || 'Instrument unavailable',
        attemptedAtUtc: timestamp,
        attemptedMissionDay,
        attemptedTimeLabel: timeLabel,
        missionEpochUtc: activeProfile.missionEpochUtc,
        keptDraftId: params.keepDraft ? activeDraft?.draftId ?? null : null,
        committedCountInSession: sessionCommittedCount,
        recordedAtUtc: timestamp,
      };

      await store.recordWorkflowEvent({
        event,
        discardDraftId: params.keepDraft ? null : activeDraft?.draftId ?? null,
        keepDraft: params.keepDraft ? activeDraft : null,
      });

      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
      if (!params.keepDraft && preferences) {
        setActiveDraft(
          store.buildDraftForProfile({
            profile: refreshed.active.profile,
            metricId,
            preferences: refreshed.preferences,
            nowUtc: timestamp,
          }),
        );
      }

      const summary = formatSkipOutcomeMessage(sessionCommittedCount);
      setSkipOutcome({
        eventType: 'measurement_unavailable',
        message: 'Measurement unavailable recorded.',
        detail: `${summary} Past log entries were not changed.`,
      });
      announce(`Measurement unavailable recorded. ${summary}`);
    },
    [
      activeDraft,
      activeProfile,
      announce,
      nowUtc,
      preferences,
      sessionCommittedCount,
      store,
    ],
  );

  const skipCurrentCheckIn = useCallback(
    async (params: { reason?: string; keepDraft: boolean }) => {
      if (!activeProfile) return;
      const timestamp = nowUtc();
      const attemptedMissionDay = computeMissionDay(timestamp, activeProfile.missionEpochUtc);
      const timeLabel = formatUtcTimeHHMM(timestamp);

      const event = {
        eventId: `ev-skip-${Date.now()}`,
        profileId: activeProfile.profileId,
        eventType: 'check_in_skipped' as const,
        metricId: null,
        reason: params.reason?.trim() || null,
        attemptedAtUtc: timestamp,
        attemptedMissionDay,
        attemptedTimeLabel: timeLabel,
        missionEpochUtc: activeProfile.missionEpochUtc,
        keptDraftId: params.keepDraft ? activeDraft?.draftId ?? null : null,
        committedCountInSession: sessionCommittedCount,
        recordedAtUtc: timestamp,
      };

      await store.recordWorkflowEvent({
        event,
        discardDraftId: params.keepDraft ? null : activeDraft?.draftId ?? null,
        keepDraft: params.keepDraft ? activeDraft : null,
      });

      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
      if (!params.keepDraft) {
        setActiveDraft(null);
      }

      const summary = formatSkipOutcomeMessage(sessionCommittedCount);
      setSkipOutcome({
        eventType: 'check_in_skipped',
        message: summary,
        detail: params.keepDraft
          ? 'Open draft stayed uncommitted on this device.'
          : 'No measurements were committed as readings.',
      });
      announce(`Check-in skipped. ${summary}`);
    },
    [activeDraft, activeProfile, announce, nowUtc, sessionCommittedCount, store],
  );

  const dismissSkipOutcome = useCallback(() => {
    setSkipOutcome(null);
    navigateTo('overview');
  }, [navigateTo]);

  const updatePreferences = useCallback(
    async (partial: Partial<AppPreferences>) => {
      await store.updatePreferences(partial);
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
    },
    [store],
  );

  const setAppearance = useCallback(
    async (appearance: AppearancePreference) => {
      await store.updatePreferences({ appearance });
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
    },
    [store],
  );

  const switchProfile = useCallback(
    async (profileId: string) => {
      await handOffLeavingDraft(profileId);
      await store.updatePreferences({ activeProfileId: profileId });
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
      setActiveDraft(draftForSnapshot(refreshed));
      setCommitState(IDLE_COMMIT_STATE);
      setSkipOutcome(null);
      setSessionCommittedCount(0);
    },
    [draftForSnapshot, handOffLeavingDraft, store],
  );

  const createPersonalProfile = useCallback(
    async (params: {
      label: string;
      alias?: string;
      missionName?: string;
      missionEpochUtc: string;
      displayTimezone?: string;
    }) => {
      await handOffLeavingDraft(null);
      const created = await store.createPersonalProfile({
        ...params,
        nowUtc: new Date().toISOString(),
      });
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
      setActiveDraft(null);
      setCommitState(IDLE_COMMIT_STATE);
      setSkipOutcome(null);
      setSessionCommittedCount(0);
      return created;
    },
    [handOffLeavingDraft, store],
  );

  const updateProfile = useCallback(
    async (profile: ProfileConfig) => {
      await store.updateProfileConfig(profile);
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
    },
    [store],
  );

  const savePersonalReference = useCallback(
    async (params: {
      metricId: Exclude<MetricId, 'mood'>;
      provenance: 'entered_preflight' | 'user_updated';
      method: string;
      context: string;
      unit: string;
      value: ReferenceValue;
    manualCapture?: ManualReferenceCapture;
    }) => {
      if (!activeProfile) return;
      await store.upsertPersonalReference({
        profileId: activeProfile.profileId,
        ...params,
        nowUtc: nowUtc(),
      });
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
      announce(`Updated personal reference for ${params.metricId}.`);
    },
    [activeProfile, announce, nowUtc, store],
  );

  const reviewInsight = useCallback(
    async (insight: Insight) => {
      if (!activeProfile || insight.profileId !== activeProfile.profileId) return;
      await store.markInsightReviewed({
        insight,
        reviewedAtUtc: nowUtc(),
      });
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
    },
    [activeProfile, nowUtc, store],
  );

  const commitCsvImport = useCallback(
    async (params: {
      preview: CsvReconciliationPreview;
      conflictChoices: Record<string, CsvConflictChoice>;
      possibleDuplicateChoices: Record<string, CsvPossibleDuplicateChoice>;
      acknowledgedExclusions: boolean;
      confirmedUnusualValues?: boolean;
      batchId: string;
    }) => {
      if (!activeProfile) {
        return {
          ready: false,
          error: 'No active profile selected.',
          batchId: null,
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
        };
      }
      const res = await store.commitCsvImportBatch({
        profileId: activeProfile.profileId,
        preview: params.preview,
        conflictChoices: params.conflictChoices,
        possibleDuplicateChoices: params.possibleDuplicateChoices,
        acknowledgedExclusions: params.acknowledgedExclusions,
        confirmedUnusualValues: params.confirmedUnusualValues,
        nowUtc: nowUtc(),
        batchId: params.batchId,
      });
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
      return res;
    },
    [activeProfile, nowUtc, store],
  );

  const restoreBackup = useCallback(
    async (params: {
      rawBackup: unknown;
      destination: 'separate_profile' | 'replace_existing';
      targetExistingProfileId?: string;
      confirmedReplace?: boolean;
      expected?: { backupIdentity: string; draftSignature: string };
    }): Promise<RestoreOperationResult> => {
      const replaceTarget =
        params.destination === 'replace_existing' ? params.targetExistingProfileId ?? null : null;
      const storeParams = {
        rawBackup: params.rawBackup,
        destination: params.destination,
        targetExistingProfileId: params.targetExistingProfileId,
        confirmedReplace: params.confirmedReplace,
        rejectPersonalInPublicDemo: false,
      };

      // A replace that is not yet confirmed is a read-only question ("what would
      // this do?"). It takes no lock because it writes nothing, but it is refused
      // while another operation is running so the answer is never about to go stale.
      if (params.destination === 'replace_existing' && params.confirmedReplace !== true) {
        if (opRef.current) {
          const msg = busyMessage();
          announce(msg);
          return { ok: false, error: msg, busy: true };
        }
        let dry: RestoreBackupResult;
        try {
          dry = await store.restoreBackupBundle(storeParams);
        } catch {
          return {
            ok: false,
            error: 'Restore could not complete. Nothing was changed; your drafts are still where they were.',
          };
        }
        return dry;
      }

      // Acquire synchronously: nothing above awaits, and nothing runs between the
      // check and the claim.
      const targetLabel = replaceTarget ? profileLabelFor(replaceTarget) : null;
      const op = beginOperation(
        replaceTarget ? 'replace' : 'restore',
        replaceTarget,
        'restoring',
        replaceTarget ? `The replacement of "${targetLabel}"` : 'The backup restore',
      );
      if (!op) {
        const msg = busyMessage();
        announce(msg);
        return { ok: false, error: msg, busy: true };
      }
      setRestoreOutcome(null);

      const settle = (
        result: RestoreOperationResult,
        kind: RestoreOutcome['kind'],
        message: string,
      ): RestoreOperationResult => {
        setRestoreOutcome({ operationId: op.id, ok: result.ok, kind, message });
        announceOperationOutcome(message);
        return { ...result, ranOperation: true, summary: message };
      };

      try {
        let supersededDrafts: CheckInDraft[] = [];
        if (replaceTarget) {
          // The write must be for exactly what the user previewed and consented to.
          const expected = params.expected;
          if (!expected) {
            const msg =
              'Preview the open drafts of the profile you chose before replacing it. Nothing was changed.';
            return settle({ ok: false, error: msg, stale: true }, 'stale', msg);
          }
          if (!snapshotRef.current?.profiles.some((p) => p.profileId === replaceTarget)) {
            return settle(
              { ok: false, error: TARGET_MISSING_MESSAGE, targetMissing: true },
              'target_missing',
              TARGET_MISSING_MESSAGE,
            );
          }
          if (backupIdentityOf(params.rawBackup) !== expected.backupIdentity) {
            const msg =
              'The backup you previewed is no longer the one loaded. Nothing was changed. Choose the file again.';
            return settle({ ok: false, error: msg, stale: true }, 'stale', msg);
          }
          try {
            supersededDrafts = await loadDraftsForProfile(replaceTarget, { strict: true });
          } catch {
            const msg = `The open drafts of "${targetLabel}" could not be checked. Nothing was changed. Try again.`;
            return settle({ ok: false, error: msg, stale: true }, 'stale', msg);
          }
          if (draftSignatureOf(supersededDrafts) !== expected.draftSignature) {
            const msg = `The drafts that would be removed from "${targetLabel}" changed after you previewed them. Nothing was changed. Review the updated preview and confirm again.`;
            return settle({ ok: false, error: msg, stale: true }, 'stale', msg);
          }
        }

        let res: RestoreBackupResult;
        try {
          res = await store.restoreBackupBundle(storeParams);
        } catch {
          // The transaction rolled back: storage and every in-memory draft are
          // exactly as they were.
          const msg =
            'Restore could not complete. Nothing was changed; your drafts are still where they were.';
          return settle({ ok: false, error: msg }, 'rolled_back', msg);
        }

        // A rejected restore wrote nothing: the open draft stays exactly where it is.
        if (!res.ok) {
          const msg = res.error ?? 'Restore could not complete.';
          try {
            setSnapshot(await store.loadAppSnapshot());
          } catch {
            // Nothing was written, so the screen already shows the stored data.
          }
          return settle(
            res,
            res.targetMissing ? 'target_missing' : 'rejected',
            res.targetMissing ? res.error ?? TARGET_MISSING_MESSAGE : msg,
          );
        }

        // Committed. From here the restore is never reported as rolled back: any
        // failure below is a refresh failure, reported on its own.
        setOperationPhase(op, 'refreshing', op.description);
        const destinationId = res.restoredProfileId ?? null;
        let draftNote: string | null = null;
        let refreshFailed = false;
        try {
          // The source profile's open draft goes with its own profile (stored, or
          // parked in memory) unless it lives in the profile that was replaced.
          const leaving = activeDraftRef.current;
          if (leaving && leaving.profileId !== destinationId) {
            const handoff = await handOffLeavingDraft(destinationId);
            if (handoff === 'memory_only') {
              draftNote =
                "Your open draft couldn't be saved, so it is kept in memory with its profile until you close CrewSignal.";
            }
          }
          if (replaceTarget && destinationId) {
            // The replace transaction deleted that profile's stored drafts. Drop
            // every in-memory copy too, so a superseded draft can never be saved
            // back over the restored data, even if the reload below fails.
            dropParkedDraft(destinationId);
            if (activeDraftRef.current?.profileId === destinationId) {
              activeDraftRef.current = null;
              setActiveDraft(null);
            }
            if (supersededDrafts.length > 0) {
              const removed =
                supersededDrafts.length === 1
                  ? 'Its open draft was'
                  : `Its ${supersededDrafts.length} open drafts were`;
              draftNote = [draftNote, `${removed} removed with the replaced profile data.`]
                .filter(Boolean)
                .join(' ');
            }
          }
          const refreshed = await store.loadAppSnapshot();
          setSnapshot(refreshed);
          setActiveDraft(draftForSnapshot(refreshed));
        } catch {
          refreshFailed = true;
        }

        // The replacement is done, so a safety-backup credit for the old data is spent.
        if (replaceTarget) {
          setLastSavedSafetyBackup(null);
          setSafetyBackupOutcome(null);
        }
        const withNote = draftNote ? ` ${draftNote}` : '';
        if (refreshFailed) {
          const msg = `Restored "${res.restoredLabel}" into SQLite storage, but CrewSignal could not reload the stored data afterwards. The restore was committed and was not rolled back. Close and reopen CrewSignal to see it.${withNote}`;
          return settle({ ...res, draftNote, refreshFailed: true }, 'refresh_failed', msg);
        }
        const msg = `Restored "${res.restoredLabel}" cleanly into SQLite storage.${withNote}`;
        return settle({ ...res, draftNote }, 'restored', msg);
      } finally {
        endOperation(op);
      }
    },
    [
      announce,
      announceOperationOutcome,
      beginOperation,
      busyMessage,
      draftForSnapshot,
      dropParkedDraft,
      endOperation,
      handOffLeavingDraft,
      loadDraftsForProfile,
      profileLabelFor,
      setOperationPhase,
      store,
    ],
  );

  /**
   * Full backup of one profile (active or not) to a file the user places with
   * the native folder picker. The lock is held from the first read until the
   * write has been acknowledged (or has failed), whatever the UI does meanwhile.
   * The SQLite read is its own short transaction; the picker wait happens outside it.
   */
  const saveSafetyBackup = useCallback(
    async (params: {
      profileId: string;
      backupIdentity: string;
      consent: boolean;
    }): Promise<SafetyBackupOutcome> => {
      const { profileId, backupIdentity } = params;
      const label = profileLabelFor(profileId);
      const outcome = (
        status: SafetyBackupStatus,
        message: string,
        extra?: { operationId?: number; savedAs?: string; atUtc?: string },
      ): SafetyBackupOutcome => ({
        operationId: extra?.operationId ?? 0,
        status,
        profileId,
        label,
        backupIdentity,
        message,
        savedAs: extra?.savedAs ?? null,
        atUtc: extra?.atUtc ?? null,
      });

      if (!params.consent) {
        const result = outcome(
          'no_consent',
          `Safety backup not saved for ${label}. Confirm that the file may include all of its data, private notes too, first.`,
        );
        setSafetyBackupOutcome(result);
        return result;
      }

      // Acquire before the first await.
      const op = beginOperation(
        'safety_backup',
        profileId,
        'reading',
        `The safety backup of "${label}"`,
      );
      if (!op) {
        const msg = busyMessage();
        announce(msg);
        // Not stored: the running operation will report its own outcome.
        return outcome('busy', msg);
      }
      setSafetyBackupOutcome(null);

      const settle = (result: SafetyBackupOutcome): SafetyBackupOutcome => {
        setSafetyBackupOutcome(result);
        announceOperationOutcome(result.message);
        return result;
      };

      try {
        let content: string;
        const exportedAtUtc = nowUtc();
        try {
          const data: ProfileBackupData = await store.readProfileBackupData(profileId);
          const backup = buildBackupBundle({
            confirmedIncludeAllProfileData: true,
            exportedAtUtc,
            profile: data.profile,
            // The file describes the target alone, as if exported while it was active.
            preferences: { ...data.preferences, activeProfileId: profileId },
            observations: data.observations,
            checkInEvents: data.checkInEvents,
            references: data.references,
            insights: data.insights,
          });
          content = `${JSON.stringify(backup, null, 2)}\n`;
        } catch {
          return settle(
            outcome(
              'read_failed',
              `Safety backup not saved. ${label}'s data couldn't be read; nothing was changed.`,
              { operationId: op.id },
            ),
          );
        }

        setOperationPhase(op, 'writing', op.description);
        const filename = `crewsignal-backup-${profileId}.json`;
        let res: Awaited<ReturnType<PlatformIoAdapter['saveTextFile']>> | null;
        try {
          res = await io.saveTextFile({
            filename,
            content,
            mimeType: 'application/json',
            // The user picks where the recovery copy goes (native folder picker).
            chooseDestination: true,
            // A repeat save never replaces an earlier recovery copy.
            avoidOverwrite: true,
          });
        } catch {
          res = null;
        }

        if (res?.outcome === 'saved') {
          const savedAs = res.savedAs ?? filename;
          setLastSavedSafetyBackup({
            operationId: op.id,
            profileId,
            backupIdentity,
            atUtc: exportedAtUtc,
            savedAs,
          });
          setLastBackupCreatedAtUtc(exportedAtUtc);
          return settle(
            outcome('saved', `Safety backup saved for ${label}. ${res.detail}`, {
              operationId: op.id,
              savedAs,
              atUtc: exportedAtUtc,
            }),
          );
        }
        const status: SafetyBackupStatus =
          res?.outcome === 'cancelled'
            ? 'cancelled'
            : res?.outcome === 'access_refused'
              ? 'refused'
              : 'failed';
        const reason = res ? `${res.label}. ${res.detail}` : 'The file could not be written.';
        return settle(
          outcome(status, `Safety backup not saved for ${label}. ${reason}`, {
            operationId: op.id,
          }),
        );
      } finally {
        endOperation(op);
      }
    },
    [
      announce,
      announceOperationOutcome,
      beginOperation,
      busyMessage,
      endOperation,
      io,
      nowUtc,
      profileLabelFor,
      setOperationPhase,
      store,
    ],
  );

  const clearSafetyBackupOutcome = useCallback(() => setSafetyBackupOutcome(null), []);
  const clearSavedSafetyBackup = useCallback(() => {
    setLastSavedSafetyBackup(null);
    setSafetyBackupOutcome(null);
  }, []);
  const clearRestoreOutcome = useCallback(() => setRestoreOutcome(null), []);

  const importDraftRecovery = useCallback(
    async (rawBundle: unknown) => {
      const pid = activeProfile?.profileId ?? SIM_01_PROFILE_ID;
      const res = await store.importDraftRecoveryBundle({
        rawBundle,
        activeProfileId: pid,
      });
      const refreshed = await store.loadAppSnapshot();
      setSnapshot(refreshed);
      if (res.valid && res.status === 'resume_draft' && res.bundle) {
        setActiveDraft({
          ...res.bundle.draft,
          profileId: pid,
          retentionStatus: 'retained',
          commitStatus: 'uncommitted',
        });
      }
      return res;
    },
    [activeProfile?.profileId, store],
  );

  const resetDemoScenario = useCallback(
    async (profileId?: string): Promise<OperationActionResult> => {
      const targetId = profileId ?? activeProfile?.profileId ?? SIM_01_PROFILE_ID;
      const op = beginOperation(
        'demo_reset',
        targetId,
        'working',
        `The demo reset of "${profileLabelFor(targetId)}"`,
      );
      if (!op) {
        const message = busyMessage();
        announce(message);
        return { ok: false, busy: true, message };
      }
      try {
        // The reset closes that demo profile's drafts only; another profile's
        // open draft is kept with it.
        await handOffLeavingDraft(targetId);
        dropParkedDraft(targetId);
        await store.resetDemoProfile(targetId);
        const refreshed = await store.loadAppSnapshot();
        setSnapshot(refreshed);
        setActiveDraft(draftForSnapshot(refreshed));
        setCommitState(IDLE_COMMIT_STATE);
        setSkipOutcome(null);
        setSessionCommittedCount(0);
        const message = 'Synthetic demo scenario reset cleanly without affecting personal profiles.';
        announce(message);
        return { ok: true, message };
      } catch {
        const message =
          'Demo reset could not complete. Check the log before relying on this profile.';
        announce(message);
        return { ok: false, message };
      } finally {
        endOperation(op);
      }
    },
    [
      activeProfile?.profileId,
      announce,
      beginOperation,
      busyMessage,
      draftForSnapshot,
      dropParkedDraft,
      endOperation,
      handOffLeavingDraft,
      profileLabelFor,
      store,
    ],
  );

  const deletePersonalProfile = useCallback(
    async (profileId: string): Promise<OperationActionResult> => {
      const op = beginOperation(
        'delete_profile',
        profileId,
        'working',
        `The deletion of "${profileLabelFor(profileId)}"`,
      );
      if (!op) {
        const message = busyMessage();
        announce(message);
        return { ok: false, busy: true, message };
      }
      try {
        await handOffLeavingDraft(profileId);
        await store.deletePersonalProfile(profileId);
        dropParkedDraft(profileId);
        const refreshed = await store.loadAppSnapshot();
        setSnapshot(refreshed);
        setActiveDraft(draftForSnapshot(refreshed));
        setCommitState(IDLE_COMMIT_STATE);
        setSkipOutcome(null);
        setSessionCommittedCount(0);
        const message = 'Personal log deleted cleanly from this device.';
        announce(message);
        return { ok: true, message };
      } catch {
        const message =
          'Deleting this personal log could not complete. Check the profile list before trying again.';
        announce(message);
        return { ok: false, message };
      } finally {
        endOperation(op);
      }
    },
    [
      announce,
      beginOperation,
      busyMessage,
      draftForSnapshot,
      dropParkedDraft,
      endOperation,
      handOffLeavingDraft,
      profileLabelFor,
      store,
    ],
  );

  const recordBackupExportedNow = useCallback(() => {
    setLastBackupCreatedAtUtc(nowUtc());
  }, [nowUtc]);

  const helpContent = useMemoHelper(preferences);

  const value: CrewSignalContextValue = {
    isLoading,
    loadError,
    snapshot,
    store,
    io,
    nowUtc,
    dueSchedules,
    isKeyboardVisible,
    isOfflineSimulated,
    setOfflineSimulated: setIsOfflineSimulated,
    activeRoute,
    selectedResearch,
    openResearch,
    researchReturnRoute,
    previousRoute,
    navigateTo,
    goBackFromHelp,
    gettingStarted,
    openGettingStarted,
    openGettingStartedStep,
    showHelpProcedures,
    liveAnnouncement,
    announce,
    clearAnnouncement,

    activeProfile,
    preferences,
    observations: snapshot?.active.observations ?? [],
    references: snapshot?.active.references ?? [],
    insights: snapshot?.active.insights ?? [],
    checkInEvents: snapshot?.active.checkInEvents ?? [],
    helpContent,

    selectedBodySystem,
    setSelectedBodySystem,
    selectedTrendsMetric,
    setSelectedTrendsMetric,
    trendsRangeDays,
    setTrendsRangeDays,
    selectedActionId,
    setSelectedActionId,

    activeDraft,
    commitState,
    skipOutcome,
    unitChangeModal,
    sessionCommittedCount,
    startOrResumeCheckIn,
    switchCheckInMetric,
    updateDraft,
    requestUnitChange,
    confirmUnitChange,
    cancelUnitChange,
    backToRecordStage,
    proceedToReviewStage,
    commitCurrentDraft,
    checkCurrentDraftCommitStatus,
    discardCurrentDraft,
    markCurrentUnavailable,
    skipCurrentCheckIn,
    dismissSkipOutcome,

    reload,
    updatePreferences,
    setAppearance,
    switchProfile,
    createPersonalProfile,
    updateProfile,
    savePersonalReference,
    reviewInsight,
    commitCsvImport,
    restoreBackup,
    importDraftRecovery,
    resetDemoScenario,
    deletePersonalProfile,
    loadDraftsForProfile,
    activeOperation,
    saveSafetyBackup,
    safetyBackupOutcome,
    lastSavedSafetyBackup,
    clearSafetyBackupOutcome,
    clearSavedSafetyBackup,
    restoreOutcome,
    clearRestoreOutcome,
    lastBackupCreatedAtUtc,
    recordBackupExportedNow,
  };

  return <CrewSignalContext.Provider value={value}>{children}</CrewSignalContext.Provider>;
}

function useMemoHelper(preferences: AppPreferences | null): HelpProcedureCard {
  if (!preferences) return DEFAULT_UNCONFIGURED_HELP;
  return resolveHelpContent(preferences.helpMode);
}

export function useCrewSignal(): CrewSignalContextValue {
  const ctx = useContext(CrewSignalContext);
  if (!ctx) {
    throw new Error('useCrewSignal must be used inside CrewSignalProvider');
  }
  return ctx;
}

export { buildInstantTiming, buildPeriodTiming, missionDayAndTimeToUtc };
export type { SleepType };
