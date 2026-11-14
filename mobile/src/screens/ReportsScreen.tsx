import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CSV_REVIEW_FIXTURE_CSV,
  describeReportFormats,
  DEFAULT_REPORT_METRICS,
  EXAMPLE_BACKUP_BUNDLE,
  EXAMPLE_DRAFT_RECOVERY_BUNDLE,
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  formatObservationDisplay,
  buildBackupBundle,
  buildDraftRecoveryBundle,
  buildReportBundle,
  computeBackupSummaryCounts,
  computeMissionDay,
  parseAndReconcileCsv,
  ENTRY_WARNING_HELP,
  serializeObservationsToCsv,
  type CsvConflictChoice,
  type CsvPossibleDuplicateChoice,
  type CheckInDraft,
  type CsvReconciliationPreview,
  type MetricId,
} from '../shared/src';
import {
  ActionButton,
  CalmBanner,
  EyebrowLabel,
  LabeledField,
  PanelCard,
  ScreenTitle,
  SelectableChip,
  StatusBadge,
} from '../components/AppPrimitives';
import { ConfirmDestructiveModal } from '../components/Modals';
import { buildA4ReportPrintHtml } from '../platform/files';
import { backupIdentityOf, draftSignatureOf } from '../state/backupIdentity';
import { useCrewSignal, type ActiveOperation } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';

/** Plain-language progress for the running operation, shown while it holds the lock. */
function operationProgressText(op: ActiveOperation): string {
  switch (op.phase) {
    case 'reading':
      return 'Reading the data from SQLite. Other backup, replace, reset and delete actions are paused until it finishes; you can keep using the app.';
    case 'writing':
      return 'Waiting for the file to be written. Other backup, replace, reset and delete actions are paused until it finishes; you can keep using the app.';
    case 'restoring':
      return 'Writing to SQLite. Other backup, replace, reset and delete actions are paused until it finishes; you can keep using the app.';
    case 'refreshing':
      return 'The change is saved. Reloading the stored data now.';
    default:
      return 'Other backup, replace, reset and delete actions are paused until it finishes; you can keep using the app.';
  }
}

export function ReportsScreen(): React.ReactElement {
  const { palette, fontSansMedium, fontSansRegular, fontMonoRegular } = useCrewTheme();
  const {
    activeProfile,
    preferences,
    snapshot,
    observations,
    references,
    insights,
    checkInEvents,
    io,
    nowUtc,
    commitCsvImport,
    restoreBackup,
    importDraftRecovery,
    recordBackupExportedNow,
    lastBackupCreatedAtUtc,
    navigateTo,
    announce,
    activeDraft,
    loadDraftsForProfile,
    activeOperation,
    saveSafetyBackup,
    safetyBackupOutcome,
    lastSavedSafetyBackup,
    clearSavedSafetyBackup,
    restoreOutcome,
    clearRestoreOutcome,
  } = useCrewSignal();

  const currentDay = activeProfile
    ? computeMissionDay(nowUtc(), activeProfile.missionEpochUtc)
    : 1;
  const [startDayText, setStartDayText] = useState(
    String(Math.max(1, currentDay - 6)),
  );
  const [endDayText, setEndDayText] = useState(String(currentDay));
  const [selectedMetrics, setSelectedMetrics] = useState<MetricId[]>([
    ...DEFAULT_REPORT_METRICS,
  ]);
  const [includeMood, setIncludeMood] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [confirmBackupAll, setConfirmBackupAll] = useState(false);

  const [fileStatusBanner, setFileStatusBanner] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // CSV staged import state
  const [csvPreview, setCsvPreview] = useState<CsvReconciliationPreview | null>(null);
  const [conflictChoices, setConflictChoices] = useState<Record<string, CsvConflictChoice>>({});
  const [possibleDupChoices, setPossibleDupChoices] = useState<
    Record<string, CsvPossibleDuplicateChoice>
  >({});
  const [ackExclusions, setAckExclusions] = useState(false);
  const [confirmCsvValues, setConfirmCsvValues] = useState(false);
  const [csvImportResultMsg, setCsvImportResultMsg] = useState<string | null>(null);

  // Backup restore state
  const [pendingBackupRaw, setPendingBackupRaw] = useState<unknown | null>(null);
  const [restoreDestination, setRestoreDestination] = useState<
    'separate_profile' | 'replace_existing'
  >('separate_profile');
  const [replaceTargetId, setReplaceTargetId] = useState<string>(activeProfile?.profileId ?? '');
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [restoreResultMsg, setRestoreResultMsg] = useState<string | null>(null);
  // Each loaded backup file has an identity derived from its contents, so a
  // preview or a safety backup of one file never stands in for another.
  const [backupIdentity, setBackupIdentity] = useState<string | null>(null);
  // Draft preview of the selected replacement target (active or not). It counts
  // only while its target and backup identity match the current selection.
  const [draftPreview, setDraftPreview] = useState<DraftPreview>({ status: 'idle' });
  const [previewRetryNonce, setPreviewRetryNonce] = useState(0);
  const previewRequestRef = useRef(0);
  // The previewed target the confirmation was opened for; the write is bound to it.
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  // Explicit consent, in the confirmation, to export all of the target's data.
  const [safetyConsent, setSafetyConsent] = useState(false);
  // A press that the app-level guard refused (something else is running). Not
  // stored by the provider because the running operation reports its own result.
  const [safetyRefusedMsg, setSafetyRefusedMsg] = useState<string | null>(null);
  // Whether the running operation, if any, blocks new actions. The provider's
  // lock is authoritative; this only drives disabled states.
  const opBusy = activeOperation !== null;
  const targetExists = snapshot?.profiles.some((p) => p.profileId === replaceTargetId) ?? false;

  // The screen sets its own status message only through this helper, so the
  // provider's persisted restore outcome and the local message are never both shown.
  const setLocalMessage = (message: string | null) => {
    clearRestoreOutcome();
    setRestoreResultMsg(message);
  };

  const parsedStartDay = Math.max(1, Number.parseInt(startDayText.trim() || '1', 10) || 1);
  const parsedEndDay = Math.max(
    parsedStartDay,
    Number.parseInt(endDayText.trim() || String(parsedStartDay), 10) || parsedStartDay,
  );

  const effectiveSelectedMetrics = useMemo(() => {
    const base = [...selectedMetrics];
    if (includeMood && !base.includes('mood')) {
      base.push('mood');
    }
    return base;
  }, [includeMood, selectedMetrics]);

  const reportBundle = useMemo(() => {
    if (!activeProfile) return null;
    return buildReportBundle({
      profile: activeProfile,
      observations,
      references,
      startDay: parsedStartDay,
      endDay: parsedEndDay,
      selectedMetricIds: effectiveSelectedMetrics,
      includeMood,
      includeNotes,
      generatedAtUtc: nowUtc(),
    });
  }, [
    activeProfile,
    effectiveSelectedMetrics,
    includeMood,
    includeNotes,
    nowUtc,
    observations,
    parsedEndDay,
    parsedStartDay,
    references,
  ]);

  const backupCounts = useMemo(
    () =>
      computeBackupSummaryCounts({
        observations,
        checkInEvents,
        references,
      }),
    [checkInEvents, observations, references],
  );

  // Look up the drafts of the profile the user actually selected, including an
  // inactive one, from storage and from memory. Only the latest request may
  // settle the preview; a late answer for an earlier selection is ignored.
  useEffect(() => {
    const requestId = ++previewRequestRef.current;
    if (
      !pendingBackupRaw ||
      !backupIdentity ||
      restoreDestination !== 'replace_existing' ||
      !replaceTargetId ||
      !targetExists
    ) {
      setDraftPreview({ status: 'idle' });
      return;
    }
    const targetId = replaceTargetId;
    const identity = backupIdentity;
    setDraftPreview({ status: 'pending', targetId, backupIdentity: identity });
    loadDraftsForProfile(targetId, { strict: true }).then(
      (drafts) => {
        if (previewRequestRef.current !== requestId) return;
        setDraftPreview({
          status: 'ready',
          targetId,
          backupIdentity: identity,
          drafts,
          signature: draftSignatureOf(drafts),
        });
      },
      () => {
        if (previewRequestRef.current !== requestId) return;
        setDraftPreview({ status: 'failed', targetId, backupIdentity: identity });
      },
    );
  }, [
    activeDraft,
    backupIdentity,
    loadDraftsForProfile,
    pendingBackupRaw,
    previewRetryNonce,
    replaceTargetId,
    restoreDestination,
    targetExists,
  ]);

  if (!activeProfile || !preferences || !snapshot || !reportBundle) {
    return (
      <View style={styles.center}>
        <Text style={{ fontFamily: fontSansRegular, color: palette.textSupporting }}>
          Loading Reports…
        </Text>
      </View>
    );
  }

  const toggleMetric = (id: MetricId) => {
    if (id === 'mood') {
      setIncludeMood((prev) => !prev);
      return;
    }
    setSelectedMetrics((curr) =>
      curr.includes(id) ? curr.filter((m) => m !== id) : [...curr, id],
    );
  };

  const handleSaveReportJson = async () => {
    const res = await io.saveTextFile({
      filename: `crewsignal-report-day${parsedStartDay}-${parsedEndDay}.json`,
      content: `${JSON.stringify(reportBundle, null, 2)}\n`,
      mimeType: 'application/json',
    });
    setFileStatusBanner({ title: res.label, message: res.detail });
    announce(`${res.label}. ${res.detail}`);
  };

  const handleSaveReportCsv = async () => {
    const csv = serializeObservationsToCsv(reportBundle.observations, {
      includeNotes,
    });
    const res = await io.saveTextFile({
      filename: `crewsignal-report-day${parsedStartDay}-${parsedEndDay}.csv`,
      content: csv,
      mimeType: 'text/csv',
    });
    setFileStatusBanner({ title: res.label, message: res.detail });
    announce(`${res.label}. ${res.detail}`);
  };

  const handleShareReportJson = async () => {
    const res = await io.shareTextFile({
      filename: `crewsignal-report-day${parsedStartDay}-${parsedEndDay}.json`,
      content: `${JSON.stringify(reportBundle, null, 2)}\n`,
      mimeType: 'application/json',
      title: 'Share CrewSignal Report',
    });
    setFileStatusBanner({ title: res.label, message: res.detail });
    announce(`${res.label}. ${res.detail}`);
  };

  const handlePrintA4 = async () => {
    const html = buildA4ReportPrintHtml({
      report: reportBundle,
      displayUnits: preferences.displayUnits,
    });
    const res = await io.printReportHtml({
      html,
      filename: `crewsignal-report-day${parsedStartDay}-${parsedEndDay}.pdf`,
    });
    setFileStatusBanner({ title: res.label, message: res.detail });
    announce(`${res.label}. ${res.detail}`);
  };

  const handleSaveFullBackup = async () => {
    if (!confirmBackupAll) return;
    const backup = buildBackupBundle({
      confirmedIncludeAllProfileData: true,
      exportedAtUtc: nowUtc(),
      profile: activeProfile,
      preferences,
      observations,
      checkInEvents,
      references,
      insights,
    });
    const res = await io.saveTextFile({
      filename: `crewsignal-backup-${activeProfile.profileId}.json`,
      content: `${JSON.stringify(backup, null, 2)}\n`,
      mimeType: 'application/json',
      // A repeat save never replaces an earlier copy.
      avoidOverwrite: true,
    });
    if (res.outcome === 'saved') {
      recordBackupExportedNow();
    }
    setFileStatusBanner({ title: res.label, message: res.detail });
    announce(`${res.label}. ${res.detail}`);
  };

  // Full backup of the profile the confirmation is about to replace, whether
  // or not it is the active one. The provider owns the whole operation (read,
  // picker, acknowledged write) so it carries on if this dialog or screen goes away.
  const handleSaveSafetyBackup = async () => {
    const target = confirmTarget;
    if (!target) return;
    setSafetyRefusedMsg(null);
    const outcome = await saveSafetyBackup({
      profileId: target.profileId,
      backupIdentity: target.backupIdentity,
      consent: safetyConsent,
    });
    if (outcome.status === 'busy') {
      setSafetyRefusedMsg(outcome.message);
    }
  };

  const stageCsvText = (csvText: string) => {
    const preview = parseAndReconcileCsv({
      csvText,
      existingObservations: observations,
      profileId: activeProfile.profileId,
      missionEpochUtc: activeProfile.missionEpochUtc,
      importBatchId: `csv-batch-${Date.now()}`,
      nowUtc: nowUtc(),
    });
    setCsvPreview(preview);
    setConflictChoices({});
    setPossibleDupChoices({});
    setAckExclusions(false);
    setConfirmCsvValues(false);
    setCsvImportResultMsg(null);
    announce(preview.summaryLine);
  };

  const handlePickCsvFile = async () => {
    const picked = await io.pickTextFile({
      mimeTypes: ['text/csv', 'text/comma-separated-values', 'text/plain'],
    });
    if (picked.outcome !== 'picked' || !picked.content) {
      setFileStatusBanner({ title: picked.label, message: picked.detail });
      return;
    }
    stageCsvText(picked.content);
  };

  const handleCommitCsv = async () => {
    if (!csvPreview) return;
    const res = await commitCsvImport({
      preview: csvPreview,
      conflictChoices,
      possibleDuplicateChoices: possibleDupChoices,
      acknowledgedExclusions: ackExclusions,
      confirmedUnusualValues: confirmCsvValues,
      batchId: `csv-batch-${Date.now()}`,
    });
    if (!res.ready) {
      setCsvImportResultMsg(res.error ?? 'Resolve conflicts and acknowledgements first.');
      announce(res.error ?? 'Resolve conflicts before importing.');
      return;
    }
    const msg = `Imported ${res.insertedCount} new and ${res.updatedCount} updated rows (${res.skippedCount} skipped/excluded).`;
    setCsvImportResultMsg(msg);
    setCsvPreview(null);
    announce(msg);
  };

  const handlePickJsonBackupOrDraft = async () => {
    const picked = await io.pickTextFile({ mimeTypes: ['application/json', 'text/plain'] });
    if (picked.outcome !== 'picked' || !picked.content) {
      setFileStatusBanner({ title: picked.label, message: picked.detail });
      return;
    }
    await handleParsedJsonBundle(picked.content);
  };

  const handleParsedJsonBundle = async (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText) as { kind?: unknown };
      if (parsed.kind === 'crewsignal-draft-recovery') {
        const res = await importDraftRecovery(parsed);
        if (!res.valid) {
          setLocalMessage(res.error ?? 'Draft recovery file rejected.');
          return;
        }
        if (res.status === 'already_in_log') {
          setLocalMessage('Already in your log — recovered draft matches a committed entry.');
          return;
        }
        setLocalMessage(
          'Uncommitted draft recovered on this device (still uncommitted until you review & commit).',
        );
        return;
      }

      if (parsed.kind === 'crewsignal-backup') {
        // The identity comes from the file's contents: a different file, or the
        // same file edited, can never reuse another file's preview or backup credit.
        setPendingBackupRaw(parsed);
        setBackupIdentity(backupIdentityOf(parsed));
        clearSavedSafetyBackup();
        setSafetyRefusedMsg(null);
        setConfirmTarget(null);
        setReplaceModalVisible(false);
        setRestoreDestination('separate_profile');
        setLocalMessage(
          'Backup verified. Default destination is a separate profile (recommended) so current data is untouched.',
        );
        return;
      }

      const rejected = await restoreBackup({
        rawBackup: parsed,
        destination: 'separate_profile',
      });
      setLocalMessage(rejected.summary ?? rejected.error ?? 'Unsupported bundle kind.');
    } catch {
      setLocalMessage('Invalid JSON file. Choose a valid CrewSignal backup or draft recovery file.');
    }
  };

  // The open draft on the active profile, if it has not been added to the log.
  const openDraft =
    activeDraft &&
    activeProfile &&
    activeDraft.commitStatus !== 'committed' &&
    activeDraft.profileId === activeProfile.profileId
      ? activeDraft
      : null;
  const openDraftUnsaved = openDraft?.retentionStatus === 'memory_only';
  const isReplacing = restoreDestination === 'replace_existing';
  const labelFor = (profileId: string) =>
    snapshot?.profiles.find((p) => p.profileId === profileId)?.label ?? profileId;
  const targetLabel = labelFor(replaceTargetId);

  // The preview counts only for the current target and the current backup file,
  // so a selection change invalidates it in the same render.
  const previewMatches =
    draftPreview.status !== 'idle' &&
    draftPreview.targetId === replaceTargetId &&
    draftPreview.backupIdentity === backupIdentity;
  const previewReady = previewMatches && draftPreview.status === 'ready';
  const previewFailed = previewMatches && draftPreview.status === 'failed';
  const previewPending = isReplacing && targetExists && !previewReady && !previewFailed;
  const targetGone = isReplacing && replaceTargetId !== '' && !targetExists;
  const targetDrafts: CheckInDraft[] =
    previewReady && draftPreview.status === 'ready' ? draftPreview.drafts : [];

  const replacingTargetDrafts = isReplacing && previewReady && targetDrafts.length > 0;
  const targetDraftsUnsaved = targetDrafts.some((d) => d.retentionStatus === 'memory_only');
  const sourceDraftKept = openDraft !== null && !(isReplacing && openDraft.profileId === replaceTargetId);
  // Replace needs a successful draft preview for exactly this backup and target.
  const canExecuteRestore = !isReplacing || (previewReady && targetExists);

  // What the confirmation was opened for must still be what the preview says.
  // `confirmCheck` explains why Confirm is off; the provider re-checks all of it
  // under the lock regardless.
  const confirmCheck: 'ok' | 'rechecking' | 'failed' | 'changed' | 'target_gone' | null = !confirmTarget
    ? null
    : !snapshot.profiles.some((p) => p.profileId === confirmTarget.profileId)
      ? 'target_gone'
      : previewFailed
        ? 'failed'
        : !previewReady || draftPreview.status !== 'ready'
          ? 'rechecking'
          : draftPreview.targetId !== confirmTarget.profileId ||
              draftPreview.backupIdentity !== confirmTarget.backupIdentity ||
              draftPreview.signature !== confirmTarget.draftSignature
            ? 'changed'
            : 'ok';
  const confirmCheckMessage =
    confirmTarget && confirmCheck && confirmCheck !== 'ok' && !opBusy
      ? confirmCheck === 'target_gone'
        ? `"${confirmTarget.label}" is no longer on this device. Nothing was changed. Close this and choose a target again.`
        : confirmCheck === 'failed'
          ? `The open drafts of "${confirmTarget.label}" could not be re-checked. Nothing was changed. Close this and try again.`
          : confirmCheck === 'changed'
            ? `The drafts that would be removed from "${confirmTarget.label}" changed after you previewed them. Close this, review the updated preview, and confirm again.`
            : `Re-checking the open drafts of "${confirmTarget.label}"… Confirm stays off until this finishes.`
      : null;

  // The safety-backup result shown in the confirmation is the provider's outcome,
  // and only when it is about this exact backup file and target.
  const matchingSafetyOutcome =
    confirmTarget &&
    safetyBackupOutcome &&
    safetyBackupOutcome.profileId === confirmTarget.profileId &&
    safetyBackupOutcome.backupIdentity === confirmTarget.backupIdentity
      ? safetyBackupOutcome
      : null;
  const safetyStatus = matchingSafetyOutcome?.message ?? safetyRefusedMsg;
  const safetyCredit =
    confirmTarget &&
    lastSavedSafetyBackup &&
    lastSavedSafetyBackup.profileId === confirmTarget.profileId &&
    lastSavedSafetyBackup.backupIdentity === confirmTarget.backupIdentity
      ? lastSavedSafetyBackup
      : null;
  const safetyRunningForTarget =
    activeOperation?.kind === 'safety_backup' && activeOperation.profileId === confirmTarget?.profileId;
  const replaceRunning = activeOperation?.kind === 'replace';
  // One status line: the provider's persisted result, or this screen's own message.
  const statusMessage = restoreOutcome?.message ?? restoreResultMsg;

  // Recovery files exclude private notes (ERROR-RECOVERY: notes only when selected).
  const exportDrafts = async (drafts: CheckInDraft[], profileLabel: string) => {
    const saved: string[] = [];
    for (const draft of drafts) {
      const bundle = buildDraftRecoveryBundle({
        draft,
        profileLabel,
        exportedAtUtc: nowUtc(),
        includeNotes: false,
      });
      const res = await io.saveTextFile({
        filename: `crewsignal-draft-${draft.draftId}.json`,
        content: `${JSON.stringify(bundle, null, 2)}\n`,
        mimeType: 'application/json',
        // A repeat export never replaces an earlier recovery copy.
        avoidOverwrite: true,
      });
      saved.push(`${res.label}: ${res.detail}`);
    }
    const msg = saved.join(' ');
    setLocalMessage(msg);
    announce(msg);
  };

  const openReplaceConfirmation = (target: ConfirmTarget) => {
    setConfirmTarget(target);
    setSafetyConsent(false);
    setSafetyRefusedMsg(null);
    setReplaceModalVisible(true);
  };

  const closeReplaceConfirmation = () => {
    setReplaceModalVisible(false);
    setConfirmTarget(null);
    setSafetyConsent(false);
    setSafetyRefusedMsg(null);
  };

  const executeBackupRestore = async (confirmedReplace: boolean) => {
    if (!pendingBackupRaw || !backupIdentity) return;
    let target: ConfirmTarget | null = null;
    if (isReplacing) {
      if (confirmedReplace) {
        // The write is bound to the exact backup, target and drafts the
        // confirmation was opened for.
        target = confirmTarget;
        if (!target || target.backupIdentity !== backupIdentity) return;
      } else {
        // A pending or failed preview, or a missing target, leaves every profile untouched.
        if (!previewReady || draftPreview.status !== 'ready' || !targetExists) return;
        target = {
          profileId: draftPreview.targetId,
          label: labelFor(draftPreview.targetId),
          drafts: draftPreview.drafts,
          backupIdentity: draftPreview.backupIdentity,
          draftSignature: draftPreview.signature,
        };
      }
    }
    // The provider's lock decides whether this may run; it answers `busy`
    // immediately, even for a press in the same tick as another action.
    const res = await restoreBackup({
      rawBackup: pendingBackupRaw,
      destination: restoreDestination,
      targetExistingProfileId: target?.profileId,
      confirmedReplace,
      expected:
        confirmedReplace && target
          ? { backupIdentity: target.backupIdentity, draftSignature: target.draftSignature }
          : undefined,
    });
    if (res.busy) {
      // Nothing started and nothing changed; the other operation keeps running.
      setLocalMessage(res.error ?? 'Another action is still in progress. Nothing was changed.');
      return;
    }
    if (res.requiresConfirmation && target) {
      openReplaceConfirmation(target);
      return;
    }
    closeReplaceConfirmation();
    if (res.stale || res.targetMissing) {
      // The preview no longer describes reality: read it again before anything is replaced.
      setPreviewRetryNonce((n) => n + 1);
    }
    if (!res.ok) {
      if (res.ranOperation) {
        clearLocalMessageOnly();
      } else {
        setLocalMessage(res.error ?? 'Restore could not complete.');
      }
      return;
    }
    setPendingBackupRaw(null);
    setBackupIdentity(null);
    clearLocalMessageOnly();
  };

  // The provider's persisted outcome already says what happened; drop any older local text.
  const clearLocalMessageOnly = () => setRestoreResultMsg(null);

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}
    >
      <ScreenTitle
        title="Reports, Export & Recovery"
        subtitle="Filter shared indicators, print monochrome A4, backup safely, or reconcile CSV rows"
      />

      {activeOperation ? (
        <CalmBanner
          testID="operation-status-banner"
          title={`${activeOperation.description} is in progress`}
          message={operationProgressText(activeOperation)}
          tone="neutral"
        />
      ) : null}

      {fileStatusBanner ? (
        <CalmBanner
          testID="reports-file-outcome"
          title={fileStatusBanner.title}
          message={fileStatusBanner.message}
          tone="neutral"
        />
      ) : null}

      {/* Section 1: Report Selection & Privacy Filter */}
      <PanelCard testID="reports-selection-card">
        <View style={{ gap: 12 }}>
          <EyebrowLabel>1 · Report scope & privacy defaults</EyebrowLabel>
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <LabeledField
                testID="report-start-day"
                label="Start mission day"
                keyboardType="numeric"
                value={startDayText}
                onChangeText={setStartDayText}
              />
            </View>
            <View style={{ flex: 1 }}>
              <LabeledField
                testID="report-end-day"
                label="End mission day"
                keyboardType="numeric"
                value={endDayText}
                onChangeText={setEndDayText}
              />
            </View>
          </View>

          <Text style={{ fontFamily: fontSansMedium, fontSize: 13, color: palette.textPrimary }}>
            Included indicators (Mood excluded unless enabled):
          </Text>
          <View style={styles.rowWrap}>
            {METRIC_ORDER.map((id) => (
              <SelectableChip
                key={id}
                testID={`report-metric-${id}`}
                label={METRIC_DEFINITIONS[id].shortLabel}
                selected={
                  id === 'mood' ? includeMood : selectedMetrics.includes(id)
                }
                onPress={() => toggleMetric(id)}
              />
            ))}
          </View>

          <View style={styles.rowWrap}>
            <SelectableChip
              testID="report-toggle-mood"
              label={includeMood ? 'Mood: Included' : 'Mood: Excluded (default)'}
              selected={includeMood}
              onPress={() => setIncludeMood((v) => !v)}
            />
            <SelectableChip
              testID="report-toggle-notes"
              label={includeNotes ? 'Private notes: Included' : 'Private notes: Excluded (default)'}
              selected={includeNotes}
              onPress={() => setIncludeNotes((v) => !v)}
            />
          </View>
        </View>
      </PanelCard>

      {/* Section 2: Live Filtered Preview & Export Actions */}
      <PanelCard testID="reports-preview-card">
        <View style={{ gap: 12 }}>
          <View style={styles.rowBetween}>
            <EyebrowLabel>2 · Filtered report preview</EyebrowLabel>
            <StatusBadge
              label={`${reportBundle.observations.length} observations`}
              tone="neutral"
            />
          </View>

          <Text style={{ fontFamily: fontSansMedium, fontSize: 16, color: palette.textPrimary }}>
            {`${reportBundle.profileLabel} · Days ${reportBundle.missionDayRange.startDay}–${reportBundle.missionDayRange.endDay}`}
          </Text>

          <Text style={{ fontFamily: fontSansRegular, fontSize: 14, color: palette.textBody }}>
            {`Included types (${reportBundle.includedMetricIds.length}): ${
              reportBundle.includedMetricIds
                .map((id) => METRIC_DEFINITIONS[id].shortLabel)
                .join(', ') || 'None'
            }`}
          </Text>

          {describeReportFormats(reportBundle, { csv: true, printIncludesMetadata: false }).map((line) => (
            <Text key={line} style={{ color: palette.textBody }}>{line}</Text>
          ))}

          {reportBundle.observations.filter((obs) => obs.quality === 'questionable').map((obs) => (
            <Text key={obs.observationId} style={{ color: palette.textBody }}>
              {`${METRIC_DEFINITIONS[obs.metricId].name}: ${formatObservationDisplay(obs, preferences.displayUnits).primaryText}`}
            </Text>
          ))}

          <Text style={{ fontFamily: fontMonoRegular, fontSize: 12, color: palette.textSupporting }}>
            {`Excluded: ${
              reportBundle.excludedMetricIds.length > 0
                ? reportBundle.excludedMetricIds
                    .map((id) => METRIC_DEFINITIONS[id].shortLabel)
                    .join(', ')
                : 'None'
            } · Notes: ${reportBundle.includeNotes ? 'Included' : 'Excluded'}`}
          </Text>

          <View style={styles.rowWrap}>
            <ActionButton
              testID="export-report-json"
              label="Save Report JSON"
              onPress={() => void handleSaveReportJson()}
              variant="primary"
            />
            <ActionButton
              testID="export-report-csv"
              label="Save Report CSV"
              onPress={() => void handleSaveReportCsv()}
              variant="secondary"
            />
            <ActionButton
              testID="share-report-btn"
              label="Share sheet"
              onPress={() => void handleShareReportJson()}
              variant="secondary"
            />
            <ActionButton
              testID="print-a4-btn"
              label="Print / PDF (A4)"
              onPress={() => void handlePrintA4()}
              variant="secondary"
            />
          </View>
        </View>
      </PanelCard>

      {/* Section 3: Full Personal Backup Bundle */}
      <PanelCard testID="reports-backup-card">
        <View style={{ gap: 12 }}>
          <EyebrowLabel>3 · Complete profile backup (kind: crewsignal-backup)</EyebrowLabel>
          <Text style={{ fontFamily: fontSansRegular, fontSize: 14, lineHeight: 20, color: palette.textBody }}>
            {`Includes ALL data for "${activeProfile.label}": ${backupCounts.observationCount} observations (${backupCounts.moodCount} mood, ${backupCounts.noteCount} notes), ${backupCounts.eventCount} workflow events, and ${backupCounts.referenceCount} references.`}
          </Text>
          <SelectableChip
            testID="backup-confirm-all"
            label="Include all profile data (mood & private notes)"
            selected={confirmBackupAll}
            onPress={() => setConfirmBackupAll((v) => !v)}
          />
          <ActionButton
            testID="save-backup-json"
            label="Save full backup JSON"
            disabled={!confirmBackupAll}
            onPress={() => void handleSaveFullBackup()}
            variant="primary"
          />
        </View>
      </PanelCard>

      {/* Section 4: CSV 5-Row Staged Review & Atomic Import */}
      <PanelCard testID="reports-csv-import-card">
        <View style={{ gap: 12 }}>
          <EyebrowLabel>4 · CSV review & atomic SQLite import</EyebrowLabel>
          <Text style={{ fontFamily: fontSansRegular, fontSize: 14, color: palette.textBody }}>
            Reviews valid rows, exact duplicates, whole-pair blood pressure conflicts, and unsupported units before touching SQLite.
          </Text>

          <View style={styles.rowWrap}>
            <ActionButton
              testID="pick-csv-button"
              label="Pick CSV file"
              onPress={() => void handlePickCsvFile()}
              variant="secondary"
            />
            <ActionButton
              testID="load-csv-fixture-button"
              label="Load 5-row CSV review sample"
              onPress={() => stageCsvText(CSV_REVIEW_FIXTURE_CSV)}
              variant="subtle"
            />
          </View>

          {csvImportResultMsg ? (
            <CalmBanner title="CSV Import" message={csvImportResultMsg} tone="confirmed" />
          ) : null}

          {csvPreview ? (
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: fontMonoRegular, fontSize: 12, color: palette.textPrimary }}>
                {csvPreview.summaryLine}
              </Text>

              {csvPreview.rows.map((row) => (
                <PanelCard key={`${row.rowIndex}-${row.observationId}`} raised>
                  <View style={{ gap: 6 }}>
                    <View style={styles.rowBetween}>
                      <Text style={{ fontFamily: fontSansMedium, fontSize: 14, color: palette.textPrimary }}>
                        {`Row ${row.rowIndex}: ${row.observationId} (${row.metricId})`}
                      </Text>
                      <StatusBadge
                        label={row.classification}
                        tone={
                          row.classification === 'conflict'
                            ? 'review'
                            : row.classification === 'rejected'
                              ? 'danger'
                              : 'neutral'
                        }
                      />
                    </View>

                    {row.warning && row.candidate && (
                      <Text style={{ color: palette.textBody }}>
                        {formatObservationDisplay(row.candidate, preferences.displayUnits).enteredText}. {row.warning}
                      </Text>
                    )}
                    {row.reason ? (
                      <Text style={{ fontFamily: fontSansRegular, fontSize: 13, color: palette.textSupporting }}>
                        {row.reason}
                      </Text>
                    ) : null}

                    {row.classification === 'conflict' ? (
                      <View style={styles.rowWrap}>
                        <SelectableChip
                          testID={`csv-conflict-keep-${row.observationId}`}
                          label="Keep current"
                          selected={conflictChoices[row.observationId] === 'keep_current'}
                          onPress={() =>
                            setConflictChoices((prev) => ({
                              ...prev,
                              [row.observationId]: 'keep_current',
                            }))
                          }
                        />
                        <SelectableChip
                          testID={`csv-conflict-import-${row.observationId}`}
                          label="Use imported (whole pair)"
                          selected={conflictChoices[row.observationId] === 'use_imported'}
                          onPress={() =>
                            setConflictChoices((prev) => ({
                              ...prev,
                              [row.observationId]: 'use_imported',
                            }))
                          }
                        />
                      </View>
                    ) : null}

                    {row.classification === 'possible_duplicate' ? (
                      <View style={styles.rowWrap}>
                        <SelectableChip
                          label="Keep separate"
                          selected={possibleDupChoices[row.observationId] === 'keep_separate'}
                          onPress={() =>
                            setPossibleDupChoices((prev) => ({
                              ...prev,
                              [row.observationId]: 'keep_separate',
                            }))
                          }
                        />
                        <SelectableChip
                          label="Skip"
                          selected={possibleDupChoices[row.observationId] === 'skip'}
                          onPress={() =>
                            setPossibleDupChoices((prev) => ({
                              ...prev,
                              [row.observationId]: 'skip',
                            }))
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                </PanelCard>
              ))}

              {csvPreview.rows.some((row) => row.warning && row.classification !== 'duplicate') && (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: palette.textBody }}>{ENTRY_WARNING_HELP}</Text>
                  <SelectableChip
                    label="Confirm unusual values in rows being imported"
                    selected={confirmCsvValues}
                    onPress={() => setConfirmCsvValues((value) => !value)}
                  />
                </View>
              )}
              <SelectableChip
                testID="csv-ack-exclusions"
                label="I acknowledge skipped, duplicate, or rejected rows"
                selected={ackExclusions}
                onPress={() => setAckExclusions((v) => !v)}
              />

              <ActionButton
                testID="csv-commit-button"
                label="Commit approved CSV rows"
                onPress={() => void handleCommitCsv()}
                variant="primary"
              />
            </View>
          ) : null}
        </View>
      </PanelCard>

      {/* Section 5: Backup Restore & Uncommitted Draft Recovery */}
      <PanelCard testID="reports-restore-card">
        <View style={{ gap: 12 }}>
          <EyebrowLabel>5 · Backup restore & draft recovery</EyebrowLabel>
          <View style={styles.rowWrap}>
            <ActionButton
              testID="pick-backup-json-btn"
              label="Pick backup or draft JSON"
              onPress={() => void handlePickJsonBackupOrDraft()}
              variant="secondary"
            />
            <ActionButton
              label="Test Report Rejection"
              onPress={() =>
                void handleParsedJsonBundle(JSON.stringify(reportBundle))
              }
              variant="subtle"
            />
            <ActionButton
              label="Test Draft Recovery Sample"
              onPress={() =>
                void handleParsedJsonBundle(
                  JSON.stringify(EXAMPLE_DRAFT_RECOVERY_BUNDLE),
                )
              }
              variant="subtle"
            />
            <ActionButton
              label="Load Backup Sample"
              onPress={() =>
                void handleParsedJsonBundle(JSON.stringify(EXAMPLE_BACKUP_BUNDLE))
              }
              variant="subtle"
            />
          </View>

          {statusMessage ? (
            <CalmBanner
              testID="restore-status"
              title="Restore & recovery status"
              message={statusMessage}
              tone={restoreOutcome && !restoreOutcome.ok ? 'review' : 'neutral'}
            />
          ) : null}

          {pendingBackupRaw ? (
            <View style={{ gap: 10 }}>
              <EyebrowLabel>Restore destination</EyebrowLabel>
              <View style={styles.rowWrap}>
                <SelectableChip
                  testID="restore-dest-separate"
                  label="Separate profile (default)"
                  selected={restoreDestination === 'separate_profile'}
                  onPress={() => setRestoreDestination('separate_profile')}
                />
                <SelectableChip
                  testID="restore-dest-replace"
                  label="Replace existing profile"
                  selected={restoreDestination === 'replace_existing'}
                  onPress={() => setRestoreDestination('replace_existing')}
                />
              </View>

              {restoreDestination === 'replace_existing' ? (
                <View style={styles.rowWrap}>
                  {snapshot.profiles.map((p) => (
                    <SelectableChip
                      key={p.profileId}
                      testID={`restore-target-${p.profileId}`}
                      label={p.label}
                      selected={replaceTargetId === p.profileId}
                      onPress={() => setReplaceTargetId(p.profileId)}
                    />
                  ))}
                </View>
              ) : null}

              {isReplacing && previewPending ? (
                <CalmBanner
                  testID="restore-preview-pending"
                  title={`Checking ${targetLabel} for open drafts…`}
                  message="Replace stays off until this check finishes, so nothing is removed unseen."
                  tone="neutral"
                />
              ) : null}
              {targetGone ? (
                <CalmBanner
                  testID="restore-target-missing"
                  title="That profile is no longer on this device"
                  message="Nothing was changed. Choose a target again; the backup is never restored into a different profile instead."
                  tone="review"
                />
              ) : null}
              {isReplacing && previewFailed ? (
                <CalmBanner
                  testID="restore-preview-failed"
                  title={`Couldn't check ${targetLabel} for open drafts`}
                  message="Nothing was changed. Replace stays off until the check succeeds."
                  tone="review"
                  actionLabel="Try again"
                  onAction={() => setPreviewRetryNonce((n) => n + 1)}
                />
              ) : null}
              {replacingTargetDrafts ? (
                <CalmBanner
                  testID="restore-replace-draft"
                  title={`Replacing ${targetLabel} removes ${
                    targetDrafts.length === 1 ? 'its open draft' : `its ${targetDrafts.length} open drafts`
                  }`}
                  message={
                    targetDraftsUnsaved
                      ? `A ${targetLabel} draft is only in memory. After the restore you will see the backup's records instead. Export a draft backup first to keep a copy.`
                      : `The ${targetLabel} draft saved on this device is deleted with the old profile data. Export a draft backup first to keep a copy.`
                  }
                  tone="review"
                  actionLabel="Export draft backup"
                  onAction={() => void exportDrafts(targetDrafts, targetLabel)}
                />
              ) : null}
              {sourceDraftKept && openDraftUnsaved && openDraft ? (
                <CalmBanner
                  testID="restore-unretained-draft"
                  title={`Your ${activeProfile.label} draft is only on this screen`}
                  message={`Device storage didn't keep it. Restoring keeps it in memory with ${activeProfile.label} until you close CrewSignal. Export a draft backup to keep a copy.`}
                  tone="review"
                  actionLabel="Export draft backup"
                  onAction={() => void exportDrafts([openDraft], activeProfile.label)}
                />
              ) : null}

              <ActionButton
                testID="execute-restore-btn"
                label={
                  restoreDestination === 'separate_profile'
                    ? 'Restore as separate profile'
                    : 'Replace selected profile…'
                }
                onPress={() => void executeBackupRestore(false)}
                disabled={!canExecuteRestore || opBusy}
                variant="primary"
              />
            </View>
          ) : null}

          <ActionButton
            label="Open Check-in drafts"
            onPress={() => navigateTo('checkin')}
            variant="subtle"
          />
        </View>
      </PanelCard>

      <ConfirmDestructiveModal
        visible={replaceModalVisible && confirmTarget !== null}
        title="Replace existing profile?"
        message={
          confirmTarget
            ? `Overwriting "${confirmTarget.label}" deletes its current SQLite observations, events, references${
                confirmTarget.drafts.length === 0
                  ? ''
                  : confirmTarget.drafts.length === 1
                    ? ', and its open draft'
                    : `, and its ${confirmTarget.drafts.length} open drafts`
              } before restoring.${
                safetyCredit
                  ? ` Safety backup saved for ${confirmTarget.label} at ${safetyCredit.atUtc}.`
                  : ` No safety backup of ${confirmTarget.label} yet. Save one first if you want a recovery copy.`
              }`
            : ''
        }
        confirmLabel="Confirm replace profile"
        secondaryActionLabel="Save safety backup first"
        secondaryActionTestID="save-safety-backup"
        secondaryActionDisabled={!safetyConsent || opBusy}
        confirmDisabled={opBusy || (confirmCheck !== null && confirmCheck !== 'ok')}
        onSecondaryAction={() => void handleSaveSafetyBackup()}
        onConfirm={() => void executeBackupRestore(true)}
        onCancel={closeReplaceConfirmation}
      >
        {confirmTarget ? (
          <View style={{ gap: 8 }}>
            <SelectableChip
              testID="safety-backup-consent"
              label={`Include all of ${confirmTarget.label}'s data (mood & private notes)`}
              selected={safetyConsent}
              onPress={() => setSafetyConsent((v) => !v)}
            />
            {safetyRunningForTarget ? (
              <Text
                testID="safety-backup-progress"
                accessibilityLiveRegion="polite"
                style={{ fontFamily: fontSansRegular, fontSize: 14, color: palette.textBody }}
              >
                {`Saving a safety backup of ${confirmTarget.label}… Replace is paused until it finishes.`}
              </Text>
            ) : null}
            {replaceRunning ? (
              <Text
                testID="replace-progress"
                accessibilityLiveRegion="polite"
                style={{ fontFamily: fontSansRegular, fontSize: 14, color: palette.textBody }}
              >
                {`Replacing ${confirmTarget.label}… Saving a safety backup is paused until it finishes.`}
              </Text>
            ) : null}
            {confirmCheckMessage ? (
              <Text
                testID="replace-confirm-check"
                accessibilityLiveRegion="polite"
                style={{ fontFamily: fontSansRegular, fontSize: 14, color: palette.textBody }}
              >
                {confirmCheckMessage}
              </Text>
            ) : null}
            {safetyStatus ? (
              <Text
                testID="safety-backup-status"
                style={{ fontFamily: fontSansRegular, fontSize: 14, color: palette.textBody }}
              >
                {safetyStatus}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ConfirmDestructiveModal>
    </ScrollView>
  );
}

type DraftPreview =
  | { status: 'idle' }
  | { status: 'pending'; targetId: string; backupIdentity: string }
  | {
      status: 'ready';
      targetId: string;
      backupIdentity: string;
      drafts: CheckInDraft[];
      signature: string;
    }
  | { status: 'failed'; targetId: string; backupIdentity: string };

/** Everything a confirmed replace is bound to: the file, the target and the drafts shown. */
interface ConfirmTarget {
  profileId: string;
  label: string;
  drafts: CheckInDraft[];
  backupIdentity: string;
  draftSignature: string;
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
