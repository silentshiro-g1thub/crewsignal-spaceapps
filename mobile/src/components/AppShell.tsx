import { getDueCheckIns } from '../shared/src';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ActionButton } from './AppPrimitives';
import { computeMissionDay, formatUtcTimeHHMM } from '../shared/src';
import { useCrewSignal, type CrewSignalRoute } from '../state/CrewSignalContext';
import { useCrewTheme } from '../theme/ThemeProvider';
import { MIN_NATIVE_TARGET_DP } from '../theme/tokens';

interface NavItemDef {
  route: CrewSignalRoute;
  label: string;
}

const PHONE_TABS: readonly NavItemDef[] = [
  { route: 'overview', label: 'Overview' },
  { route: 'checkin', label: 'Check-in' },
  { route: 'explorer', label: 'Explorer' },
  { route: 'trends', label: 'Trends' },
  { route: 'more', label: 'More' },
];

const TABLET_RAIL_ITEMS: readonly NavItemDef[] = [
  { route: 'overview', label: 'Overview' },
  { route: 'checkin', label: 'Check-in' },
  { route: 'explorer', label: 'Explorer' },
  { route: 'trends', label: 'Trends' },
  { route: 'actions', label: 'Actions' },
  { route: 'reports', label: 'Reports' },
  { route: 'settings', label: 'Settings' },
  { route: 'help', label: 'Help' },
];

function NavIcon({
  route,
  color,
  size = 18,
}: {
  route: CrewSignalRoute;
  color: string;
  size?: number;
}): React.ReactElement {
  switch (route) {
    case 'overview':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="3" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
          <Rect x="13" y="3" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
          <Rect x="3" y="13" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
          <Rect x="13" y="13" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.75" />
        </Svg>
      );
    case 'checkin':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.75" />
          <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
        </Svg>
      );
    case 'explorer':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="6.5" r="2.5" stroke={color} strokeWidth="1.75" />
          <Path
            d="M7 11.5h10M12 11.5v5.5M12 17l-3.5 4M12 17l3.5 4"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'trends':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 17l6-6 4 4 8-8"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M3 20h18" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
        </Svg>
      );
    case 'actions':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14M13 6l6 6-6 6"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'reports':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 3h9l4 4v14H6V3z"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <Path d="M9 12h6M9 16h6" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.75" />
          <Path
            d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'help':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.75" />
          <Path
            d="M9.75 9.25a2.25 2.25 0 113.4 1.94c-.7.45-1.15 1-1.15 1.81v.5"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <Circle cx="12" cy="17" r="1" fill={color} />
        </Svg>
      );
    case 'more':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="6" cy="12" r="1.5" fill={color} />
          <Circle cx="12" cy="12" r="1.5" fill={color} />
          <Circle cx="18" cy="12" r="1.5" fill={color} />
        </Svg>
      );
  }
}

function isPhoneTabActive(activeRoute: CrewSignalRoute, tabRoute: CrewSignalRoute): boolean {
  if (activeRoute === tabRoute) return true;
  if (
    tabRoute === 'more' &&
    (activeRoute === 'actions' ||
      activeRoute === 'reports' ||
      activeRoute === 'sources' ||
      activeRoute === 'settings')
  ) {
    return true;
  }
  return false;
}

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const {
    palette,
    resolvedMode,
    isTablet,
    fontSansMedium,
    fontMonoRegular,
    fontSansRegular,
  } = useCrewTheme();
  const {
    activeRoute,
    navigateTo,
    goBackFromHelp,
    gettingStarted,
    openGettingStarted,
    activeProfile,
    observations,
    nowUtc,
    isKeyboardVisible,
    isOfflineSimulated,
    liveAnnouncement,
  } = useCrewSignal();

  const currentUtc = nowUtc();
  const dueCount = getDueCheckIns(activeProfile, observations, currentUtc).length;
  const missionDay = activeProfile
    ? computeMissionDay(currentUtc, activeProfile.missionEpochUtc)
    : 1;
  const utcLabel = formatUtcTimeHHMM(currentUtc);

  const isSecondaryRoute =
    !isTablet &&
    (activeRoute === 'actions' ||
      activeRoute === 'reports' ||
      activeRoute === 'sources' ||
      activeRoute === 'settings');

  const hideBottomBar = !isTablet && isKeyboardVisible && activeRoute === 'checkin';
  const walkthroughReturn = gettingStarted && activeRoute !== 'help' ? (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <ActionButton label="Back to Getting started" onPress={openGettingStarted} variant="secondary" />
    </View>
  ) : null;

  const headerBar = (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: palette.borderSubtle,
          backgroundColor: palette.surfacePanel,
        },
      ]}
    >
      <View style={styles.brandGroup}>
        {activeRoute === 'help' ? (
          <Pressable
            onPress={goBackFromHelp}
            accessibilityRole="button"
            accessibilityLabel="Back from Help"
            style={[
              styles.headerActionBtn,
              {
                borderColor: palette.borderControl,
                borderRadius: palette.radiusControl,
                backgroundColor: palette.surfaceRaised,
              },
            ]}
          >
            <Text style={{ fontFamily: fontSansMedium, fontSize: 14, color: palette.textPrimary }}>
              Back
            </Text>
          </Pressable>
        ) : isSecondaryRoute ? (
          <Pressable
            onPress={() => navigateTo('more')}
            accessibilityRole="button"
            accessibilityLabel="Back to More"
            style={[
              styles.headerActionBtn,
              {
                borderColor: palette.borderControl,
                borderRadius: palette.radiusControl,
                backgroundColor: palette.surfaceRaised,
              },
            ]}
          >
            <Text style={{ fontFamily: fontSansMedium, fontSize: 14, color: palette.textPrimary }}>
              More
            </Text>
          </Pressable>
        ) : null}

        <View style={{ flexShrink: 1 }}>
          <Text
            style={{
              fontFamily: fontSansMedium,
              fontSize: 16,
              lineHeight: 20,
              color: palette.textPrimary,
            }}
          >
            CrewSignal
          </Text>
          <Text
            style={{
              fontFamily: fontMonoRegular,
              fontSize: 11,
              lineHeight: 14,
              color: palette.textSupporting,
            }}
          >
            {activeProfile
              ? `${activeProfile.mode === 'demo' ? activeProfile.scenarioId ?? 'Demo' : activeProfile.label} · Day ${missionDay} · ${utcLabel} ${activeProfile.displayTimezone}`
              : 'Loading local store'}
          </Text>
        </View>
      </View>

      <View style={styles.headerRight}>
        <View
          accessibilityLabel={isOfflineSimulated ? 'Offline mode active, stored locally' : 'Local storage'}
          style={[
            styles.offlineChip,
            {
              backgroundColor: palette.surfaceRaised,
              borderColor: palette.borderSubtle,
              borderRadius: palette.radiusPill,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: fontMonoRegular,
              fontSize: 11,
              color: palette.textSupporting,
            }}
          >
            {isOfflineSimulated ? 'Offline' : 'Local'}
          </Text>
        </View>

        <Pressable
          testID="header-help-button"
          onPress={() => navigateTo('help')}
          accessibilityRole="button"
          accessibilityLabel="Help"
          accessibilityState={{ selected: activeRoute === 'help' }}
          style={[
            styles.headerActionBtn,
            {
              backgroundColor:
                activeRoute === 'help' ? palette.selectionBg : palette.surfaceRaised,
              borderColor:
                activeRoute === 'help' ? palette.focusRing : palette.borderControl,
              borderWidth: activeRoute === 'help' ? 2 : 1,
              borderRadius: palette.radiusControl,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: fontSansMedium,
              fontSize: 14,
              color: palette.textPrimary,
            }}
          >
            Help
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const syntheticBanner =
    activeProfile?.mode === 'demo' ? (
      <View
        style={{
          backgroundColor: palette.surfaceRaised,
          borderBottomWidth: 1,
          borderBottomColor: palette.borderSubtle,
          paddingHorizontal: 16,
          paddingVertical: 6,
        }}
      >
        <Text
          style={{
            fontFamily: fontMonoRegular,
            fontSize: 11,
            lineHeight: 15,
            color: palette.textSupporting,
          }}
        >
          SYNTHETIC DEMO ({activeProfile.scenarioId ?? 'DEMO'}) · Not clinical diagnosis · Snapshot {utcLabel} {activeProfile.displayTimezone}
        </Text>
      </View>
    ) : null;

  const liveRegion = (
    <View
      accessible
      accessibilityLiveRegion="polite"
      style={liveAnnouncement ? styles.liveBar : styles.srPlaceholder}
    >
      {liveAnnouncement ? (
        <Text
          style={{
            fontFamily: fontSansRegular,
            fontSize: 13,
            color: palette.textPrimary,
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: palette.surfaceRaised,
            borderBottomWidth: 1,
            borderBottomColor: palette.borderSubtle,
          }}
        >
          {liveAnnouncement}
        </Text>
      ) : null}
    </View>
  );

  if (isTablet) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={[styles.root, { backgroundColor: palette.surfaceCanvas }]}
      >
        <View style={styles.tabletRow}>
          <View
            testID="tablet-navigation-rail"
            accessibilityRole="tablist"
            style={[
              styles.tabletRail,
              {
                backgroundColor: palette.surfacePanel,
                borderRightColor: palette.borderSubtle,
              },
            ]}
          >
            <View style={{ paddingHorizontal: 10, paddingVertical: 12 }}>
              <Text
                style={{
                  fontFamily: fontSansMedium,
                  fontSize: 13,
                  color: palette.textPrimary,
                }}
              >
                CrewSignal
              </Text>
            </View>

            <View style={styles.railItems}>
              {TABLET_RAIL_ITEMS.map((item) => {
                const selected =
                  activeRoute === item.route ||
                  (item.route === 'actions' && activeRoute === 'sources');
                return (
                  <Pressable
                    key={item.route}
                    testID={`rail-${item.route}`}
                    onPress={() => navigateTo(item.route)}
                    accessibilityRole="tab"
                    accessibilityLabel={item.label === 'Check-in' && dueCount ? `Check-in, ${dueCount} due` : item.label}
                    accessibilityState={{ selected }}
                    style={{
                      minHeight: MIN_NATIVE_TARGET_DP,
                      minWidth: 88,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: palette.radiusControl,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? palette.focusRing : 'transparent',
                      backgroundColor: selected ? palette.selectionBg : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <NavIcon
                      route={item.route}
                      color={selected ? palette.textPrimary : palette.textSupporting}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fontSansMedium,
                        fontSize: 12,
                        color: selected ? palette.textPrimary : palette.textSupporting,
                      }}
                    >
                      {item.label}{item.label === 'Check-in' && dueCount > 0 ? ` (${dueCount})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => navigateTo('settings')}
              accessibilityRole="button"
              accessibilityLabel={`Theme: ${resolvedMode === 'dark' ? 'Dark' : 'Light'}`}
              style={{
                minHeight: MIN_NATIVE_TARGET_DP,
                minWidth: 88,
                paddingHorizontal: 10,
                paddingVertical: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1,
                borderTopColor: palette.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: fontMonoRegular,
                  fontSize: 11,
                  color: palette.textSupporting,
                }}
              >
                {resolvedMode === 'dark' ? 'Theme: Dark' : 'Theme: Light'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.mainColumn}>
            {headerBar}
            {syntheticBanner}
            {liveRegion}
            {walkthroughReturn}
            <View style={styles.contentHost}>{children}</View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.root, { backgroundColor: palette.surfaceCanvas }]}
    >
      {headerBar}
      {syntheticBanner}
      {liveRegion}
      {walkthroughReturn}
      <View style={styles.contentHost}>{children}</View>

      {!hideBottomBar ? (
        <View
          testID="phone-bottom-tabs"
          accessibilityRole="tablist"
          style={[
            styles.bottomTabs,
            {
              backgroundColor: palette.tabBarBg,
              borderTopColor: palette.borderSubtle,
            },
          ]}
        >
          {PHONE_TABS.map((tab) => {
            const selected = isPhoneTabActive(activeRoute, tab.route);
            return (
              <Pressable
                key={tab.route}
                testID={`tab-${tab.route}`}
                onPress={() => navigateTo(tab.route)}
                accessibilityRole="tab"
                accessibilityLabel={tab.route === 'checkin' && dueCount ? `Check-in, ${dueCount} due` : tab.label}
                accessibilityState={{ selected }}
                style={{
                  flex: 1,
                  minHeight: 52,
                  minWidth: MIN_NATIVE_TARGET_DP,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 6,
                  borderTopWidth: 2,
                  borderTopColor: selected ? palette.focusRing : 'transparent',
                  gap: 3,
                }}
              >
                <NavIcon
                  route={tab.route}
                  color={selected ? palette.textPrimary : palette.textSupporting}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: selected ? fontSansMedium : fontSansRegular,
                    fontSize: 11,
                    color: selected ? palette.textPrimary : palette.textSupporting,
                  }}
                >
                  {tab.label}{tab.route === 'checkin' && dueCount > 0 ? ` (${dueCount})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerActionBtn: {
    minHeight: MIN_NATIVE_TARGET_DP,
    minWidth: MIN_NATIVE_TARGET_DP,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBar: {
    width: '100%',
  },
  srPlaceholder: {
    height: 0,
    overflow: 'hidden',
  },
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
  },
  tabletRail: {
    minWidth: 104,
    borderRightWidth: 1,
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  railItems: {
    flex: 1,
    gap: 4,
  },
  mainColumn: {
    flex: 1,
  },
  contentHost: {
    flex: 1,
  },
  bottomTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 4,
  },
});
