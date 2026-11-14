import { useState } from "react";
import {
  computeMissionDay,
  createWorkflowEvent,
  EVIDENCE_REGISTRY,
  formatUtcTimeHHMM,
  METRIC_DEFINITIONS,
  MEASUREMENT_RESEARCH,
} from "../shared/src";
import { desktopBridge } from "../bridge/desktopBridge";
import { useApp } from "../state/AppContext";
import { exportDraftRecoveryFile } from "../state/draftRecoveryExport";
import { ModalDialog } from "./ModalDialog";

export function AppModals() {
  const {
    activeModal,
    closeModal,
    activeDraft,
    setActiveDraft,
    parkedMemoryDrafts,
    allProfiles,
    setDraftRetentionFailed,
    activeProfile,
    currentReferenceNowUtc,
    refreshSnapshot,
    showToast,
    navigate,
    openResearch,
    clearSessionCommittedIds,
    resetDemo,
    deletePersonalProfile,
  } = useApp();

  const [reasonText, setReasonText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!activeModal) return null;

  if (activeModal.kind === "measurement_help") {
    const def = METRIC_DEFINITIONS[activeModal.metricId];
    const evidenceItems = def.evidenceIds
      .map((id) => EVIDENCE_REGISTRY[id])
      .filter((e): e is NonNullable<typeof e> => Boolean(e));

    return (
      <ModalDialog
        title={`What is ${def.name.toLowerCase()}?`}
        subtitle={`${def.entryMode === "self_report" ? "Self-report" : "Manual observation"} · Unit: ${def.acceptedUnits.join(" or ")}`}
        onClose={closeModal}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                closeModal();
                navigate("sources");
              }}
            >
              View cached sources
            </button>
            <button type="button" className="btn-secondary" onClick={() => {
              closeModal();
              openResearch(MEASUREMENT_RESEARCH[def.id]);
            }}>
              View measurement research
            </button>
            <button type="button" className="btn-primary" onClick={closeModal}>
              Close
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-body)" }}>{def.purpose}</p>
        <div>
          <p className="mono-label" style={{ marginBottom: 6 }}>
            Recording notes
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-body)" }}>
            {def.instructions.map((line) => (
              <li key={line} style={{ marginBottom: 4 }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="notice-banner" style={{ padding: "10px 12px" }}>
          <div>
            <strong>Boundary:</strong> CrewSignal logs your observation and displays reference context; it does not diagnose illness or provide instrument calibration procedures.
          </div>
        </div>
        {evidenceItems.length > 0 ? (
          <div>
            <p className="mono-label" style={{ marginBottom: 4 }}>
              Referenced summaries (cached offline)
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-supporting)", fontSize: 13 }}>
              {evidenceItems.map((ev) => (
                <li key={ev.sourceId}>
                  {ev.shortTitle} ({ev.publisher})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </ModalDialog>
    );
  }

  if (activeModal.kind === "unit_change") {
    return (
      <ModalDialog
        title={activeModal.dialogTitle}
        onClose={closeModal}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal}>
              {activeModal.cancelLabel}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                activeModal.onConfirm();
                closeModal();
              }}
            >
              {activeModal.confirmLabel}
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-body)" }}>{activeModal.dialogBody}</p>
      </ModalDialog>
    );
  }

  if (activeModal.kind === "discard_draft") {
    return (
      <ModalDialog
        title="Discard unfinished draft?"
        onClose={closeModal}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Keep draft
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                activeModal.onConfirm();
                closeModal();
              }}
            >
              Discard draft
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-body)" }}>
          Committed observations in your log will not be affected. Discarding removes only this unfinished draft.
        </p>
      </ModalDialog>
    );
  }

  if (activeModal.kind === "skip_checkin") {
    const committedCount = activeModal.committedInSession;
    return (
      <ModalDialog
        title="Skip remaining check-in?"
        onClose={closeModal}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Continue check-in
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                if (!activeProfile) return;
                setBusy(true);
                try {
                  const missionDay = Math.max(
                    1,
                    computeMissionDay(currentReferenceNowUtc, activeProfile.missionEpochUtc),
                  );
                  const hhmm = formatUtcTimeHHMM(currentReferenceNowUtc);
                  const event = createWorkflowEvent({
                    eventId: `evt-skip-${Date.now()}`,
                    profileId: activeProfile.profileId,
                    eventType: "check_in_skipped",
                    metricId: activeDraft?.metricId ?? null,
                    reason: reasonText.trim() || null,
                    attemptedAtUtc: currentReferenceNowUtc,
                    attemptedMissionDay: missionDay,
                    attemptedTimeLabel: hhmm,
                    missionEpochUtc: activeProfile.missionEpochUtc,
                    keptDraftId: null,
                    committedCountInSession: committedCount,
                    recordedAtUtc: currentReferenceNowUtc,
                  });
                  await desktopBridge.commitCheckInEvent({
                    profileId: activeProfile.profileId,
                    event,
                    discardDraftId: activeDraft?.draftId ?? null,
                  });
                  setActiveDraft(null);
                  setDraftRetentionFailed(false);
                  clearSessionCommittedIds();
                  await refreshSnapshot(activeProfile.profileId);
                  closeModal();
                  navigate("overview");
                  showToast({
                    tone: "neutral",
                    title: "Check-in skipped",
                    detail:
                      committedCount > 0
                        ? `Session ended cleanly; ${committedCount} already saved reading(s) remain in your log.`
                        : "Skipped check-in logged; no observation was fabricated.",
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Skip check-in
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-body)" }}>
          {committedCount > 0
            ? `You have already saved ${committedCount} reading(s) in this session — they stay in your log.`
            : "Skipping records an event that this check-in was skipped without inventing missing readings."}
        </p>
        {activeDraft ? (
          <div className="notice-banner notice-banner-review" style={{ padding: "10px 12px" }}>
            <div>
              <strong>Unfinished draft will be closed:</strong>{" "}
              {METRIC_DEFINITIONS[activeDraft.metricId].name} draft is not yet added to your log.
            </div>
          </div>
        ) : null}
        <div className="field-group">
          <label className="field-label" htmlFor="skip-reason-input">
            Optional note (why skipped)
          </label>
          <input
            id="skip-reason-input"
            className="text-input"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="e.g., Crew schedule interruption"
          />
        </div>
      </ModalDialog>
    );
  }

  if (activeModal.kind === "unavailable_metric") {
    const def = METRIC_DEFINITIONS[activeModal.metricId];
    return (
      <ModalDialog
        title={`Mark ${def.name.toLowerCase()} unavailable`}
        subtitle="Logs a missing-instrument or skipped measurement event without recording 0."
        onClose={closeModal}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                if (!activeProfile) return;
                setBusy(true);
                try {
                  const missionDay = Math.max(
                    1,
                    computeMissionDay(currentReferenceNowUtc, activeProfile.missionEpochUtc),
                  );
                  const hhmm = formatUtcTimeHHMM(currentReferenceNowUtc);
                  const event = createWorkflowEvent({
                    eventId: `evt-unavail-${Date.now()}`,
                    profileId: activeProfile.profileId,
                    eventType: "measurement_unavailable",
                    metricId: activeModal.metricId,
                    reason: reasonText.trim() || "Instrument unavailable",
                    attemptedAtUtc: currentReferenceNowUtc,
                    attemptedMissionDay: missionDay,
                    attemptedTimeLabel: hhmm,
                    missionEpochUtc: activeProfile.missionEpochUtc,
                    keptDraftId: null,
                    committedCountInSession: 0,
                    recordedAtUtc: currentReferenceNowUtc,
                  });
                  await desktopBridge.commitCheckInEvent({
                    profileId: activeProfile.profileId,
                    event,
                    discardDraftId:
                      activeDraft?.metricId === activeModal.metricId ? activeDraft.draftId : null,
                  });
                  if (activeDraft?.metricId === activeModal.metricId) {
                    setActiveDraft(null);
                    setDraftRetentionFailed(false);
                  }
                  await refreshSnapshot(activeProfile.profileId);
                  closeModal();
                  showToast({
                    tone: "neutral",
                    title: "Measurement unavailable recorded",
                    detail: `${def.name} recorded as unavailable${reasonText.trim() ? `: ${reasonText.trim()}` : ""}.`,
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Record unavailable
            </button>
          </>
        }
      >
        <div className="field-group">
          <label className="field-label" htmlFor="unavail-reason">
            Reason (optional)
          </label>
          <input
            id="unavail-reason"
            className="text-input"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="e.g., Cuff battery dead"
          />
          <p className="field-helper-text">
            No numeric measurement will be inserted into trends or comparisons.
          </p>
        </div>
      </ModalDialog>
    );
  }

  if (activeModal.kind === "close_guard") {
    const guard = activeModal.guardState;
    return (
      <ModalDialog
        title="Save or export before closing?"
        subtitle={
          guard.hasUnretainedDraft
            ? "An unretained draft is only in memory on this screen."
            : "You have an unfinished check-in draft that has not been added to your log."
        }
        onClose={closeModal}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Stay in app
            </button>
            {activeDraft && activeProfile ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  const res = await exportDraftRecoveryFile(activeDraft, activeProfile.label);
                  if (res.status === "saved") {
                    showToast({
                      tone: "success",
                      title: "File saved",
                      detail: res.path ?? undefined,
                    });
                  }
                }}
              >
                Export draft recovery
              </button>
            ) : null}
            {Object.values(parkedMemoryDrafts).map((parked) => {
              const label =
                allProfiles.find((p) => p.profileId === parked.profileId)?.label ?? "another profile";
              return (
                <button
                  key={parked.draftId}
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    const res = await exportDraftRecoveryFile(parked, label);
                    if (res.status === "saved") {
                      showToast({ tone: "success", title: "File saved", detail: res.path ?? undefined });
                    }
                  }}
                >
                  Export {label} draft
                </button>
              );
            })}
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                await desktopBridge.confirmCloseApplication();
                closeModal();
              }}
            >
              Close anyway
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-body)" }}>
          {guard.hasUnretainedDraft
            ? "Local draft retention did not finish. Exporting a draft recovery file preserves your entered values before closing."
            : "Your draft stays saved locally for your next launch unless you discard it, or you can finish adding it to your log first."}
        </p>
      </ModalDialog>
    );
  }

  if (activeModal.kind === "reset_demo") {
    return (
      <ModalDialog
        title="Reset SIM-01 demo profile?"
        onClose={closeModal}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await resetDemo();
                  closeModal();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Reset demo
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-body)" }}>
          Restores SIM-01 (Crew member 01) back to its 11 initial synthetic observations, preflight references, and UTC epoch. Your Personal profiles remain untouched.
        </p>
      </ModalDialog>
    );
  }

  if (activeModal.kind === "delete_personal_profile") {
    const { profileId, alias } = activeModal;
    return (
      <ModalDialog
        title={`Delete personal profile "${alias}"?`}
        onClose={closeModal}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await deletePersonalProfile(profileId);
                  closeModal();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete personal profile
            </button>
          </>
        }
      >
        <p style={{ margin: 0, color: "var(--text-body)" }}>
          Permanently removes this personal profile and all of its local observations, drafts, events, and references from this device inside a single SQLite transaction. Export a Backup JSON first if you want a copy.
        </p>
      </ModalDialog>
    );
  }

  return null;
}
