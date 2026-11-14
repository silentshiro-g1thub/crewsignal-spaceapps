import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  buildSleepInsight,
  getMetricAction,
  compareObservationToReference,
  countCoveredMetricTypes,
  evaluateMetricSchedule,
  formatDurationHoursMinutes,
  formatObservationDisplay,
  formatUtcTimeHHMM,
  getLatestObservationsByMetric,
  getObservedMissionDay,
  getReadingStatus,
  isInsightReviewCurrent,
  findCurrentInsightReview,
  resolveActiveReference,
  READING_STATUSES,
  type Observation,
} from '../shared/src';
import {
  ActionButton,
  CalmBanner,
  EyebrowLabel,
  PanelCard,
  ScreenTitle,
  StatusBadge,
} from '../components/AppPrimitives';
import { SleepChartSvg, type TrendPlotPoint } from '../components/SleepChartSvg';
import { ReadingStatusBadge } from '../components/ReadingStatusBadge';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';
import { MIN_NATIVE_TARGET_DP } from '../theme/tokens';

export function OverviewScreen(): React.ReactElement {
  const {
    palette,
    fontSansMedium,
    fontSansRegular,
    fontMonoRegular,
    isTablet,
    useSingleColumnCards,
  } = useCrewTheme();
  const {
    isLoading,
    loadError,
    reload,
    activeProfile,
    preferences,
    observations,
    references,
    insights,
    activeDraft,
    nowUtc,
    dueSchedules,
    startOrResumeCheckIn,
    navigateTo,
    gettingStarted,
    openGettingStarted,
    setSelectedActionId,
    setSelectedTrendsMetric,
    reviewInsight,
  } = useCrewSignal();

  const currentUtc = nowUtc();
  const latestByMetric = useMemo(
    () => getLatestObservationsByMetric(observations),
    [observations],
  );
  const coveredTypes = useMemo(() => countCoveredMetricTypes(observations), [observations]);

  const sleepRef = useMemo(() => {
    if (!activeProfile) return null;
    return resolveActiveReference({
      profileId: activeProfile.profileId,
      metricId: 'sleep',
      references,
      observations,
      nowUtc: currentUtc,
    });
  }, [activeProfile, currentUtc, latestByMetric.sleep, observations, references]);

  const generatedSleepInsight = useMemo(() => {
    if (!latestByMetric.sleep) return null;
    return buildSleepInsight({
      observation: latestByMetric.sleep,
      reference: sleepRef,
      createdAtUtc: currentUtc,
    });
  }, [currentUtc, latestByMetric.sleep, sleepRef]);

  const savedSleepReview = useMemo(() => {
    if (!generatedSleepInsight) return null;
    return findCurrentInsightReview(insights, generatedSleepInsight);
  }, [generatedSleepInsight, insights]);

  const sleepReviewed =
    generatedSleepInsight && savedSleepReview
      ? isInsightReviewCurrent(savedSleepReview, generatedSleepInsight)
      : false;

  const sleepChartPoints = useMemo<TrendPlotPoint[]>(() => {
    if (!preferences) return [];
    const sleepObs = observations.filter((o) => o.metricId === 'sleep');
    if (sleepObs.length === 0) return [];
    const maxDay = Math.max(...sleepObs.map((o) => getObservedMissionDay(o)));
    const startDay = Math.max(1, maxDay - 6);
    const byDay = new Map<number, Observation>();
    for (const obs of sleepObs) {
      byDay.set(getObservedMissionDay(obs), obs);
    }
    const pts: TrendPlotPoint[] = [];
    for (let day = startDay; day <= maxDay; day += 1) {
      const obs = byDay.get(day);
      if (obs && obs.canonical.kind === 'sleep_duration') {
        const hours = Number((obs.canonical.durationMinutes / 60).toFixed(2));
        pts.push({
          missionDay: day,
          value: hours,
          labelText: formatObservationDisplay(obs, preferences.displayUnits).primaryText,
        });
      } else {
        pts.push({ missionDay: day, value: null, labelText: 'No entry' });
      }
    }
    return pts;
  }, [observations, preferences]);

  if (isLoading && !activeProfile) {
    return (
      <View style={styles.centerState}>
        <PanelCard style={{ maxWidth: 420, width: '100%' }}>
          <Text style={{ fontFamily: fontSansMedium, fontSize: 16, color: palette.textPrimary }}>
            Loading CrewSignal local log…
          </Text>
          <Text
            style={{
              fontFamily: fontSansRegular,
              fontSize: 14,
              color: palette.textSupporting,
              marginTop: 6,
            }}
          >
            Opening your records stored on this device.
          </Text>
        </PanelCard>
      </View>
    );
  }

  if (loadError || !activeProfile || !preferences) {
    return (
      <View style={styles.centerState}>
        <PanelCard style={{ maxWidth: 460, width: '100%' }}>
          <View style={{ gap: 10 }}>
            <CalmBanner
              title="Unable to load CrewSignal data from device storage"
              message={
                loadError ??
                'Local SQLite storage did not respond cleanly. Stored records remain untouched on disk.'
              }
              tone="danger"
              actionLabel="Retry loading"
              onAction={() => void reload()}
            />
            <ActionButton
              label="Open Help"
              onPress={() => navigateTo('help')}
              variant="secondary"
            />
          </View>
        </PanelCard>
      </View>
    );
  }

  const sleepRefHours =
    sleepRef?.value?.kind === 'sleep_duration'
      ? Number((sleepRef.value.durationMinutes / 60).toFixed(2))
      : null;

  const colWidthPct = useSingleColumnCards ? '100%' : isTablet ? '32%' : '48%';
  const hasOpenDraft = Boolean(
    activeDraft &&
      activeDraft.profileId === activeProfile.profileId &&
      activeDraft.commitStatus === 'uncommitted',
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { backgroundColor: palette.surfaceCanvas },
      ]}
    >
      <ScreenTitle
        title="Overview"
        subtitle={`${activeProfile.missionName} · ${coveredTypes} of 6 indicators logged · ${observations.length} committed ${observations.length === 1 ? 'entry' : 'entries'}`}
      />

      {dueSchedules.length > 0 && (
        <PanelCard testID="overview-due-now">
          <Text accessibilityRole="header" style={{ fontFamily: fontSansMedium, fontSize: 18, color: palette.textPrimary }}>
            Due now
          </Text>
          {dueSchedules.map(({ metricId, status, intervalLabel, ageLabel }) => (
            <CalmBanner
              key={metricId}
              testID={`schedule-due-${metricId}`}
              title={METRIC_DEFINITIONS[metricId].name}
              message={status === 'due_no_entries'
                ? 'First check-in due.'
                : `Last logged ${ageLabel} ago. The ${intervalLabel} interval has passed.`}
              tone="review"
              actionLabel={`Start ${METRIC_DEFINITIONS[metricId].name.toLowerCase()} check-in`}
              onAction={() => startOrResumeCheckIn(metricId)}
            />
          ))}
        </PanelCard>
      )}

      {activeProfile.mode === 'demo' && !gettingStarted && (
        <ActionButton label="Getting started" variant="secondary" onPress={openGettingStarted} />
      )}

      {/* Primary Check-in Hero */}
      <PanelCard testID="overview-checkin-card">
        <View style={{ gap: 12 }}>
          <View style={styles.rowBetween}>
            <View style={{ gap: 4, flex: 1 }}>
              <EyebrowLabel>Check-in</EyebrowLabel>
              <Text
                style={{
                  fontFamily: fontSansMedium,
                  fontSize: 18,
                  color: palette.textPrimary,
                }}
              >
                {hasOpenDraft
                  ? 'Continue open check-in draft'
                  : observations.length === 0
                    ? 'No entries yet'
                    : 'Ready when you want to log'}
              </Text>
              <Text
                style={{
                  fontFamily: fontSansRegular,
                  fontSize: 14,
                  lineHeight: 20,
                  color: palette.textSupporting,
                }}
              >
                {hasOpenDraft && activeDraft
                  ? `${METRIC_DEFINITIONS[activeDraft.metricId].name}: ${activeDraft.rawFields.primary || 'Unfinished'}${activeDraft.rawFields.secondary ? `/${activeDraft.rawFields.secondary}` : ''} ${activeDraft.selectedUnit} (${activeDraft.rawObservedTimeText}) · uncommitted`
                  : observations.length === 0
                    ? 'Start with any indicator you measured. Leaving an indicator blank never creates fake zeros.'
                    : 'All six measurements remain optional. Add a single value or complete a quick pass.'}
              </Text>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <ActionButton
              testID="overview-primary-checkin-cta"
              label={hasOpenDraft ? 'Continue check-in' : 'Start check-in'}
              onPress={() => startOrResumeCheckIn()}
              variant="primary"
            />
            {observations.length === 0 ? (
              <ActionButton
                label="Open Trends"
                onPress={() => navigateTo('trends')}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      </PanelCard>

      {/* Scheduled prompt if configured (e.g. SIM-SCHEDULE 24h BP) */}
      {/* Compact Action Row: Review sleep */}
      {generatedSleepInsight && generatedSleepInsight.comparisonAvailable ? (
        <PanelCard testID="overview-review-sleep-card">
          <View style={{ gap: 10 }}>
            <View style={styles.rowBetween}>
              <StatusBadge
                label={sleepReviewed ? 'Reviewed' : 'Review'}
                tone={sleepReviewed ? 'neutral' : 'review'}
              />
              <Text
                style={{
                  fontFamily: fontMonoRegular,
                  fontSize: 11,
                  color: palette.textSupporting,
                }}
              >
                {generatedSleepInsight.ruleVersion}
              </Text>
            </View>

            <Text
              style={{
                fontFamily: fontSansMedium,
                fontSize: 16,
                color: palette.textPrimary,
              }}
            >
              {generatedSleepInsight.summary}
            </Text>

            {sleepReviewed ? <Text>Reviewed {savedSleepReview?.reviewedAtUtc}</Text> : null}
            {generatedSleepInsight.sourceIds.map(id => <ActionButton key={id} label={id + ' · ' + generatedSleepInsight.sourceVersions[id]} onPress={() => navigateTo('sources')} variant="subtle" />)}
            <View style={styles.ctaRow}>
              <ActionButton
                testID="overview-review-sleep-btn"
                label="Review sleep"
                onPress={() => {
                  setSelectedActionId(getMetricAction('sleep').actionId);
                  navigateTo('actions');
                }}
                variant="secondary"
              />
              {!sleepReviewed ? (
                <ActionButton
                  label="Mark reviewed"
                  onPress={() => void reviewInsight(generatedSleepInsight)}
                  variant="subtle"
                />
              ) : null}
            </View>
          </View>
        </PanelCard>
      ) : null}

      <PanelCard>
        <View style={{ gap: 8 }}>
          <EyebrowLabel>Reading guidance</EyebrowLabel>
          <View style={styles.ctaRow}>
            {METRIC_ORDER.map((metricId) => {
              const action = getMetricAction(metricId);
              return (
                <ActionButton
                  key={action.actionId}
                  label={action.title}
                  onPress={() => {
                    setSelectedActionId(action.actionId);
                    navigateTo('actions');
                  }}
                  variant="subtle"
                />
              );
            })}
          </View>
        </View>
      </PanelCard>

      {/* Joined Readings Grid: 2x3 Phone | 1-col Narrow/Large-Font | 3x2 Tablet */}
      <View style={{ gap: 8 }}>
        <EyebrowLabel>Latest readings</EyebrowLabel>
        <View style={styles.readingsGrid}>
          {METRIC_ORDER.map((metricId) => {
            const def = METRIC_DEFINITIONS[metricId];
            const obs = latestByMetric[metricId] ?? null;
            const formatted = obs
              ? formatObservationDisplay(obs, preferences.displayUnits)
              : null;
            const day = obs ? getObservedMissionDay(obs) : null;
            const timeLabel = obs
              ? obs.timing.kind === 'instant'
                ? formatUtcTimeHHMM(obs.timing.observedAtUtc)
                : formatUtcTimeHHMM(obs.timing.reportedAtUtc)
              : null;
            const reference = resolveActiveReference({
              profileId: activeProfile.profileId,
              metricId,
              references,
              observations,
              nowUtc: currentUtc,
            });
            const comparison = obs ? compareObservationToReference(obs, reference) : null;
            const schedule = evaluateMetricSchedule({
              metricId,
              latestObservation: obs,
              schedule: activeProfile.schedules[metricId] ?? null,
              referenceNowUtc: currentUtc,
            });
            const status = getReadingStatus(obs, comparison, schedule);
            const compText = comparison?.differenceText ?? comparison?.unavailableReason;

            return (
              <Pressable
                key={metricId}
                testID={`reading-card-${metricId}`}
                onPress={() => startOrResumeCheckIn(metricId)}
                accessibilityRole="button"
                accessibilityLabel={`${def.name}. ${formatted ? `${formatted.primaryText}. ` : ''}${READING_STATUSES[status].label}.`}
                accessibilityHint="Opens check-in to log or update this reading"
                style={({ pressed }) => [
                  {
                    width: colWidthPct,
                    flexGrow: useSingleColumnCards ? 0 : 1,
                    minHeight: 112,
                    minWidth: MIN_NATIVE_TARGET_DP,
                    backgroundColor: palette.surfacePanel,
                    borderColor: palette.borderSubtle,
                    borderWidth: 1,
                    borderRadius: palette.radiusCard,
                    padding: 14,
                    justifyContent: 'space-between',
                    gap: 8,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text
                    style={{
                      fontFamily: fontSansMedium,
                      fontSize: 13,
                      color: palette.textSupporting,
                      flexShrink: 1,
                    }}
                  >
                    {def.name}
                  </Text>
                  {day !== null && timeLabel ? (
                    <Text
                      style={{
                        fontFamily: fontMonoRegular,
                        fontSize: 11,
                        color: palette.textSupporting,
                      }}
                    >
                      {`D${day} · ${timeLabel}`}
                    </Text>
                  ) : null}
                </View>

                <Text
                  style={{
                    fontFamily: fontSansMedium,
                    fontSize: 22,
                    lineHeight: 28,
                    color: obs ? palette.textPrimary : palette.textSupporting,
                  }}
                >
                  {formatted ? formatted.primaryText : 'Not entered'}
                </Text>

                <ReadingStatusBadge status={status} />
                {compText && (
                  <Text style={{
                    fontFamily: fontSansRegular,
                    fontSize: 12,
                    lineHeight: 17,
                    color: palette.textSupporting,
                  }}>
                    {compText}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sleep Over Time Chart */}
      <PanelCard testID="overview-sleep-chart-card">
        <View style={{ gap: 12 }}>
          <View style={styles.rowBetween}>
            <View style={{ gap: 2 }}>
              <EyebrowLabel>Sleep over time</EyebrowLabel>
              <Text
                style={{
                  fontFamily: fontSansMedium,
                  fontSize: 17,
                  color: palette.textPrimary,
                }}
              >
                7-day duration trend
              </Text>
            </View>
            <ActionButton
              label="Open Trends"
              onPress={() => {
                setSelectedTrendsMetric('sleep');
                navigateTo('trends');
              }}
              variant="subtle"
            />
          </View>

          {sleepChartPoints.length > 0 ? (
            <SleepChartSvg
              points={sleepChartPoints}
              referenceValue={sleepRefHours}
              referenceLabel={
                sleepRef?.value?.kind === 'sleep_duration'
                  ? formatDurationHoursMinutes(sleepRef.value.durationMinutes, {
                      padMinutes: true,
                    })
                  : null
              }
              rangeDays={7}
              yMin={0}
              yMax={10}
              yTickValues={[0, 5, 10]}
            />
          ) : (
            <Text
              style={{
                fontFamily: fontSansRegular,
                fontSize: 14,
                lineHeight: 20,
                color: palette.textSupporting,
              }}
            >
              No sleep observations logged yet for this profile.
            </Text>
          )}
        </View>
      </PanelCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 28,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  readingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
