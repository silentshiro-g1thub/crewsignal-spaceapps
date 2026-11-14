import { ScheduledNotificationSetting } from '../components/ScheduledNotifications';
import { useEffect, useState } from "react";
import {
  createNewReferenceVersion,
  validateManualReference,
  needsManualReferenceConfirmation,
  deriveSevenDayFallbackReference,
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  type MetricId,
  type ReferenceValue,
} from "../shared/src";
import { desktopBridge, type DiagnosticHooks } from "../bridge/desktopBridge";
import { useApp } from "../state/AppContext";

export function SettingsRoute() {
  const {
    snapshot,
    activeProfile,
    allProfiles,
    preferences,
    resolvedTheme,
    runtimeInfo,
    diagnosticHooks,
    activeDraft,
    pendingUpdateBlocked,
    setPendingUpdateBlocked,
    setAppearance,
    setDisplayUnits,
    setHelpMode,
    switchProfile,
    createPersonalProfile,
    openModal,
    loadSimScheduleFixture,
    updateDiagnosticHooks,
    updateMetricSchedule,
    refreshSnapshot,
    currentReferenceNowUtc,
    showToast,
  } = useApp();

  const [newAlias, setNewAlias] = useState("Crew personal 01");
  const [newTz, setNewTz] = useState("UTC");

  const [clockEpoch, setClockEpoch] = useState(activeProfile?.missionEpochUtc ?? "");
  const [clockTz, setClockTz] = useState(activeProfile?.displayTimezone ?? "UTC");

  // Reference editor state
  const [refMetric, setRefMetric] = useState<Exclude<MetricId, "mood">>("sleep");
  const [refPrimary, setRefPrimary] = useState("");
  const [refSecondary, setRefSecondary] = useState("");
  const [refMethod, setRefMethod] = useState("");
  const [refContext, setRefContext] = useState("");

  const [refErrors, setRefErrors] = useState<Record<string,string>>({});
  const [refSaveError, setRefSaveError] = useState('');
  const [reviewingReferenceId, setReviewingReferenceId] = useState<string | undefined>();
  const [confirmedReference, setConfirmedReference] = useState(false);
  const [savingReference, setSavingReference] = useState(false);
  useEffect(() => setConfirmedReference(false), [refPrimary,refSecondary,refMethod,refContext]);
  // Schedule editor state
  const [schedMetric, setSchedMetric] = useState<MetricId>("blood_pressure");
  const [schedEnabled, setSchedEnabled] = useState(true);
  const [schedHours, setSchedHours] = useState("24");

  useEffect(() => {
    if (activeProfile) {
      setClockEpoch(activeProfile.missionEpochUtc);
      setClockTz(activeProfile.displayTimezone);
    }
  }, [activeProfile]);

  useEffect(() => {
    setRefPrimary(''); setRefSecondary(''); setRefMethod(''); setRefContext('');
    setRefErrors({}); setRefSaveError(''); setReviewingReferenceId(undefined); setConfirmedReference(false);
  }, [refMetric, activeProfile?.profileId]);

  if (!snapshot || !activeProfile) {
    return (
      <div className="panel-card">
        <p style={{ margin: 0 }}>Loading settings…</p>
      </div>
    );
  }

  const handleSaveClock = async () => {
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    await desktopBridge.updateProfileClock({
      profileId: activeProfile.profileId,
      epochUtc: clockEpoch.trim(),
      timezone: clockTz.trim() || "UTC",
      snapshotUtc: activeProfile.snapshotUtc,
      changedAt: nowIso,
    });
    await refreshSnapshot(activeProfile.profileId);
    showToast({
      tone: "success",
      title: "Mission clock version updated",
      detail: `Stored observation UTC timestamps remain unchanged; mission-day labels reflect Version ${activeProfile.clockVersion + 1}.`,
    });
  };

  const handleSaveNewReference = async () => {
    const validation = validateManualReference({metricId:refMetric,primaryText:refPrimary,secondaryText:refSecondary,method:refMethod,context:refContext,unit:METRIC_DEFINITIONS[refMetric].canonicalUnit,confirmedPreviousReferenceId:reviewingReferenceId});
    setRefErrors(validation.errors); setRefSaveError('');
    if (!validation.valid || !validation.value || !validation.capture) return;
    if (reviewingReferenceId && !confirmedReference) { setRefSaveError('Confirm both entered values before creating a replacement version.'); return; }
    if (savingReference) return;
    setSavingReference(true);
    try {
    const updated = createNewReferenceVersion({
      existingReferences: snapshot.profileData.references,
      profileId: activeProfile.profileId,
      metricId: refMetric,
      provenance: "user_updated",
      method: refMethod,
      context: refContext,
      unit: METRIC_DEFINITIONS[refMetric].canonicalUnit,
      value: validation.value,
      manualCapture: validation.capture,
      createdAtUtc: currentReferenceNowUtc,
    });
    const newest = updated[updated.length - 1]!;
    await desktopBridge.upsertPersonalReference(activeProfile.profileId, newest);
    await refreshSnapshot(activeProfile.profileId);
    setRefPrimary(''); setRefSecondary(''); setRefMethod(''); setRefContext(''); setReviewingReferenceId(undefined);
    showToast({
      tone: "success",
      title: `Saved ${METRIC_DEFINITIONS[refMetric].shortLabel} reference Version ${newest.version}`,
      detail: "Previous active version kept in history; old action acknowledgements require re-review.",
    });
    } catch { setRefSaveError('Reference was not saved. Your entered values are retained; retry when storage is available.'); }
    finally { setSavingReference(false); }
  };

  const handleDeriveFallback = async () => {
    const derived = deriveSevenDayFallbackReference({
      profileId: activeProfile.profileId,
      metricId: refMetric,
      method: refMethod,
      context: refContext,
      observations: snapshot.profileData.observations,
      createdAtUtc: currentReferenceNowUtc,
      existingVersion:
        snapshot.profileData.references.filter((r) => r.metricId === refMetric).length + 1,
    });
    if (derived.status !== "active") {
      showToast({
        tone: "review",
        title: "Fallback reference unavailable",
        detail: derived.unavailableReason ?? "Needs 7 distinct observed days with matching method & context.",
      });
      return;
    }
    await desktopBridge.upsertPersonalReference(activeProfile.profileId, derived);
    await refreshSnapshot(activeProfile.profileId);
    showToast({
      tone: "success",
      title: `Derived 7-day fallback reference (Version ${derived.version})`,
      detail: `Computed median from ${derived.distinctObservedDays} distinct compatible days.`,
    });
  };

  const toggleHook = async (key: keyof Omit<DiagnosticHooks, "simulateFileOutcome">) => {
    await updateDiagnosticHooks({
      ...diagnosticHooks,
      [key]: !diagnosticHooks[key],
    });
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Profiles, mission clock, theme appearance, display units, personal references, and local SQLite storage diagnostics.
          </p>
        </div>
      </div>

      {/* 1. Appearance & Display Units */}
      <div className="overview-grid">
        <section className="panel-card stack-md" aria-labelledby="appearance-heading">
          <div>
            <h2 id="appearance-heading" className="panel-heading">
              Appearance
            </h2>
            <p className="page-subtitle" style={{ fontSize: 13 }}>
              Defaults to Windows System preference and switches instantly without leaving your screen or draft. Currently active:{" "}
              <strong>{resolvedTheme === "light" ? "Vercel Light" : "Linear Dark"}</strong>.
            </p>
          </div>
          <div className="segmented-group" role="group" aria-label="Appearance theme">
            {(["system", "light", "dark"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                className="segmented-btn"
                aria-pressed={preferences.appearance === opt}
                onClick={() => void setAppearance(opt)}
              >
                {opt === "system" ? "System" : opt === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-card stack-md" aria-labelledby="units-heading">
          <div>
            <h2 id="units-heading" className="panel-heading">
              Display units
            </h2>
            <p className="page-subtitle" style={{ fontSize: 13 }}>
              Controls how Overview, Trends, and Reports render values while keeping original entered values & precision intact.
            </p>
          </div>

          <div className="form-grid-2">
            <div className="field-group">
              <span className="field-label">Blood glucose display</span>
              <div className="segmented-group" role="group" aria-label="Blood glucose display unit">
                {(["mg/dL", "mmol/L"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="segmented-btn"
                    aria-pressed={preferences.displayUnits.blood_glucose === u}
                    onClick={() =>
                      void setDisplayUnits({ ...preferences.displayUnits, blood_glucose: u })
                    }
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <span className="field-label">Temperature display</span>
              <div className="segmented-group" role="group" aria-label="Temperature display unit">
                {(["C", "F"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="segmented-btn"
                    aria-pressed={preferences.displayUnits.body_temperature === u}
                    onClick={() =>
                      void setDisplayUnits({ ...preferences.displayUnits, body_temperature: u })
                    }
                  >
                    {u === "C" ? "°C" : "°F"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 2. Profiles: Demo vs Personal */}
      <section className="panel-card stack-md" aria-labelledby="profiles-heading">
        <div className="row-wrap" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 id="profiles-heading" className="panel-heading">
              Profiles & isolation
            </h2>
            <p className="page-subtitle" style={{ fontSize: 13 }}>
              Demo data (SIM-01) and Personal logs are strictly separated by profile in SQLite.
            </p>
          </div>
          <div className="row-wrap">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void loadSimScheduleFixture()}
            >
              Load SIM-SCHEDULE fixture
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => openModal({ kind: "reset_demo" })}
            >
              Reset demo
            </button>
          </div>
        </div>

        <div
          className="data-table-wrap"
          role="region"
          aria-label="Local profiles table"
          tabIndex={0}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Mode</th>
                <th>Epoch / Clock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allProfiles.map((prof) => {
                const isCurrent = prof.profileId === activeProfile.profileId;
                return (
                  <tr key={prof.profileId}>
                    <td style={{ fontWeight: 590 }}>{prof.label}</td>
                    <td>
                      <span className="badge-neutral">
                        {prof.mode === "demo" ? "Demo · Synthetic" : "Personal · Local log"}
                      </span>
                    </td>
                    <td className="tabular-value" style={{ fontSize: 13 }}>
                      {prof.missionEpochUtc} · v{prof.clockVersion}
                    </td>
                    <td>
                      <div className="row-wrap">
                        <button
                          type="button"
                          className={isCurrent ? "btn-secondary" : "btn-primary"}
                          disabled={isCurrent}
                          onClick={() => void switchProfile(prof.profileId)}
                        >
                          {isCurrent ? "Active" : "Switch to profile"}
                        </button>
                        {prof.mode === "personal" ? (
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() =>
                              openModal({
                                kind: "delete_personal_profile",
                                profileId: prof.profileId,
                                alias: prof.label,
                              })
                            }
                          >
                            Delete personal profile
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="form-grid-2" style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 14 }}>
          <div className="field-group">
            <label className="field-label" htmlFor="new-personal-alias">
              New personal profile alias (pseudonymous local label)
            </label>
            <input
              id="new-personal-alias"
              className="text-input"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="new-personal-tz">
              Timezone display label
            </label>
            <div className="row-wrap">
              <input
                id="new-personal-tz"
                className="text-input"
                style={{ flex: 1 }}
                value={newTz}
                onChange={(e) => setNewTz(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => void createPersonalProfile(newAlias, newTz)}
              >
                Create blank Personal profile
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Mission Clock & Schedules */}
      <div className="overview-grid">
        <section className="panel-card stack-md" aria-labelledby="clock-heading">
          <div>
            <h2 id="clock-heading" className="panel-heading">
              Mission clock (Version {activeProfile.clockVersion})
            </h2>
            <p className="page-subtitle" style={{ fontSize: 13 }}>
              Stored UTC observation timestamps stay immutable; changing epoch or timezone versions mission-day display context.
            </p>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="clock-epoch">
              Mission Day 1 epoch (UTC ISO-8601)
            </label>
            <input
              id="clock-epoch"
              className="text-input tabular-value"
              value={clockEpoch}
              onChange={(e) => setClockEpoch(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="clock-tz">
              Timezone label
            </label>
            <input
              id="clock-tz"
              className="text-input"
              value={clockTz}
              onChange={(e) => setClockTz(e.target.value)}
            />
          </div>
          <button type="button" className="btn-secondary" onClick={() => void handleSaveClock()}>
            Save mission clock version
          </button>
        </section>

        <section className="panel-card stack-md" aria-labelledby="sched-heading">
          <div>
            <h2 id="sched-heading" className="panel-heading">
              Optional check-in schedule
            </h2>
            <p className="page-subtitle" style={{ fontSize: 13 }}>
              Marks Overview cells as Past interval when an optional user-configured interval elapses.
            </p>
          </div>
          <ScheduledNotificationSetting />
          <div className="form-grid-2">
            <div className="field-group">
              <label className="field-label" htmlFor="sched-metric">
                Measurement
              </label>
              <select
                id="sched-metric"
                className="select-input"
                value={schedMetric}
                onChange={(e) => setSchedMetric(e.target.value as MetricId)}
              >
                {METRIC_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {METRIC_DEFINITIONS[m].name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="sched-hours">
                Interval (hours)
              </label>
              <input
                id="sched-hours"
                className="text-input"
                value={schedHours}
                onChange={(e) => setSchedHours(e.target.value)}
              />
            </div>
          </div>
          <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={schedEnabled}
              onChange={(e) => setSchedEnabled(e.target.checked)}
            />
            <span>Enable reminder interval for this measurement</span>
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              void updateMetricSchedule(schedMetric, {
                enabled: schedEnabled,
                intervalHours: Math.max(1, Number(schedHours) || 24),
                configuredAtUtc: currentReferenceNowUtc,
              })
            }
          >
            Save schedule setting
          </button>
        </section>
      </div>

      {/* 4. Personal Reference Editor & History */}
      <section className="panel-card stack-md" aria-labelledby="refs-heading">
        <div>
          <h2 id="refs-heading" className="panel-heading">
            Personal reference editor & version history
          </h2>
          <p className="page-subtitle" style={{ fontSize: 13 }}>
            Updates create a new numbered version while superseding prior versions cleanly. Locked fallback baselines are never silently retrained.
          </p>
        </div>

        <div className="form-grid-2">
          <div className="field-group">
            <label className="field-label" htmlFor="ref-metric">
              Measurement
            </label>
            <select
              id="ref-metric"
              className="select-input"
              value={refMetric}
              onChange={(e) => setRefMetric(e.target.value as Exclude<MetricId, "mood">)}
            >
              {METRIC_ORDER.filter((m): m is Exclude<MetricId, "mood"> => m !== "mood").map((m) => (
                <option key={m} value={m}>
                  {METRIC_DEFINITIONS[m].name}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="ref-val">
              {refMetric === "sleep"
                ? "Target duration (minutes)"
                : refMetric === "blood_pressure"
                  ? "Systolic (mmHg)"
                  : `Reference value (${METRIC_DEFINITIONS[refMetric].canonicalUnit})`}
            </label>
            <div className="row-wrap">
              <input
                id="ref-val"
                aria-invalid={!!refErrors.primary} aria-describedby="ref-primary-error"
                className="text-input"
                style={{ flex: 1 }}
                value={refPrimary}
                onChange={(e) => setRefPrimary(e.target.value)}
              />
              {refMetric === "blood_pressure" ? (
                <input
                  className="text-input"
                  style={{ width: 100 }}
                  value={refSecondary}
                  onChange={(e) => setRefSecondary(e.target.value)}
                  id="ref-secondary" aria-label="Diastolic reference mmHg" aria-invalid={!!refErrors.secondary} aria-describedby="ref-secondary-error"
                />
              ) : null}
            </div>
          </div>
          <p id="ref-primary-error" role="alert">{refErrors.primary}</p>
          <p id="ref-secondary-error" role="alert">{refErrors.secondary}</p>
          <div className="field-group">
            <label className="field-label" htmlFor="ref-method">
              Method (must match observations to compare)
            </label>
            <select
              id="ref-method" aria-invalid={!!refErrors.method} aria-describedby="ref-method-error"
              className="select-input"
              value={refMethod}
              onChange={(e) => setRefMethod(e.target.value)}
            >
              <option value="">Select method</option>
              {METRIC_DEFINITIONS[refMetric].methodOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="ref-context">
              Context
            </label>
            <select
              id="ref-context" aria-invalid={!!refErrors.context} aria-describedby="ref-context-error"
              className="select-input"
              value={refContext}
              onChange={(e) => setRefContext(e.target.value)}
            >
              <option value="">Select context</option>
              {METRIC_DEFINITIONS[refMetric].contextOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p id="ref-method-error" role="alert">{refErrors.method}</p><p id="ref-context-error" role="alert">{refErrors.context}</p>
        {refSaveError ? <p role="alert">{refSaveError}</p> : null}
        {reviewingReferenceId ? <div><strong>Review saved reference {reviewingReferenceId}. No value is saved until you confirm.</strong><label><input type="checkbox" checked={confirmedReference} onChange={e=>setConfirmedReference(e.target.checked)} />I have verified both BP inputs, method and context</label></div> : null}
        <div className="row-wrap">
          <button type="button" className="btn-primary" disabled={savingReference} onClick={() => void handleSaveNewReference()}>
            Save new reference version
          </button>
          <button type="button" className="btn-secondary" onClick={() => void handleDeriveFallback()}>
            Compute 7-day fallback median
          </button>
        </div>

        {snapshot.profileData.references.length > 0 ? (
          <div
            className="data-table-wrap"
            role="region"
            aria-label="Configured reference ranges table"
            tabIndex={0}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Method & context</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.profileData.references.map((r) => (
                  <tr key={r.referenceId}>
                    <td>{METRIC_DEFINITIONS[r.metricId].shortLabel}</td>
                    <td>{r.label}<pre>{JSON.stringify(r.value)} {r.unit}</pre>
                    {needsManualReferenceConfirmation(r) ? <span>Needs confirmation before comparison</span> : null}
                    {needsManualReferenceConfirmation(r) && r.metricId === refMetric && r.value?.kind === 'blood_pressure' ? <button type="button" onClick={() => { if(r.value?.kind !== 'blood_pressure') return; setRefPrimary(String(r.value.systolic)); setRefSecondary(String(r.value.diastolic)); setRefMethod(r.method); setRefContext(r.context); setReviewingReferenceId(r.referenceId); setConfirmedReference(false); }}>Review previous BP values</button> : null}</td>
                    <td>
                      <span className={r.status === "active" ? "badge-success" : "badge-neutral"}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.method} · {r.context}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* 5. Desktop Runtime Info, Help Fixture Toggle & Recovery Test Hooks */}
      <section className="panel-card stack-md" aria-labelledby="diag-heading">
        <div>
          <h2 id="diag-heading" className="panel-heading">
            Windows storage & recovery diagnostics
          </h2>
          <p className="page-subtitle" style={{ fontSize: 13 }}>
            Local SQLite runtime telemetry and deterministic toggles for verifying error recovery & Help boundaries.
          </p>
        </div>

        {runtimeInfo ? (
          <dl className="dl-rows">
            <div className="dl-row">
              <dt>Platform & Arch</dt>
              <dd className="tabular-value">
                {runtimeInfo.platform} ({runtimeInfo.arch}) · v{runtimeInfo.appVersion}
              </dd>
            </div>
            <div className="dl-row">
              <dt>Edge WebView2</dt>
              <dd className="tabular-value">{runtimeInfo.webview2Version ?? "Not detected"}</dd>
            </div>
            <div className="dl-row">
              <dt>SQLite Database</dt>
              <dd className="tabular-value">
                {runtimeInfo.dbPath} ({runtimeInfo.sqliteJournalMode})
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="stack-sm">
          <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={preferences.helpMode === "configured_fixture"}
              onChange={(e) =>
                void setHelpMode(e.target.checked ? "configured_fixture" : "unconfigured")
              }
            />
            <span>Enable Help configured test fixture card (C07 test mode)</span>
          </label>

          <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={diagnosticHooks.simulateDraftRetentionFailure}
              onChange={() => void toggleHook("simulateDraftRetentionFailure")}
            />
            <span>Simulate ER-01 draft retention failure</span>
          </label>

          <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={diagnosticHooks.simulateCommitRollback}
              onChange={() => void toggleHook("simulateCommitRollback")}
            />
            <span>Simulate ER-02 commit rollback (keeps draft in Review)</span>
          </label>

          <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={diagnosticHooks.simulateLostAck}
              onChange={() => void toggleHook("simulateLostAck")}
            />
            <span>Simulate ER-03 lost acknowledgement after SQLite commit</span>
          </label>

          <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={diagnosticHooks.simulateLookupUnavailable}
              onChange={() => void toggleHook("simulateLookupUnavailable")}
            />
            <span>Simulate storage lookup failure during Check the log</span>
          </label>

          <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={diagnosticHooks.simulateLogReadFailure}
              onChange={() => void toggleHook("simulateLogReadFailure")}
            />
            <span>Simulate C08 observation log read failure</span>
          </label>

          <div className="row-wrap" style={{ paddingTop: 6 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (activeDraft) {
                  setPendingUpdateBlocked(true);
                  showToast({
                    tone: "review",
                    title: "Update waits for your draft",
                    detail: "Active draft detected — application update deferred until draft is finished or exported.",
                  });
                } else {
                  setPendingUpdateBlocked(false);
                  showToast({
                    tone: "neutral",
                    title: "No active draft blocking update",
                    detail: "Update check boundary clear.",
                  });
                }
              }}
            >
              {pendingUpdateBlocked ? "Update deferred for draft" : "Test native update guard boundary"}
            </button>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => void refreshSnapshot(activeProfile.profileId)}
            >
              Reload SQLite snapshot
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
