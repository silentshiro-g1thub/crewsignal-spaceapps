import { MeasurementEducation } from '../components/MeasurementEducation';
import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  applyInputUnitChange,
  buildDraftRecoveryBundle,
  compareObservationToReference,
  computeMissionDay,
  createBlankDraft,
  formatReviewEquivalent,
  formatUtcTimeHHMM,
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  NEEDS_RECHECK_HELP,
  NEEDS_RECHECK_LABEL,
  MF_FIXTURES,
  MOOD_SCALE_SPEC,
  planCommitDraft,
  planInputUnitChange,
  resolveUnknownCommitOutcome,
  SIM_01_OPTIONAL_BP_DRAFT,
  SLEEP_TYPE_LABELS,
  ENTRY_CONFIRMED_NOTE,
  ENTRY_WARNING_HELP,
  validateDraftForReview,
  type CheckInDraft,
  type MetricId,
  type Observation,
  type SleepType,
} from "../shared/src";
import { desktopBridge } from "../bridge/desktopBridge";
import { useApp } from "../state/AppContext";

type CommitErrorKind = "none" | "rollback" | "unknown_outcome" | "unconfirmed" | "already_in_log";

export function CheckInRoute() {
  const {
    activeProfile,
    snapshot,
    preferences,
    activeDraft,
    setActiveDraft,
    draftRetentionFailed,
    setDraftRetentionFailed,
    saveDraftToStore,
    openModal,
    navigate,
    route,
    showToast,
    announce,
    currentReferenceNowUtc,
    activeReferencesByMetric,
    refreshSnapshot,
    sessionCommittedIds,
    addSessionCommittedId,
    setSelectedTrendMetric,
  } = useApp();

  const [savedReceipt, setSavedReceipt] = useState<{
    heading: string;
    detail: string;
    observation: Observation;
  } | null>(null);
  const [commitErrorKind, setCommitErrorKind] = useState<CommitErrorKind>("none");
  const [commitErrorMsg, setCommitErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retainingReview, setRetainingReview] = useState(false);

  // Initialize blank draft cleanly if user visits Check-in without an active draft or receipt
  useEffect(() => {
    if (route === "check_in" && !activeDraft && !savedReceipt && activeProfile) {
      const missionDay = Math.max(
        1,
        computeMissionDay(currentReferenceNowUtc, activeProfile.missionEpochUtc),
      );
      const hhmm = formatUtcTimeHHMM(currentReferenceNowUtc);
      const blank = createBlankDraft({
        draftId: `draft-heart_rate-${Date.now()}`,
        profileId: activeProfile.profileId,
        mode: activeProfile.mode,
        metricId: "heart_rate",
        missionEpochUtc: activeProfile.missionEpochUtc,
        proposedMissionDay: missionDay,
        proposedTimeHHMM: hhmm,
        nowUtc: currentReferenceNowUtc,
      });
      setActiveDraft(blank);
      setDraftRetentionFailed(false);
    }
  }, [
    activeDraft,
    activeProfile,
    currentReferenceNowUtc,
    savedReceipt,
    route,
    setActiveDraft,
    setDraftRetentionFailed,
  ]);

  if (!activeProfile || !snapshot) {
    return (
      <div className="panel-card">
        <p style={{ margin: 0 }}>Loading check-in workspace…</p>
      </div>
    );
  }

  const updateDraft = (mutator: (prev: CheckInDraft) => CheckInDraft) => {
    setCommitErrorKind("none");
    setCommitErrorMsg(null);
    setActiveDraft((prev) => {
      if (!prev) return prev;
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      return {
        ...mutator(prev),
        updatedAtUtc: nowIso,
      };
    });
  };

  const switchMetric = async (nextMetric: MetricId) => {
    setSavedReceipt(null);
    setCommitErrorKind("none");
    setCommitErrorMsg(null);
    const missionDay = Math.max(
      1,
      computeMissionDay(currentReferenceNowUtc, activeProfile.missionEpochUtc),
    );
    const hhmm = formatUtcTimeHHMM(currentReferenceNowUtc);
    const createNew = async () => {
      if (activeDraft) {
        await desktopBridge.deleteDraft(activeProfile.profileId, activeDraft.draftId);
      }
      const next = createBlankDraft({
        draftId: `draft-${nextMetric}-${Date.now()}`,
        profileId: activeProfile.profileId,
        mode: activeProfile.mode,
        metricId: nextMetric,
        missionEpochUtc: activeProfile.missionEpochUtc,
        proposedMissionDay: missionDay,
        proposedTimeHHMM: hhmm,
        nowUtc: currentReferenceNowUtc,
        preferredUnit:
          nextMetric === "blood_glucose"
            ? preferences.displayUnits.blood_glucose
            : nextMetric === "body_temperature"
              ? preferences.displayUnits.body_temperature
              : undefined,
      });
      await saveDraftToStore(next);
    };

    const hasEnteredText = Boolean(
      activeDraft &&
        (activeDraft.rawFields.primary.trim() ||
          activeDraft.rawFields.secondary?.trim() ||
          activeDraft.rawFields.hours?.trim() ||
          activeDraft.rawFields.minutes?.trim() ||
          activeDraft.rawFields.moodScore !== null ||
          activeDraft.note.trim()),
    );

    if (activeDraft && activeDraft.metricId !== nextMetric && hasEnteredText) {
      openModal({
        kind: "discard_draft",
        targetRoute: null,
        onConfirm: () => {
          void createNew();
        },
      });
      return;
    }
    await createNew();
  };

  const handleLoadFixtureDraft = async (fixtureDraft: CheckInDraft) => {
    setSavedReceipt(null);
    setCommitErrorKind("none");
    setCommitErrorMsg(null);
    const adapted: CheckInDraft = {
      ...structuredClone(fixtureDraft),
      profileId: activeProfile.profileId,
      mode: activeProfile.mode,
      missionEpochUtc: activeProfile.missionEpochUtc,
      stage: "record",
    };
    await saveDraftToStore(adapted);
    showToast({
      tone: "neutral",
      title: `Loaded draft fixture (${METRIC_DEFINITIONS[adapted.metricId].shortLabel})`,
      detail: "Draft remains uncommitted until Review -> Add to log.",
    });
  };

  const handleExportRecovery = async () => {
    if (!activeDraft) return;
    const bundle = buildDraftRecoveryBundle({
      draft: activeDraft,
      profileLabel: activeProfile.label,
      exportedAtUtc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      includeNotes: false,
    });
    const res = await desktopBridge.saveExportFile({
      defaultFileName: `crewsignal-draft-recovery-${activeDraft.draftId}.json`,
      filterName: "JSON files",
      extensions: ["json"],
      content: JSON.stringify(bundle, null, 2),
    });
    if (res.status === "saved") {
      showToast({
        tone: "success",
        title: "File saved",
        detail: res.path ?? undefined,
      });
    } else if (res.status !== "cancelled") {
      showToast({
        tone: "danger",
        title: res.status === "permission_refused" ? "File access wasn't granted" : "Couldn't export",
        detail: res.message ?? "Your draft stays active on screen.",
      });
    }
  };

  const handleSaveDraftExplicit = async () => {
    if (!activeDraft) return;
    setBusy(true);
    try {
      const retained = await saveDraftToStore(activeDraft);
      if (retained) {
        showToast({
          tone: "success",
          title: "Draft kept on this device",
          detail: "You can return anytime or advance to Review.",
        });
      } else {
        announce("We couldn't retain this draft on this device.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleProceedToReview = async () => {
    if (!activeDraft) return;
    const result = validateDraftForReview(activeDraft, currentReferenceNowUtc);
    const nextDraft: CheckInDraft = {
      ...activeDraft,
      validationState: result.validationState,
      normalizedCandidate: result.canonical,
      stage: result.validationState.valid ? "review" : "record",
    };
    if (!result.validationState.valid) {
      setActiveDraft(nextDraft);
      announce(result.validationState.announcement ?? "Check the highlighted field.");
      const firstKey = result.validationState.firstInvalidField;
      if (firstKey) {
        window.setTimeout(() => {
          const el = document.getElementById(`field-${firstKey}`);
          el?.focus();
        }, 20);
      }
      return;
    }

    setRetainingReview(true);
    try {
      await saveDraftToStore(nextDraft);
    } finally {
      setRetainingReview(false);
    }
  };

  const handleCommitToLog = async (confirmedUnusualValue: boolean) => {
    if (!activeDraft) return;
    setCommitErrorKind("none");
    setCommitErrorMsg(null);
    if (!activeProfile || activeDraft.profileId !== activeProfile.profileId) {
      // Never add one profile's draft to another profile's log.
      setCommitErrorKind("rollback");
      setCommitErrorMsg(
        "This draft belongs to another profile. Switch back to that profile to add it. No changes made.",
      );
      return;
    }
    setBusy(true);
    const committedAtUtc = currentReferenceNowUtc;
    const stableObsId =
      activeDraft.committedObservationId ??
      `obs-${activeDraft.draftId.replace(/^draft-/, "")}`;

    try {
      const plan = planCommitDraft({
        draft: activeDraft,
        existingObservations: snapshot.profileData.observations,
        observationId: stableObsId,
        committedAtUtc,
        confirmedUnusualValue,
      });

      if (!plan.ok || !plan.observation) {
        setCommitErrorKind("rollback");
        setCommitErrorMsg(plan.error ?? "Entry validation failed before commit.");
        return;
      }

      if (plan.outcome === "already_in_log") {
        await desktopBridge.deleteDraft(activeProfile.profileId, activeDraft.draftId);
        addSessionCommittedId(plan.observation.observationId);
        setSavedReceipt({
          heading: "Already in your log",
          detail: "Stored on this device. No duplicate entry was created.",
          observation: plan.observation,
        });
        setActiveDraft(null);
        await refreshSnapshot(activeProfile.profileId);
        return;
      }

      const res = await desktopBridge.commitObservation({
        profileId: activeProfile.profileId,
        draftId: activeDraft.draftId,
        observation: plan.observation,
      });

      addSessionCommittedId(res.observation.observationId);
      setActiveDraft(null);
      setDraftRetentionFailed(false);
      await refreshSnapshot(activeProfile.profileId);
      setSavedReceipt({
        heading: res.outcome === "already_in_log" ? "Already in your log" : "Added to your log",
        detail: "Stored on this device",
        observation: res.observation,
      });
      announce(
        `${res.outcome === "already_in_log" ? "Already in your log" : "Added to your log"}. Stored on this device.`,
      );
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : "ERROR";
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Commit failed.";
      if (code === "UNKNOWN_OUTCOME") {
        setCommitErrorKind("unknown_outcome");
        setCommitErrorMsg(message);
        setActiveDraft((prev) =>
          prev
            ? {
                ...prev,
                commitStatus: "unconfirmed",
                committedObservationId: stableObsId,
              }
            : prev,
        );
      } else if (code === "COMMIT_SCOPE_MISMATCH") {
        setCommitErrorKind("rollback");
        setCommitErrorMsg(message);
      } else {
        setCommitErrorKind("rollback");
        setCommitErrorMsg(
          "The addition did not finish. Your entry is still here and can be saved again.",
        );
      }
      announce(message);
    } finally {
      setBusy(false);
    }
  };

  const handleCheckLogStatus = async () => {
    if (!activeDraft) return;
    setBusy(true);
    try {
      const lookup = await desktopBridge.checkObservationStatus({
        profileId: activeProfile.profileId,
        observationId: activeDraft.committedObservationId ?? undefined,
        draftId: activeDraft.draftId,
      });

      const resolved = resolveUnknownCommitOutcome({
        draftId: activeDraft.draftId,
        profileId: activeProfile.profileId,
        storageCheckSucceeded: lookup.state !== "unconfirmed",
        existingObservations: lookup.observation ? [lookup.observation] : [],
      });

      if (resolved.status === "already_in_log" && resolved.existingObservation) {
        await desktopBridge.deleteDraft(activeProfile.profileId, activeDraft.draftId);
        addSessionCommittedId(resolved.existingObservation.observationId);
        setActiveDraft(null);
        await refreshSnapshot(activeProfile.profileId);
        setSavedReceipt({
          heading: resolved.heading,
          detail: resolved.message,
          observation: resolved.existingObservation,
        });
        setCommitErrorKind("none");
      } else if (resolved.status === "unconfirmed") {
        setCommitErrorKind("unconfirmed");
        setCommitErrorMsg(resolved.message);
      } else {
        setCommitErrorKind("rollback");
        setCommitErrorMsg(resolved.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // Saved receipt screen
  if (savedReceipt) {
    const receiptDef = METRIC_DEFINITIONS[savedReceipt.observation.metricId];
    return (
      <div className="stack-lg">
        <div className="page-header">
          <div>
            <h1 className="page-title">Check-in</h1>
            <p className="page-subtitle">Recorded on {activeProfile.label}</p>
          </div>
        </div>

        <ol className="stepper-row" aria-label="Check-in steps">
          <li className="stepper-item" data-state="done">
            <span className="stepper-circle">1</span>
            <span>Record</span>
          </li>
          <div className="stepper-line" aria-hidden="true" />
          <li className="stepper-item" data-state="done">
            <span className="stepper-circle">2</span>
            <span>Review</span>
          </li>
          <div className="stepper-line" aria-hidden="true" />
          <li className="stepper-item" data-state="active">
            <span className="stepper-circle">3</span>
            <span>Saved</span>
          </li>
        </ol>

        <section className="panel-card stack-md" aria-labelledby="saved-receipt-heading">
          <div className="row-wrap" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 id="saved-receipt-heading" className="panel-heading">
                {savedReceipt.heading}
              </h2>
              <p style={{ margin: "4px 0 0", color: "var(--text-body)" }}>
                {savedReceipt.detail}
              </p>
            </div>
            <span className="badge-success">Stored locally</span>
          </div>

          <dl className="dl-rows">
            <div className="dl-row">
              <dt>Measurement</dt>
              <dd>{receiptDef.name}</dd>
            </div>
            <div className="dl-row">
              <dt>Entered</dt>
              <dd className="tabular-value">
                {savedReceipt.observation.entered.kind === "blood_pressure"
                  ? `${savedReceipt.observation.entered.systolic}/${savedReceipt.observation.entered.diastolic} mmHg`
                  : savedReceipt.observation.entered.kind === "sleep_duration"
                    ? savedReceipt.observation.entered.reportedNoSleep
                      ? "Reported no sleep (0h 0m)"
                      : `${Math.floor(savedReceipt.observation.entered.durationMinutes / 60)}h ${(savedReceipt.observation.entered.durationMinutes % 60).toString().padStart(2, "0")}m`
                    : savedReceipt.observation.entered.kind === "mood_ordinal"
                      ? `${savedReceipt.observation.entered.score} / 5 · ${savedReceipt.observation.entered.label}`
                      : `${savedReceipt.observation.entered.value} ${savedReceipt.observation.entered.unit}`}
              </dd>
            </div>
            <div className="dl-row">
              <dt>Method & context</dt>
              <dd>
                {savedReceipt.observation.method} · {savedReceipt.observation.context}
              </dd>
            </div>
            {savedReceipt.observation.quality === "questionable" ? (
              <div className="dl-row"><dt>Quality</dt><dd>{NEEDS_RECHECK_LABEL}</dd></div>
            ) : null}
            {savedReceipt.observation.qualityNote === ENTRY_CONFIRMED_NOTE && (
              <div className="dl-row"><dt>Confirmation</dt><dd>{ENTRY_CONFIRMED_NOTE}</dd></div>
            )}
          </dl>

          <div className="row-wrap">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSavedReceipt(null);
                navigate("overview");
              }}
            >
              Back to overview
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSavedReceipt(null);
                void switchMetric(savedReceipt.observation.quality === "questionable"
                  ? savedReceipt.observation.metricId : "heart_rate");
              }}
            >
              {savedReceipt.observation.quality === "questionable" ? "Log a new reading" : "Record another"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const m = savedReceipt.observation.metricId;
                setSavedReceipt(null);
                setSelectedTrendMetric(m);
                navigate("trends");
              }}
            >
              View in Trends
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!activeDraft) return null;

  const def = METRIC_DEFINITIONS[activeDraft.metricId];
  const errs = activeDraft.validationState.errors;

  // Equivalent conversion string for Review (never mutates entered)
  let equivalentReviewLabel: string | null = null;
  if (
    activeDraft.metricId === "blood_glucose" ||
    activeDraft.metricId === "body_temperature"
  ) {
    const num = Number(activeDraft.rawFields.primary);
    if (Number.isFinite(num)) {
      equivalentReviewLabel =
        formatReviewEquivalent(
          activeDraft.metricId,
          num,
          activeDraft.selectedUnit,
        )?.label ?? null;
    }
  }

  // Review preview compatibility notice
  const reviewPreview = validateDraftForReview(activeDraft, currentReferenceNowUtc);
  const reviewRef = activeReferencesByMetric[activeDraft.metricId];
  const tempReviewObs: Observation | null =
    reviewPreview.entered && reviewPreview.canonical && reviewPreview.timing
      ? {
          observationId: "preview-obs",
          profileId: activeProfile.profileId,
          metricId: activeDraft.metricId,
          timing: reviewPreview.timing,
          recordedAtUtc: currentReferenceNowUtc,
          entered: reviewPreview.entered,
          canonical: reviewPreview.canonical,
          method: activeDraft.method,
          context: activeDraft.context,
          provenance: activeDraft.provenance,
          quality: activeDraft.quality ?? "valid",
          qualityNote: null,
          note: activeDraft.note.trim() || null,
          sourceDraftId: activeDraft.draftId,
          importBatchId: null,
          correctionHistory: [],
        }
      : null;

  const reviewComparison = tempReviewObs
    ? compareObservationToReference(tempReviewObs, reviewRef)
    : null;

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 className="page-title">Check-in</h1>
          <p className="page-subtitle">
            Record, verify on Review, and add explicitly to your local SQLite log.
          </p>
        </div>
        <div className="row-wrap">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => openModal({ kind: "measurement_help", metricId: activeDraft.metricId })}
          >
            <HelpCircle size={16} aria-hidden="true" />
            <span>What is this?</span>
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              openModal({
                kind: "skip_checkin",
                committedInSession: sessionCommittedIds.length,
              })
            }
          >
            Skip check-in
          </button>
        </div>
      </div>

      <ol className="stepper-row" aria-label="Check-in steps">
        <li
          className="stepper-item"
          data-state={activeDraft.stage === "record" ? "active" : "done"}
        >
          <span className="stepper-circle">1</span>
          <span>Record</span>
        </li>
        <div className="stepper-line" aria-hidden="true" />
        <li
          className="stepper-item"
          data-state={activeDraft.stage === "review" ? "active" : undefined}
        >
          <span className="stepper-circle">2</span>
          <span>Review</span>
        </li>
        <div className="stepper-line" aria-hidden="true" />
        <li className="stepper-item">
          <span className="stepper-circle">3</span>
          <span>Saved</span>
        </li>
      </ol>

      {/* ER-01 Retention Failure Banner */}
      {draftRetentionFailed ? (
        <div className="notice-banner notice-banner-danger" role="alert">
          <div>
            <strong>We couldn't retain this draft on this device.</strong>{" "}
            Export a recovery file before leaving or retrying.
          </div>
          <div className="row-wrap">
            <button type="button" className="btn-secondary" onClick={handleExportRecovery}>
              Export draft recovery file
            </button>
            <button type="button" className="btn-primary" onClick={handleSaveDraftExplicit}>
              Retry retaining draft
            </button>
          </div>
        </div>
      ) : null}

      {/* Metric selector strip */}
      <div className="chip-group" role="group" aria-label="Choose measurement">
        {METRIC_ORDER.map((mId) => (
          <button
            key={mId}
            type="button"
            className="chip-btn"
            aria-pressed={activeDraft.metricId === mId}
            disabled={retainingReview}
            onClick={() => void switchMetric(mId)}
          >
            {METRIC_DEFINITIONS[mId].shortLabel}
          </button>
        ))}
      </div>

      {activeDraft.stage === "record" ? (
        <div className="split-layout">
          <section className="panel-card stack-md" aria-labelledby="record-form-heading">
            <div className="row-wrap" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 id="record-form-heading" className="panel-heading">
                  {def.name}
                </h2>
                <p className="page-subtitle" style={{ fontSize: 13 }}>
                  {def.purpose}
                </p>
              </div>
              {def.supportsUnavailableInstrument ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    openModal({ kind: "unavailable_metric", metricId: activeDraft.metricId })
                  }
                >
                  Mark unavailable
                </button>
              ) : null}
            </div>

            {activeDraft.validationState.announcement ? (
              <div className="notice-banner notice-banner-danger" role="alert">
                <div>{activeDraft.validationState.announcement}</div>
              </div>
            ) : null}

            <MeasurementEducation key={def.id} definition={def} collapsible />

            {/* Metric-specific fields */}
            {activeDraft.metricId === "heart_rate" ? (
              <div className="field-group">
                <label className="field-label" htmlFor="field-primary">
                  Heart rate (bpm)
                </label>
                <div className="input-with-unit">
                  <input
                    id="field-primary"
                    className="text-input"
                    inputMode="decimal"
                    value={activeDraft.rawFields.primary}
                    aria-invalid={Boolean(errs.primary)}
                    aria-describedby={errs.primary ? "err-primary" : undefined}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        rawFields: { ...d.rawFields, primary: e.target.value },
                      }))
                    }
                    placeholder="e.g., 72"
                  />
                  <span className="input-unit-suffix">bpm</span>
                </div>
                {errs.primary ? (
                  <p id="err-primary" className="field-error-text">
                    {errs.primary}
                  </p>
                ) : null}
              </div>
            ) : null}

            {activeDraft.metricId === "blood_pressure" ? (
              <div className="form-grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="field-primary">
                    Systolic (mmHg)
                  </label>
                  <div className="input-with-unit">
                    <input
                      id="field-primary"
                      className="text-input"
                      inputMode="decimal"
                      value={activeDraft.rawFields.primary}
                      aria-invalid={Boolean(errs.primary)}
                      aria-describedby={errs.primary ? "err-primary" : undefined}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          rawFields: { ...d.rawFields, primary: e.target.value },
                        }))
                      }
                      placeholder="e.g., 118"
                    />
                    <span className="input-unit-suffix">mmHg</span>
                  </div>
                  {errs.primary ? (
                    <p id="err-primary" className="field-error-text">
                      {errs.primary}
                    </p>
                  ) : null}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="field-secondary">
                    Diastolic (mmHg)
                  </label>
                  <div className="input-with-unit">
                    <input
                      id="field-secondary"
                      className="text-input"
                      inputMode="decimal"
                      value={activeDraft.rawFields.secondary ?? ""}
                      aria-invalid={Boolean(errs.secondary)}
                      aria-describedby={errs.secondary ? "err-secondary" : undefined}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          rawFields: { ...d.rawFields, secondary: e.target.value },
                        }))
                      }
                      placeholder="e.g., 76"
                    />
                    <span className="input-unit-suffix">mmHg</span>
                  </div>
                  {errs.secondary ? (
                    <p id="err-secondary" className="field-error-text">
                      {errs.secondary}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {(activeDraft.metricId === "blood_glucose" ||
              activeDraft.metricId === "body_temperature") ? (
              <div className="form-grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="field-primary">
                    {def.name} ({activeDraft.selectedUnit === "C" ? "°C" : activeDraft.selectedUnit === "F" ? "°F" : activeDraft.selectedUnit})
                  </label>
                  <div className="input-with-unit">
                    <input
                      id="field-primary"
                      className="text-input"
                      inputMode="decimal"
                      value={activeDraft.rawFields.primary}
                      aria-invalid={Boolean(errs.primary)}
                      aria-describedby={errs.primary ? "err-primary" : undefined}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          rawFields: { ...d.rawFields, primary: e.target.value },
                        }))
                      }
                      placeholder={activeDraft.metricId === "blood_glucose" ? "e.g., 5.4" : "e.g., 36.7"}
                    />
                    <span className="input-unit-suffix">
                      {activeDraft.selectedUnit === "C"
                        ? "°C"
                        : activeDraft.selectedUnit === "F"
                          ? "°F"
                          : activeDraft.selectedUnit}
                    </span>
                  </div>
                  {errs.primary ? (
                    <p id="err-primary" className="field-error-text">
                      {errs.primary}
                    </p>
                  ) : null}
                </div>

                <div className="field-group">
                  <span className="field-label">Input unit</span>
                  <div className="segmented-group" role="group" aria-label="Select input unit">
                    {def.acceptedUnits.map((unitOpt) => (
                      <button
                        key={unitOpt}
                        type="button"
                        className="segmented-btn"
                        aria-pressed={activeDraft.selectedUnit === unitOpt}
                        onClick={() => {
                          const plan = planInputUnitChange(
                            activeDraft.rawFields.primary,
                            activeDraft.selectedUnit,
                            unitOpt,
                          );
                          const doApply = (confirmed: boolean) => {
                            const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
                            setActiveDraft((prev) =>
                              prev ? applyInputUnitChange(prev, unitOpt, confirmed, nowIso) : prev,
                            );
                          };
                          if (plan.requiresConfirmation) {
                            openModal({
                              kind: "unit_change",
                              draftId: activeDraft.draftId,
                              fromUnit: plan.fromUnit,
                              toUnit: plan.toUnit,
                              rawValue: plan.currentRawValue,
                              dialogTitle: plan.dialogTitle,
                              dialogBody: plan.dialogBody,
                              confirmLabel: plan.confirmLabel,
                              cancelLabel: plan.cancelLabel,
                              onConfirm: () => doApply(true),
                            });
                          } else {
                            doApply(true);
                          }
                        }}
                      >
                        {unitOpt === "C" ? "°C" : unitOpt === "F" ? "°F" : unitOpt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeDraft.metricId === "sleep" ? (
              <div className="stack-md">
                <div className="form-grid-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="field-hours">
                      Sleep duration — hours
                    </label>
                    <input
                      id="field-hours"
                      className="text-input"
                      inputMode="numeric"
                      value={activeDraft.rawFields.hours ?? ""}
                      aria-invalid={Boolean(errs.hours)}
                      aria-describedby={errs.hours ? "err-hours" : undefined}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          rawFields: { ...d.rawFields, hours: e.target.value },
                        }))
                      }
                      placeholder="e.g., 7"
                    />
                    {errs.hours ? (
                      <p id="err-hours" className="field-error-text">
                        {errs.hours}
                      </p>
                    ) : null}
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="field-minutes">
                      Minutes (0–59)
                    </label>
                    <input
                      id="field-minutes"
                      className="text-input"
                      inputMode="numeric"
                      value={activeDraft.rawFields.minutes ?? ""}
                      aria-invalid={Boolean(errs.minutes)}
                      aria-describedby={errs.minutes ? "err-minutes" : undefined}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          rawFields: { ...d.rawFields, minutes: e.target.value },
                        }))
                      }
                      placeholder="e.g., 30"
                    />
                    {errs.minutes ? (
                      <p id="err-minutes" className="field-error-text">
                        {errs.minutes}
                      </p>
                    ) : null}
                  </div>
                </div>

                {activeDraft.rawFields.hours?.trim() === "0" &&
                activeDraft.rawFields.minutes?.trim() === "0" ? (
                  <div className="notice-banner notice-banner-review" role="status">
                    <div>
                      <strong>Reported no sleep (0h 0m)</strong> — Explicitly logged as zero sleep rather than a missing entry.
                    </div>
                  </div>
                ) : null}

                <div className="form-grid-2">
                  <div className="field-group">
                    <label className="field-label" htmlFor="field-sleepType">
                      Sleep period type
                    </label>
                    <select
                      id="field-sleepType"
                      className="select-input"
                      value={activeDraft.rawFields.sleepType ?? "main_sleep"}
                      onChange={(e) => {
                        const sleepType = e.target.value as SleepType;
                        updateDraft((d) => ({
                          ...d,
                          context: SLEEP_TYPE_LABELS[sleepType],
                          rawFields: { ...d.rawFields, sleepType },
                        }));
                      }}
                    >
                      <option value="main_sleep">Main sleep</option>
                      <option value="nap">Nap</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="field-endingMissionDay">
                      Ending mission day
                    </label>
                    <input
                      id="field-endingMissionDay"
                      className="text-input"
                      inputMode="numeric"
                      value={activeDraft.rawFields.endingMissionDay ?? ""}
                      aria-invalid={Boolean(errs.endingMissionDay)}
                      aria-describedby={errs.endingMissionDay ? "err-endingDay" : undefined}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          rawFields: { ...d.rawFields, endingMissionDay: e.target.value },
                        }))
                      }
                    />
                    {errs.endingMissionDay ? (
                      <p id="err-endingDay" className="field-error-text">
                        {errs.endingMissionDay}
                      </p>
                    ) : null}
                  </div>
                </div>

                <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(activeDraft.rawFields.hasSleepWindow)}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        rawFields: {
                          ...d.rawFields,
                          hasSleepWindow: e.target.checked,
                          windowStartDay: d.rawFields.windowStartDay ?? d.rawFields.endingMissionDay ?? "1",
                          windowStartTime: d.rawFields.windowStartTime ?? "22:30",
                          windowEndDay: d.rawFields.windowEndDay ?? d.rawFields.endingMissionDay ?? "1",
                          windowEndTime: d.rawFields.windowEndTime ?? "06:30",
                        },
                      }))
                    }
                  />
                  <span>Exact sleep window (optional — never overwrites estimated duration)</span>
                </label>

                {activeDraft.rawFields.hasSleepWindow ? (
                  <div className="form-grid-2">
                    <div className="field-group">
                      <label className="field-label" htmlFor="field-windowStartDay">
                        Start mission day & time (HH:MM)
                      </label>
                      <div className="row-wrap">
                        <input
                          id="field-windowStartDay"
                          className="text-input"
                          style={{ width: 90 }}
                          value={activeDraft.rawFields.windowStartDay ?? ""}
                          onChange={(e) =>
                            updateDraft((d) => ({
                              ...d,
                              rawFields: { ...d.rawFields, windowStartDay: e.target.value },
                            }))
                          }
                          aria-label="Sleep start mission day"
                        />
                        <input
                          id="field-windowStartTime"
                          className="text-input"
                          style={{ width: 110 }}
                          value={activeDraft.rawFields.windowStartTime ?? ""}
                          onChange={(e) =>
                            updateDraft((d) => ({
                              ...d,
                              rawFields: { ...d.rawFields, windowStartTime: e.target.value },
                            }))
                          }
                          aria-label="Sleep start HH:MM"
                        />
                      </div>
                      {errs.windowStartDay || errs.windowStartTime ? (
                        <p className="field-error-text">
                          {errs.windowStartDay ?? errs.windowStartTime}
                        </p>
                      ) : null}
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="field-windowEndDay">
                        End mission day & time (HH:MM)
                      </label>
                      <div className="row-wrap">
                        <input
                          id="field-windowEndDay"
                          className="text-input"
                          style={{ width: 90 }}
                          value={activeDraft.rawFields.windowEndDay ?? ""}
                          aria-invalid={Boolean(errs.windowEndDay)}
                          onChange={(e) =>
                            updateDraft((d) => ({
                              ...d,
                              rawFields: { ...d.rawFields, windowEndDay: e.target.value },
                            }))
                          }
                          aria-label="Sleep end mission day"
                        />
                        <input
                          id="field-windowEndTime"
                          className="text-input"
                          style={{ width: 110 }}
                          value={activeDraft.rawFields.windowEndTime ?? ""}
                          onChange={(e) =>
                            updateDraft((d) => ({
                              ...d,
                              rawFields: { ...d.rawFields, windowEndTime: e.target.value },
                            }))
                          }
                          aria-label="Sleep end HH:MM"
                        />
                      </div>
                      {errs.windowEndDay || errs.windowEndTime ? (
                        <p id="err-windowEndDay" className="field-error-text">
                          {errs.windowEndDay ?? errs.windowEndTime}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeDraft.metricId === "mood" ? (
              <div className="stack-md">
                <div>
                  <p className="field-label" style={{ marginBottom: 4 }}>
                    {MOOD_SCALE_SPEC.questionText}
                  </p>
                  <p className="field-helper-text">
                    Mood score (1–5 · CrewSignal custom scale v1). Starts unselected — not comparable to clinical depression/anxiety scales.
                  </p>
                </div>

                <div
                  id="field-moodScore"
                  className="mood-scale-grid"
                  role="group"
                  aria-label="Mood rating 1 to 5"
                >
                  {MOOD_SCALE_SPEC.choices.map((choice) => (
                    <button
                      key={choice.score}
                      type="button"
                      className="mood-btn"
                      aria-pressed={activeDraft.rawFields.moodScore === choice.score}
                      onClick={() =>
                        updateDraft((d) => ({
                          ...d,
                          rawFields: { ...d.rawFields, moodScore: choice.score },
                        }))
                      }
                    >
                      <span className="tabular-value" style={{ fontWeight: 590, fontSize: 16 }}>
                        {choice.score}
                      </span>
                      <span style={{ fontSize: 13 }}>{choice.label}</span>
                    </button>
                  ))}
                </div>
                {errs.moodScore ? (
                  <p className="field-error-text">{errs.moodScore}</p>
                ) : null}
              </div>
            ) : null}

            {/* Timing fields for instant metrics */}
            {activeDraft.metricId !== "sleep" ? (
              <div className="form-grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="field-observedMissionDay">
                    Observed mission day
                  </label>
                  <input
                    id="field-observedMissionDay"
                    className="text-input"
                    inputMode="numeric"
                    value={activeDraft.observedMissionDay ?? ""}
                    aria-invalid={Boolean(errs.observedMissionDay)}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateDraft((d) => ({
                        ...d,
                        observedMissionDay:
                          e.target.value.trim() === ""
                            ? null
                            : Number.isInteger(val)
                              ? val
                              : null,
                      }));
                    }}
                  />
                  {errs.observedMissionDay ? (
                    <p className="field-error-text">{errs.observedMissionDay}</p>
                  ) : null}
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="field-observedTimeHHMM">
                    Observed time (24h HH:MM UTC)
                  </label>
                  <input
                    id="field-observedTimeHHMM"
                    className="text-input"
                    value={activeDraft.observedTimeHHMM ?? ""}
                    aria-invalid={Boolean(errs.observedTimeHHMM)}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        observedTimeHHMM: e.target.value,
                      }))
                    }
                    placeholder="07:18"
                  />
                  {errs.observedTimeHHMM ? (
                    <p className="field-error-text">{errs.observedTimeHHMM}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Method and context selectors */}
            <div className="form-grid-2">
              <div className="field-group">
                <label className="field-label" htmlFor="field-method">
                  Measurement method
                </label>
                <select
                  id="field-method"
                  className="select-input"
                  value={activeDraft.method}
                  onChange={(e) =>
                    updateDraft((d) => ({ ...d, method: e.target.value }))
                  }
                >
                  {def.methodOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="field-context">
                  Context
                </label>
                <select
                  id="field-context"
                  className="select-input"
                  value={activeDraft.context}
                  onChange={(e) =>
                    updateDraft((d) => ({ ...d, context: e.target.value }))
                  }
                >
                  {def.contextOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="field-note">
                Private note (excluded from default reports)
              </label>
              <textarea
                id="field-note"
                className="textarea-input"
                value={activeDraft.note}
                onChange={(e) =>
                  updateDraft((d) => ({ ...d, note: e.target.value }))
                }
                placeholder="Optional note retained locally on this device"
              />
            </div>

            <div className="row-wrap" style={{ justifyContent: "space-between", paddingTop: 4 }}>
              <div className="row-wrap">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void handleSaveDraftExplicit()}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleExportRecovery}
                >
                  Export draft recovery
                </button>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || retainingReview}
                onClick={() => void handleProceedToReview()}
              >
                Next: Review
              </button>
            </div>
          </section>

          <aside className="stack-md">
            <section className="panel-card stack-sm" aria-labelledby="record-guidance-heading">
              <h2 id="record-guidance-heading" className="panel-heading">
                Measurement scope
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-body)" }}>
                <strong>Draft stays local:</strong> Nothing enters your log or changes Overview numbers until you confirm <em>Add to log</em> on Review.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-supporting)" }}>
                {def.instructions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            <section className="panel-card stack-sm" aria-labelledby="fixtures-helper-heading">
              <h2 id="fixtures-helper-heading" className="panel-heading">
                Test fixtures
              </h2>
              <p className="page-subtitle" style={{ fontSize: 12 }}>
                Load isolated sample drafts for verification without touching your committed log.
              </p>
              <div className="stack-sm">
                <button
                  type="button"
                  className="btn-secondary btn-full"
                  onClick={() => void handleLoadFixtureDraft(SIM_01_OPTIONAL_BP_DRAFT)}
                >
                  Load Day 42 07:18 BP draft (118/76)
                </button>
                {MF_FIXTURES.map((fx) => (
                  <button
                    key={fx.fixtureId}
                    type="button"
                    className="btn-ghost btn-full"
                    style={{ justifyContent: "flex-start", fontSize: 13 }}
                    onClick={() => void handleLoadFixtureDraft(fx.draft)}
                  >
                    {fx.fixtureId}: {fx.description}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : (
        /* Neutral Review Step — explicit confirmation before SQLite commit */
        <section className="panel-card stack-md" aria-labelledby="review-heading">
          <div className="row-wrap" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 id="review-heading" className="panel-heading">
                Review before adding to your log
              </h2>
              <p className="page-subtitle" style={{ fontSize: 13 }}>
                Nothing has been written to the committed log yet. Verify values, units, and timing below.
              </p>
            </div>
            <span className="badge-neutral">Pending confirmation</span>
          </div>

          {commitErrorKind === "rollback" && commitErrorMsg ? (
            <div className="notice-banner notice-banner-danger" role="alert">
              <div>
                <strong>Log addition did not finish.</strong> {commitErrorMsg}
              </div>
            </div>
          ) : null}

          {commitErrorKind === "unknown_outcome" && commitErrorMsg ? (
            <div className="notice-banner notice-banner-review" role="alert">
              <div>
                <strong>Addition unconfirmed</strong> — {commitErrorMsg} Check stored records before adding again so you do not create a duplicate.
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void handleCheckLogStatus()}
              >
                Check the log
              </button>
            </div>
          ) : null}

          {commitErrorKind === "unconfirmed" && commitErrorMsg ? (
            <div className="notice-banner notice-banner-danger" role="alert">
              <div>
                <strong>Addition unconfirmed.</strong> {commitErrorMsg}
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void handleCheckLogStatus()}
              >
                Retry checking log
              </button>
            </div>
          ) : null}

          <dl className="dl-rows">
            <div className="dl-row">
              <dt>Measurement</dt>
              <dd>{def.name}</dd>
            </div>

            <div className="dl-row">
              <dt>Entered value</dt>
              <dd className="tabular-value">
                {activeDraft.metricId === "blood_pressure"
                  ? `${activeDraft.rawFields.primary}/${activeDraft.rawFields.secondary} mmHg`
                  : activeDraft.metricId === "sleep"
                    ? (activeDraft.rawFields.hours?.trim() || "0") === "0" &&
                      (activeDraft.rawFields.minutes?.trim() || "0") === "0"
                      ? "Reported no sleep (0h 0m)"
                      : `${activeDraft.rawFields.hours || "0"}h ${(activeDraft.rawFields.minutes || "0").padStart(2, "0")}m`
                    : activeDraft.metricId === "mood" && activeDraft.rawFields.moodScore
                      ? `${activeDraft.rawFields.moodScore} / 5 (${
                          MOOD_SCALE_SPEC.choices.find((c) => c.score === activeDraft.rawFields.moodScore)?.label ?? ""
                        })`
                      : `${activeDraft.rawFields.primary} ${
                          activeDraft.selectedUnit === "C"
                            ? "°C"
                            : activeDraft.selectedUnit === "F"
                              ? "°F"
                              : activeDraft.selectedUnit
                        }`}
              </dd>
            </div>

            {equivalentReviewLabel ? (
              <div className="dl-row">
                <dt>Normalized review</dt>
                <dd className="tabular-value">{equivalentReviewLabel}</dd>
              </div>
            ) : null}

            <div className="dl-row">
              <dt>Observed timing</dt>
              <dd>
                {activeDraft.metricId === "sleep"
                  ? `${SLEEP_TYPE_LABELS[activeDraft.rawFields.sleepType ?? "main_sleep"]} ending Day ${activeDraft.rawFields.endingMissionDay}`
                  : `Day ${activeDraft.observedMissionDay} · ${activeDraft.observedTimeHHMM} UTC`}
              </dd>
            </div>

            <div className="dl-row">
              <dt>Method & context</dt>
              <dd>
                {activeDraft.method} · {activeDraft.context}
              </dd>
            </div>

            <div className="dl-row">
              <dt>Reference status</dt>
              <dd>
                {reviewComparison?.comparisonAvailable
                  ? reviewComparison.differenceText ?? "Compatible reference active"
                  : reviewComparison?.unavailableReason ?? "Comparison unavailable"}
              </dd>
            </div>

            {activeDraft.note.trim() ? (
              <div className="dl-row">
                <dt>Private note</dt>
                <dd>{activeDraft.note.trim()}</dd>
              </div>
            ) : null}
          </dl>

          {reviewPreview.warning && (
            <div id="entry-warning" className="notice-banner notice-banner-review" role="status">
              <div>
                <strong>Confirm unusual value</strong>
                <p>{reviewPreview.warning} {ENTRY_WARNING_HELP}</p>
              </div>
            </div>
          )}
          <div className="field-group">
            <label className="row-wrap">
              <input
                type="checkbox"
                checked={activeDraft.quality === "questionable"}
                disabled={busy || retainingReview || commitErrorKind === "unknown_outcome" || commitErrorKind === "unconfirmed"}
                aria-describedby="recheck-help"
                onChange={async (event) => {
                  const next: CheckInDraft = {
                    ...activeDraft,
                    quality: event.target.checked ? "questionable" : "valid",
                    updatedAtUtc: new Date().toISOString(),
                  };
                  setRetainingReview(true);
                  try {
                    await saveDraftToStore(next, { edit: true });
                  } finally {
                    setRetainingReview(false);
                  }
                }}
              />
              {NEEDS_RECHECK_LABEL}
            </label>
            <p id="recheck-help" className="page-subtitle">{NEEDS_RECHECK_HELP}</p>
            <div><button type="button" className="btn-ghost" onClick={() =>
              openModal({ kind: "measurement_help", metricId: activeDraft.metricId })
            }>Measurement help</button></div>
          </div>

          <div className="row-wrap" style={{ justifyContent: "space-between", paddingTop: 6 }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || retainingReview}
              onClick={() => updateDraft((d) => ({ ...d, stage: "record" }))}
            >
              Edit details
            </button>

            <button
              type="button"
              className="btn-primary"
              disabled={busy || retainingReview || commitErrorKind === "unknown_outcome" || commitErrorKind === "unconfirmed"}
              aria-describedby={reviewPreview.warning ? "entry-warning" : undefined}
              onClick={() => void handleCommitToLog(Boolean(reviewPreview.warning))}
            >
              {busy ? "Adding…" : reviewPreview.warning ? "Confirm and add to log" : "Add to log"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
