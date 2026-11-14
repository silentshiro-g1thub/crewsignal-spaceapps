import { ScheduledNotifications } from './components/ScheduledNotifications';
import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppShell } from './components/AppShell';
import { loadBundledFonts } from './platform/fonts';
import { ActionsScreen } from './screens/ActionsScreen';
import { CheckInScreen } from './screens/CheckInScreen';
import { ExplorerScreen } from './screens/ExplorerScreen';
import { HelpScreen } from './screens/HelpScreen';
import { MoreScreen } from './screens/MoreScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SourcesScreen } from './screens/SourcesScreen';
import { CrewSignalProvider, useCrewSignal } from './state/CrewSignalContext';
import { ExpoSqliteDriver } from './storage/expoDriver';
import { CrewSignalSqliteStore } from './storage/sqliteStore';
import { CrewSignalThemeProvider, useCrewTheme } from './theme/ThemeProvider';

function CrewSignalRouteBody(): React.ReactElement {
  const { activeRoute } = useCrewSignal();
  switch (activeRoute) {
    case 'checkin':
      return <></>;
    case 'explorer':
      return <ExplorerScreen />;
    case 'trends':
      return <TrendsScreen />;
    case 'more':
      return <MoreScreen />;
    case 'actions':
      return <ActionsScreen />;
    case 'reports':
      return <ReportsScreen />;
    case 'sources':
      return <SourcesScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'help':
      return <HelpScreen />;
    case 'overview':
    default:
      return <OverviewScreen />;
  }
}

// Import placed after helper to satisfy clean module ordering
import { TrendsScreen } from './screens/TrendsScreen';
import type { PlatformIoAdapter } from './platform/files';

function ThemedCrewSignalApp({
  fontsLoaded,
}: {
  fontsLoaded: boolean;
}): React.ReactElement {
  const { preferences } = useCrewSignal();
  const appearance = preferences?.appearance ?? 'system';

  return (
    <CrewSignalThemeProvider appearance={appearance} fontsLoaded={fontsLoaded}>
      <ThemedShellHost />
    </CrewSignalThemeProvider>
  );
}

function ThemedShellHost(): React.ReactElement {
  const { palette } = useCrewTheme();
  const { activeRoute, previousRoute, gettingStarted } = useCrewSignal();
  const showCheckIn = activeRoute === 'checkin';
  const keepCheckIn = previousRoute === 'checkin' && (activeRoute === 'help' || gettingStarted);
  return (
    <>
      <StatusBar style={palette.statusBarStyle} />
      <ScheduledNotifications />
      <AppShell>
        {(showCheckIn || keepCheckIn) && (
          <View
            style={showCheckIn ? { flex: 1 } : { display: 'none' }}
            importantForAccessibility={showCheckIn ? 'auto' : 'no-hide-descendants'}
          >
            <CheckInScreen />
          </View>
        )}
        <CrewSignalRouteBody />
      </AppShell>
    </>
  );
}

export interface CrewSignalAppProps {
  store?: CrewSignalSqliteStore;
  io?: PlatformIoAdapter;
  clockOverrideUtc?: string;
  simulateLoadFailure?: boolean;
  skipFontLoading?: boolean;
}

export default function App(props: CrewSignalAppProps = {}): React.ReactElement {
  const {
    store: externalStore,
    io,
    clockOverrideUtc,
    simulateLoadFailure,
    skipFontLoading = false,
  } = props;

  const [fontsLoaded, setFontsLoaded] = useState(skipFontLoading);
  const [nativeStore, setNativeStore] = useState<CrewSignalSqliteStore | null>(
    externalStore ?? null,
  );

  useEffect(() => {
    if (!skipFontLoading) {
      loadBundledFonts().then((loaded) => setFontsLoaded(loaded));
    }
  }, [skipFontLoading]);

  useEffect(() => {
    if (externalStore) {
      setNativeStore(externalStore);
      return;
    }
    let active = true;
    ExpoSqliteDriver.open('crewsignal_v1.db').then((driver) => {
      if (active) {
        setNativeStore(new CrewSignalSqliteStore(driver));
      } else {
        void driver.close();
      }
    });
    return () => {
      active = false;
    };
  }, [externalStore]);

  const fallbackStore = useMemo(
    () =>
      nativeStore ??
      new CrewSignalSqliteStore({
        exec: async () => undefined,
        run: async () => ({ changes: 0, lastInsertRowId: 0 }),
        getFirst: async () => null,
        getAll: async () => [],
        withTransaction: async (fn) =>
          fn({
            exec: async () => undefined,
            run: async () => ({ changes: 0, lastInsertRowId: 0 }),
            getFirst: async () => null,
            getAll: async () => [],
          }),
        close: async () => undefined,
      }),
    [nativeStore],
  );

  // Avoid running initialization against the dummy placeholder before ExpoSqliteDriver.open resolves.
  if (!nativeStore && !externalStore) {
    return (
      <SafeAreaProvider>
        <CrewSignalThemeProvider appearance="system" fontsLoaded={fontsLoaded}>
          <ThemedLoadingPlaceholder />
        </CrewSignalThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <CrewSignalProvider
        store={fallbackStore}
        io={io}
        clockOverrideUtc={clockOverrideUtc}
        simulateLoadFailure={simulateLoadFailure}
      >
        <ThemedCrewSignalApp fontsLoaded={fontsLoaded} />
      </CrewSignalProvider>
    </SafeAreaProvider>
  );
}

import { Text, View } from 'react-native';

function ThemedLoadingPlaceholder(): React.ReactElement {
  const { palette, fontSansMedium } = useCrewTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surfaceCanvas,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <Text style={{ fontFamily: fontSansMedium, fontSize: 16, color: palette.textPrimary }}>
        Opening CrewSignal SQLite store…
      </Text>
    </View>
  );
}
