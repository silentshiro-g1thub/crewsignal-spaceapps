import { MeasurementEducation } from '../components/MeasurementEducation';
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  METRIC_DEFINITIONS,
  MEASUREMENT_RESEARCH,
  ENTRY_CONFIRMED_NOTE,
  ENTRY_WARNING_HELP,
  METRIC_ORDER,
  MOOD_QUESTION_TEXT,
  MOOD_SCALE_SPEC,
  SLEEP_TYPE_LABELS,
  buildDraftRecoveryBundle,
  computeMissionDay,
  formatDurationHoursMinutes,
  formatObservationDisplay,
  NEEDS_RECHECK_HELP,
  NEEDS_RECHECK_LABEL,
  formatReviewEquivalent,
  parseHHMM,
  validateDraftForReview,
  type CheckInDraft,
  type MetricId,
  type SleepType,
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
import {
  MeasurementHelpModal,
  SkipOrUnavailableModal,
  UnitChangeModal,
} from '../components/Modals';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';

function isDraftPopulated(draft: CheckInDraft | null): boolean {
  if (!draft) return false;
  return (
    draft.rawFields.primary.trim().length > 0 ||
    (draft.rawFields.secondary?.trim().length ?? 0) > 0 ||
    (draft.rawFields.hours?.trim().length ?? 0) > 0 ||
    (draft.rawFields.minutes?.trim().length ?? 0) > 0 ||
    draft.rawFields.moodScore !== null ||
    draft.note.trim().length > 0
  );
}

export function CheckInScreen(): React.ReactElement {
  const { palette, fontSansMedium, fontSansRegular, fontMonoRegular } = useCrewTheme();
  const {
    activeProfile,
    preferences,
    activeDraft,
    commitState,
    skipOutcome,
    io,
    nowUtc,
    switchCheckInMetric,
    updateDraft,
    requestUnitChange,
    backToRecordStage,
    proceedToReviewStage,
    commitCurrentDraft,
    checkCurrentDraftCommitStatus,
    discardCurrentDraft,
    markCurrentUnavailable,
    skipCurrentCheckIn,
    dismissSkipOutcome,
    navigateTo,
    openResearch,
    startOrResumeCheckIn,
    announce,
  } = useCrewSignal();

  const [retainingReview, setRetainingReview] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [workflowModalMode, setWorkflowModalMode] = useState<'skip' | 'unavailable' | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const primaryInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const secondaryInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const dayInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const timeInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const reviewEquiv = useMemo(() => {
    if (!activeDraft) return null;
    if (activeDraft.metricId !== 'blood_glucose' && activeDraft.metricId !== 'body_temperature') {
      return null;
    }
    const parsed = Number(activeDraft.rawFields.primary.trim());
    if (!Number.isFinite(parsed)) return null;
    return formatReviewEquivalent(activeDraft.metricId, parsed, activeDraft.selectedUnit);
  }, [activeDraft]);

  if (!activeProfile || !preferences) {
    return (
      <View style={styles.center}>
        <Text style={{ fontFamily: fontSansRegular, color: palette.textSupporting }}>
          Preparing Check-in…
        </Text>
      </View>
    );
  }

  // Skip / Unavailable explicit receipt
  if (skipOutcome) {
    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}
      >
        <ScreenTitle title="Check-in complete" subtitle="No fake values written" />
        <CalmBanner
          testID="checkin-skip-outcome"
          title={
            skipOutcome.eventType === 'measurement_unavailable'
              ? 'Measurement unavailable logged'
              : 'Check-in closed'
          }
          message={`${skipOutcome.message} ${skipOutcome.detail}`}
          tone="neutral"
        />
        <View style={styles.rowWrap}>
          <ActionButton
            label="Back to Overview"
            onPress={dismissSkipOutcome}
            variant="primary"
          />
          <ActionButton
            label="Open Check-in again"
            onPress={() => startOrResumeCheckIn('heart_rate')}
            variant="secondary"
          />
        </View>
      </ScrollView>
    );
  }

  // Saved Receipt Stage (only confirmation green in the app)
  if (commitState.phase === 'saved' && commitState.savedObservation) {
    const saved = commitState.savedObservation;
    const formatted = formatObservationDisplay(saved, preferences.displayUnits);
    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}
      >
        <ScreenTitle title="Check-in" subtitle="Committed to device SQLite log" />

        <PanelCard testID="checkin-saved-receipt">
          <View style={{ gap: 12 }}>
            <StatusBadge
              label={commitState.heading ?? 'Added to your log'}
              tone="confirmed"
            />
            <Text
              style={{
                fontFamily: fontSansMedium,
                fontSize: 22,
                color: palette.textPrimary,
              }}
            >
              {`${METRIC_DEFINITIONS[saved.metricId].name}: ${formatted.primaryText}`}
            </Text>
            <Text
              style={{
                fontFamily: fontSansRegular,
                fontSize: 14,
                lineHeight: 20,
                color: palette.textBody,
              }}
            >
              {commitState.message ?? 'Stored on this device in one SQLite transaction.'}
            </Text>
            {saved.qualityNote === ENTRY_CONFIRMED_NOTE && (
              <Text style={{ color: palette.textBody }}>{ENTRY_CONFIRMED_NOTE}</Text>
            )}
            <Text
              style={{
                fontFamily: fontMonoRegular,
                fontSize: 12,
                color: palette.textSupporting,
              }}
            >
              {`ID: ${saved.observationId} · Method: ${saved.method} · Context: ${saved.context}`}
            </Text>
          </View>
        </PanelCard>

        <View style={styles.rowWrap}>
          <ActionButton
            testID="saved-to-overview"
            label="Overview"
            onPress={() => navigateTo('overview')}
            variant="primary"
          />
          <ActionButton
            label={saved.quality === 'questionable' ? 'Log a new reading' : 'Add another measurement'}
            onPress={() => {
              const nextMetric = saved.quality === 'questionable'
                ? saved.metricId
                : METRIC_ORDER.find((m) => m !== saved.metricId) ?? 'heart_rate';
              startOrResumeCheckIn(nextMetric);
            }}
            variant="secondary"
          />
        </View>
      </ScrollView>
    );
  }

  const currentMetricId: MetricId = activeDraft?.metricId ?? 'heart_rate';
  const metricDef = METRIC_DEFINITIONS[currentMetricId];

  const fallbackDay = computeMissionDay(nowUtc(), activeProfile.missionEpochUtc);
  const draft: CheckInDraft = activeDraft ?? {
    draftId: 'temp',
    profileId: activeProfile.profileId,
    mode: activeProfile.mode,
    metricId: 'heart_rate',
    stage: 'record',
    rawFields: {
      primary: '',
      secondary: '',
      hours: '',
      minutes: '',
      moodScore: null,
      sleepType: 'main_sleep',
      endingMissionDay: String(fallbackDay),
      hasSleepWindow: false,
    },
    selectedUnit: 'bpm',
    rawObservedTimeText: `Day ${fallbackDay} · 07:18`,
    observedMissionDay: fallbackDay,
    observedTimeHHMM: '07:18',
    observedAtUtc: nowUtc(),
    missionEpochUtc: activeProfile.missionEpochUtc,
    originalTimezone: activeProfile.displayTimezone,
    method: 'Manual pulse count',
    context: 'At rest',
    provenance: 'manual',
    note: '',
    validationState: {
      valid: true,
      errors: {},
      firstInvalidField: null,
      announcement: null,
    },
    normalizedCandidate: null,
    conversionVersion: 'crewsignal-units-v1',
    retentionStatus: 'retained',
    commitStatus: 'uncommitted',
    committedObservationId: null,
    createdAtUtc: nowUtc(),
    updatedAtUtc: nowUtc(),
  };

  const exportDraftRecoveryFile = async () => {
    const bundle = buildDraftRecoveryBundle({
      draft,
      profileLabel: activeProfile.label,
      exportedAtUtc: nowUtc(),
      // Private notes stay out of recovery files unless selected (ERROR-RECOVERY).
      includeNotes: false,
    });
    const res = await io.saveTextFile({
      filename: `crewsignal-draft-${draft.draftId}.json`,
      content: `${JSON.stringify(bundle, null, 2)}\n`,
      mimeType: 'application/json',
    });
    setExportMessage(`${res.label}: ${res.detail}`);
    announce(`${res.label}. ${res.detail}`);
  };

  // Review Stage
  if (draft.stage === 'review') {
    const entryWarning = validateDraftForReview(draft).warning;
    const sleepH = Number.parseInt(draft.rawFields.hours?.trim() || '0', 10) || 0;
    const sleepM = Number.parseInt(draft.rawFields.minutes?.trim() || '0', 10) || 0;
    const sleepMins = sleepH * 60 + sleepM;

    const timingSummary =
      draft.metricId === 'sleep'
        ? `${SLEEP_TYPE_LABELS[draft.rawFields.sleepType ?? 'main_sleep']} · Ending Day ${draft.rawFields.endingMissionDay ?? draft.observedMissionDay ?? fallbackDay}`
        : `Day ${draft.observedMissionDay ?? fallbackDay} · ${draft.observedTimeHHMM ?? '07:18'} ${draft.originalTimezone}`;

    const windowDurationMin = (() => {
      if (
        draft.metricId !== 'sleep' ||
        !draft.rawFields.hasSleepWindow ||
        !draft.rawFields.windowStartDay ||
        !draft.rawFields.windowStartTime ||
        !draft.rawFields.windowEndDay ||
        !draft.rawFields.windowEndTime
      ) {
        return null;
      }
      const sDay = Number.parseInt(draft.rawFields.windowStartDay, 10);
      const eDay = Number.parseInt(draft.rawFields.windowEndDay, 10);
      const sTime = parseHHMM(draft.rawFields.windowStartTime);
      const eTime = parseHHMM(draft.rawFields.windowEndTime);
      if (!Number.isFinite(sDay) || !Number.isFinite(eDay) || !sTime || !eTime) {
        return null;
      }
      const diff =
        eDay * 1440 +
        eTime.hours * 60 +
        eTime.minutes -
        (sDay * 1440 + sTime.hours * 60 + sTime.minutes);
      return diff >= 0 ? diff : null;
    })();

    const commitPending = commitState.phase === 'submitting' ||
      commitState.phase === 'unknown' || commitState.phase === 'unconfirmed';

    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}
      >
        <ScreenTitle
          title={`Review ${metricDef.name}`}
          subtitle="Verify value, timing, and context before committing to the log"
        />

        {commitState.phase === 'unknown' ? (
          <CalmBanner
            testID="commit-unknown-banner"
            title={commitState.heading ?? 'Saving status unknown'}
            message={
              commitState.message ??
              'Check the log for this entry before adding again.'
            }
            tone="review"
            actionLabel="Check log now"
            onAction={() => void checkCurrentDraftCommitStatus(false)}
          />
        ) : null}

        {commitState.phase === 'confirmed_not_saved' ? (
          <CalmBanner
            testID="commit-not-saved-banner"
            title={commitState.heading ?? 'Log addition did not complete'}
            message={commitState.message ?? 'Your draft is still ready in Review.'}
            tone="danger"
          />
        ) : null}

        {commitState.phase === 'unconfirmed' ? (
          <CalmBanner
            testID="commit-unconfirmed-banner"
            title={commitState.heading ?? 'Addition unconfirmed'}
            message={commitState.message ?? 'Check the log for this entry before adding again.'}
            tone="danger"
            actionLabel="Retry checking log"
            onAction={() => void checkCurrentDraftCommitStatus(false)}
          />
        ) : null}

        {commitState.phase === 'storage_error' ? (
          <CalmBanner
            testID="commit-storage-error-banner"
            title={commitState.heading ?? "Didn't save to the log"}
            message={
              commitState.message ??
              'Your draft is still ready on this device. Try adding again or export a draft backup.'
            }
            tone="danger"
            actionLabel="Export draft backup"
            onAction={() => void exportDraftRecoveryFile()}
          />
        ) : null}

        {draft.retentionStatus === 'memory_only' ? (
          <CalmBanner
            testID="draft-memory-only-banner"
            title="Draft not saved on this device"
            message="Device storage didn't keep this draft, so it exists only on this screen. It stays with this profile until you close CrewSignal. Export a draft backup to keep a copy."
            tone="danger"
            actionLabel="Export draft backup"
            onAction={() => void exportDraftRecoveryFile()}
          />
        ) : null}

        {exportMessage ? (
          <CalmBanner title="Draft export" message={exportMessage} tone="neutral" />
        ) : null}

        <PanelCard testID="checkin-review-card">
          <View style={{ gap: 10 }}>
            <StatusBadge label="Review" tone="review" />
            <EyebrowLabel>{metricDef.name}</EyebrowLabel>

            <Text
              style={{
                fontFamily: fontSansMedium,
                fontSize: 26,
                lineHeight: 32,
                color: palette.textPrimary,
              }}
            >
              {draft.metricId === 'sleep'
                ? sleepMins === 0
                  ? '0h 0m (Reported no sleep)'
                  : formatDurationHoursMinutes(sleepMins, { padMinutes: true })
                : draft.metricId === 'blood_pressure'
                  ? `${draft.rawFields.primary}/${draft.rawFields.secondary} mmHg`
                  : draft.metricId === 'mood'
                    ? `${draft.rawFields.moodScore} / 5 (${
                        MOOD_SCALE_SPEC.choices.find(
                          (c) => c.score === draft.rawFields.moodScore,
                        )?.label ?? ''
                      })`
                    : `${draft.rawFields.primary} ${
                        draft.selectedUnit === 'C'
                          ? '°C'
                          : draft.selectedUnit === 'F'
                            ? '°F'
                            : draft.selectedUnit
                      }`}
            </Text>

            {reviewEquiv ? (
              <Text
                style={{
                  fontFamily: fontMonoRegular,
                  fontSize: 13,
                  color: palette.textBody,
                }}
              >
                {reviewEquiv.label}
              </Text>
            ) : null}

            <Text
              style={{
                fontFamily: fontMonoRegular,
                fontSize: 12,
                color: palette.textSupporting,
              }}
            >
              {timingSummary}
            </Text>

            {windowDurationMin !== null ? (
              <Text
                style={{
                  fontFamily: fontSansRegular,
                  fontSize: 13,
                  color: palette.textSupporting,
                }}
              >
                {`In-bed window: ${formatDurationHoursMinutes(windowDurationMin, { padMinutes: true })} (entered estimated asleep preserved)`}
              </Text>
            ) : null}

            <Text
              style={{
                fontFamily: fontSansRegular,
                fontSize: 14,
                color: palette.textBody,
              }}
            >
              {`Method: ${draft.method} · Context: ${draft.context}`}
            </Text>

            {draft.note.trim() ? (
              <Text
                style={{
                  fontFamily: fontSansRegular,
                  fontSize: 14,
                  color: palette.textBody,
                }}
              >
                {`Note: ${draft.note.trim()}`}
              </Text>
            ) : null}
          </View>
        </PanelCard>

        <PanelCard>
          <View style={{ gap: 10 }}>
            <Text style={{ color: palette.textBody }}>{NEEDS_RECHECK_HELP}</Text>
            <View style={styles.rowWrap}>
              <SelectableChip
                testID="checkin-needs-recheck"
                label={NEEDS_RECHECK_LABEL}
                selected={draft.quality === 'questionable'}
                disabled={retainingReview || commitPending}
                onPress={async () => {
                  setRetainingReview(true);
                  try {
                    await updateDraft((previous) => ({
                      ...previous,
                      quality: previous.quality === 'questionable' ? 'valid' : 'questionable',
                    }));
                  } finally {
                    setRetainingReview(false);
                  }
                }}
              />
              <ActionButton label="Measurement help" variant="subtle" onPress={() => setHelpModalOpen(true)} />
            </View>
          </View>
        </PanelCard>

        {entryWarning && (
          <CalmBanner title="Confirm unusual value" message={`${entryWarning} ${ENTRY_WARNING_HELP}`} tone="review" />
        )}
        <View style={{ gap: 10 }}>
          <ActionButton
            testID="checkin-add-to-log"
            label={commitState.phase === 'submitting' ? 'Adding to log…' : entryWarning ? 'Confirm and add to log' : 'Add to log'}
            disabled={retainingReview || commitPending}
            onPress={() => void commitCurrentDraft('none', Boolean(entryWarning))}
            variant="primary"
            fullWidth
          />
          <ActionButton
            testID="checkin-back-to-edit"
            label="Back to edit"
            disabled={retainingReview}
            onPress={() => void backToRecordStage()}
            variant="secondary"
            fullWidth
          />
          <ActionButton
            label="Export uncommitted draft backup"
            onPress={() => void exportDraftRecoveryFile()}
            variant="subtle"
            fullWidth
          />
        </View>
        <MeasurementHelpModal
          visible={helpModalOpen}
          metricId={draft.metricId}
          onClose={() => setHelpModalOpen(false)}
          onOpenSources={() => navigateTo('sources')}
          onOpenResearch={() => openResearch(MEASUREMENT_RESEARCH[draft.metricId])}
        />
      </ScrollView>
    );
  }

  // Record Stage
  const validationErrors = draft.validationState.errors;
  const firstErrorText = draft.validationState.announcement;

  const handleReviewPress = async () => {
    setRetainingReview(true);
    const res = await proceedToReviewStage().finally(() => setRetainingReview(false));
    if (!res.valid) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (res.firstInvalidField === 'secondary') {
        secondaryInputRef.current?.focus();
      } else if (
        res.firstInvalidField === 'observedMissionDay' ||
        res.firstInvalidField === 'endingMissionDay'
      ) {
        dayInputRef.current?.focus();
      } else if (res.firstInvalidField === 'observedTimeHHMM') {
        timeInputRef.current?.focus();
      } else {
        primaryInputRef.current?.focus();
      }
    }
  };

  const isNoSleep =
    draft.metricId === 'sleep' &&
    draft.rawFields.hours?.trim() === '0' &&
    draft.rawFields.minutes?.trim() === '0';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.surfaceCanvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { backgroundColor: palette.surfaceCanvas },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <ScreenTitle
              title={`Check-in · ${metricDef.name}`}
              subtitle={metricDef.purpose}
            />
          </View>
          <ActionButton
            testID="measurement-help-button"
            label="Measurement help"
            onPress={() => setHelpModalOpen(true)}
            variant="secondary"
          />
        </View>

        {draft.retentionStatus === 'memory_only' ? (
          <CalmBanner
            testID="draft-memory-only-banner"
            title="Draft not saved on this device"
            message="Device storage didn't keep this draft, so it exists only on this screen. It stays with this profile until you close CrewSignal. Export a draft backup to keep a copy."
            tone="danger"
            actionLabel="Export draft backup"
            onAction={() => void exportDraftRecoveryFile()}
          />
        ) : null}

        {isDraftPopulated(draft) && draft.retentionStatus !== 'memory_only' ? (
          <CalmBanner
            testID="draft-retained-banner"
            title="Uncommitted draft preserved"
            message="Values stay only in your draft until you tap Add to log in Review."
            tone="neutral"
            actionLabel="Discard draft"
            onAction={() => void discardCurrentDraft()}
          />
        ) : null}

        {firstErrorText ? (
          <CalmBanner
            testID="checkin-error-summary"
            title="Check highlighted fields"
            message={firstErrorText}
            tone="danger"
          />
        ) : null}

        <View style={{ gap: 6 }}>
          <EyebrowLabel>Select indicator</EyebrowLabel>
          <View style={styles.rowWrap}>
            {METRIC_ORDER.map((m) => (
              <SelectableChip
                key={m}
                testID={`metric-chip-${m}`}
                label={METRIC_DEFINITIONS[m].shortLabel}
                selected={draft.metricId === m}
                onPress={() => switchCheckInMetric(m)}
              />
            ))}
          </View>
        </View>

        <PanelCard>
          <View style={{ gap: 14 }}>
            <MeasurementEducation key={metricDef.id} definition={metricDef} collapsible />
            {draft.metricId === 'heart_rate' ? (
              <LabeledField
                testID="input-primary"
                inputRef={primaryInputRef}
                label="Heart rate"
                unitLabel="bpm"
                keyboardType="numeric"
                value={draft.rawFields.primary}
                placeholder="e.g. 72"
                errorText={validationErrors.primary ?? null}
                onChangeText={(text) =>
                  void updateDraft((prev) => ({
                    ...prev,
                    rawFields: { ...prev.rawFields, primary: text },
                    validationState: { ...prev.validationState, errors: {}, announcement: null },
                  }))
                }
              />
            ) : null}

            {draft.metricId === 'blood_pressure' ? (
              <View style={{ gap: 12 }}>
                <LabeledField
                  testID="input-primary"
                  inputRef={primaryInputRef}
                  label="Systolic pressure"
                  unitLabel="mmHg"
                  keyboardType="numeric"
                  value={draft.rawFields.primary}
                  placeholder="e.g. 118"
                  errorText={validationErrors.primary ?? null}
                  helperText="Enter both systolic and diastolic mmHg values from one paired measurement."
                  onChangeText={(text) =>
                    void updateDraft((prev) => ({
                      ...prev,
                      rawFields: { ...prev.rawFields, primary: text },
                      validationState: { ...prev.validationState, errors: {}, announcement: null },
                    }))
                  }
                />
                <LabeledField
                  testID="input-secondary"
                  inputRef={secondaryInputRef}
                  label="Diastolic pressure"
                  unitLabel="mmHg"
                  keyboardType="numeric"
                  value={draft.rawFields.secondary ?? ''}
                  placeholder="e.g. 76"
                  errorText={validationErrors.secondary ?? null}
                  onChangeText={(text) =>
                    void updateDraft((prev) => ({
                      ...prev,
                      rawFields: { ...prev.rawFields, secondary: text },
                      validationState: { ...prev.validationState, errors: {}, announcement: null },
                    }))
                  }
                />
              </View>
            ) : null}

            {draft.metricId === 'blood_glucose' ? (
              <View style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <EyebrowLabel>Input unit</EyebrowLabel>
                  <View style={styles.rowWrap}>
                    <SelectableChip
                      testID="unit-chip-mg/dL"
                      label="mg/dL"
                      selected={draft.selectedUnit === 'mg/dL'}
                      onPress={() => void requestUnitChange('mg/dL')}
                    />
                    <SelectableChip
                      testID="unit-chip-mmol/L"
                      label="mmol/L"
                      selected={draft.selectedUnit === 'mmol/L'}
                      onPress={() => void requestUnitChange('mmol/L')}
                    />
                  </View>
                </View>

                <LabeledField
                  testID="input-primary"
                  inputRef={primaryInputRef}
                  label="Blood glucose"
                  unitLabel={draft.selectedUnit}
                  keyboardType="decimal-pad"
                  value={draft.rawFields.primary}
                  placeholder={draft.selectedUnit === 'mmol/L' ? 'e.g. 5.4' : 'e.g. 97'}
                  errorText={validationErrors.primary ?? null}
                  onChangeText={(text) =>
                    void updateDraft((prev) => ({
                      ...prev,
                      rawFields: { ...prev.rawFields, primary: text },
                      validationState: { ...prev.validationState, errors: {}, announcement: null },
                    }))
                  }
                />
              </View>
            ) : null}

            {draft.metricId === 'body_temperature' ? (
              <View style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <EyebrowLabel>Input unit</EyebrowLabel>
                  <View style={styles.rowWrap}>
                    <SelectableChip
                      testID="unit-chip-C"
                      label="°C"
                      selected={draft.selectedUnit === 'C'}
                      onPress={() => void requestUnitChange('C')}
                    />
                    <SelectableChip
                      testID="unit-chip-F"
                      label="°F"
                      selected={draft.selectedUnit === 'F'}
                      onPress={() => void requestUnitChange('F')}
                    />
                  </View>
                </View>

                <LabeledField
                  testID="input-primary"
                  inputRef={primaryInputRef}
                  label="Body temperature"
                  unitLabel={draft.selectedUnit === 'F' ? '°F' : '°C'}
                  keyboardType="decimal-pad"
                  value={draft.rawFields.primary}
                  placeholder={draft.selectedUnit === 'F' ? 'e.g. 98.1' : 'e.g. 36.7'}
                  errorText={validationErrors.primary ?? null}
                  onChangeText={(text) =>
                    void updateDraft((prev) => ({
                      ...prev,
                      rawFields: { ...prev.rawFields, primary: text },
                      validationState: { ...prev.validationState, errors: {}, announcement: null },
                    }))
                  }
                />
              </View>
            ) : null}

            {draft.metricId === 'sleep' ? (
              <View style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <EyebrowLabel>Sleep period type</EyebrowLabel>
                  <View style={styles.rowWrap}>
                    {(['main_sleep', 'nap', 'other'] as SleepType[]).map((st) => (
                      <SelectableChip
                        key={st}
                        label={SLEEP_TYPE_LABELS[st]}
                        selected={(draft.rawFields.sleepType ?? 'main_sleep') === st}
                        onPress={() =>
                          void updateDraft((prev) => ({
                            ...prev,
                            rawFields: { ...prev.rawFields, sleepType: st },
                          }))
                        }
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.twoColInputs}>
                  <View style={{ flex: 1 }}>
                    <LabeledField
                      testID="sleep-hours-input"
                      inputRef={primaryInputRef}
                      label="Hours asleep"
                      unitLabel="h"
                      keyboardType="numeric"
                      value={draft.rawFields.hours ?? ''}
                      placeholder="e.g. 5"
                      errorText={validationErrors.hours ?? null}
                      onChangeText={(text) =>
                        void updateDraft((prev) => ({
                          ...prev,
                          rawFields: { ...prev.rawFields, hours: text },
                          validationState: { ...prev.validationState, errors: {}, announcement: null },
                        }))
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabeledField
                      testID="sleep-minutes-input"
                      label="Minutes asleep"
                      unitLabel="m"
                      keyboardType="numeric"
                      value={draft.rawFields.minutes ?? ''}
                      placeholder="e.g. 48"
                      errorText={validationErrors.minutes ?? null}
                      onChangeText={(text) =>
                        void updateDraft((prev) => ({
                          ...prev,
                          rawFields: { ...prev.rawFields, minutes: text },
                          validationState: { ...prev.validationState, errors: {}, announcement: null },
                        }))
                      }
                    />
                  </View>
                </View>

                <SelectableChip
                  testID="sleep-reported-none-chip"
                  label="Reported no sleep (0h 0m)"
                  selected={isNoSleep}
                  onPress={() =>
                    void updateDraft((prev) => ({
                      ...prev,
                      rawFields: {
                        ...prev.rawFields,
                        hours: isNoSleep ? '' : '0',
                        minutes: isNoSleep ? '' : '0',
                      },
                      validationState: { ...prev.validationState, errors: {}, announcement: null },
                    }))
                  }
                />

                <SelectableChip
                  testID="sleep-window-toggle"
                  label={
                    draft.rawFields.hasSleepWindow
                      ? 'Optional in-bed window: Included'
                      : 'Add optional in-bed window (e.g. 23:00 to 05:00)'
                  }
                  selected={Boolean(draft.rawFields.hasSleepWindow)}
                  onPress={() =>
                    void updateDraft((prev) => ({
                      ...prev,
                      rawFields: {
                        ...prev.rawFields,
                        hasSleepWindow: !prev.rawFields.hasSleepWindow,
                        windowStartDay:
                          prev.rawFields.windowStartDay ??
                          String(
                            Math.max(
                              1,
                              Number.parseInt(
                                prev.rawFields.endingMissionDay ?? String(fallbackDay),
                                10,
                              ) - 1,
                            ),
                          ),
                        windowStartTime: prev.rawFields.windowStartTime ?? '23:00',
                        windowEndDay:
                          prev.rawFields.windowEndDay ??
                          prev.rawFields.endingMissionDay ??
                          String(fallbackDay),
                        windowEndTime: prev.rawFields.windowEndTime ?? '05:00',
                      },
                    }))
                  }
                />

                {draft.rawFields.hasSleepWindow ? (
                  <View style={styles.twoColInputs}>
                    <View style={{ flex: 1 }}>
                      <LabeledField
                        testID="sleep-window-start-time"
                        label={`Start time (Day ${draft.rawFields.windowStartDay ?? Math.max(1, fallbackDay - 1)})`}
                        value={draft.rawFields.windowStartTime ?? ''}
                        placeholder="23:00"
                        errorText={validationErrors.windowStartTime ?? null}
                        onChangeText={(text) =>
                          void updateDraft((prev) => ({
                            ...prev,
                            rawFields: { ...prev.rawFields, windowStartTime: text },
                          }))
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <LabeledField
                        testID="sleep-window-end-time"
                        label={`Wake time (Day ${draft.rawFields.windowEndDay ?? fallbackDay})`}
                        value={draft.rawFields.windowEndTime ?? ''}
                        placeholder="05:00"
                        errorText={
                          validationErrors.windowEndTime ??
                          validationErrors.windowEndDay ??
                          null
                        }
                        onChangeText={(text) =>
                          void updateDraft((prev) => ({
                            ...prev,
                            rawFields: { ...prev.rawFields, windowEndTime: text },
                          }))
                        }
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {draft.metricId === 'mood' ? (
              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontFamily: fontSansMedium,
                    fontSize: 16,
                    color: palette.textPrimary,
                  }}
                >
                  {MOOD_QUESTION_TEXT}
                </Text>
                {validationErrors.moodScore ? (
                  <Text
                    accessibilityRole="alert"
                    style={{
                      fontFamily: fontSansMedium,
                      fontSize: 13,
                      color: palette.dangerFg,
                    }}
                  >
                    {validationErrors.moodScore}
                  </Text>
                ) : null}
                <View style={{ gap: 8 }}>
                  {MOOD_SCALE_SPEC.choices.map((choice) => (
                    <SelectableChip
                      key={choice.score}
                      testID={`mood-score-${choice.score}`}
                      label={`${choice.score} · ${choice.label}`}
                      selected={draft.rawFields.moodScore === choice.score}
                      onPress={() =>
                        void updateDraft((prev) => ({
                          ...prev,
                          rawFields: {
                            ...prev.rawFields,
                            moodScore: choice.score,
                          },
                          validationState: { ...prev.validationState, errors: {}, announcement: null },
                        }))
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Timing & Method / Context */}
            {draft.metricId === 'sleep' ? (
              <LabeledField
                inputRef={dayInputRef}
                label="Ending mission day"
                keyboardType="numeric"
                value={draft.rawFields.endingMissionDay ?? String(fallbackDay)}
                errorText={validationErrors.endingMissionDay ?? null}
                onChangeText={(text) =>
                  void updateDraft((prev) => ({
                    ...prev,
                    rawFields: { ...prev.rawFields, endingMissionDay: text },
                    validationState: { ...prev.validationState, errors: {}, announcement: null },
                  }))
                }
              />
            ) : (
              <View style={styles.twoColInputs}>
                <View style={{ flex: 1 }}>
                  <LabeledField
                    inputRef={dayInputRef}
                    label="Mission day"
                    keyboardType="numeric"
                    value={String(draft.observedMissionDay ?? fallbackDay)}
                    errorText={validationErrors.observedMissionDay ?? null}
                    onChangeText={(text) => {
                      const num = Number.parseInt(text.trim(), 10);
                      void updateDraft((prev) => ({
                        ...prev,
                        observedMissionDay: Number.isFinite(num) && num >= 1 ? num : 1,
                        validationState: { ...prev.validationState, errors: {}, announcement: null },
                      }));
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <LabeledField
                    inputRef={timeInputRef}
                    label="Observed time (UTC)"
                    value={draft.observedTimeHHMM ?? '07:18'}
                    placeholder="07:18"
                    errorText={validationErrors.observedTimeHHMM ?? null}
                    onChangeText={(text) =>
                      void updateDraft((prev) => ({
                        ...prev,
                        observedTimeHHMM: text,
                        validationState: { ...prev.validationState, errors: {}, announcement: null },
                      }))
                    }
                  />
                </View>
              </View>
            )}

            <View style={{ gap: 6 }}>
              <EyebrowLabel>Method</EyebrowLabel>
              <View style={styles.rowWrap}>
                {metricDef.methodOptions.map((mChoice) => (
                  <SelectableChip
                    key={mChoice}
                    label={mChoice}
                    selected={draft.method === mChoice}
                    onPress={() =>
                      void updateDraft((prev) => ({
                        ...prev,
                        method: mChoice,
                      }))
                    }
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <EyebrowLabel>Context</EyebrowLabel>
              <View style={styles.rowWrap}>
                {metricDef.contextOptions.map((cChoice) => (
                  <SelectableChip
                    key={cChoice}
                    label={cChoice}
                    selected={draft.context === cChoice}
                    onPress={() =>
                      void updateDraft((prev) => ({
                        ...prev,
                        context: cChoice,
                      }))
                    }
                  />
                ))}
              </View>
            </View>

            <LabeledField
              testID="checkin-note-input"
              label="Private note (optional — excluded from shared reports by default)"
              value={draft.note}
              placeholder="Optional observation note"
              multiline
              onChangeText={(text) =>
                void updateDraft((prev) => ({
                  ...prev,
                  note: text,
                }))
              }
            />
          </View>
        </PanelCard>
      </ScrollView>

      {/* Sticky keyboard-aware bottom Action Dock */}
      <View
        testID="checkin-sticky-dock"
        style={[
          styles.stickyDock,
          {
            backgroundColor: palette.surfacePanel,
            borderTopColor: palette.borderSubtle,
          },
        ]}
      >
        <View style={styles.dockPrimary}>
          <ActionButton
            testID="checkin-review-button"
            disabled={retainingReview}
            label="Review entry"
            onPress={() => void handleReviewPress()}
            variant="primary"
            fullWidth
          />
        </View>
        <View style={styles.dockSecondaryRow}>
          <ActionButton
            testID="checkin-unavailable-button"
            label="Unavailable"
            onPress={() => setWorkflowModalMode('unavailable')}
            variant="secondary"
          />
          <ActionButton
            testID="checkin-skip-button"
            label="Skip check-in"
            onPress={() => setWorkflowModalMode('skip')}
            variant="subtle"
          />
        </View>
      </View>

      <UnitChangeModal />
      <MeasurementHelpModal
        visible={helpModalOpen}
        metricId={draft.metricId}
        onClose={() => setHelpModalOpen(false)}
        onOpenSources={() => navigateTo('sources')}
        onOpenResearch={() => openResearch(MEASUREMENT_RESEARCH[draft.metricId])}
      />
      <SkipOrUnavailableModal
        visible={workflowModalMode !== null}
        mode={workflowModalMode ?? 'skip'}
        hasDraftData={isDraftPopulated(draft)}
        onClose={() => setWorkflowModalMode(null)}
        onSubmit={({ reason, keepDraft }) => {
          const currentMode = workflowModalMode;
          setWorkflowModalMode(null);
          if (currentMode === 'unavailable') {
            void markCurrentUnavailable({ reason, keepDraft });
          } else {
            void skipCurrentCheckIn({ reason, keepDraft });
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  twoColInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  stickyDock: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  dockPrimary: {
    width: '100%',
  },
  dockSecondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
});
