import { useEffect, useMemo, useState } from "react";
import {
  buildBackupBundle,
  buildCsvCommitPlan,
  buildReportBundle,
  computeMissionDay,
  CSV_REVIEW_FIXTURE_CSV,
  describeReportFormats,
  DEFAULT_REPORT_METRICS,
  formatObservationDisplay,
  generateCsvTemplate,
  getObservedMissionDay,
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  parseAndReconcileCsv,
  ENTRY_WARNING_HELP,
  validateBackupImport,
  validateDraftRecoveryImport,
  type BackupValidationResult,
  type CsvConflictChoice,
  type CsvPossibleDuplicateChoice,
  type CsvReconciliationPreview,
  type MetricId,
  type ProfileConfig,
} from "../shared/src";
import {
  desktopBridge,
  type ConflictReplacementPayload,
} from "../bridge/desktopBridge";
import {
  backupHistoryFrom,
  buildRestoreRequest,
  restoreBlockReason,
} from "../state/backupRestore";
import { PrintReportSheet } from "../components/PrintReportSheet";
import { useTabList } from "../components/useTabList";
import { useApp } from "../state/AppContext";
import { normalizeAppPreferences } from "../state/preferences";
import { exportDraftRecoveryFile, isUnretainedDraft } from "../state/draftRecoveryExport";
import type { CheckInDraft } from "../shared/src";

type ReportTab = "report" | "backup" | "csv";

export function ReportsRoute() {
  const {
    snapshot,
    activeProfile,
    preferences,
    currentReferenceNowUtc,
    refreshSnapshot,
    activeDraft,
    setActiveDraft,
    draftRetentionFailed,
    setDraftRetentionFailed,
    navigate,
    readingReportScope,
    showToast,
  } = useApp();

  // ER-04: a draft that local storage could not keep is the only copy. A restore
  // that changes profiles keeps it in memory with its own profile; this notice
  // says so before the restore and offers the recovery export.
  const unretainedDraft = isUnretainedDraft(activeDraft, draftRetentionFailed) ? activeDraft : null;

  const handleExportDraft = async (draft: CheckInDraft | null) => {
    if (!draft || !activeProfile) return;
    const res = await exportDraftRecoveryFile(draft, activeProfile.label);
    if (res.status === "saved") {
      showToast({ tone: "success", title: "File saved", detail: res.path ?? undefined });
    } else if (res.status !== "cancelled") {
      showToast({
        tone: "danger",
        title: res.status === "permission_refused" ? "File access wasn't granted" : "Couldn't export",
        detail: res.message ?? "Your draft stays in memory on this device.",
      });
    }
  };

  const [tab, setTab] = useState<ReportTab>("report");
  const sectionTabs = useTabList({
    ids: ["report", "backup", "csv"] as const,
    selected: tab,
    onSelect: setTab,
    idPrefix: "reports-section",
  });

  const currentMissionDay = activeProfile
    ? Math.max(1, computeMissionDay(currentReferenceNowUtc, activeProfile.missionEpochUtc))
    : 42;

  const readingScope = readingReportScope?.profileId === activeProfile?.profileId ? readingReportScope : undefined;
  const [startDay, setStartDay] = useState(() => readingScope?.startDay ?? Math.max(1, currentMissionDay - 6));
  const [endDay, setEndDay] = useState(() => readingScope?.endDay ?? currentMissionDay);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricId[]>([...(readingScope?.metricIds ?? DEFAULT_REPORT_METRICS)]);
  const [includeMood, setIncludeMood] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);

  // Sync default day window cleanly when switching active profile
  useEffect(() => {
    setStartDay(readingScope?.startDay ?? Math.max(1, currentMissionDay - 6));
    setEndDay(readingScope?.endDay ?? currentMissionDay);
  }, [activeProfile?.profileId, currentMissionDay, readingScope]);

  // Backup export & restore state
  const [confirmFullBackup, setConfirmFullBackup] = useState(false);
  const [backupPreview, setBackupPreview] = useState<BackupValidationResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<"separate_profile" | "replace_profile">(
    "separate_profile",
  );
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // CSV staged reconciliation state
  const [csvPreview, setCsvPreview] = useState<CsvReconciliationPreview | null>(null);
  const [csvBatchId, setCsvBatchId] = useState<string>("");
  const [conflictChoices, setConflictChoices] = useState<Record<string, CsvConflictChoice>>({});
  const [possibleDupChoices, setPossibleDupChoices] = useState<
    Record<string, CsvPossibleDuplicateChoice>
  >({});
  const [ackExclusions, setAckExclusions] = useState(false);
  const [confirmCsvValues, setConfirmCsvValues] = useState(false);
  const [busy, setBusy] = useState(false);

  const reportBundle = useMemo(() => {
    if (!snapshot || !activeProfile) return null;
    const requested = includeMood && !readingScope
      ? [...new Set<MetricId>([...selectedMetrics, "mood"])]
      : selectedMetrics.filter((m) => m !== "mood");
    return buildReportBundle({
      profile: activeProfile,
      observations: snapshot.profileData.observations,
      references: snapshot.profileData.references,
      selectedObservationIds: readingScope?.observationIds,
      startDay: Math.max(1, Math.min(startDay, endDay)),
      endDay: Math.max(1, Math.max(startDay, endDay)),
      selectedMetricIds: requested,
      includeMood: includeMood && !readingScope,
      includeNotes,
      generatedAtUtc: currentReferenceNowUtc,
    });
  }, [
    snapshot,
    activeProfile,
    readingScope,
    includeMood,
    includeNotes,
    selectedMetrics,
    startDay,
    endDay,
    currentReferenceNowUtc,
  ]);

  if (!snapshot || !activeProfile || !reportBundle) {
    return (
      <div className="panel-card">
        <p style={{ margin: 0 }}>Loading reports workspace…</p>
      </div>
    );
  }

  const toggleMetric = (mId: MetricId) => {
    if (mId === "mood") {
      setIncludeMood((prev) => !prev);
      return;
    }
    setSelectedMetrics((prev) =>
      prev.includes(mId) ? prev.filter((x) => x !== mId) : [...prev, mId],
    );
  };

  const handleSaveOutcomeToast = (res: {
    status: "saved" | "cancelled" | "permission_refused" | "error";
    path: string | null;
    message: string | null;
  }) => {
    if (res.status === "saved") {
      showToast({
        tone: "success",
        title: "File saved",
        detail: res.path ?? "Export written to disk.",
      });
    } else if (res.status === "cancelled") {
      showToast({
        tone: "neutral",
        title: "Export cancelled",
        detail: "Preview and data stayed intact.",
      });
    } else if (res.status === "permission_refused") {
      showToast({
        tone: "danger",
        title: "File access wasn't granted",
        detail: res.message ?? "Choose another writable folder.",
      });
    } else {
      showToast({
        tone: "danger",
        title: "Couldn't export",
        detail: res.message ?? "Write failed without losing your report preview.",
      });
    }
  };

  const handleExportReportJson = async () => {
    const res = await desktopBridge.saveExportFile({
      defaultFileName: `crewsignal-report-d${reportBundle.missionDayRange.startDay}-d${reportBundle.missionDayRange.endDay}.json`,
      filterName: "JSON files",
      extensions: ["json"],
      content: JSON.stringify(reportBundle, null, 2),
    });
    handleSaveOutcomeToast(res);
  };

  const handleExportBackupJson = async () => {
    if (!confirmFullBackup) return;
    let bundle: ReturnType<typeof buildBackupBundle>;
    try {
      bundle = buildBackupBundle({
        confirmedIncludeAllProfileData: true,
        exportedAtUtc: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        profile: activeProfile,
        preferences: normalizeAppPreferences(preferences, activeProfile.profileId),
        observations: snapshot.profileData.observations,
        checkInEvents: snapshot.profileData.checkinEvents,
        references: snapshot.profileData.references,
        insights: [],
        history: backupHistoryFrom(snapshot.profileData),
      });
    } catch {
      // Nothing was written: no file dialog opens and the preview stays as it was.
      showToast({
        tone: "danger",
        title: "Couldn't create backup",
        detail:
          "The backup didn't pass its own check, so no file was written. Your records and this preview are unchanged.",
      });
      return;
    }
    const res = await desktopBridge.saveExportFile({
      defaultFileName: `crewsignal-backup-${activeProfile.profileId}.json`,
      filterName: "JSON files",
      extensions: ["json"],
      content: JSON.stringify(bundle, null, 2),
    });
    handleSaveOutcomeToast(res);
  };

  const handleOpenBackupFile = async () => {
    const fileRes = await desktopBridge.openImportFile({
      filterName: "JSON backup or recovery files",
      extensions: ["json"],
    });
    if (fileRes.status !== "loaded" || fileRes.content === null) {
      if (fileRes.status === "permission_refused" || fileRes.status === "error") {
        showToast({
          tone: "danger",
          title:
            fileRes.status === "permission_refused"
              ? "File access wasn't granted"
              : "Couldn't read file",
          detail: fileRes.message ?? undefined,
        });
      }
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(fileRes.content);
    } catch {
      showToast({
        tone: "danger",
        title: "Invalid JSON file",
        detail: "The selected file could not be parsed as JSON.",
      });
      return;
    }

    // Check if user opened a DraftRecoveryBundle instead of full backup
    if (
      typeof parsedJson === "object" &&
      parsedJson !== null &&
      "kind" in parsedJson &&
      (parsedJson as { kind?: string }).kind === "crewsignal-draft-recovery"
    ) {
      const draftCheck = validateDraftRecoveryImport(parsedJson, {
        existingObservations: snapshot.profileData.observations,
        rejectPersonalInPublicDemo: activeProfile.mode === "demo",
      });
      if (!draftCheck.valid || !draftCheck.bundle) {
        showToast({
          tone: "danger",
          title: "Draft recovery rejected",
          detail: draftCheck.error ?? "Invalid draft recovery file.",
        });
        return;
      }
      if (draftCheck.status === "already_in_log") {
        showToast({
          tone: "neutral",
          title: "Already in your log",
          detail: "This draft's observation was already committed; no duplicate created.",
        });
        return;
      }
      const resumedDraft = {
        ...draftCheck.bundle.draft,
        profileId: activeProfile.profileId,
      };
      await desktopBridge.saveDraft(activeProfile.profileId, resumedDraft);
      setActiveDraft(resumedDraft);
      setDraftRetentionFailed(false);
      await refreshSnapshot(activeProfile.profileId);
      navigate("check_in");
      showToast({
        tone: "success",
        title: "Draft recovered into Review/Record",
        detail: "Nothing was silently committed to your log.",
      });
      return;
    }

    const validation = validateBackupImport(parsedJson, {
      rejectPersonalInPublicDemo: false,
    });
    setBackupPreview(validation);
    setRestoreMode("separate_profile");
    setConfirmReplace(false);
    setRestoreError(null);
  };

  const restoreBlocked =
    backupPreview?.valid && backupPreview.bundle
      ? restoreBlockReason({
          bundle: backupPreview.bundle,
          mode: restoreMode,
          activeProfile,
          confirmReplace,
        })
      : null;

  // Replacing the active profile deletes its stored drafts in the same
  // transaction, so any open draft for it (retained or not) goes too.
  const replaceDraft =
    restoreMode === "replace_profile" &&
    activeProfile &&
    activeDraft &&
    activeDraft.commitStatus !== "committed" &&
    activeDraft.profileId === activeProfile.profileId
      ? activeDraft
      : null;

  const handleExecuteRestore = async () => {
    if (!backupPreview?.valid || !backupPreview.bundle || restoreBlocked) return;
    setBusy(true);
    setRestoreError(null);
    try {
      const { request, target } = buildRestoreRequest({
        bundle: backupPreview.bundle,
        mode: restoreMode,
        activeProfile,
        nowIso: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
        uniqueSuffix: String(Date.now()),
      });
      const leavingUnretained = unretainedDraft
        ? { profileId: unretainedDraft.profileId, label: activeProfile.label }
        : null;
      const replacedDraft = replaceDraft;
      // Nothing about the open draft changes until the restore succeeds: a
      // rolled-back restore leaves the stored draft and its status as they were.
      const res = await desktopBridge.restoreBackup(request);
      const replacedActive = res.restoredProfile.id === activeProfile.profileId;

      setBackupPreview(null);
      // After a replace, the draft shown is whatever SQLite now holds for the
      // profile (the backup's, or none); the old draft went with the old rows.
      await refreshSnapshot(res.restoredProfile.id, { reconcileDraft: replacedActive });
      const keptNote = replacedActive
        ? replacedDraft
          ? " The open draft was removed with the replaced profile data."
          : ""
        : leavingUnretained
          ? ` Your unsaved ${leavingUnretained.label} draft is kept in memory with that profile until you close CrewSignal.`
          : "";
      showToast({
        tone: "success",
        title: res.replacedExisting ? "Profile replaced from backup" : "Restored into separate profile",
        detail: `${res.observationCount} observations restored atomically into ${target.label}.${keptNote}`,
      });
    } catch (err) {
      // The native restore runs in one transaction: on failure nothing was written.
      const detail =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      setRestoreError(detail);
      showToast({
        tone: "danger",
        title: "Restore didn't complete",
        detail: "Your existing records were left unchanged.",
      });
    } finally {
      setBusy(false);
    }
  };

  const stageCsvText = (csvText: string) => {
    const batchId = `csv-${Date.now()}`;
    const preview = parseAndReconcileCsv({
      csvText,
      existingObservations: snapshot.profileData.observations,
      profileId: activeProfile.profileId,
      missionEpochUtc: activeProfile.missionEpochUtc,
      importBatchId: batchId,
      nowUtc: currentReferenceNowUtc,
    });
    setCsvBatchId(batchId);
    setCsvPreview(preview);
    setConflictChoices({});
    setPossibleDupChoices({});
    setAckExclusions(false);
    setConfirmCsvValues(false);
  };

  const handleOpenCsvFile = async () => {
    const fileRes = await desktopBridge.openImportFile({
      filterName: "CSV files",
      extensions: ["csv", "txt"],
    });
    if (fileRes.status === "loaded" && fileRes.content !== null) {
      stageCsvText(fileRes.content);
    } else if (fileRes.status === "permission_refused" || fileRes.status === "error") {
      showToast({
        tone: "danger",
        title:
          fileRes.status === "permission_refused"
            ? "File access wasn't granted"
            : "Couldn't read CSV",
        detail: fileRes.message ?? undefined,
      });
    }
  };

  const handleDownloadCsvTemplate = async () => {
    const res = await desktopBridge.saveExportFile({
      defaultFileName: "crewsignal-import-template.csv",
      filterName: "CSV files",
      extensions: ["csv"],
      content: generateCsvTemplate(),
    });
    handleSaveOutcomeToast(res);
  };

  const handleCommitCsv = async () => {
    if (!csvPreview) return;
    const plan = buildCsvCommitPlan({
      preview: csvPreview,
      existingObservations: snapshot.profileData.observations,
      conflictChoices,
      possibleDuplicateChoices: possibleDupChoices,
      acknowledgedExclusions: ackExclusions,
      confirmedUnusualValues: confirmCsvValues,
      nowUtc: currentReferenceNowUtc,
    });

    if (!plan.ready || !plan.nextObservations) {
      showToast({
        tone: "review",
        title: "Resolve staged CSV rows first",
        detail: plan.error ?? undefined,
      });
      return;
    }

    setBusy(true);
    try {
      const existingById = new Map(
        snapshot.profileData.observations.map((o) => [o.observationId, o]),
      );
      const newObservations = plan.nextObservations.filter(
        (o) => !existingById.has(o.observationId),
      );
      const conflictReplacements: ConflictReplacementPayload[] = plan.nextObservations
        .filter((o) => {
          const prev = existingById.get(o.observationId);
          return prev && prev.correctionHistory.length < o.correctionHistory.length;
        })
        .map((o) => {
          const prev = existingById.get(o.observationId)!;
          return {
            observationId: o.observationId,
            previousPayload: prev,
            newPayload: o,
            reason: "CSV import conflict resolved using imported whole entry",
            correctedAt: currentReferenceNowUtc,
          };
        });

      const res = await desktopBridge.commitCsvBatch({
        profileId: activeProfile.profileId,
        batchId: csvBatchId,
        newObservations,
        conflictReplacements,
        summary: {
          inserted: plan.insertedCount,
          updated: plan.updatedCount,
          skipped: plan.skippedCount,
        },
      });

      await refreshSnapshot(activeProfile.profileId);
      setCsvPreview(null);
      showToast({
        tone: "success",
        title: "CSV import applied atomically",
        detail: `${res.insertedCount} inserted · ${res.replacedCount} conflict entry updated with correction history.`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="stack-lg no-print">
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports & Data Portability</h1>
            <p className="page-subtitle">
              Filtered JSON/PDF handoffs exclude mood and notes by default; full backups and staged CSV imports run atomically.
            </p>
          </div>
          <div className="segmented-group" role="tablist" aria-label="Reports sections">
            <button type="button" className="segmented-btn" {...sectionTabs.getTabProps("report")}>
              Report & Print
            </button>
            <button type="button" className="segmented-btn" {...sectionTabs.getTabProps("backup")}>
              Backup & Restore
            </button>
            <button type="button" className="segmented-btn" {...sectionTabs.getTabProps("csv")}>
              CSV Import
            </button>
          </div>
        </div>

        <div {...sectionTabs.panelProps} style={{ display: "contents" }}>
        {tab === "report" ? (
          <div className="split-layout">
            <section className="panel-card stack-md" aria-labelledby="report-preview-heading">
              <div className="row-wrap" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2 id="report-preview-heading" className="panel-heading">
                    Filtered report preview
                  </h2>
                  <p style={{ margin: "4px 0 0", color: "var(--text-supporting)", fontSize: 13 }}>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {reportBundle.totalObservations} observations across {reportBundle.includedTypesCount} types
                    </strong>{" "}
                    (Days {reportBundle.missionDayRange.startDay}–{reportBundle.missionDayRange.endDay})
                  </p>
                </div>
                <div className="row-wrap">
                  <button type="button" className="btn-secondary" onClick={handleExportReportJson}>
                    Export Report JSON
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => window.print()}
                  >
                    Print / Save PDF (Light A4)
                  </button>
                  <ul>{describeReportFormats(reportBundle, { csv: false, printIncludesMetadata: true }).map((line) => <li key={line}>{line}</li>)}</ul>
                </div>
              </div>

              <div className="notice-banner" style={{ padding: "10px 14px" }}>
                <div>
                  <strong>Privacy boundary:</strong>{" "}
                  {reportBundle.excludedMetricIds.length > 0
                    ? `Excluded types (${reportBundle.excludedMetricIds
                        .map((id) => METRIC_DEFINITIONS[id].shortLabel)
                        .join(", ")}) and their source citations are omitted.`
                    : "All metric types selected."}{" "}
                  Private notes are {includeNotes ? "INCLUDED" : "EXCLUDED"}. Not a medical clearance.
                </div>
              </div>

              <div
                className="data-table-wrap"
                role="region"
                aria-label="Report preview observations table"
                tabIndex={0}
              >
                {reportBundle.observations.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--text-supporting)" }}>
                    No observations match the selected day window and metrics.
                  </p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Measurement</th>
                        <th>Value</th>
                        <th>Method & context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportBundle.observations.map((obs) => {
                        const disp = formatObservationDisplay(obs, preferences.displayUnits);
                        return (
                          <tr key={obs.observationId}>
                            <td className="tabular-value">Day {getObservedMissionDay(obs)}</td>
                            <td>{METRIC_DEFINITIONS[obs.metricId].shortLabel}</td>
                            <td className="tabular-value" style={{ fontWeight: 590 }}>
                              {disp.primaryText}
                            </td>
                            <td>
                              {obs.method} · {obs.context}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <aside className="panel-card stack-md" aria-labelledby="report-filters-heading">
              <h2 id="report-filters-heading" className="panel-heading">
                Report scope
              </h2>

              {readingScope && (
                <div className="stack-sm">
                  <p>This draft contains the selected readings from Overview.</p>
                  <button type="button" className="btn-secondary" onClick={() => navigate("reports")}>
                    Start a general report
                  </button>
                </div>
              )}

              <div className="form-grid-2">
                <div className="field-group">
                  <label className="field-label" htmlFor="rep-start-day">
                    Start day
                  </label>
                  <input
                    id="rep-start-day"
                    type="number"
                    min={1}
                    className="text-input"
                    value={startDay}
                    onChange={(e) => setStartDay(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="rep-end-day">
                    End day
                  </label>
                  <input
                    id="rep-end-day"
                    type="number"
                    min={1}
                    className="text-input"
                    value={endDay}
                    onChange={(e) => setEndDay(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </div>

              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="field-label" style={{ marginBottom: 8 }}>
                  Included measurements
                </legend>
                <div className="stack-sm">
                  {METRIC_ORDER.map((mId) => {
                    const checked =
                      mId === "mood" ? includeMood : selectedMetrics.includes(mId);
                    return (
                      <label key={mId} className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={Boolean(readingScope && !readingScope.metricIds.includes(mId))}
                          onChange={() => toggleMetric(mId)}
                        />
                        <span>
                          {METRIC_DEFINITIONS[mId].name}
                          {mId === "mood" ? " (excluded by default)" : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <hr className="divider" />

              <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
                <span>Include private notes (unchecked by default)</span>
              </label>
            </aside>
          </div>
        ) : null}

        {tab === "backup" ? (
          <div className="overview-grid">
            <section className="panel-card stack-md" aria-labelledby="backup-export-heading">
              <div>
                <h2 id="backup-export-heading" className="panel-heading">
                  Full local backup (includes mood & notes)
                </h2>
                <p className="page-subtitle" style={{ fontSize: 13 }}>
                  Exports every observation, mood score, private note, check-in event, personal reference version, and setting for {activeProfile.label}.
                </p>
              </div>

              <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={confirmFullBackup}
                  onChange={(e) => setConfirmFullBackup(e.target.checked)}
                />
                <span>Include all profile data (mood entries and private notes)</span>
              </label>

              <button
                type="button"
                className="btn-primary"
                disabled={!confirmFullBackup}
                onClick={handleExportBackupJson}
              >
                Export full backup JSON
              </button>
            </section>

            <section className="panel-card stack-md" aria-labelledby="backup-restore-heading">
              <div>
                <h2 id="backup-restore-heading" className="panel-heading">
                  Restore backup or resume draft recovery
                </h2>
                <p className="page-subtitle" style={{ fontSize: 13 }}>
                  Validates JSON schema strictly. Defaults to non-destructive restoration into a separate Personal profile.
                </p>
              </div>

              <button type="button" className="btn-secondary" onClick={handleOpenBackupFile}>
                Choose Backup or Draft Recovery JSON
              </button>

              {backupPreview ? (
                backupPreview.valid && backupPreview.bundle ? (
                  <div className="stack-md" style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: 12 }}>
                    <div className="notice-banner notice-banner-success" style={{ padding: "10px 12px" }}>
                      <div>
                        <strong>
                          Valid {backupPreview.bundle.profile.mode === "demo" ? "Demo" : "Personal"} backup (
                          {backupPreview.bundle.profile.label}):
                        </strong>{" "}
                        {backupPreview.bundle.summaryCounts.observationCount} observations ·{" "}
                        {backupPreview.bundle.summaryCounts.referenceCount} references ·{" "}
                        {backupPreview.bundle.summaryCounts.eventCount} events
                      </div>
                    </div>

                    <div className="choice-list" role="radiogroup" aria-label="Restore destination">
                      <label className="choice-label">
                        <input
                          type="radio"
                          name="restoreDest"
                          checked={restoreMode === "separate_profile"}
                          onChange={() => setRestoreMode("separate_profile")}
                        />
                        <span>Restore as separate profile (Recommended — preserves active profile)</span>
                      </label>
                      <label className="choice-label">
                        <input
                          type="radio"
                          name="restoreDest"
                          disabled={
                            activeProfile.mode === "demo" ||
                            backupPreview.bundle.profile.mode !== activeProfile.mode
                          }
                          checked={restoreMode === "replace_profile"}
                          onChange={() => setRestoreMode("replace_profile")}
                        />
                        <span>
                          Replace current personal profile
                          {activeProfile.mode === "demo"
                            ? " (disabled while viewing public SIM-01 demo)"
                            : backupPreview.bundle.profile.mode !== activeProfile.mode
                              ? " (disabled: backup is from a different mode)"
                              : ""}
                        </span>
                      </label>
                    </div>

                    {restoreMode === "replace_profile" ? (
                      <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={confirmReplace}
                          onChange={(e) => setConfirmReplace(e.target.checked)}
                        />
                        <span>
                          Confirm overwriting {activeProfile.label} atomically
                          {replaceDraft ? ", including its open draft" : ""}
                        </span>
                      </label>
                    ) : null}

                    {restoreBlocked && restoreMode === "replace_profile" && confirmReplace ? (
                      <p role="status" style={{ margin: 0, fontSize: 14 }}>
                        {restoreBlocked}
                      </p>
                    ) : null}

                    {restoreError ? (
                      <div className="notice-banner notice-banner-danger" role="alert">
                        <div className="stack-sm">
                          <strong>Restore didn't complete. Your existing records were left unchanged.</strong>
                          <span>{restoreError}</span>
                          <span>
                            You can try again, restore as a separate profile, or export a backup of the
                            current profile first.
                          </span>
                          {restoreMode === "replace_profile" ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setRestoreMode("separate_profile");
                                setRestoreError(null);
                              }}
                            >
                              Restore as separate profile instead
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {replaceDraft ? (
                      <div className="notice-banner notice-banner-review" role="status" data-testid="restore-replace-draft">
                        <div className="stack-sm">
                          <strong>Replacing {activeProfile.label} removes its open draft.</strong>
                          <span>
                            {isUnretainedDraft(replaceDraft, draftRetentionFailed)
                              ? "This draft is only on this screen. "
                              : "The copy saved on this device is deleted with the old profile data. "}
                            After the restore you will see the backup&apos;s records instead. Export a draft
                            recovery file first to keep a copy.
                          </span>
                          <div className="row-wrap">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void handleExportDraft(replaceDraft)}
                            >
                              Export draft recovery
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => navigate("check_in")}>
                              Back to check-in
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {unretainedDraft && restoreMode === "separate_profile" ? (
                      <div className="notice-banner notice-banner-review" role="status" data-testid="restore-unretained-draft">
                        <div className="stack-sm">
                          <strong>Your {activeProfile.label} draft is only on this screen.</strong>
                          <span>
                            Local storage didn't keep it. Restoring keeps it in memory with{" "}
                            {activeProfile.label} until you close CrewSignal. Export a draft recovery file to
                            keep a copy.
                          </span>
                          <div className="row-wrap">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => void handleExportDraft(unretainedDraft)}
                            >
                              Export draft recovery
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => navigate("check_in")}>
                              Back to check-in
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="row-wrap">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy || restoreBlocked !== null}
                        onClick={() => void handleExecuteRestore()}
                      >
                        {restoreError ? "Try restore again" : "Restore profile atomically"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setBackupPreview(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="notice-banner notice-banner-danger" role="alert">
                    <div>
                      <strong>Restore rejected:</strong> {backupPreview.error}
                    </div>
                  </div>
                )
              ) : null}
            </section>
          </div>
        ) : null}

        {tab === "csv" ? (
          <section className="panel-card stack-md" aria-labelledby="csv-import-heading">
            <div className="row-wrap" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 id="csv-import-heading" className="panel-heading">
                  CSV staged reconciliation & import
                </h2>
                <p className="page-subtitle" style={{ fontSize: 13 }}>
                  Preview every row before writing: validates units, detects exact duplicates and whole-observation conflicts, and commits inside one SQLite transaction.
                </p>
              </div>
              <div className="row-wrap">
                <button type="button" className="btn-secondary" onClick={handleDownloadCsvTemplate}>
                  Download CSV template
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => stageCsvText(CSV_REVIEW_FIXTURE_CSV)}
                >
                  Load 5-row review fixture
                </button>
                <button type="button" className="btn-primary" onClick={handleOpenCsvFile}>
                  Open CSV file
                </button>
              </div>
            </div>

            {csvPreview ? (
              <div className="stack-md">
                {!csvPreview.validHeader ? (
                  <div className="notice-banner notice-banner-danger" role="alert">
                    <div>
                      <strong>Invalid CSV header:</strong> {csvPreview.headerError}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="notice-banner" role="status">
                      <div>
                        <strong>Staged preview ({csvPreview.counts.total} rows):</strong>{" "}
                        {csvPreview.summaryLine}
                      </div>
                    </div>

                    <div
                      className="data-table-wrap"
                      role="region"
                      aria-label="CSV staged preview rows table"
                      tabIndex={0}
                    >
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Observation ID</th>
                            <th>Metric</th>
                            <th>Classification</th>
                            <th>Resolution / Detail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.rows.map((row) => (
                            <tr key={`${row.rowIndex}-${row.observationId}`}>
                              <td className="tabular-value">{row.rowIndex}</td>
                              <td className="tabular-value">{row.observationId}</td>
                              <td>{row.metricId}</td>
                              <td>
                                <span
                                  className={
                                    row.classification === "valid"
                                      ? "badge-success"
                                      : row.classification === "rejected"
                                        ? "badge-danger"
                                        : "badge-review"
                                  }
                                >
                                  {row.classification.replace("_", " ")}
                                </span>
                              </td>
                              <td>
                                {row.classification === "conflict" ? (
                                  <div className="row-wrap" role="radiogroup" aria-label={`Conflict choice for ${row.observationId}`}>
                                    <label style={{ fontSize: 13 }}>
                                      <input
                                        type="radio"
                                        name={`conflict-${row.observationId}`}
                                        checked={conflictChoices[row.observationId] === "keep_current"}
                                        onChange={() =>
                                          setConflictChoices((p) => ({
                                            ...p,
                                            [row.observationId]: "keep_current",
                                          }))
                                        }
                                      />{" "}
                                      Keep current
                                    </label>
                                    <label style={{ fontSize: 13 }}>
                                      <input
                                        type="radio"
                                        name={`conflict-${row.observationId}`}
                                        checked={conflictChoices[row.observationId] === "use_imported"}
                                        onChange={() =>
                                          setConflictChoices((p) => ({
                                            ...p,
                                            [row.observationId]: "use_imported",
                                          }))
                                        }
                                      />{" "}
                                      Use imported whole entry
                                    </label>
                                  </div>
                                ) : row.classification === "possible_duplicate" ? (
                                  <div className="row-wrap" role="radiogroup" aria-label={`Duplicate choice for ${row.observationId}`}>
                                    <label style={{ fontSize: 13 }}>
                                      <input
                                        type="radio"
                                        name={`pdup-${row.observationId}`}
                                        checked={possibleDupChoices[row.observationId] === "keep_separate"}
                                        onChange={() =>
                                          setPossibleDupChoices((p) => ({
                                            ...p,
                                            [row.observationId]: "keep_separate",
                                          }))
                                        }
                                      />{" "}
                                      Keep separate
                                    </label>
                                    <label style={{ fontSize: 13 }}>
                                      <input
                                        type="radio"
                                        name={`pdup-${row.observationId}`}
                                        checked={possibleDupChoices[row.observationId] === "skip"}
                                        onChange={() =>
                                          setPossibleDupChoices((p) => ({
                                            ...p,
                                            [row.observationId]: "skip",
                                          }))
                                        }
                                      />{" "}
                                      Skip
                                    </label>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 13, color: "var(--text-supporting)" }}>
                                    {row.reason ?? "Ready to insert"}
                                  </span>
                                )}
                                {row.warning && row.candidate && (
                                  <p>{formatObservationDisplay(row.candidate, preferences.displayUnits).enteredText}. {row.warning}</p>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {csvPreview.rows.some((row) => row.warning && row.classification !== "duplicate") && (
                      <label className="row-wrap">
                        <input type="checkbox" checked={confirmCsvValues} onChange={(event) => setConfirmCsvValues(event.target.checked)} />
                        <span>Confirm unusual values in rows being imported. {ENTRY_WARNING_HELP}</span>
                      </label>
                    )}
                    <label className="row-wrap" style={{ fontSize: 14, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={ackExclusions}
                        onChange={(e) => setAckExclusions(e.target.checked)}
                      />
                      <span>Acknowledge excluded, duplicate, or skipped rows before committing import</span>
                    </label>

                    <div className="row-wrap">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => void handleCommitCsv()}
                      >
                        Commit CSV import batch
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setCsvPreview(null)}
                      >
                        Clear staged preview
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </section>
        ) : null}
        </div>
      </div>

      <PrintReportSheet report={reportBundle} displayUnits={preferences.displayUnits} />
    </>
  );
}
