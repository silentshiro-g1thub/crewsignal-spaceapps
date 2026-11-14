import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  GETTING_STARTED_INTRO, GETTING_STARTED_PERSONAL, GETTING_STARTED_STEPS, GETTING_STARTED_STORAGE,
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
import { ReadingStatusLegend } from '../components/ReadingStatusBadge';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';

export function HelpScreen(): React.ReactElement {
  const { palette, fontSansMedium, fontSansRegular, fontMonoRegular } = useCrewTheme();
  const {
    helpContent,
    preferences,
    updatePreferences,
    isOfflineSimulated,
    activeDraft,
    activeProfile,
    goBackFromHelp,
    navigateTo,
    gettingStarted,
    openGettingStarted,
    openGettingStartedStep,
    showHelpProcedures,
  } = useCrewSignal();

  const currentMode = preferences?.helpMode ?? 'unconfigured';
  const heading = useRef<React.ComponentRef<typeof Text>>(null);

  useEffect(() => {
    if (!gettingStarted) return;
    const frame = requestAnimationFrame(() => {
      if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus');
    });
    return () => cancelAnimationFrame(frame);
  }, [gettingStarted]);

  if (gettingStarted) {
    const isDemo = activeProfile?.mode === 'demo';
    return (
      <ScrollView key="walkthrough" contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}>
        <Text ref={heading} accessible accessibilityRole="header" style={{ color: palette.textPrimary, fontFamily: fontSansMedium, fontSize: 28 }}>
          Getting started
        </Text>
        <Text style={{ color: palette.textBody, fontSize: 16 }}>{GETTING_STARTED_INTRO}</Text>
        <View style={styles.rowWrap}>
          <ActionButton label="Help procedures and sources" onPress={showHelpProcedures} variant="secondary" />
          <ActionButton label="Return to previous screen" onPress={goBackFromHelp} variant="secondary" />
        </View>
        {activeProfile?.mode === 'personal' && <Text style={{ color: palette.textBody, fontSize: 16 }}>{GETTING_STARTED_PERSONAL}</Text>}
        {GETTING_STARTED_STEPS.map((step) => (
          <PanelCard key={step.route}>
            <View style={{ gap: 8 }}>
              <Text accessibilityRole="header" style={{ color: palette.textPrimary, fontFamily: fontSansMedium, fontSize: 18 }}>{step.title}</Text>
              <Text style={{ color: palette.textBody, fontSize: 16 }}>{step.body}</Text>
              {isDemo && <ActionButton label={step.action} onPress={() => openGettingStartedStep(step.route)} variant="secondary" fullWidth />}
            </View>
          </PanelCard>
        ))}
        <PanelCard>
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={{ color: palette.textPrimary, fontFamily: fontSansMedium, fontSize: 18 }}>Local storage and export</Text>
            <Text style={{ color: palette.textBody, fontSize: 16 }}>
              {GETTING_STARTED_STORAGE} On Android, Save Report writes a copy to the app’s CrewSignal documents folder. Share sheet opens Android’s sharing options. You choose the destination there.
            </Text>
          </View>
        </PanelCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      key="procedures"
      contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}
    >
      <ScreenTitle
        title="Help & Procedure Card"
        subtitle="Always reachable offline, before logging data, or mid-check-in without losing your draft"
      />

      <View style={styles.rowWrap}>
        <ActionButton label="Getting started" onPress={openGettingStarted} variant="secondary" />
      </View>

      {activeDraft && activeDraft.profileId === activeProfile?.profileId ? (
        <CalmBanner
          title="Open check-in preserved"
          message="Returning from Help keeps every field you entered in your uncommitted draft."
          tone="neutral"
          actionLabel="Return to Check-in"
          onAction={() => navigateTo('checkin')}
        />
      ) : null}

      {helpContent.mode === 'configured_fixture' && helpContent.fixtureBanner ? (
        <CalmBanner
          testID="help-fixture-banner"
          title={helpContent.fixtureBanner}
          message="Synthetic demonstration fixture only. Do not confuse fixture contacts with mission flight-surgeon channels."
          tone="review"
        />
      ) : null}

      <ReadingStatusLegend />

      <PanelCard testID="help-procedure-card">
        <View style={{ gap: 12 }}>
          <View style={styles.rowBetween}>
            <EyebrowLabel>Procedure & escalation status</EyebrowLabel>
            <StatusBadge
              label={
                helpContent.mode === 'configured_fixture'
                  ? 'Test fixture'
                  : 'Unconfigured'
              }
              tone={helpContent.mode === 'configured_fixture' ? 'review' : 'neutral'}
            />
          </View>

          <Text
            style={{
              fontFamily: fontSansMedium,
              fontSize: 20,
              color: palette.textPrimary,
            }}
          >
            {helpContent.statusTitle}
          </Text>

          <Text
            style={{
              fontFamily: fontSansRegular,
              fontSize: 15,
              lineHeight: 22,
              color: palette.textBody,
            }}
          >
            {helpContent.body}
          </Text>

          <View style={{ gap: 6 }}>
            <EyebrowLabel>Offline actions on this build</EyebrowLabel>
            {helpContent.steps.map((step, index) => (
              <Text
                key={index}
                style={{
                  fontFamily: fontSansRegular,
                  fontSize: 14,
                  lineHeight: 20,
                  color: palette.textBody,
                }}
              >
                {`${index + 1}. ${step}`}
              </Text>
            ))}
          </View>

          <Text
            style={{
              fontFamily: fontSansRegular,
              fontSize: 13,
              lineHeight: 19,
              color: palette.textSupporting,
            }}
          >
            {helpContent.limitation}
          </Text>

          {helpContent.offlineFacts.length > 0 ? (
            <PanelCard raised>
              <View style={{ gap: 4 }}>
                {helpContent.versionLabel ? (
                  <EyebrowLabel>{helpContent.versionLabel}</EyebrowLabel>
                ) : null}
                {helpContent.offlineFacts.map((fact, idx) => (
                  <Text
                    key={idx}
                    style={{
                      fontFamily: fontMonoRegular,
                      fontSize: 12,
                      color: palette.textPrimary,
                    }}
                  >
                    {`· ${fact}`}
                  </Text>
                ))}
              </View>
            </PanelCard>
          ) : null}
        </View>
      </PanelCard>

      <PanelCard>
        <View style={{ gap: 10 }}>
          <EyebrowLabel>Device connectivity & fixture mode</EyebrowLabel>
          <Text
            style={{
              fontFamily: fontSansRegular,
              fontSize: 13,
              lineHeight: 19,
              color: palette.textSupporting,
            }}
          >
            {`Offline local store: ${isOfflineSimulated ? 'Offline mode active (all logging, review, export, and Help work offline)' : 'Local'}.`}
          </Text>

          <View style={styles.rowWrap}>
            <SelectableChip
              testID="help-mode-unconfigured"
              label="Default unconfigured"
              selected={currentMode === 'unconfigured'}
              onPress={() => void updatePreferences({ helpMode: 'unconfigured' })}
            />
            <SelectableChip
              testID="help-mode-fixture"
              label="Test fixture preview"
              selected={currentMode === 'configured_fixture'}
              onPress={() => void updatePreferences({ helpMode: 'configured_fixture' })}
            />
          </View>
        </View>
      </PanelCard>

      <PanelCard>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: palette.textPrimary, fontFamily: fontSansMedium, fontSize: 18 }}>
            Where your data lives
          </Text>
          <Text style={{ color: palette.textBody, fontSize: 16 }}>
            On Android, CrewSignal stores readings and drafts in a SQLite database in the app's private storage. CrewSignal does not encrypt the database or exported files. Android cloud backup is disabled for CrewSignal. Some devices may still transfer app data directly to another device.
          </Text>
          <Text style={{ color: palette.textBody, fontSize: 16 }}>
            To keep your records through a reinstall, save a profile backup from Reports and copy it outside the app before uninstalling. A full backup includes that profile's readings, mood and notes. Report exports contain the readings you select and exclude mood and notes by default.
          </Text>
        </View>
      </PanelCard>

      <View style={styles.rowWrap}>
        <ActionButton
          testID="help-back-button"
          label="Return to previous screen"
          onPress={goBackFromHelp}
          variant="primary"
        />
        <ActionButton
          label="Open Sources"
          onPress={() => navigateTo('sources')}
          variant="secondary"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
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
});
