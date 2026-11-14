import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildInstantTiming,
  computeMissionDay,
  createBlankDraft,
  formatUtcTimeHHMM,
  getDueMetricSchedules,
  resolveActiveReference,
  selectFallbackReferenceToLock,
  SIM_01_PROFILE_ID,
  SIM_SCHEDULE_OBSERVATIONS,
  SIM_SCHEDULE_PROFILE,
  type AppPreferences,
  type ReadingReportScope,
  type BodySystemId,
  type ResearchContext,
  type CheckInDraft,
  type GettingStartedDestination,
  type MetricId,
  type MetricSchedule,
  type PersonalReference,
  type ProfileConfig,
} from "../shared/src";
import {
  browserMockBackend,
  buildDemoSeedInput,
  desktopBridge,
  profileConfigToRecord,
  profileRecordToConfig,
  type AppSnapshot,
  type DiagnosticHooks,
  type DraftGuardState,
  type RuntimeEnvironmentInfo,
  type StorageStatus,
} from "../bridge/desktopBridge";
import { normalizeAppPreferences } from "./preferences";

export type AppRoute =
  | "overview"
  | "check_in"
  | "explorer"
  | "trends"
  | "reports"
  | "actions"
  | "sources"
  | "settings"
  | "help";

export interface ToastNotice {
  id: string;
  tone: "success" | "review" | "danger" | "neutral";
  title: string;
  detail?: string;
}

export type ActiveModal =
  | { kind: "measurement_help"; metricId: MetricId }
  | {
      kind: "unit_change";
      draftId: string;
      fromUnit: string;
      toUnit: string;
      rawValue: string;
      dialogTitle: string;
      dialogBody: string;
      confirmLabel: string;
      cancelLabel: string;
      onConfirm: () => void;
    }
  | {
      kind: "discard_draft";
      targetRoute: AppRoute | null;
      onConfirm: () => void;
    }
  | { kind: "skip_checkin"; committedInSession: number }
  | { kind: "unavailable_metric"; metricId: MetricId }
  | { kind: "close_guard"; guardState: DraftGuardState }
  | { kind: "reset_demo" }
  | { kind: "delete_personal_profile"; profileId: string; alias: string };

interface AppContextValue {
  loading: boolean;
  loadError: string | null;
  /** Set when SQLite could not be opened; Overview shows recovery instead of the log. */
  storageStatus: StorageStatus | null;
  retryStorage: () => Promise<void>;
  snapshot: AppSnapshot | null;
  activeProfile: ProfileConfig | null;
  allProfiles: ProfileConfig[];
  preferences: AppPreferences;
  resolvedTheme: "dark" | "light";
  runtimeInfo: RuntimeEnvironmentInfo | null;
  diagnosticHooks: DiagnosticHooks;

  route: AppRoute;
  selectedResearch: ResearchContext | null;
  openResearch: (context: ResearchContext) => void;
  researchReturnRoute: AppRoute;
  navigate: (nextRoute: AppRoute, reportScope?: ReadingReportScope) => void;
  helpReturnRoute: AppRoute;
  gettingStarted: boolean;
  openGettingStarted: () => void;
  openGettingStartedStep: (destination: GettingStartedDestination) => void;
  showHelpProcedures: () => void;
  returnFromHelp: () => void;
  readingReportScope: ReadingReportScope | undefined;
  selectedBodySystem: BodySystemId;
  setSelectedBodySystem: (id: BodySystemId) => void;
  selectedTrendMetric: MetricId;
  setSelectedTrendMetric: (id: MetricId) => void;
  selectedActionId: string | null;
  openAction: (actionId: string) => void;
  trendRangeDays: 7 | 30;
  setTrendRangeDays: (days: 7 | 30) => void;
  trendViewMode: "chart" | "table";
  setTrendViewMode: (mode: "chart" | "table") => void;

  activeDraft: CheckInDraft | null;
  setActiveDraft: React.Dispatch<React.SetStateAction<CheckInDraft | null>>;
  /** Memory-only drafts of other profiles, keyed by profile ID (ER-04). */
  parkedMemoryDrafts: Record<string, CheckInDraft>;
  draftRetentionFailed: boolean;
  setDraftRetentionFailed: React.Dispatch<React.SetStateAction<boolean>>;
  pendingUpdateBlocked: boolean;
  setPendingUpdateBlocked: React.Dispatch<React.SetStateAction<boolean>>;
  sessionCommittedIds: string[];
  addSessionCommittedId: (id: string) => void;
  clearSessionCommittedIds: () => void;

  toast: ToastNotice | null;
  showToast: (toast: Omit<ToastNotice, "id">) => void;
  dismissToast: () => void;
  liveAnnouncement: string;
  announce: (msg: string) => void;

  activeModal: ActiveModal | null;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;

  currentReferenceNowUtc: string;
  dueSchedules: ReturnType<typeof getDueMetricSchedules>;
  activeReferencesByMetric: Record<MetricId, PersonalReference | null>;

  /**
   * Reloads the snapshot. With `reconcileDraft`, the open draft is re-read from
   * what SQLite holds for that profile (after a replace removed the old one)
   * instead of keeping the in-memory copy.
   */
  refreshSnapshot: (profileId?: string, options?: { reconcileDraft?: boolean }) => Promise<void>;
  setAppearance: (appearance: AppPreferences["appearance"]) => Promise<void>;
  setDisplayUnits: (units: AppPreferences["displayUnits"]) => Promise<void>;
  setHelpMode: (helpMode: AppPreferences["helpMode"]) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  createPersonalProfile: (alias: string, timezone: string) => Promise<void>;
  resetDemo: () => Promise<void>;
  loadSimScheduleFixture: () => Promise<void>;
  deletePersonalProfile: (profileId: string) => Promise<void>;
  updateDiagnosticHooks: (hooks: DiagnosticHooks) => Promise<void>;
  saveDraftToStore: (draft: CheckInDraft, options?: { edit: true }) => Promise<boolean>;
  openDraftForMetric: (metricId: MetricId, initialDraft?: CheckInDraft) => Promise<void>;
  updateMetricSchedule: (metricId: MetricId, schedule: MetricSchedule) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function resolveSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeEnvironmentInfo | null>(null);
  const [diagnosticHooks, setDiagnosticHooks] = useState<DiagnosticHooks>({
    simulateDraftRetentionFailure: false,
    simulateCommitRollback: false,
    simulateLostAck: false,
    simulateLookupUnavailable: false,
    simulateLogReadFailure: false,
    simulateFileOutcome: null,
  });

  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(resolveSystemTheme);
  const [selectedResearch, setSelectedResearch] = useState<ResearchContext | null>(null);
  const [researchReturnRoute, setResearchReturnRoute] = useState<AppRoute>("actions");
  const [route, setRoute] = useState<AppRoute>("overview");
  const [helpReturnRoute, setHelpReturnRoute] = useState<AppRoute>("overview");
  const [gettingStarted, setGettingStarted] = useState(false);
  const [readingReportScope, setReadingReportScope] = useState<ReadingReportScope>();
  const [selectedBodySystem, setSelectedBodySystem] =
    useState<BodySystemId>("sleep_cognition");
  const [selectedTrendMetric, setSelectedTrendMetric] = useState<MetricId>("sleep");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [trendRangeDays, setTrendRangeDays] = useState<7 | 30>(7);
  const [trendViewMode, setTrendViewMode] = useState<"chart" | "table">("chart");

  const [activeDraft, setActiveDraft] = useState<CheckInDraft | null>(null);
  const [draftRetentionFailed, setDraftRetentionFailed] = useState(false);
  const [pendingUpdateBlocked, setPendingUpdateBlocked] = useState(false);
  const [sessionCommittedIds, setSessionCommittedIds] = useState<string[]>([]);

  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);

  const [preferences, setPreferences] = useState<AppPreferences>({
    appearance: "system",
    activeProfileId: SIM_01_PROFILE_ID,
    displayUnits: {
      blood_glucose: "mg/dL",
      body_temperature: "C",
    },
    helpMode: "unconfigured",
  });

  const resolvedTheme: "dark" | "light" =
    preferences.appearance === "system" ? systemTheme : preferences.appearance;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const listener = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "light" : "dark");
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const announce = useCallback((msg: string) => {
    setLiveAnnouncement("");
    window.setTimeout(() => setLiveAnnouncement(msg), 20);
  }, []);

  const showToast = useCallback(
    (next: Omit<ToastNotice, "id">) => {
      const id = `toast-${Date.now()}`;
      setToast({ ...next, id });
      announce(`${next.title}${next.detail ? `. ${next.detail}` : ""}`);
    },
    [announce],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const openModal = useCallback((modal: ActiveModal) => {
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const addSessionCommittedId = useCallback((id: string) => {
    setSessionCommittedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const clearSessionCommittedIds = useCallback(() => {
    setSessionCommittedIds([]);
  }, []);

  const activeDraftRef = useRef<CheckInDraft | null>(null);
  activeDraftRef.current = activeDraft;

  // ER-04: a draft that local storage could not keep exists only in memory.
  // When the view moves to another profile (restore, switch, new profile), it is
  // parked here under its own profile so it is never dropped or carried across.
  // It returns when that profile is active again and stays until it is stored,
  // added to the log, discarded, or the app closes (the close guard covers it).
  const [parkedMemoryDrafts, setParkedMemoryDraftsState] = useState<Record<string, CheckInDraft>>({});
  const parkedMemoryDraftsRef = useRef<Record<string, CheckInDraft>>({});
  const setParkedMemoryDrafts = useCallback((next: Record<string, CheckInDraft>) => {
    parkedMemoryDraftsRef.current = next;
    setParkedMemoryDraftsState(next);
  }, []);
  const dropParkedDraft = useCallback(
    (profileId: string) => {
      if (!parkedMemoryDraftsRef.current[profileId]) return;
      const rest = { ...parkedMemoryDraftsRef.current };
      delete rest[profileId];
      setParkedMemoryDrafts(rest);
    },
    [setParkedMemoryDrafts],
  );

  /**
   * Keeps the open draft with its own profile before the view moves to
   * `targetProfileId`. Local storage is tried first; if it reports
   * `retained: false` or throws, the draft is parked in memory instead.
   */
  const parkLeavingDraft = useCallback(
    async (targetProfileId: string | null): Promise<"none" | "stored" | "memory_only"> => {
      const leaving = activeDraftRef.current;
      if (!leaving || leaving.commitStatus === "committed" || leaving.profileId === targetProfileId) return "none";
      let retained = false;
      try {
        retained = (await desktopBridge.saveDraft(leaving.profileId, leaving)).retained;
      } catch {
        retained = false;
      }
      const next = { ...parkedMemoryDraftsRef.current };
      if (retained) delete next[leaving.profileId];
      else next[leaving.profileId] = { ...leaving, retentionStatus: "memory_only" };
      setParkedMemoryDrafts(next);
      return retained ? "stored" : "memory_only";
    },
    [setParkedMemoryDrafts],
  );

  const syncFromSnapshot = useCallback((snap: AppSnapshot, preserveActiveDraft = false) => {
    setSnapshot(snap);
    setPreferences(normalizeAppPreferences(snap.preferences, snap.activeProfileId));
    // A draft only ever belongs to its own profile. When the snapshot is for a
    // different profile (for example after a restore), hydrate that profile's
    // stored draft instead of carrying the previous one across.
    const current = activeDraftRef.current;
    const keepCurrent =
      preserveActiveDraft && (current === null || current.profileId === snap.activeProfileId);
    if (!keepCurrent) {
      // A parked memory-only draft is newer than any stored copy of that profile.
      const parked = parkedMemoryDraftsRef.current[snap.activeProfileId] ?? null;
      if (parked) dropParkedDraft(snap.activeProfileId);
      const storedDraft =
        parked ?? snap.profileData.drafts.find((d) => d.profileId === snap.activeProfileId) ?? null;
      activeDraftRef.current = storedDraft;
      setActiveDraft(storedDraft);
      setDraftRetentionFailed(storedDraft?.retentionStatus === "failed" || storedDraft?.retentionStatus === "memory_only");
    }
  }, [dropParkedDraft]);

  const refreshSnapshot = useCallback(
    async (profileId?: string, options?: { reconcileDraft?: boolean }) => {
      try {
        setLoadError(null);
        if (options?.reconcileDraft && profileId) {
          // The profile's rows were replaced: whatever this view held for it,
          // in memory or parked, no longer matches storage.
          dropParkedDraft(profileId);
          const snap = await desktopBridge.loadAppSnapshot(profileId);
          syncFromSnapshot(snap, false);
          return;
        }
        // Keep the source profile's work with that profile before the view
        // moves to another one: stored if possible, otherwise parked in memory.
        if (profileId) await parkLeavingDraft(profileId);
        const snap = await desktopBridge.loadAppSnapshot(profileId);
        syncFromSnapshot(snap, true);
      } catch (err) {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Stored records could not be loaded.";
        setLoadError(msg);
      }
    },
    [dropParkedDraft, parkLeavingDraft, syncFromSnapshot],
  );

  // Initial seed + snapshot hydration. Storage is checked first so an unreadable
  // or denied database routes to recovery (with Help) instead of a crash or a
  // misleading empty log. The database file itself is never modified here.
  const bootedRef = useRef(false);
  const boot = useCallback(async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const storage = await desktopBridge.getStorageStatus();
        setStorageStatus(storage);
        if (!storage.available) {
          setRuntimeInfo(await desktopBridge.getRuntimeInfo());
          setLoadError(
            storage.message ?? "Local storage could not be opened. Your saved file was left unchanged.",
          );
          return;
        }
        const [snap, rt, hooks] = await Promise.all([
          desktopBridge.ensureDemoSeed(buildDemoSeedInput(false)),
          desktopBridge.getRuntimeInfo(),
          desktopBridge.getDiagnosticHooks(),
        ]);
        syncFromSnapshot(snap, false);
        setRuntimeInfo(rt);
        setDiagnosticHooks(hooks);
      } catch (err) {
        const msg =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to initialize local SQLite database.";
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
  }, [syncFromSnapshot]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void boot();
  }, [boot]);

  const retryStorage = useCallback(async () => {
    const status = await desktopBridge.retryOpenStorage();
    setStorageStatus(status);
    if (status.available) await boot();
  }, [boot]);

  // Keep Tauri native window close guard synchronized with active draft state
  useEffect(() => {
    const parkedCount = Object.keys(parkedMemoryDrafts).length;
    const hasUnfinished = Boolean(
      (activeDraft && activeDraft.commitStatus !== "committed") || parkedCount > 0,
    );
    const hasUnretained = Boolean(
      (activeDraft &&
        (draftRetentionFailed ||
          activeDraft.retentionStatus === "memory_only" ||
          activeDraft.retentionStatus === "failed")) ||
        parkedCount > 0,
    );
    const parts: string[] = [];
    if (activeDraft) parts.push(`${activeDraft.metricId.replace("_", " ")} (${activeDraft.stage})`);
    if (parkedCount > 0) {
      parts.push(`${parkedCount} unsaved draft${parkedCount === 1 ? "" : "s"} in another profile`);
    }
    const summary = parts.length > 0 ? parts.join("; ") : null;

    void desktopBridge.setDraftGuardState({
      hasUnfinishedDraft: hasUnfinished,
      hasUnretainedDraft: hasUnretained,
      draftSummary: summary,
    });
  }, [activeDraft, draftRetentionFailed, parkedMemoryDrafts]);

  // Listen for native Tauri window close interception when draft exists
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void desktopBridge
      .subscribeCloseRequested((guardState) => {
        setActiveModal({ kind: "close_guard", guardState });
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const allProfiles = useMemo<ProfileConfig[]>(() => {
    if (!snapshot) return [];
    return snapshot.profiles.map((p) =>
      profileRecordToConfig(
        p,
        p.id === snapshot.profileData.profileId ? snapshot.profileData.schedules : undefined,
      ),
    );
  }, [snapshot]);

  const activeProfile = useMemo<ProfileConfig | null>(() => {
    if (!snapshot) return null;
    return allProfiles.find((p) => p.profileId === snapshot.activeProfileId) ?? allProfiles[0] ?? null;
  }, [snapshot, allProfiles]);

  const [wallClockUtc, setWallClockUtc] = useState(() => new Date().toISOString());
  useEffect(() => {
    const update = () => setWallClockUtc(new Date().toISOString());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentReferenceNowUtc = useMemo(() => {
    if (activeProfile?.mode === "demo" && activeProfile.snapshotUtc) {
      return activeProfile.snapshotUtc;
    }
    return wallClockUtc.replace(/\.\d{3}Z$/, "Z");
  }, [activeProfile, wallClockUtc]);

  const [scheduleNowUtc, setScheduleNowUtc] = useState(() => new Date().toISOString());
  const hasSchedules = Object.values(activeProfile?.schedules ?? {}).some((schedule) => schedule?.enabled);
  useEffect(() => {
    if (!hasSchedules || activeProfile?.mode === "demo") return;
    const update = () => setScheduleNowUtc(new Date().toISOString());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [activeProfile?.profileId, activeProfile?.mode, hasSchedules]);

  const dueSchedules = activeProfile && snapshot
    ? getDueMetricSchedules(
        activeProfile.schedules,
        snapshot.profileData.observations,
        activeProfile.mode === "demo" ? currentReferenceNowUtc : scheduleNowUtc,
      )
    : [];

  const activeReferencesByMetric = useMemo<Record<MetricId, PersonalReference | null>>(() => {
    const empty: Record<MetricId, PersonalReference | null> = {
      heart_rate: null,
      blood_pressure: null,
      blood_glucose: null,
      body_temperature: null,
      sleep: null,
      mood: null,
    };
    if (!snapshot || !activeProfile) return empty;
    const refs = snapshot.profileData.references;
    const obs = snapshot.profileData.observations;
    for (const metricId of [
      "heart_rate",
      "blood_pressure",
      "blood_glucose",
      "body_temperature",
      "sleep",
      "mood",
    ] as const) {
      empty[metricId] = resolveActiveReference({
        profileId: activeProfile.profileId,
        metricId,
        references: refs,
        observations: obs,
        nowUtc: currentReferenceNowUtc,
      });
    }
    return empty;
  }, [snapshot, activeProfile, currentReferenceNowUtc]);

  // Persist the first eligible seven-day fallback (with its representative
  // observation IDs) before any view can present it as locked. The bridge
  // re-checks inside its transaction, so repeated runs write at most once.
  useEffect(() => {
    if (!snapshot || !activeProfile) return;
    const toLock = (["heart_rate", "blood_pressure", "blood_glucose", "body_temperature", "sleep"] as const)
      .map((metricId) =>
        selectFallbackReferenceToLock({
          profileId: activeProfile.profileId,
          metricId,
          references: snapshot.profileData.references,
          observations: snapshot.profileData.observations,
          nowUtc: currentReferenceNowUtc,
        }),
      )
      .filter((r): r is PersonalReference => r !== null);
    if (toLock.length === 0) return;
    void (async () => {
      let wrote = false;
      for (const ref of toLock) {
        try {
          wrote = (await desktopBridge.lockFallbackReference(activeProfile.profileId, ref)) || wrote;
        } catch {
          // Storage problems surface through the normal load/recovery path.
        }
      }
      if (wrote) await refreshSnapshot(activeProfile.profileId);
    })();
  }, [snapshot, activeProfile, currentReferenceNowUtc, refreshSnapshot]);

  const showRoute = useCallback((nextRoute: AppRoute) => {
    setRoute(nextRoute);
    const main = document.getElementById("main-content");
    if (main) main.focus({ preventScroll: true });
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, reportScope?: ReadingReportScope) => {
    setSelectedResearch(null);
    if (nextRoute === "help" && route !== "help" && !gettingStarted) setHelpReturnRoute(route);
    setGettingStarted(false);
    setReadingReportScope(nextRoute === "reports" ? reportScope : undefined);
    setSelectedActionId(null);
    showRoute(nextRoute);
  }, [gettingStarted, route, showRoute]);

  function openResearch(context: ResearchContext) {
    navigate("sources");
    setResearchReturnRoute(route);
    setSelectedResearch(context);
  }

  function openAction(actionId: string) {
    navigate("actions");
    setSelectedActionId(actionId);
  }

  function openGettingStarted() {
    if (route !== "help" && !gettingStarted) setHelpReturnRoute(route);
    setGettingStarted(true);
    showRoute("help");
  }

  function openGettingStartedStep(destination: GettingStartedDestination) {
    if (activeProfile?.mode !== "demo") return;
    if (destination === "trends") setSelectedTrendMetric("sleep");
    setReadingReportScope(undefined);
    showRoute(destination);
  }

  function showHelpProcedures() {
    setGettingStarted(false);
    showRoute("help");
  }

  function returnFromHelp() {
    setGettingStarted(false);
    showRoute(helpReturnRoute);
  }

  const setAppearance = useCallback(
    async (appearance: AppPreferences["appearance"]) => {
      const next: AppPreferences = { ...preferences, appearance };
      setPreferences(next);
      await desktopBridge.updatePreferences(next);
    },
    [preferences],
  );

  const setDisplayUnits = useCallback(
    async (displayUnits: AppPreferences["displayUnits"]) => {
      const next: AppPreferences = { ...preferences, displayUnits };
      setPreferences(next);
      await desktopBridge.updatePreferences(next);
      showToast({
        tone: "neutral",
        title: "Display units updated",
        detail: `Glucose: ${displayUnits.blood_glucose} · Temperature: °${displayUnits.body_temperature}. Source values unchanged.`,
      });
    },
    [preferences, showToast],
  );

  const setHelpMode = useCallback(
    async (helpMode: AppPreferences["helpMode"]) => {
      const next: AppPreferences = { ...preferences, helpMode };
      setPreferences(next);
      await desktopBridge.updatePreferences(next);
    },
    [preferences],
  );

  const switchProfile = useCallback(
    async (profileId: string) => {
      await parkLeavingDraft(profileId);
      const snap = await desktopBridge.setActiveProfile(profileId);
      setActiveDraft(null);
      setDraftRetentionFailed(false);
      clearSessionCommittedIds();
      syncFromSnapshot(snap, false);
    },
    [clearSessionCommittedIds, parkLeavingDraft, syncFromSnapshot],
  );

  const createPersonalProfile = useCallback(
    async (alias: string, timezone: string) => {
      const nowUtc = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const todayEpochUtc = `${nowUtc.slice(0, 10)}T00:00:00Z`;
      const profileId = `personal-${Date.now()}`;
      const cfg: ProfileConfig = {
        profileId,
        label: alias.trim() || "Personal profile",
        alias: alias.trim() || "Personal",
        mode: "personal",
        scenarioId: null,
        missionName: "Local personal log",
        missionEpochUtc: todayEpochUtc,
        displayTimezone: timezone || "UTC",
        snapshotUtc: null,
        createdAtUtc: nowUtc,
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
      await parkLeavingDraft(profileId);
      const snap = await desktopBridge.createPersonalProfile(profileConfigToRecord(cfg, nowUtc));
      setActiveDraft(null);
      setDraftRetentionFailed(false);
      clearSessionCommittedIds();
      syncFromSnapshot(snap, false);
      showToast({
        tone: "success",
        title: "Personal profile created",
        detail: "Started blank using your device clock. Synthetic demo values were not carried over.",
      });
    },
    [clearSessionCommittedIds, parkLeavingDraft, showToast, syncFromSnapshot],
  );

  const resetDemo = useCallback(async () => {
    // The reset closes SIM-01 drafts only; another profile's draft is kept.
    await parkLeavingDraft(SIM_01_PROFILE_ID);
    dropParkedDraft(SIM_01_PROFILE_ID);
    const snap = await desktopBridge.resetDemoProfile(buildDemoSeedInput(false));
    setActiveDraft(null);
    setDraftRetentionFailed(false);
    clearSessionCommittedIds();
    syncFromSnapshot(snap, false);
    showToast({
      tone: "success",
      title: "Demo reset to SIM-01",
      detail: "Restored 11 initial synthetic observations and closed demo drafts. Personal profiles unchanged.",
    });
  }, [clearSessionCommittedIds, dropParkedDraft, parkLeavingDraft, showToast, syncFromSnapshot]);

  const loadSimScheduleFixture = useCallback(async () => {
    const seed = buildDemoSeedInput(false);
    seed.profile = profileConfigToRecord(SIM_SCHEDULE_PROFILE);
    seed.observations = [...SIM_SCHEDULE_OBSERVATIONS];
    seed.schedules = [
      {
        metricId: "blood_pressure",
        schedule: SIM_SCHEDULE_PROFILE.schedules.blood_pressure!,
      },
    ];
    // Same handoff as a profile switch: the open draft stays with its own
    // profile (stored, or parked in memory if storage refuses it). The fixture
    // reload replaces only SIM-SCHEDULE rows, so its own drafts are closed.
    const leaving = activeDraftRef.current;
    const handoff = await parkLeavingDraft(SIM_SCHEDULE_PROFILE.profileId);
    dropParkedDraft(SIM_SCHEDULE_PROFILE.profileId);
    const snap = await desktopBridge.resetDemoProfile(seed);
    setActiveDraft(null);
    setDraftRetentionFailed(false);
    clearSessionCommittedIds();
    syncFromSnapshot(snap, false);
    const sourceLabel =
      leaving && handoff !== "none"
        ? snap.profiles.find((p) => p.id === leaving.profileId)?.alias ?? "its profile"
        : null;
    const draftNote =
      handoff === "stored"
        ? ` Your open draft was saved with ${sourceLabel}.`
        : handoff === "memory_only"
          ? ` Your open draft could not be saved, so it is kept in memory with ${sourceLabel} until you close CrewSignal.`
          : "";
    showToast({
      tone: handoff === "memory_only" ? "review" : "neutral",
      title: "SIM-SCHEDULE loaded",
      detail: `Blood pressure interval set to 24h; latest BP observation is 26h 18m ago.${draftNote}`,
    });
  }, [clearSessionCommittedIds, dropParkedDraft, parkLeavingDraft, showToast, syncFromSnapshot]);

  const deletePersonalProfile = useCallback(
    async (profileId: string) => {
      // The confirmed delete removes that profile's draft too; others are kept.
      await parkLeavingDraft(profileId);
      const res = await desktopBridge.deletePersonalProfile(profileId);
      dropParkedDraft(profileId);
      const snap = await desktopBridge.loadAppSnapshot(res.fallbackProfileId);
      setActiveDraft(null);
      setDraftRetentionFailed(false);
      clearSessionCommittedIds();
      syncFromSnapshot(snap, false);
      showToast({
        tone: "success",
        title: "Personal profile deleted",
        detail: "Removed all records for that profile from local SQLite storage.",
      });
    },
    [clearSessionCommittedIds, dropParkedDraft, parkLeavingDraft, showToast, syncFromSnapshot],
  );

  const updateDiagnosticHooks = useCallback(async (hooks: DiagnosticHooks) => {
    const updated = await desktopBridge.setDiagnosticHooks(hooks);
    setDiagnosticHooks(updated);
  }, []);

  const saveDraftToStore = useCallback(
    async (draft: CheckInDraft, options?: { edit: true }): Promise<boolean> => {
      if (options?.edit) {
        activeDraftRef.current = draft;
        setActiveDraft(draft);
      }
      let result: Awaited<ReturnType<typeof desktopBridge.saveDraft>>;
      try {
        result = await desktopBridge.saveDraft(draft.profileId, draft);
      } catch (error) {
        if (!options?.edit) throw error;
        result = { retained: false, draft: { ...draft, retentionStatus: 'memory_only' as const } };
      }
      if (!options?.edit || activeDraftRef.current === draft) {
        activeDraftRef.current = result.draft;
        setActiveDraft(result.draft);
        setDraftRetentionFailed(!result.retained);
      }
      return result.retained;
    },
    [],
  );

  const openDraftForMetric = useCallback(
    async (metricId: MetricId, initialDraft?: CheckInDraft) => {
      if (!activeProfile) return;
      const nowUtc = currentReferenceNowUtc;
      const missionDay = Math.max(1, computeMissionDay(nowUtc, activeProfile.missionEpochUtc));
      const hhmm = formatUtcTimeHHMM(nowUtc);
      const draft: CheckInDraft =
        initialDraft ??
        (activeDraftRef.current?.profileId === activeProfile.profileId && activeDraftRef.current.metricId === metricId
          ? activeDraftRef.current : snapshot?.profileData.drafts.find((draft) => draft.metricId === metricId)) ??
        createBlankDraft({
          draftId: `draft-${metricId}-${Date.now()}`,
          profileId: activeProfile.profileId,
          mode: activeProfile.mode,
          metricId,
          missionEpochUtc: activeProfile.missionEpochUtc,
          proposedMissionDay: missionDay,
          proposedTimeHHMM: hhmm,
          nowUtc,
          preferredUnit:
            metricId === "blood_glucose"
              ? preferences.displayUnits.blood_glucose
              : metricId === "body_temperature"
                ? preferences.displayUnits.body_temperature
                : undefined,
        });
      const retained = await saveDraftToStore(draft);
      setDraftRetentionFailed(!retained);
      navigate("check_in");
    },
    [
      activeProfile,
      currentReferenceNowUtc,
      navigate,
      preferences.displayUnits,
      snapshot?.profileData.drafts,
      saveDraftToStore,
    ],
  );

  const updateMetricSchedule = useCallback(
    async (metricId: MetricId, schedule: MetricSchedule) => {
      if (!activeProfile) return;
      await desktopBridge.upsertSchedule(activeProfile.profileId, metricId, schedule);
      await refreshSnapshot(activeProfile.profileId);
      showToast({
        tone: "neutral",
        title: "Schedule updated",
        detail: `${metricId.replace("_", " ")} reminder cadence set to ${schedule.enabled ? `${schedule.intervalHours}h` : "Not scheduled"}.`,
      });
    },
    [activeProfile, refreshSnapshot, showToast],
  );

  // Also keep timing helper imported cleanly if unused — remove unused if not needed
  void buildInstantTiming;
  void browserMockBackend;

  const value: AppContextValue = {
    loading,
    loadError,
    storageStatus,
    retryStorage,
    snapshot,
    activeProfile,
    allProfiles,
    preferences,
    resolvedTheme,
    runtimeInfo,
    diagnosticHooks,
    route,
    navigate,
    selectedResearch,
    openResearch,
    researchReturnRoute,
    helpReturnRoute,
    gettingStarted,
    openGettingStarted,
    openGettingStartedStep,
    showHelpProcedures,
    returnFromHelp,
    readingReportScope,
    selectedBodySystem,
    setSelectedBodySystem,
    selectedTrendMetric,
    setSelectedTrendMetric,
    selectedActionId,
    openAction,
    trendRangeDays,
    setTrendRangeDays,
    trendViewMode,
    setTrendViewMode,
    activeDraft,
    setActiveDraft,
    parkedMemoryDrafts,
    draftRetentionFailed,
    setDraftRetentionFailed,
    pendingUpdateBlocked,
    setPendingUpdateBlocked,
    sessionCommittedIds,
    addSessionCommittedId,
    clearSessionCommittedIds,
    toast,
    showToast,
    dismissToast,
    liveAnnouncement,
    announce,
    activeModal,
    openModal,
    closeModal,
    currentReferenceNowUtc,
    dueSchedules,
    activeReferencesByMetric,
    refreshSnapshot,
    setAppearance,
    setDisplayUnits,
    setHelpMode,
    switchProfile,
    createPersonalProfile,
    resetDemo,
    loadSimScheduleFixture,
    deletePersonalProfile,
    updateDiagnosticHooks,
    saveDraftToStore,
    openDraftForMetric,
    updateMetricSchedule,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
