import { MeasurementEducation } from '../components/MeasurementEducation';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BODY_SYSTEM_DEFINITIONS,
  BODY_SYSTEM_RESEARCH,
  EVIDENCE_REGISTRY,
  RADIATION_RESEARCH,
  METRIC_DEFINITIONS,
  compareObservationToReference,
  evaluateMetricSchedule,
  formatObservationDisplay,
  formatUtcTimeHHMM,
  getLatestObservationsByMetric,
  getMetricAction,
  getObservedMissionDay,
  getReadingStatus,
  resolveActiveReference,
  type BodySystemId,
} from '../shared/src';
import {
  ActionButton,
  CalmBanner,
  EyebrowLabel,
  PanelCard,
  ScreenTitle,
  SelectableChip,
  StatusBadge,
} from '../components/AppPrimitives';
import { BodyExplorerVisual } from '../components/BodyExplorerVisual';
import { ReadingStatusBadge } from '../components/ReadingStatusBadge';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';
import { MIN_NATIVE_TARGET_DP } from '../theme/tokens';

export function ExplorerScreen(): React.ReactElement {
  const { palette, fontSansMedium, fontSansRegular, fontMonoRegular, isTablet } =
    useCrewTheme();
  const {
    activeProfile,
    preferences,
    observations,
    references,
    selectedBodySystem,
    setSelectedBodySystem,
    startOrResumeCheckIn,
    setSelectedTrendsMetric,
    setSelectedActionId,
    navigateTo,
    openResearch,
    nowUtc,
  } = useCrewSignal();

  const [mobileSubView, setMobileSubView] = useState<'map' | 'list'>('map');

  const currentUtc = nowUtc();
  const latestByMetric = useMemo(
    () => getLatestObservationsByMetric(observations),
    [observations],
  );

  const statusBySystem = useMemo(() => {
    const map: Record<BodySystemId, string> = {
      sleep_cognition: 'Not entered',
      cardiovascular: 'Not entered',
      musculoskeletal: 'Not assessed',
      immune_context: 'Not assessed',
      nutrition_metabolism: 'Not entered',
    };
    if (!preferences) return map;

    for (const sys of BODY_SYSTEM_DEFINITIONS) {
      if (sys.coverageKind === 'not_assessed') {
        map[sys.id] = 'Not assessed';
        continue;
      }
      if (sys.id === 'immune_context') {
        const tempObs = latestByMetric.body_temperature;
        map[sys.id] = tempObs
          ? `Context: ${formatObservationDisplay(tempObs, preferences.displayUnits).primaryText}`
          : 'Not assessed · Context only';
        continue;
      }
      const populated = sys.metricIds
        .map((m) => latestByMetric[m])
        .filter((obs): obs is NonNullable<typeof obs> => Boolean(obs));
      if (populated.length === 0) {
        map[sys.id] = 'Not entered';
      } else if (populated.length === 1) {
        const obs = populated[0]!;
        map[sys.id] = formatObservationDisplay(obs, preferences.displayUnits).primaryText;
      } else {
        map[sys.id] = `${populated.length} indicators`;
      }
    }
    return map;
  }, [latestByMetric, preferences]);

  if (!activeProfile || !preferences) {
    return (
      <View style={styles.center}>
        <Text style={{ fontFamily: fontSansRegular, color: palette.textSupporting }}>
          Loading Explorer…
        </Text>
      </View>
    );
  }

  const activeSystem =
    BODY_SYSTEM_DEFINITIONS.find((s) => s.id === selectedBodySystem) ??
    BODY_SYSTEM_DEFINITIONS[0]!;

  const systemDetailCard = (
    <PanelCard testID="explorer-system-detail">
      <View style={{ gap: 12 }}>
        <View style={styles.rowBetween}>
          <View style={{ gap: 2, flex: 1 }}>
            <EyebrowLabel>Selected body system</EyebrowLabel>
            <Text
              style={{
                fontFamily: fontSansMedium,
                fontSize: 20,
                color: palette.textPrimary,
              }}
            >
              {activeSystem.name}
            </Text>
          </View>
          <StatusBadge label={activeSystem.coverageLabel} tone="neutral" />
        </View>

        <Text
          style={{
            fontFamily: fontSansRegular,
            fontSize: 14,
            lineHeight: 20,
            color: palette.textBody,
          }}
        >
          {activeSystem.summary}
        </Text>

        <Text
          style={{
            fontFamily: fontSansRegular,
            fontSize: 13,
            lineHeight: 19,
            color: palette.textSupporting,
          }}
        >
          {activeSystem.limitation}
        </Text>

        {activeSystem.metricIds.length === 0 ? (
          <CalmBanner
            testID="system-not-assessed-banner"
            title="Not assessed"
            message="CrewSignal never infers unmeasured markers. This system has no assigned routine indicator."
            tone="neutral"
          />
        ) : (
          <View style={{ gap: 10 }}>
            {activeSystem.id === 'immune_context' ? (
              <CalmBanner
                testID="immune-context-banner"
                title="Not assessed · Context only"
                message="Body temperature provides thermal context only and never assesses or predicts immune function."
                tone="neutral"
              />
            ) : null}

            {activeSystem.metricIds.map((metricId) => {
              const def = METRIC_DEFINITIONS[metricId];
              const obs = latestByMetric[metricId] ?? null;
              const action = getMetricAction(metricId);
              const resolvedRef = resolveActiveReference({
                profileId: activeProfile.profileId,
                metricId,
                references,
                observations,
                nowUtc: currentUtc,
              });
              const comparison = obs
                ? compareObservationToReference(obs, resolvedRef)
                : null;
              const status = getReadingStatus(obs, comparison, evaluateMetricSchedule({
                metricId,
                latestObservation: obs,
                schedule: activeProfile.schedules[metricId],
                referenceNowUtc: currentUtc,
              }));
              const formatted = obs
                ? formatObservationDisplay(obs, preferences.displayUnits)
                : null;

              return (
                <PanelCard key={metricId} raised>
                  <View style={{ gap: 8 }}>
                    <View style={styles.rowBetween}>
                      <Text
                        style={{
                          fontFamily: fontSansMedium,
                          fontSize: 15,
                          color: palette.textPrimary,
                        }}
                      >
                        {def.name}
                      </Text>
                      {obs ? (
                        <Text
                          style={{
                            fontFamily: fontMonoRegular,
                            fontSize: 11,
                            color: palette.textSupporting,
                          }}
                        >
                          {`Day ${getObservedMissionDay(obs)} · ${
                            obs.timing.kind === 'instant'
                              ? formatUtcTimeHHMM(obs.timing.observedAtUtc)
                              : formatUtcTimeHHMM(obs.timing.reportedAtUtc)
                          }`}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={{
                        fontFamily: fontSansMedium,
                        fontSize: 22,
                        color: obs ? palette.textPrimary : palette.textSupporting,
                      }}
                    >
                      {formatted ? formatted.primaryText : 'Not entered'}
                    </Text>
                    <ReadingStatusBadge status={status} />

                    {obs ? (
                      <>
                        <Text
                          style={{
                            fontFamily: fontSansRegular,
                            fontSize: 13,
                            color: palette.textSupporting,
                          }}
                        >
                          {`Method: ${obs.method} · Context: ${obs.context}`}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fontSansMedium,
                            fontSize: 13,
                            color: comparison?.comparisonAvailable
                              ? palette.textBody
                              : palette.textSupporting,
                          }}
                        >
                          {comparison?.comparisonAvailable
                            ? comparison.differenceText
                            : comparison?.unavailableReason
                              ? `Comparison unavailable — ${comparison.unavailableReason}`
                              : 'No active personal reference yet'}
                        </Text>
                      </>
                    ) : null}

                    <View style={styles.rowWrap}>
                      <ActionButton
                        label={action.title}
                        onPress={() => {
                          setSelectedActionId(action.actionId);
                          navigateTo('actions');
                        }}
                        variant="subtle"
                      />
                      <ActionButton
                        label={obs ? `Update ${def.shortLabel}` : `Log ${def.shortLabel}`}
                        onPress={() => startOrResumeCheckIn(metricId)}
                        variant="secondary"
                      />
                      <ActionButton
                        label="View trend"
                        onPress={() => {
                          setSelectedTrendsMetric(metricId);
                          navigateTo('trends');
                        }}
                        variant="subtle"
                      />
                    </View>
                  </View>
                  <MeasurementEducation definition={def} />
                </PanelCard>
              );
            })}
          </View>
        )}
      </View>
    </PanelCard>
  );

  const researchCards = [BODY_SYSTEM_RESEARCH[selectedBodySystem], RADIATION_RESEARCH].map((research) => (
    <PanelCard key={research.sourceId}>
      <View style={{ gap: 8 }}>
        <EyebrowLabel>{research === RADIATION_RESEARCH ? 'Radiation research' : 'Research for this system'}</EyebrowLabel>
        <Text style={{ color: palette.textBody }}>{research.text}</Text>
        <ActionButton label={EVIDENCE_REGISTRY[research.sourceId]!.shortTitle}
          onPress={() => openResearch(research)} variant="secondary" />
      </View>
    </PanelCard>
  ));

  const systemListCard = (
    <PanelCard testID="explorer-system-list">
      <View style={{ gap: 10 }}>
        <EyebrowLabel>All physiological contexts</EyebrowLabel>
        {BODY_SYSTEM_DEFINITIONS.map((sys) => {
          const selected = sys.id === selectedBodySystem;
          return (
            <Pressable
              key={sys.id}
              testID={`explorer-list-item-${sys.id}`}
              onPress={() => setSelectedBodySystem(sys.id)}
              accessibilityRole="button"
              accessibilityLabel={`${sys.name}, ${statusBySystem[sys.id]}`}
              accessibilityState={{ selected }}
              style={{
                minHeight: MIN_NATIVE_TARGET_DP,
                minWidth: MIN_NATIVE_TARGET_DP,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: palette.radiusControl,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? palette.focusRing : palette.borderSubtle,
                backgroundColor: selected ? palette.selectionBg : palette.surfaceRaised,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: fontSansMedium,
                    fontSize: 15,
                    color: palette.textPrimary,
                  }}
                >
                  {sys.name}
                </Text>
                <Text
                  style={{
                    fontFamily: fontSansRegular,
                    fontSize: 12,
                    color: palette.textSupporting,
                  }}
                >
                  {sys.metricIds.length > 0
                    ? sys.metricIds.map((m) => METRIC_DEFINITIONS[m].shortLabel).join(' · ')
                    : 'Not measured directly'}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fontMonoRegular,
                  fontSize: 12,
                  color: palette.textPrimary,
                }}
              >
                {statusBySystem[sys.id]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </PanelCard>
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { backgroundColor: palette.surfaceCanvas },
      ]}
    >
      <ScreenTitle
        title="Explorer"
        subtitle="Synchronized body map and system readings (neutral navigation illustration)"
      />

      {!isTablet ? (
        <View style={styles.rowWrap}>
          <SelectableChip
            testID="explorer-view-map"
            label="Body map"
            selected={mobileSubView === 'map'}
            onPress={() => setMobileSubView('map')}
          />
          <SelectableChip
            testID="explorer-view-list"
            label="System list"
            selected={mobileSubView === 'list'}
            onPress={() => setMobileSubView('list')}
          />
        </View>
      ) : null}

      {isTablet ? (
        <View style={styles.tabletSplit}>
          <View style={{ flex: 1, gap: 14 }}>
            <PanelCard>
              <BodyExplorerVisual
                selectedSystemId={selectedBodySystem}
                onSelectSystem={setSelectedBodySystem}
                statusBySystem={statusBySystem}
              />
            </PanelCard>
            {systemListCard}
          </View>
          <View style={{ flex: 1, gap: 14 }}>{systemDetailCard}{researchCards}</View>
        </View>
      ) : mobileSubView === 'map' ? (
        <>
          <PanelCard>
            <BodyExplorerVisual
              selectedSystemId={selectedBodySystem}
              onSelectSystem={setSelectedBodySystem}
              statusBySystem={statusBySystem}
            />
          </PanelCard>
          {systemDetailCard}
          {researchCards}
        </>
      ) : (
        <>
          {systemListCard}
          {systemDetailCard}
          {researchCards}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabletSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
});
