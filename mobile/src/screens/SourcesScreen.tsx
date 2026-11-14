import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EVIDENCE_REGISTRY, EVIDENCE_LIST } from '../shared/src';
import {
  ActionButton,
  CalmBanner,
  EyebrowLabel,
  PanelCard,
  ScreenTitle,
  StatusBadge,
} from '../components/AppPrimitives';
import { useCrewSignal } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';

export function SourcesScreen(): React.ReactElement {
  const { palette, fontSansMedium, fontSansRegular, fontMonoRegular } = useCrewTheme();
  const { io, isOfflineSimulated, announce, selectedResearch, researchReturnRoute, navigateTo } = useCrewSignal();
  const [linkStatus, setLinkStatus] = useState<string | null>(null);

  const sourceList = selectedResearch ? [EVIDENCE_REGISTRY[selectedResearch.sourceId]!] : EVIDENCE_LIST;

  const handleOpenExternal = async (url: string, title: string) => {
    const res = await io.openExternalUrl(url);
    const msg = `${title}: ${res.message}`;
    setLinkStatus(msg);
    announce(msg);
  };

  const handleCopyUrl = async (url: string, title: string) => {
    const copied = await io.copyToClipboard(url);
    const msg = copied
      ? `Copied URL for "${title}" to clipboard.`
      : 'Unable to access clipboard on this device.';
    setLinkStatus(msg);
    announce(msg);
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { backgroundColor: palette.surfaceCanvas }]}
    >
      <ScreenTitle
        title="Sources"
        subtitle="Cached offline evidence summaries"
      />

      {selectedResearch && (
        <ActionButton label="Back to previous screen" onPress={() => navigateTo(researchReturnRoute)} variant="secondary" />
      )}

      {linkStatus ? (
        <CalmBanner
          testID="sources-link-status"
          title="Source link action"
          message={linkStatus}
          tone="neutral"
        />
      ) : null}

      {isOfflineSimulated ? (
        <CalmBanner
          title="Offline summary cache active"
          message="Cached evidence summaries load completely offline. Opening original publisher links uses your device browser when connectivity is available."
          tone="neutral"
        />
      ) : null}

      {sourceList.map((ev) => {
        const hasKnownUpdate = ev.knownUpdateAvailableVersion !== null;
        const badgeLabel = hasKnownUpdate
          ? 'Known update'
          : ev.cachedAvailable
            ? 'Cached offline summary'
            : 'No cached summary';

        return (
          <PanelCard key={ev.sourceId} testID={`source-card-${ev.sourceId}`}>
            <View style={{ gap: 10 }}>
              <View style={styles.rowBetween}>
                <EyebrowLabel>{`${ev.publisher} · ${ev.summaryVersion}`}</EyebrowLabel>
                <StatusBadge
                  label={badgeLabel}
                  tone={hasKnownUpdate ? 'review' : 'neutral'}
                />
              </View>

              <Text
                style={{
                  fontFamily: fontSansMedium,
                  fontSize: 17,
                  color: palette.textPrimary,
                }}
              >
                {ev.title}
              </Text>

              <Text
                style={{
                  fontFamily: fontSansRegular,
                  fontSize: 14,
                  lineHeight: 20,
                  color: palette.textBody,
                }}
              >
                {ev.summaryText}
              </Text>

              <Text
                style={{
                  fontFamily: fontSansRegular,
                  fontSize: 13,
                  lineHeight: 18,
                  color: palette.textSupporting,
                }}
              >
                {`${ev.limitations} · ${ev.offlineAccessNote}`}
              </Text>

              <Text
                style={{
                  fontFamily: fontMonoRegular,
                  fontSize: 11,
                  color: palette.textSupporting,
                }}
              >
                {`Checked: ${ev.checkedDate} · ${ev.url}`}
              </Text>

              {selectedResearch && <Text style={{ color: palette.textBody }}>{selectedResearch.text}</Text>}
              <View style={styles.rowWrap}>
                <ActionButton
                  testID={`open-source-${ev.sourceId}`}
                  label="View original source"
                  onPress={() => void handleOpenExternal(ev.url, ev.title)}
                  variant="secondary"
                />
                <ActionButton
                  label="Copy source URL"
                  onPress={() => void handleCopyUrl(ev.url, ev.title)}
                  variant="subtle"
                />
              </View>
            </View>
          </PanelCard>
        );
      })}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
