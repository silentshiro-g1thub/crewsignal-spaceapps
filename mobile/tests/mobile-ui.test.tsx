import { ACTION_CONTENT_REGISTRY, EVIDENCE_REGISTRY } from '../src/shared/src';
import React from 'react';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as ReactNative from 'react-native';
import { Keyboard } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import App from '../src/App';
import { EXAMPLE_BACKUP_BUNDLE, SIM_01_SNAPSHOT_UTC } from '../src/shared/src';
import { Directory } from 'expo-file-system';
import { SIM_SCHEDULE_PROFILE } from '../src/shared/src';
import { defaultPlatformIo, type PlatformIoAdapter } from '../src/platform/files';
import { NodeSqliteDriver } from '../src/storage/nodeDriver';
import { CrewSignalSqliteStore } from '../src/storage/sqliteStore';

function createMockIo(overrides: Partial<PlatformIoAdapter> = {}): PlatformIoAdapter & {
  savedFiles: Array<{ filename: string; content: string; mimeType: string }>;
  sharedFiles: Array<{ filename: string; content: string; mimeType: string }>;
  printedHtml: string[];
  openedUrls: string[];
} {
  const savedFiles: Array<{ filename: string; content: string; mimeType: string }> = [];
  const sharedFiles: Array<{ filename: string; content: string; mimeType: string }> = [];
  const printedHtml: string[] = [];
  const openedUrls: string[] = [];

  return {
    savedFiles,
    sharedFiles,
    printedHtml,
    openedUrls,
    saveTextFile: async ({ filename, content, mimeType }) => {
      savedFiles.push({ filename, content, mimeType });
      return {
        outcome: 'saved',
        label: 'File saved',
        detail: `Saved ${filename} to app storage.`,
        uri: `file:///mock/${filename}`,
      };
    },
    shareTextFile: async ({ filename, content, mimeType }) => {
      sharedFiles.push({ filename, content, mimeType });
      return {
        outcome: 'shared',
        label: 'Share sheet opened',
        detail: `Handed ${filename} to the native share sheet.`,
        uri: `file:///mock/${filename}`,
      };
    },
    pickTextFile: async () => ({
      outcome: 'cancelled',
      label: 'File selection cancelled',
      detail: 'No file selected.',
    }),
    printReportHtml: async ({ html }) => {
      printedHtml.push(html);
      return {
        outcome: 'printed',
        label: 'Print preview opened',
        detail: 'Sent light A4 report to native print dialog.',
      };
    },
    openExternalUrl: async (url) => {
      openedUrls.push(url);
      return {
        ok: true,
        message: `Opened ${url} externally.`,
      };
    },
    copyToClipboard: async () => true,
    ...overrides,
  };
}

function flattenMinHeight(styleProp: unknown): number {
  const flat = ReactNative.StyleSheet.flatten(
    styleProp as ReactNative.StyleProp<ReactNative.ViewStyle>,
  );
  return typeof flat?.minHeight === 'number' ? flat.minHeight : 0;
}

function flattenMinWidth(styleProp: unknown): number {
  const flat = ReactNative.StyleSheet.flatten(
    styleProp as ReactNative.StyleProp<ReactNative.ViewStyle>,
  );
  return typeof flat?.minWidth === 'number' ? flat.minWidth : 0;
}

describe('CrewSignal Mobile UI, responsiveness, accessibility & recovery workflows', () => {
  const testClockUtc = '2026-11-13T07:18:00Z';
  const DeviceDate = globalThis.Date;
  const cleanups: Array<() => Promise<void>> = [];

  function setViewport(width: number, height: number, scale = 3, fontScale = 1) {
    ReactNative.Dimensions.set({
      window: { width, height, scale, fontScale },
      screen: { width, height, scale, fontScale },
    });
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    // Profile creation reads the device date directly. Keep async timers real.
    globalThis.Date = new Proxy(DeviceDate, {
      construct(target, args, newTarget) {
        return Reflect.construct(target, args.length === 0 ? [testClockUtc] : args, newTarget);
      },
    });
    jest.spyOn(ReactNative.Appearance, 'getColorScheme').mockReturnValue('dark');
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    setViewport(390, 844, 3, 1);
  });

  afterEach(async () => {
    globalThis.Date = DeviceDate;
    jest.restoreAllMocks();
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  async function renderTestApp(options?: {
    simulateLoadFailure?: boolean;
    io?: PlatformIoAdapter;
    profileId?: string;
  }) {
    const driver = new NodeSqliteDriver(':memory:');
    const store = new CrewSignalSqliteStore(driver);
    cleanups.push(() => driver.close());
    if (options?.profileId) {
      await store.initialize();
      await store.updatePreferences({ activeProfileId: options.profileId });
    }
    // Tests that pass the production adapter do not read the mock's file lists.
    const io = (options?.io ?? createMockIo()) as ReturnType<typeof createMockIo>;

    const rendered = await render(
      <App
        store={store}
        io={io}
        clockOverrideUtc={testClockUtc}
        simulateLoadFailure={options?.simulateLoadFailure}
        skipFontLoading
      />,
    );

    return { driver, store, io, unmount: rendered.unmount };
  }

  test.each([
    [390, 844, 'tab-checkin'],
    [1000, 800, 'rail-checkin'],
  ] as const)('shows the due count and opens the scheduled metric at %ipx', async (width, height, navId) => {
    setViewport(width, height);
    await renderTestApp({ profileId: SIM_SCHEDULE_PROFILE.profileId });

    expect(await screen.findByText('Due now')).toBeTruthy();
    expect(screen.getByTestId(navId).props.accessibilityLabel).toBe('Check-in, 1 due');
    await fireEvent.press(screen.getByRole('button', { name: 'Start blood pressure check-in' }));
    expect(await screen.findByLabelText(/Systolic pressure/i)).toBeTruthy();
  });

  test('default report redacts restored notes in Android JSON, share, CSV and print', async () => {
    const { store, io, unmount } = await renderTestApp();
    await screen.findByTestId('overview-checkin-card');
    const row = EXAMPLE_BACKUP_BUNDLE.observations.find((obs) => obs.metricId === 'blood_pressure')!;
    const legacy = {
      ...row, note: 'READING_SENTINEL', qualityNote: 'QUALITY_SENTINEL',
      correctionHistory: [{
        correctionId: 'old-correction', correctedAtUtc: SIM_01_SNAPSHOT_UTC,
        reason: 'CORRECTION_SENTINEL', previousEntered: row.entered, previousCanonical: row.canonical,
        previousTiming: row.timing, previousMethod: row.method, previousContext: row.context,
      }],
    };
    const restored = await store.restoreBackupBundle({
      rawBackup: { ...EXAMPLE_BACKUP_BUNDLE, observations: [legacy] },
      destination: 'replace_existing', targetExistingProfileId: row.profileId, confirmedReplace: true,
    });
    expect(restored.ok).toBe(true);
    await unmount();
    await render(<App store={store} io={io} clockOverrideUtc={SIM_01_SNAPSHOT_UTC} skipFontLoading />);
    await fireEvent.press(await screen.findByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-reports'));
    for (const id of ['export-report-json', 'share-report-btn', 'export-report-csv', 'print-a4-btn']) {
      await fireEvent.press(await screen.findByTestId(id));
    }
    const json = io.savedFiles.find((file) => file.mimeType === 'application/json')!.content;
    const csv = io.savedFiles.find((file) => file.mimeType === 'text/csv')!.content;
    const print = io.printedHtml[0]!;
    expect(io.sharedFiles[0]!.content).toBe(json);
    expect(JSON.parse(json).observations).toHaveLength(1);
    expect(csv).toContain('blood_pressure');
    expect(print).toContain('Blood pressure');
    for (const payload of [json, csv, print]) expect(payload).not.toContain('SENTINEL');
    expect((await store.loadProfileSnapshot(row.profileId)).observations[0]).toEqual(legacy);
  });

  test('source-only revision reviews the current Actions tuple from a stale provider snapshot in one click', async () => {
    const { store } = await renderTestApp();
    await screen.findByTestId('overview-review-sleep-btn');
    const source = EVIDENCE_REGISTRY[ACTION_CONTENT_REGISTRY['action-review-sleep-routine']!.sourceIds[0]!]!;
    const oldVersion = source.summaryVersion;
    try {
      await fireEvent.press(screen.getByText('Mark reviewed'));
      await waitFor(() => expect(screen.queryByText('Mark reviewed')).toBeNull());
      source.summaryVersion = oldVersion + ' source-only regression';
      await fireEvent.press(screen.getByTestId('tab-more'));
      await fireEvent.press(await screen.findByTestId('more-nav-actions'));
      const card = await screen.findByTestId('actions-sleep-insight-card');
      const review = within(card).getByText('Mark reviewed');
      await act(async () => { fireEvent.press(review); fireEvent.press(review); });
      await waitFor(() => expect(within(card).queryByText('Mark reviewed')).toBeNull());
      const saved = await store.loadAppSnapshot();
      const fresh = saved.active.insights.filter(i=>i.sourceVersions[source.sourceId]===source.summaryVersion && i.status==='reviewed');
      expect(fresh).toHaveLength(1);
      await fireEvent.press(screen.getByTestId('tab-overview'));
      await screen.findByTestId('overview-review-sleep-btn');
      expect(screen.queryByText('Mark reviewed')).toBeNull();
    } finally { source.summaryVersion = oldVersion; }
  });

  test.each([390, 834])('reference editor at %i px requires two explicit BP values and preserves fields on storage failure', async (width) => {
    const {store}=await renderTestApp();
    await screen.findByTestId('overview-primary-checkin-cta');
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    await fireEvent.changeText(await screen.findByTestId('new-personal-profile-label'),'Reference entry harness');
    await fireEvent.press(screen.getByTestId('create-personal-profile-btn'));
    await waitFor(async()=>expect((await store.loadAppSnapshot()).active.profile.mode).toBe('personal'));
    await act(async () => { setViewport(width, 1100); });
    const card=await screen.findByTestId('settings-references-card');
    const write=jest.spyOn(store,'upsertPersonalReference');
    await fireEvent.press(within(card).getByText('Blood pressure'));
    expect(screen.getByTestId('reference-primary').props.value).toBe('');
    expect(screen.getByTestId('reference-secondary').props.value).toBe('');
    await fireEvent.changeText(screen.getByTestId('reference-primary'),'118');
    await fireEvent.press(within(card).getByText('Manual cuff'));
    await fireEvent.press(screen.getByTestId('save-reference'));
    expect(write).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('reference-secondary'),'76');
    await fireEvent.press(screen.getByTestId('save-reference'));
    expect(write).not.toHaveBeenCalled();
    await fireEvent.press(within(card).getByText('At rest'));
    await fireEvent.changeText(screen.getByTestId('reference-primary'),'118junk');
    await fireEvent.press(screen.getByTestId('save-reference'));expect(write).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('reference-primary'),'118');
    await fireEvent.press(screen.getByTestId('save-reference'));
    await waitFor(()=>expect(write).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(screen.getByTestId('reference-primary').props.value).toBe(''));
    const before=await store.loadAppSnapshot();expect(before.active.references[0]!.value).toEqual({kind:'blood_pressure',systolic:118,diastolic:76});
    write.mockRejectedValueOnce(new Error('simulated storage failure'));
    await fireEvent.changeText(screen.getByTestId('reference-primary'),'120.25');
    await fireEvent.changeText(screen.getByTestId('reference-secondary'),'80.75');
    await fireEvent.press(within(card).getByText('Manual cuff'));await fireEvent.press(within(card).getByText('At rest'));
    await fireEvent.press(screen.getByTestId('save-reference'));
    await screen.findByText(/Reference was not saved/);
    expect(screen.getByTestId('reference-primary').props.value).toBe('120.25');
    expect(screen.getByTestId('reference-secondary').props.value).toBe('80.75');
    expect((await store.loadAppSnapshot()).active.references).toEqual(before.active.references);
    await fireEvent.press(within(card).getByText('Sleep'));expect(screen.getByTestId('reference-primary').props.value).toBe('');
  });

  test('Phone shell (390x844): Overview -> ER-01 validation -> Review -> Saved -> Overview live update (12 entries)', async () => {
    await renderTestApp();

    const primaryCta = await screen.findByTestId('overview-primary-checkin-cta');
    expect(screen.getByText(/Continue check-in/)).toBeTruthy();
    expect(screen.getByText(/5 of 6 indicators logged · 11 committed entries/)).toBeTruthy();
    expect(screen.getAllByTestId(/^reading-card-/)).toHaveLength(6);
    const moodReading = screen.getByRole('button', { name: /^Mood\..*No reference\.$/ });
    expect(within(moodReading).getByText('No reference')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Blood glucose. Not logged.' })).toBeTruthy();

    // Phone bottom 5-tab bar + persistent >=48dp Help button
    expect(screen.getByTestId('phone-bottom-tabs')).toBeTruthy();
    expect(screen.queryByTestId('tablet-navigation-rail')).toBeNull();
    const helpBtn = screen.getByTestId('header-help-button');
    expect(helpBtn.props.accessibilityRole).toBe('button');
    expect(helpBtn.props.accessibilityLabel).toBe('Help');
    expect(flattenMinHeight(helpBtn.props.style)).toBeGreaterThanOrEqual(48);
    expect(flattenMinWidth(helpBtn.props.style)).toBeGreaterThanOrEqual(48);

    // Start / resume Blood Pressure draft
    await fireEvent.press(primaryCta);
    expect(await screen.findByTestId('draft-retained-banner')).toBeTruthy();

    // ER-01: missing Diastolic stays on Record stage, preserves Systolic, displays inline error summary
    await fireEvent.changeText(screen.getByTestId('input-primary'), '118');
    await fireEvent.changeText(screen.getByTestId('input-secondary'), '');
    await fireEvent.press(screen.getByTestId('checkin-review-button'));

    expect(await screen.findByTestId('checkin-error-summary')).toBeTruthy();
    expect(screen.getByTestId('input-primary').props.value).toBe('118');
    expect(screen.queryByTestId('checkin-review-card')).toBeNull();

    // Filling Diastolic completes paired entry and proceeds cleanly to Review -> Saved
    await fireEvent.changeText(screen.getByTestId('input-secondary'), '76');
    await fireEvent.press(screen.getByTestId('checkin-review-button'));

    const reviewCard = await screen.findByTestId('checkin-review-card');
    expect(within(reviewCard).getByText('118/76 mmHg')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('checkin-add-to-log'));
    const savedReceipt = await screen.findByTestId('checkin-saved-receipt');
    expect(savedReceipt).toBeTruthy();
    expect(within(savedReceipt).getByText('Added to your log')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('saved-to-overview'));
    expect(
      await screen.findByText(/5 of 6 indicators logged · 12 committed entries/),
    ).toBeTruthy();
  });

  test('Tablet rail (768x1024 >=88dp), keyboard collapse on Check-in, unit conversion confirmation, sleep 0h 0m & mood prompt', async () => {
    const keyboardListeners: Record<string, Array<(e: unknown) => void>> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: (e: unknown) => void) => {
      keyboardListeners[event] = keyboardListeners[event] ?? [];
      keyboardListeners[event].push(cb);
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);

    setViewport(768, 1024, 2, 1);

    await renderTestApp();
    const rail = await screen.findByTestId('tablet-navigation-rail');
    expect(rail).toBeTruthy();
    expect(screen.queryByTestId('phone-bottom-tabs')).toBeNull();
    const overviewRailTab = screen.getByTestId('rail-overview');
    expect(overviewRailTab.props.accessibilityRole).toBe('tab');
    expect(flattenMinWidth(overviewRailTab.props.style)).toBeGreaterThanOrEqual(88);
    expect(flattenMinHeight(overviewRailTab.props.style)).toBeGreaterThanOrEqual(48);

    // Enter Check-in from tablet rail, then switch viewport to phone to verify keyboard collapse
    await fireEvent.press(screen.getByTestId('rail-checkin'));
    await screen.findByTestId('checkin-sticky-dock');
    await act(async () => {
      setViewport(390, 844, 3, 1);
    });
    expect(await screen.findByTestId('phone-bottom-tabs')).toBeTruthy();

    await act(async () => {
      for (const cb of keyboardListeners.keyboardDidShow ?? []) {
        cb({ endCoordinates: { height: 280, width: 390, screenX: 0, screenY: 564 } });
      }
    });
    expect(screen.queryByTestId('phone-bottom-tabs')).toBeNull();
    expect(screen.getByTestId('checkin-sticky-dock')).toBeTruthy();

    await act(async () => {
      for (const cb of keyboardListeners.keyboardDidHide ?? []) {
        cb({ endCoordinates: { height: 0, width: 390, screenX: 0, screenY: 844 } });
      }
    });
    expect(screen.getByTestId('phone-bottom-tabs')).toBeTruthy();

    // Blood glucose unit change modal (populated value triggers Cancel / Convert / Clear)
    await fireEvent.press(screen.getByTestId('metric-chip-blood_glucose'));
    await fireEvent.press(await screen.findByTestId('unit-chip-mmol/L'));
    await fireEvent.changeText(screen.getByTestId('input-primary'), '5.4');
    await fireEvent.press(screen.getByTestId('unit-chip-mg/dL'));

    expect(await screen.findByTestId('unit-change-cancel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('unit-change-cancel'));
    expect(screen.getByTestId('input-primary').props.value).toBe('5.4');

    await fireEvent.press(screen.getByTestId('unit-chip-mg/dL'));
    await fireEvent.press(await screen.findByTestId('unit-change-convert'));
    await waitFor(() => {
      expect(screen.getByTestId('input-primary').props.value).toBe('97.3');
    });

    // Sleep "Reported no sleep" -> 0h 0m accepted cleanly on Review
    await fireEvent.press(screen.getByTestId('metric-chip-sleep'));
    await fireEvent.press(await screen.findByTestId('sleep-reported-none-chip'));
    await fireEvent.press(screen.getByTestId('checkin-review-button'));
    const reviewCard = await screen.findByTestId('checkin-review-card');
    expect(within(reviewCard).getByText('0h 0m (Reported no sleep)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('checkin-back-to-edit'));

    // Mood unselected asks custom question
    await fireEvent.press(screen.getByTestId('metric-chip-mood'));
    await fireEvent.press(await screen.findByTestId('checkin-review-button'));
    expect(await screen.findByText('How is your mood right now?')).toBeTruthy();
  });

  test.each([[390, 844, 1], [768, 1024, 2]])('Getting started works at %ipx and returns to an unchanged draft', async (width, height, fontScale) => {
    setViewport(width, height, 2, fontScale);
    const back = jest.spyOn(ReactNative.BackHandler, 'addEventListener');
    const { io } = await renderTestApp();
    const gettingStarted = await screen.findByRole('button', { name: 'Getting started' });
    expect(flattenMinHeight(gettingStarted.props.style)).toBeGreaterThanOrEqual(48);
    expect(flattenMinWidth(gettingStarted.props.style)).toBeGreaterThanOrEqual(48);
    await fireEvent.press(gettingStarted);
    expect(screen.getByRole('header', { name: 'Getting started' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Reports preview' }));
    expect(await screen.findByText(/Filtered report preview/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Getting started' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Return to previous screen' }));
    expect(await screen.findByText(/11 committed entries/)).toBeTruthy();
    expect(io.savedFiles).toHaveLength(0);
    expect(io.sharedFiles).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('overview-primary-checkin-cta'));
    await fireEvent.press(await screen.findByTestId('metric-chip-blood_glucose'));
    await fireEvent.press(await screen.findByTestId('unit-chip-mmol/L'));
    await fireEvent.changeText(screen.getByTestId('input-primary'), '5.4');
    await fireEvent.press(screen.getByTestId('header-help-button'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Getting started' }));
    const hardwareBack = back.mock.lastCall?.[1];
    expect(hardwareBack).toBeDefined();
    await act(async () => { expect(hardwareBack?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true); });
    expect((await screen.findByTestId('input-primary')).props.value).toBe('5.4');
    expect(screen.getByTestId('unit-chip-mmol/L').props.accessibilityState.selected).toBe(true);
  });

  test('Persistent Help mid-draft, theme switching preservation, Unavailable modal, & load failure Help path', async () => {
    await renderTestApp();
    await screen.findByTestId('overview-primary-checkin-cta');

    // Type unfinished Heart Rate draft, jump to Help offline & toggle fixture banner
    await fireEvent.press(screen.getByTestId('tab-checkin'));
    await fireEvent.press(await screen.findByTestId('metric-chip-heart_rate'));
    await fireEvent.changeText(await screen.findByTestId('input-primary'), '68');

    await fireEvent.press(screen.getByTestId('header-help-button'));
    expect(await screen.findByTestId('help-procedure-card')).toBeTruthy();
    expect(screen.getByText('Open check-in preserved')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('help-mode-fixture'));
    expect(await screen.findByTestId('help-fixture-banner')).toBeTruthy();
    expect(screen.getByText('Example procedure card · Test fixture')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('help-back-button'));
    expect((await screen.findByTestId('input-primary')).props.value).toBe('68');

    // Light/Dark switch preserves draft value on Check-in
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    await fireEvent.press(await screen.findByTestId('appearance-light'));
    expect(await screen.findByText(/Resolved: Vercel Light/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-checkin'));
    expect((await screen.findByTestId('input-primary')).props.value).toBe('68');

    // Unavailable workflow event commits zero fake entries
    await fireEvent.press(screen.getByTestId('checkin-unavailable-button'));
    await fireEvent.press(await screen.findByTestId('confirm-skip-unavailable'));
    const skipOutcome = await screen.findByTestId('checkin-skip-outcome');
    expect(within(skipOutcome).getByText(/No measurements added in this check-in\./)).toBeTruthy();
  });

  test('opens cached radiation research before handing the exact URL to the browser', async () => {
    const openExternalUrl = jest.fn<PlatformIoAdapter['openExternalUrl']>(async () => ({
      ok: false,
      message: 'No external browser handler is available for this link. Copy the URL instead.',
    }));
    const copyToClipboard = jest.fn<PlatformIoAdapter['copyToClipboard']>(async () => true);
    const io = createMockIo({ openExternalUrl, copyToClipboard });
    await renderTestApp({ io });
    await screen.findByTestId('overview-primary-checkin-cta');
    await fireEvent.press(screen.getByTestId('tab-explorer'));
    await fireEvent.press(await screen.findByRole('button', { name: 'CSA radiation monitoring' }));

    const card = await screen.findByTestId('source-card-csa-radiation-monitoring');
    expect(within(card).getByText('Canadian Space Agency · Version 1')).toBeTruthy();
    expect(within(card).getByText(/CrewSignal check-ins leave radiation exposure unassessed/)).toBeTruthy();
    expect(openExternalUrl).not.toHaveBeenCalled();
    const url = 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp';
    await fireEvent.press(within(card).getByTestId('open-source-csa-radiation-monitoring'));
    expect(openExternalUrl).toHaveBeenCalledWith(url);
    const status = await screen.findByTestId('sources-link-status');
    expect(within(status).getByText(/No external browser handler/)).toBeTruthy();
    await fireEvent.press(within(card).getByRole('button', { name: 'Copy source URL' }));
    expect(copyToClipboard).toHaveBeenCalledWith(url);
  });

  test('Explorer diagram/list sync, Trends 7/30d & Table, Sources linking, Reports save/share/print/CSV, & Personal blank isolation', async () => {
    const io = createMockIo();
    await renderTestApp({ io });
    await screen.findByTestId('overview-primary-checkin-cta');

    // Explorer: Musculoskeletal not assessed & Immune context-only preserved across List switch
    await fireEvent.press(screen.getByTestId('tab-explorer'));
    await fireEvent.press(await screen.findByTestId('diagram-node-musculoskeletal'));
    expect(await screen.findByTestId('system-not-assessed-banner')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('explorer-view-list'));
    expect(screen.getByTestId('explorer-system-list')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('explorer-list-item-immune_context'));
    expect(await screen.findByTestId('immune-context-banner')).toBeTruthy();

    // Trends: Chart/Table & sparse 30d + Blood Glucose empty state
    await fireEvent.press(screen.getByTestId('tab-trends'));
    expect(await screen.findByTestId('trends-chart-panel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('trends-range-30d'));
    await fireEvent.press(screen.getByTestId('trends-mode-table'));
    expect(await screen.findByTestId('trends-table-panel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('trends-metric-blood_glucose'));
    expect(await screen.findByTestId('trends-empty-banner')).toBeTruthy();

    // Sources: View original source triggers Linking wrapper safely offline
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-sources'));
    const sourceButtons = await screen.findAllByText('View original source');
    await fireEvent.press(sourceButtons[0]!);
    expect(await screen.findByTestId('sources-link-status')).toBeTruthy();
    expect(io.openedUrls.length).toBe(1);

    // Reports: live count = 10 -> save JSON, share sheet, A4 light HTML print, 5-row CSV staged review
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-reports'));
    const previewCard = await screen.findByTestId('reports-preview-card');
    expect(within(previewCard).getByText('10 observations')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('export-report-json'));
    await waitFor(() => expect(io.savedFiles.length).toBe(1));
    expect(screen.getByTestId('reports-file-outcome')).toBeTruthy();
    expect(screen.getByText('File saved')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('share-report-btn'));
    await waitFor(() => expect(io.sharedFiles.length).toBe(1));
    expect(screen.getByText('Share sheet opened')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('print-a4-btn'));
    await waitFor(() => expect(io.printedHtml.length).toBe(1));
    expect(io.printedHtml[0]).toMatch(/#ffffff/i);

    await fireEvent.press(screen.getByTestId('load-csv-fixture-button'));
    expect(await screen.findByTestId('csv-ack-exclusions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('csv-ack-exclusions'));
    await fireEvent.press(await screen.findByTestId('csv-conflict-import-obs-sim01-bp-01'));
    await fireEvent.press(screen.getByTestId('csv-commit-button'));
    const importMatches = await screen.findAllByText(
      /Imported 2 new and 1 updated rows \(2 skipped\/excluded\)\./,
    );
    expect(importMatches.length).toBeGreaterThanOrEqual(1);

    // Settings: create blank Personal profile (0 entries, real clock) + scoped demo reset
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    await fireEvent.changeText(
      await screen.findByTestId('new-personal-profile-label'),
      'Commander Test',
    );
    await fireEvent.press(screen.getByTestId('create-personal-profile-btn'));
    await screen.findByText(/Created blank personal log "Commander Test"/);

    await fireEvent.press(screen.getByTestId('tab-overview'));
    expect(await screen.findByText('No entries yet')).toBeTruthy();
    expect(screen.getByText(/0 of 6 indicators logged · 0 committed entries/)).toBeTruthy();
  });

  test('ER-04/S10: a draft the device refused to save survives a restore that changes profiles', async () => {
    const { store } = await renderTestApp();

    // Personal profile with a blood pressure draft.
    await fireEvent.press(await screen.findByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    await fireEvent.changeText(
      await screen.findByTestId('new-personal-profile-label'),
      'Commander Vega',
    );
    await fireEvent.press(screen.getByTestId('create-personal-profile-btn'));
    await screen.findByText(/Created blank personal log "Commander Vega"/);
    const personalId = (await store.loadAppSnapshot()).active.profile.profileId;

    // Every draft write is refused from here on, so device storage never holds
    // these values: the screen is the only copy.
    const saveSpy = jest
      .spyOn(store, 'saveDraft')
      .mockRejectedValue(new Error('SQLITE_FULL: database or disk is full'));

    await fireEvent.press(screen.getByTestId('tab-checkin'));
    await fireEvent.press(await screen.findByTestId('metric-chip-blood_pressure'));
    await fireEvent.changeText(await screen.findByTestId('input-primary'), '129');
    await fireEvent.changeText(screen.getByTestId('input-secondary'), '83');
    await fireEvent.press(screen.getByTestId('checkin-review-button'));

    const reviewCard = await screen.findByTestId('checkin-review-card');
    expect(within(reviewCard).getByText('129/83 mmHg')).toBeTruthy();
    // The failed write is surfaced, with a recovery export.
    expect(screen.getByTestId('draft-memory-only-banner')).toBeTruthy();
    expect((await store.loadAppSnapshot()).active.drafts).toHaveLength(0);

    // Storage works again; the following restore can succeed.
    saveSpy.mockRestore();
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-reports'));
    await fireEvent.press(await screen.findByText('Load Backup Sample'));
    expect(await screen.findByTestId('restore-unretained-draft')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    await screen.findByText(/Restored ".*" cleanly into SQLite storage\./);
    expect((await store.loadAppSnapshot()).active.profile.profileId).not.toBe(personalId);

    // Back on Commander Vega, the draft resumes at Review with its values.
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    await fireEvent.press(await screen.findByTestId(`profile-chip-${personalId}`));
    await fireEvent.press(screen.getByTestId('tab-checkin'));
    const resumed = await screen.findByTestId('checkin-review-card');
    expect(within(resumed).getByText('129/83 mmHg')).toBeTruthy();
  });

  async function createPersonal(label: string, store: CrewSignalSqliteStore): Promise<string> {
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    await fireEvent.changeText(await screen.findByTestId('new-personal-profile-label'), label);
    await fireEvent.press(screen.getByTestId('create-personal-profile-btn'));
    await screen.findByText(new RegExp(`Created blank personal log "${label}"`));
    return (await store.loadAppSnapshot()).active.profile.profileId;
  }

  async function switchProfile(store: CrewSignalSqliteStore, profileId: string) {
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    await fireEvent.press(await screen.findByTestId(`profile-chip-${profileId}`));
    await waitFor(async () =>
      expect((await store.loadAppSnapshot()).active.profile.profileId).toBe(profileId),
    );
  }

  async function openBpReview(sys: string, dia: string, note?: string) {
    await fireEvent.press(screen.getByTestId('tab-checkin'));
    await fireEvent.press(await screen.findByTestId('metric-chip-blood_pressure'));
    await fireEvent.changeText(await screen.findByTestId('input-primary'), sys);
    await fireEvent.changeText(screen.getByTestId('input-secondary'), dia);
    if (note) await fireEvent.changeText(screen.getByTestId('checkin-note-input'), note);
    await fireEvent.press(screen.getByTestId('checkin-review-button'));
    return screen.findByTestId('checkin-review-card');
  }

  async function countDrafts(store: CrewSignalSqliteStore, profileId: string) {
    return (await store.loadProfileSnapshot(profileId)).drafts.length;
  }

  async function countObservations(store: CrewSignalSqliteStore, profileId: string) {
    return (await store.loadProfileSnapshot(profileId)).observations.length;
  }

  test('S05/G04: retains a flagged Review with its own profile and confirms one save', async () => {
    const { store } = await renderTestApp();
    const personalId = await createPersonal('Commander Recheck', store);
    const demoId = (await store.loadAppSnapshot()).profiles.find((p) => p.mode !== 'personal')!.profileId;
    await fireEvent.press(screen.getByTestId('tab-checkin'));
    await fireEvent.press(await screen.findByTestId('metric-chip-heart_rate'));
    await fireEvent.changeText(await screen.findByTestId('input-primary'), '350oops');
    await fireEvent.press(screen.getByTestId('checkin-review-button'));
    expect(await screen.findByTestId('checkin-error-summary')).toBeTruthy();
    expect(await countObservations(store, personalId)).toBe(0);

    await fireEvent.changeText(screen.getByTestId('input-primary'), '350');
    await fireEvent.press(screen.getByTestId('checkin-review-button'));
    const flag = await screen.findByTestId('checkin-needs-recheck');
    await waitFor(() => expect(flag.props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(flag);
    await waitFor(async () => {
      expect((await store.loadProfileSnapshot(personalId)).drafts[0]?.quality).toBe('questionable');
    });
    await switchProfile(store, demoId);
    await switchProfile(store, personalId);
    await fireEvent.press(screen.getByTestId('tab-checkin'));
    expect((await screen.findByTestId('checkin-needs-recheck')).props.accessibilityState.selected).toBe(true);

    const commit = store.commitDraftObservation.bind(store);
    jest.spyOn(store, 'commitDraftObservation').mockImplementationOnce((params) =>
      commit({ ...params, simulateFailureMode: 'lost_ack' }),
    );
    const add = screen.getByTestId('checkin-add-to-log');
    await waitFor(() => expect(add.props.accessibilityState.disabled).toBe(false));
    await fireEvent.press(add);
    await fireEvent.press(await screen.findByText('Check log now'));
    const receipt = await screen.findByTestId('checkin-saved-receipt');
    expect(within(receipt).getByText(/350 bpm.*Needs recheck/)).toBeTruthy();
    const { observations, drafts } = await store.loadProfileSnapshot(personalId);
    expect(observations).toEqual([expect.objectContaining({
      quality: 'questionable', qualityNote: null,
      entered: expect.objectContaining({ value: 350, unit: 'bpm' }),
    })]);
    expect(drafts).toHaveLength(0);
    await fireEvent.press(screen.getByText('Log a new reading'));
    expect((await screen.findByTestId('input-primary')).props.value).toBe('');
  });

  test.each(['confirmed add', 'verified Already in your log'] as const)(
    'V02/G04: a %s closes the draft, so a profile switch cannot write it back',
    async (path) => {
      const { store } = await renderTestApp();
      const personalId = await createPersonal('Commander Rhee', store);
      const demoId = (await store.loadAppSnapshot()).profiles.find((p) => p.mode !== 'personal')!
        .profileId;

      const review = await openBpReview('129', '83');
      expect(within(review).getByText('129/83 mmHg')).toBeTruthy();

      if (path === 'confirmed add') {
        await fireEvent.press(screen.getByTestId('checkin-add-to-log'));
      } else {
        // The insert lands but its acknowledgement is lost; Check log now verifies it.
        const orig = store.commitDraftObservation.bind(store);
        const spy = jest
          .spyOn(store, 'commitDraftObservation')
          .mockImplementationOnce((p) => orig({ ...p, simulateFailureMode: 'lost_ack' }));
        await fireEvent.press(screen.getByTestId('checkin-add-to-log'));
        await screen.findByTestId('commit-unknown-banner');
        spy.mockRestore();
        await fireEvent.press(screen.getByText('Check log now'));
      }
      await screen.findByTestId('checkin-saved-receipt');
      expect(await countObservations(store, personalId)).toBe(1);

      await switchProfile(store, demoId);
      expect(await countDrafts(store, personalId)).toBe(0);
      await switchProfile(store, personalId);
      expect(await countDrafts(store, personalId)).toBe(0);

      // Check-in starts fresh: no stale 129/83 Review comes back.
      await fireEvent.press(screen.getByTestId('tab-checkin'));
      expect(screen.queryByText('129/83 mmHg')).toBeNull();

      const second = await openBpReview('132', '84');
      expect(within(second).getByText('132/84 mmHg')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('checkin-add-to-log'));
      await screen.findByTestId('checkin-saved-receipt');
      expect(screen.queryByText(/Already in your log/)).toBeNull();
      expect(await countObservations(store, personalId)).toBe(2);
    },
  );

  test.each(['retained', 'memory-only'] as const)(
    'S10/G07: replacing an inactive profile names its %s draft, survives cancel and rollback, then clears it',
    async (mode) => {
      const io = createMockIo();
      const { store } = await renderTestApp({ io });
      const aId = await createPersonal('Commander Alpha', store);

      const refuse = () =>
        jest.spyOn(store, 'saveDraft').mockRejectedValue(new Error('SQLITE_FULL'));
      let saveSpy = mode === 'memory-only' ? refuse() : null;
      await openBpReview('129', '83', 'private alpha note');
      const bId = await createPersonal('Commander Bravo', store);
      expect((await store.loadAppSnapshot()).active.profile.profileId).toBe(bId);
      expect(await countDrafts(store, aId)).toBe(mode === 'retained' ? 1 : 0);

      // Bravo has its own draft that must survive Alpha's replacement.
      saveSpy?.mockRestore();
      await openBpReview('118', '76');
      await waitFor(async () => expect(await countDrafts(store, bId)).toBe(1));
      if (mode === 'memory-only') saveSpy = refuse();

      await fireEvent.press(screen.getByTestId('tab-more'));
      await fireEvent.press(await screen.findByTestId('more-nav-reports'));
      await fireEvent.press(await screen.findByText('Load Backup Sample'));
      await fireEvent.press(await screen.findByTestId('restore-dest-replace'));
      await fireEvent.press(await screen.findByText('Commander Alpha'));

      const notice = await screen.findByTestId('restore-replace-draft');
      expect(
        within(notice).getByText(/Replacing Commander Alpha removes its open draft/),
      ).toBeTruthy();
      // Bravo's draft is retained in storage, so there is no unretained notice for it.
      expect(screen.queryByTestId('restore-unretained-draft')).toBeNull();

      // The recovery export carries Alpha's values but not the private note.
      await fireEvent.press(within(notice).getByText('Export draft backup'));
      await waitFor(() => expect(io.savedFiles).toHaveLength(1));
      const bytes = io.savedFiles[0]?.content ?? '';
      const exported = JSON.parse(bytes);
      expect(exported.profileId).toBe(aId);
      expect(exported.includeNotes).toBe(false);
      expect(exported.draft.note).toBe('');
      expect(bytes).toContain('129');
      expect(bytes).not.toContain('private alpha note');

      // Cancel keeps everything.
      await fireEvent.press(screen.getByTestId('execute-restore-btn'));
      expect(await screen.findByText(/Overwriting "Commander Alpha".*its open draft/)).toBeTruthy();
      await fireEvent.press(screen.getByText('Cancel'));
      expect(await countDrafts(store, aId)).toBe(mode === 'retained' ? 1 : 0);
      expect(await screen.findByTestId('restore-replace-draft')).toBeTruthy();

      // A rolled-back replace keeps Alpha's and Bravo's drafts.
      const origRestore = store.restoreBackupBundle.bind(store);
      const restoreSpy = jest
        .spyOn(store, 'restoreBackupBundle')
        .mockImplementation((p) => origRestore({ ...p, simulateWriteFailure: true }));
      await fireEvent.press(screen.getByTestId('execute-restore-btn'));
      await fireEvent.press(await screen.findByTestId('confirm-destructive-action'));
      await screen.findByText(/Nothing was changed/);
      expect(await countDrafts(store, aId)).toBe(mode === 'retained' ? 1 : 0);
      expect(await countDrafts(store, bId)).toBe(1);
      expect(await screen.findByTestId('restore-replace-draft')).toBeTruthy();
      restoreSpy.mockRestore();

      // The confirmed replace removes Alpha's draft everywhere and keeps Bravo's.
      await fireEvent.press(screen.getByTestId('execute-restore-btn'));
      await fireEvent.press(await screen.findByTestId('confirm-destructive-action'));
      await screen.findByText(/Restored ".*" cleanly into SQLite storage\..*open draft was removed/);
      expect(await countDrafts(store, aId)).toBe(0);
      expect(await countDrafts(store, bId)).toBe(1);

      await switchProfile(store, aId);
      await fireEvent.press(screen.getByTestId('tab-checkin'));
      expect(screen.queryByText('129/83 mmHg')).toBeNull();
      expect(screen.queryByTestId('checkin-review-card')).toBeNull();
      expect(await countDrafts(store, aId)).toBe(0);
      saveSpy?.mockRestore();
    },
  );

  test('ERROR-RECOVERY: Check-in draft recovery export leaves the private note out', async () => {
    const io = createMockIo();
    const { store } = await renderTestApp({ io });
    await createPersonal('Commander Note', store);
    await openBpReview('129', '83', 'secret crew note');
    await fireEvent.press(screen.getByText('Export uncommitted draft backup'));
    await waitFor(() => expect(io.savedFiles).toHaveLength(1));
    const bytes = io.savedFiles[0]?.content ?? '';
    expect(bytes).not.toContain('secret crew note');
    expect(JSON.parse(bytes)).toMatchObject({ includeNotes: false, draft: { note: '' } });
  });

  /** Alpha (inactive): one logged reading with a note, plus an open draft. Bravo is active. */
  async function setUpReplaceTargets(store: CrewSignalSqliteStore) {
    const aId = await createPersonal('Commander Alpha', store);
    await openBpReview('121', '79', 'alpha logged note');
    await fireEvent.press(screen.getByTestId('checkin-add-to-log'));
    await screen.findByTestId('checkin-saved-receipt');
    await fireEvent.press(screen.getByText('Add another measurement'));
    await openBpReview('129', '83', 'private alpha note');
    await waitFor(async () => expect(await countDrafts(store, aId)).toBe(1));
    const bId = await createPersonal('Commander Bravo', store);
    await openBpReview('141', '91', 'bravo logged note');
    await fireEvent.press(screen.getByTestId('checkin-add-to-log'));
    await screen.findByTestId('checkin-saved-receipt');
    // Settle Alpha's reference lock as a profile switch would, then take the
    // baseline every blocked replacement must leave exactly as it is.
    await store.loadProfileSnapshot(aId);
    await store.loadProfileSnapshot(bId);
    const alpha = await profileRecords(store, aId);
    const bravo = await profileRecords(store, bId);
    return { aId, bId, alpha, bravo };
  }

  /** Every SQLite table of a profile, read without the fallback-reference lock. */
  async function profileRecords(store: CrewSignalSqliteStore, profileId: string) {
    return store.loadProfileSnapshot(profileId, { lockReferences: false });
  }

  async function expectRecordsKept(
    store: CrewSignalSqliteStore,
    before: { aId: string; bId: string; alpha: unknown; bravo: unknown },
  ) {
    expect(await profileRecords(store, before.aId)).toEqual(before.alpha);
    expect(await profileRecords(store, before.bId)).toEqual(before.bravo);
    expect(await countObservations(store, before.aId)).toBe(1);
    expect(await countDrafts(store, before.aId)).toBe(1);
  }

  /** Reports → sample backup → Replace, with the default (active) target's preview settled. */
  async function openReplaceRestore() {
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-reports'));
    await fireEvent.press(await screen.findByText('Load Backup Sample'));
    await fireEvent.press(await screen.findByTestId('restore-dest-replace'));
    await waitFor(() => expect(screen.queryByTestId('restore-preview-pending')).toBeNull());
  }

  /** Pressing Replace while it is off must not open the confirmation. */
  async function expectReplaceBlocked() {
    expect(screen.getByTestId('execute-restore-btn').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    expect(screen.queryByText('Confirm replace profile')).toBeNull();
    expect(screen.queryByText(/Overwriting "/)).toBeNull();
  }

  test('S10/G07: Replace stays off while the target preview is delayed or failed, ignores late results, and retries', async () => {
    const io = createMockIo();
    const { store } = await renderTestApp({ io });
    const base = await setUpReplaceTargets(store);
    const { aId, bId } = base;
    await openReplaceRestore();
    const realLoad = store.loadProfileDrafts.bind(store);
    const lookup = jest.spyOn(store, 'loadProfileDrafts');

    // 1. Delayed read: pending, Replace and the recovery export stay off.
    let releaseAlpha: (drafts: Awaited<ReturnType<typeof realLoad>>) => void = () => {};
    lookup.mockImplementationOnce(
      () => new Promise((resolve) => { releaseAlpha = resolve; }),
    );
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    expect(await screen.findByTestId('restore-preview-pending')).toBeTruthy();
    expect(screen.queryByTestId('restore-replace-draft')).toBeNull();
    expect(screen.queryByText('Export draft backup')).toBeNull();
    await expectReplaceBlocked();
    await expectRecordsKept(store, base);
    expect(io.savedFiles).toHaveLength(0);
    const alphaDrafts = await realLoad(aId);
    await act(async () => releaseAlpha(alphaDrafts));
    expect(await screen.findByTestId('restore-replace-draft')).toBeTruthy();
    expect(screen.queryByTestId('restore-preview-pending')).toBeNull();

    // 2. Switch targets while Alpha's read is pending: its late answer is ignored,
    //    and the confirmation and write use the target that was previewed.
    await fireEvent.press(screen.getByTestId(`restore-target-${bId}`));
    await waitFor(() => expect(screen.queryByTestId('restore-preview-pending')).toBeNull());
    let releaseLate: (drafts: Awaited<ReturnType<typeof realLoad>>) => void = () => {};
    lookup.mockImplementationOnce(
      () => new Promise((resolve) => { releaseLate = resolve; }),
    );
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    expect(await screen.findByTestId('restore-preview-pending')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`restore-target-${bId}`));
    await waitFor(() => expect(screen.queryByTestId('restore-preview-pending')).toBeNull());
    await act(async () => releaseLate(alphaDrafts));
    expect(screen.queryByTestId('restore-replace-draft')).toBeNull();
    expect(screen.queryByText(/Replacing Commander Alpha/)).toBeNull();
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    expect(await screen.findByText(/Overwriting "Commander Bravo"/)).toBeTruthy();
    expect(screen.queryByText(/Overwriting "Commander Alpha"/)).toBeNull();
    await fireEvent.press(screen.getByText('Cancel'));
    await expectRecordsKept(store, base);

    // 3. Failed read: a retry is offered and nothing can be replaced or exported.
    lookup.mockRejectedValueOnce(new Error('SQLITE_IOERR'));
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    const failed = await screen.findByTestId('restore-preview-failed');
    expect(within(failed).getByText(/Couldn't check Commander Alpha/)).toBeTruthy();
    expect(screen.queryByTestId('restore-replace-draft')).toBeNull();
    await expectReplaceBlocked();
    await expectRecordsKept(store, base);
    expect(io.savedFiles).toHaveLength(0);

    // 4. Retry succeeds: the preview names Alpha's draft and Replace opens for Alpha.
    await fireEvent.press(within(failed).getByText('Try again'));
    expect(await screen.findByTestId('restore-replace-draft')).toBeTruthy();
    expect(screen.queryByTestId('restore-preview-failed')).toBeNull();
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    expect(await screen.findByText(/Overwriting "Commander Alpha".*its open draft/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel'));
    await expectRecordsKept(store, base);
    lookup.mockRestore();
  });

  test('S10/G07: the safety backup holds the inactive target profile and counts only a written file', async () => {
    const io = createMockIo();
    const { store } = await renderTestApp({ io });
    const base = await setUpReplaceTargets(store);
    const { aId, bId } = base;
    await openReplaceRestore();
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    const notice = await screen.findByTestId('restore-replace-draft');

    // Draft recovery is separate: Alpha's draft, without its private note.
    await fireEvent.press(within(notice).getByText('Export draft backup'));
    await waitFor(() => expect(io.savedFiles).toHaveLength(1));
    const draftBytes = io.savedFiles[0]?.content ?? '';
    const draftFile = JSON.parse(draftBytes);
    expect(draftFile.kind).toBe('crewsignal-draft-recovery');
    expect(draftFile.profileId).toBe(aId);
    expect(draftFile.includeNotes).toBe(false);
    expect(draftFile.draft.note).toBe('');
    expect(draftBytes).toContain('129');
    expect(draftBytes).not.toContain('private alpha note');
    expect(draftBytes).not.toContain('141');

    const openConfirmation = async () => {
      await fireEvent.press(screen.getByTestId('execute-restore-btn'));
      return screen.findByText(/Overwriting "Commander Alpha"/);
    };
    const notSavedYet = /No safety backup of Commander Alpha yet/;
    const expectSafetyStatus = (re: RegExp) =>
      waitFor(() => expect(screen.getByTestId('safety-backup-status').props.children).toMatch(re));

    // Without explicit consent the safety backup does nothing.
    expect((await openConfirmation()).props.children).toMatch(notSavedYet);
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    expect(io.savedFiles).toHaveLength(1);

    // A cancelled write is not a safety backup.
    const save = jest.spyOn(io, 'saveTextFile');
    save.mockResolvedValueOnce({ outcome: 'cancelled', label: 'Save cancelled', detail: 'No file was written.' });
    await fireEvent.press(screen.getByTestId('safety-backup-consent'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectSafetyStatus(/Safety backup not saved for Commander Alpha\. Save cancelled/);
    expect(screen.getByText(notSavedYet)).toBeTruthy();
    expect(screen.queryByText(/Safety backup saved/)).toBeNull();

    // A failed write is not a safety backup either.
    save.mockResolvedValueOnce({ outcome: 'write_failed', label: 'Save failed', detail: 'Device storage refused the file.' });
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectSafetyStatus(/Safety backup not saved for Commander Alpha\. Save failed/);
    expect(screen.queryByText(/Safety backup saved/)).toBeNull();

    // A write that throws is not one either.
    save.mockRejectedValueOnce(new Error('EIO'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectSafetyStatus(/Safety backup not saved for Commander Alpha\. The file could not be written/);
    expect(screen.queryByText(/Safety backup saved/)).toBeNull();
    save.mockRestore();
    expect(io.savedFiles).toHaveLength(1);
    await fireEvent.press(screen.getByText('Cancel'));
    await expectRecordsKept(store, base);

    // A full backup of the active profile (Bravo) does not count for Alpha.
    await fireEvent.press(screen.getByTestId('backup-confirm-all'));
    await fireEvent.press(screen.getByTestId('save-backup-json'));
    await waitFor(() => expect(io.savedFiles).toHaveLength(2));
    expect(JSON.parse(io.savedFiles[1]?.content ?? '{}').profile.profileId).toBe(bId);
    expect((await openConfirmation()).props.children).toMatch(notSavedYet);
    expect(screen.queryByText(/Safety backup saved/)).toBeNull();
    // Consent is asked again each time the confirmation opens.
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    expect(io.savedFiles).toHaveLength(2);

    // With consent, the written file is Alpha's full data, private notes included.
    await fireEvent.press(screen.getByTestId('safety-backup-consent'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await waitFor(() => expect(io.savedFiles).toHaveLength(3));
    const safety = io.savedFiles[2]!;
    expect(safety.filename).toBe(`crewsignal-backup-${aId}.json`);
    const backup = JSON.parse(safety.content);
    expect(backup.kind).toBe('crewsignal-backup');
    expect(backup.confirmedFullProfileData).toBe(true);
    expect(backup.profile.profileId).toBe(aId);
    expect(backup.profile.label).toBe('Commander Alpha');
    expect(backup.observations).toHaveLength(1);
    expect(backup.observations.every((o: { profileId: string }) => o.profileId === aId)).toBe(true);
    expect(safety.content).toContain('alpha logged note');
    expect(safety.content).not.toContain('bravo logged note');
    expect(safety.content).not.toContain(bId);
    expect(backup.preferences.activeProfileId).toBe(aId);
    // Every table in the file is exactly what SQLite holds for Alpha.
    const stored = base.alpha as Awaited<ReturnType<typeof profileRecords>>;
    expect(backup.observations).toEqual(stored.observations);
    expect(backup.checkInEvents).toEqual(stored.checkInEvents);
    expect(backup.references).toEqual(stored.references);
    expect(backup.insights).toEqual(stored.insights);
    for (const key of ['checkInEvents', 'references', 'insights'] as const) {
      expect(backup[key].every((r: { profileId: string }) => r.profileId === aId)).toBe(true);
    }
    expect(await screen.findByText(/Safety backup saved for Commander Alpha at /)).toBeTruthy();
    await expectRecordsKept(store, base);

    // The confirmed write goes to the previewed target only.
    await fireEvent.press(screen.getByTestId('confirm-destructive-action'));
    await screen.findByText(/Restored ".*" cleanly into SQLite storage\..*open draft was removed/);
    expect(await countDrafts(store, aId)).toBe(0);
    expect(await countObservations(store, bId)).toBe(1);
  });

  test('S10/G07: Replace waits for the safety backup read and write, and the file keeps the original records', async () => {
    const io = createMockIo();
    const { store } = await renderTestApp({ io });
    const base = await setUpReplaceTargets(store);
    const { aId, bId } = base;
    const stored = base.alpha as Awaited<ReturnType<typeof profileRecords>>;
    await openReplaceRestore();
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    await screen.findByTestId('restore-replace-draft');
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    await screen.findByText(/Overwriting "Commander Alpha"/);
    const confirmButton = () => screen.getByTestId('confirm-destructive-action');
    const expectStatus = (re: RegExp) =>
      waitFor(() => expect(screen.getByTestId('safety-backup-status').props.children).toMatch(re));
    /**
     * The press handler of a button as rendered now. Running two of these in one
     * act() presses both in the same tick, before React re-renders either button
     * as disabled, so only the synchronous guards can refuse the second press.
     */
    type PressFiber = { memoizedProps?: { onPress?: unknown }; return?: PressFiber | null };
    const pressHandlerNow = (testID: string): (() => void) => {
      let fiber = (screen.getByTestId(testID) as unknown as { unstable_fiber?: PressFiber }).unstable_fiber ?? null;
      while (fiber) {
        const onPress = fiber.memoizedProps?.onPress;
        if (typeof onPress === 'function') return () => void (onPress as (e: unknown) => unknown)({});
        fiber = fiber.return ?? null;
      }
      throw new Error(`no press handler for ${testID}`);
    };
    /** While the backup runs, confirming must not touch SQLite. */
    const expectReplaceHeld = async () => {
      expect(screen.getByTestId('safety-backup-progress')).toBeTruthy();
      expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
      expect(screen.getByTestId('save-safety-backup').props.accessibilityState).toMatchObject({ disabled: true });
      await fireEvent.press(confirmButton());
      await fireEvent.press(screen.getByTestId('save-safety-backup'));
      await expectRecordsKept(store, base);
      expect(screen.queryByText(/Restored ".*" cleanly/)).toBeNull();
    };

    // 1. Delayed SQLite read, then a failed write: Replace is held while the
    //    backup runs and is offered again afterwards, with the failure shown.
    const realSnapshot = store.readProfileBackupData.bind(store);
    const snapshot = jest.spyOn(store, 'readProfileBackupData');
    let releaseRead: () => void = () => {};
    snapshot.mockImplementationOnce(
      (id) =>
        new Promise((resolve, reject) => {
          // The read happens only on release, so a replace that slipped through
          // would show up in the file, as in the review's reproduction.
          releaseRead = () => void realSnapshot(id).then(resolve, reject);
        }),
    );
    const save = jest.spyOn(io, 'saveTextFile');
    save.mockResolvedValueOnce({ outcome: 'write_failed', label: 'Write failed', detail: 'Disk full.' });
    await fireEvent.press(screen.getByTestId('safety-backup-consent'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    expect(await screen.findByTestId('safety-backup-progress')).toBeTruthy();
    await expectReplaceHeld();
    expect(save).not.toHaveBeenCalled();
    await act(async () => releaseRead());
    await expectStatus(/Safety backup not saved for Commander Alpha\. Write failed/);
    expect(screen.queryByTestId('safety-backup-progress')).toBeNull();
    expect(confirmButton().props.accessibilityState?.disabled ?? false).toBe(false);
    expect(screen.getByText(/No safety backup of Commander Alpha yet/)).toBeTruthy();
    await expectRecordsKept(store, base);
    // The file built from the delayed read holds Alpha's original records, not a replacement.
    const delayedReadFile = JSON.parse(save.mock.calls[0]?.[0].content ?? '{}');
    expect(delayedReadFile.profile.profileId).toBe(aId);
    expect(delayedReadFile.observations).toEqual(stored.observations);
    expect(delayedReadFile.checkInEvents).toEqual(stored.checkInEvents);
    expect(save.mock.calls[0]?.[0].content).toContain('alpha logged note');
    expect(delayedReadFile.observations.some((o: { entered: { systolic?: number } }) => o.entered?.systolic === 121)).toBe(true);

    // 1b. Same tick: Save, then Replace, pressed with no re-render in between, so
    //     both buttons are still enabled and only the refs can refuse the replace.
    //     The save then throws: Replace comes back, with the failure shown.
    const restore = jest.spyOn(store, 'restoreBackupBundle');
    let releaseRead2: () => void = () => {};
    snapshot.mockImplementationOnce(
      (id) =>
        new Promise((resolve, reject) => {
          releaseRead2 = () => void realSnapshot(id).then(resolve, reject);
        }),
    );
    save.mockRejectedValueOnce(new Error('EIO: i/o error'));
    expect(screen.getByTestId('save-safety-backup').props.accessibilityState?.disabled ?? false).toBe(false);
    expect(confirmButton().props.accessibilityState?.disabled ?? false).toBe(false);
    const pressSave = pressHandlerNow('save-safety-backup');
    const pressConfirm = pressHandlerNow('confirm-destructive-action');
    await act(async () => {
      pressSave();
      pressConfirm();
    });
    expect(restore).not.toHaveBeenCalled();
    await expectReplaceHeld();
    expect(restore).not.toHaveBeenCalled();
    await act(async () => releaseRead2());
    await expectStatus(/Safety backup not saved for Commander Alpha. The file could not be written./);
    expect(screen.queryByTestId('safety-backup-progress')).toBeNull();
    expect(confirmButton().props.accessibilityState?.disabled ?? false).toBe(false);
    expect(screen.getByText(/No safety backup of Commander Alpha yet/)).toBeTruthy();
    expect(restore).not.toHaveBeenCalled();
    await expectRecordsKept(store, base);

    // 2. Delayed file write: Replace stays held until the write settles, and the
    //    written file holds Alpha's original reading and note.
    const realSave = createMockIo().saveTextFile;
    let releaseWrite: () => void = () => {};
    let written: Parameters<typeof realSave>[0] | null = null;
    save.mockImplementationOnce(
      (params) =>
        new Promise((resolve) => {
          releaseWrite = () => {
            written = params;
            void realSave(params).then(resolve);
          };
        }),
    );
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    await expectReplaceHeld();
    await act(async () => releaseWrite());
    await expectStatus(/Safety backup saved for Commander Alpha\./);
    expect(save.mock.calls[2]?.[0].chooseDestination).toBe(true);
    const file = written as unknown as { filename: string; content: string };
    expect(file.filename).toBe(`crewsignal-backup-${aId}.json`);
    const backup = JSON.parse(file.content);
    expect(backup.profile.profileId).toBe(aId);
    expect(backup.observations).toEqual(stored.observations);
    expect(backup.checkInEvents).toEqual(stored.checkInEvents);
    expect(file.content).toContain('alpha logged note');
    expect(backup.observations.some((o: { entered: { systolic?: number } }) => o.entered?.systolic === 121)).toBe(true);
    expect(await screen.findByText(/Safety backup saved for Commander Alpha at /)).toBeTruthy();
    await expectRecordsKept(store, base);

    // 3. While the replace itself runs, neither a second replace nor a backup can
    //    start, including a save pressed in the same tick as the confirmation.
    restore.mockRestore();
    const realRestore = store.restoreBackupBundle.bind(store);
    const restoreRun = jest.spyOn(store, 'restoreBackupBundle');
    let releaseRestore: () => void = () => {};
    restoreRun.mockImplementationOnce(
      (params) =>
        new Promise((resolve, reject) => {
          releaseRestore = () => void realRestore(params).then(resolve, reject);
        }),
    );
    const pressConfirmNow = pressHandlerNow('confirm-destructive-action');
    const pressSaveNow = pressHandlerNow('save-safety-backup');
    await act(async () => {
      pressConfirmNow();
      pressSaveNow();
    });
    await waitFor(() => expect(restoreRun).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledTimes(3);
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('save-safety-backup').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(confirmButton());
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    expect(restoreRun).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(3);
    await act(async () => releaseRestore());
    await screen.findByText(/Restored ".*" cleanly into SQLite storage\..*open draft was removed/);
    expect(await countDrafts(store, aId)).toBe(0);
    expect(await countObservations(store, bId)).toBe(1);
  });

  test('S10/G07: the safety backup asks for a folder through the native picker, and a cancelled pick writes nothing', async () => {
    // The production adapter, with only the native folder picker stubbed.
    const { store } = await renderTestApp({ io: defaultPlatformIo });
    const base = await setUpReplaceTargets(store);
    const { aId } = base;
    const stored = base.alpha as Awaited<ReturnType<typeof profileRecords>>;
    await openReplaceRestore();
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    await screen.findByTestId('restore-replace-draft');
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    await screen.findByText(/Overwriting "Commander Alpha"/);
    const expectStatus = (re: RegExp) =>
      waitFor(() => expect(screen.getByTestId('safety-backup-status').props.children).toMatch(re));

    const written: Array<{ name: string; mimeType: string; content: string }> = [];
    const pickedFolder = {
      uri: 'content://picked-folder',
      createFile: (name: string, mimeType: string) => ({
        uri: `content://picked-folder/${name}`,
        write: (content: string) => {
          written.push({ name, mimeType, content });
        },
      }),
    };
    const picker = jest.fn<() => Promise<unknown>>();
    const originalPicker = Directory.pickDirectoryAsync;
    (Directory as unknown as { pickDirectoryAsync: unknown }).pickDirectoryAsync = picker;
    cleanups.push(async () => {
      (Directory as unknown as { pickDirectoryAsync: unknown }).pickDirectoryAsync = originalPicker;
    });

    // Cancelled pick (the message the iOS and Android pickers reject with).
    picker.mockRejectedValueOnce(new Error('The file picker was cancelled by the user'));
    await fireEvent.press(screen.getByTestId('safety-backup-consent'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectStatus(/Safety backup not saved for Commander Alpha\. Cancelled\. Folder selection was cancelled/);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(written).toHaveLength(0);
    expect(screen.queryByText(/Safety backup saved/)).toBeNull();
    expect(screen.getByText(/No safety backup of Commander Alpha yet/)).toBeTruthy();
    // The target and its preview are intact, and Replace is still available.
    expect(screen.getByText(/Overwriting "Commander Alpha".*its open draft/)).toBeTruthy();
    expect(screen.getByTestId('restore-replace-draft', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('confirm-destructive-action').props.accessibilityState?.disabled ?? false).toBe(false);
    await expectRecordsKept(store, base);

    // A picked folder receives Alpha's full backup.
    picker.mockResolvedValueOnce(pickedFolder);
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectStatus(/Safety backup saved for Commander Alpha\. Saved crewsignal-backup-.*to the selected folder/);
    expect(picker).toHaveBeenCalledTimes(2);
    expect(written).toHaveLength(1);
    expect(written[0]?.name).toBe(`crewsignal-backup-${aId}.json`);
    expect(written[0]?.mimeType).toBe('application/json');
    const backup = JSON.parse(written[0]?.content ?? '{}');
    expect(backup.profile.profileId).toBe(aId);
    expect(backup.preferences.activeProfileId).toBe(aId);
    expect(backup.observations).toEqual(stored.observations);
    expect(written[0]?.content).toContain('alpha logged note');
    expect(await screen.findByText(/Safety backup saved for Commander Alpha at /)).toBeTruthy();
    await expectRecordsKept(store, base);
  });

  test('S10/G07 lifecycle: a safety backup still reading when Reports is left and reopened keeps Replace refused, and the file holds the original records', async () => {
    const io = createMockIo();
    const { store } = await renderTestApp({ io });
    const base = await setUpReplaceTargets(store);
    const { aId } = base;
    const stored = base.alpha as Awaited<ReturnType<typeof profileRecords>>;
    await openReplaceRestore();
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    await screen.findByTestId('restore-replace-draft');
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    await screen.findByText(/Overwriting "Commander Alpha"/);

    // The review's reproduction: the SQLite read is held, and the file is built
    // from whatever the read returns once it is released.
    const realSnapshot = store.readProfileBackupData.bind(store);
    const snapshot = jest.spyOn(store, 'readProfileBackupData');
    let releaseRead: () => void = () => {};
    snapshot.mockImplementationOnce(
      (id) =>
        new Promise((resolve, reject) => {
          releaseRead = () => void realSnapshot(id).then(resolve, reject);
        }),
    );
    const restore = jest.spyOn(store, 'restoreBackupBundle');
    await fireEvent.press(screen.getByTestId('safety-backup-consent'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    expect(await screen.findByTestId('safety-backup-progress')).toBeTruthy();

    // Close the dialog, leave Reports (its screen unmounts), and come back.
    await fireEvent.press(screen.getByText('Cancel'));
    await fireEvent.press(screen.getByTestId('tab-overview'));
    await waitFor(() => expect(screen.queryByTestId('reports-restore-card')).toBeNull());
    await openReplaceRestore();
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    await waitFor(() => expect(screen.queryByTestId('restore-preview-pending')).toBeNull());

    // Replace is attempted while the old backup is still reading.
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    const confirm = screen.queryByTestId('confirm-destructive-action');
    if (confirm) await fireEvent.press(confirm);
    // The opening call is a dry run; only a confirmed replace may write.
    const confirmedReplaces = () =>
      restore.mock.calls.filter(([params]) => params.confirmedReplace === true);
    expect(confirmedReplaces()).toHaveLength(0);
    await expectRecordsKept(store, base);

    // Releasing the read must still produce Alpha's original records.
    await act(async () => releaseRead());
    await waitFor(() => expect(io.savedFiles).toHaveLength(1));
    const file = io.savedFiles[0]!;
    const backup = JSON.parse(file.content);
    expect(backup.profile.profileId).toBe(aId);
    expect(backup.observations).toEqual(stored.observations);
    expect(file.content).toContain('alpha logged note');
    expect(backup.observations.some((o: { entered: { systolic?: number } }) => o.entered?.systolic === 121)).toBe(true);
    expect(confirmedReplaces()).toHaveLength(0);
    await expectRecordsKept(store, base);
  });

  /**
   * The press handler of a button as rendered now. Calling it runs the same code a
   * tap would, with no re-render in between, so it reaches handlers whose button is
   * already shown disabled (or two handlers in one tick).
   */
  type PressFiber = { memoizedProps?: { onPress?: unknown }; return?: PressFiber | null };
  function pressNow(testID: string): () => void {
    let fiber =
      (screen.getByTestId(testID) as unknown as { unstable_fiber?: PressFiber }).unstable_fiber ?? null;
    while (fiber) {
      const onPress = fiber.memoizedProps?.onPress;
      if (typeof onPress === 'function') return () => void (onPress as (e: unknown) => unknown)({});
      fiber = fiber.return ?? null;
    }
    throw new Error(`no press handler for ${testID}`);
  }

  /** Reports → Replace → Commander Alpha → the confirmation, with Alpha's preview settled. */
  async function openAlphaConfirmation(aId: string) {
    await openReplaceRestore();
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    await screen.findByTestId('restore-replace-draft');
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    await screen.findByText(/Overwriting "Commander Alpha"/);
  }

  const isDisabled = (testID: string) =>
    screen.getByTestId(testID).props.accessibilityState?.disabled === true;

  test('S10/G07 lifecycle: a safety backup waiting on the file write survives closing the dialog and leaving Reports, and the file keeps the original records', async () => {
    const io = createMockIo();
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, 'announceForAccessibility');
    const { store } = await renderTestApp({ io });
    const base = await setUpReplaceTargets(store);
    const { aId } = base;
    const stored = base.alpha as Awaited<ReturnType<typeof profileRecords>>;
    await openAlphaConfirmation(aId);

    // The file write is held: the read is done and the picker has not answered.
    const realSave = io.saveTextFile.bind(io);
    const save = jest.spyOn(io, 'saveTextFile');
    let releaseWrite: () => void = () => {};
    let wrote: Promise<void> = Promise.resolve();
    save.mockImplementationOnce(
      (params) =>
        new Promise((resolve) => {
          releaseWrite = () => {
            wrote = realSave(params).then((r) => resolve(r));
          };
        }),
    );
    const restore = jest.spyOn(store, 'restoreBackupBundle');
    const confirmedReplaces = () =>
      restore.mock.calls.filter(([params]) => params.confirmedReplace === true);
    await fireEvent.press(screen.getByTestId('safety-backup-consent'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('safety-backup-progress')).toBeTruthy();

    // Close the dialog, leave Reports, come back, and look at what Reports says.
    await fireEvent.press(screen.getByText('Cancel'));
    await fireEvent.press(screen.getByTestId('tab-overview'));
    await waitFor(() => expect(screen.queryByTestId('reports-restore-card')).toBeNull());
    await openReplaceRestore();
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    await waitFor(() => expect(screen.queryByTestId('restore-preview-pending')).toBeNull());
    const banner = screen.getByTestId('operation-status-banner');
    expect(within(banner).getByText(/safety backup.* is in progress/i)).toBeTruthy();
    expect(within(banner).getByText(/Waiting for the file to be written/)).toBeTruthy();

    // Replace is refused: the button is off, and so are its handlers, even pressed in one tick.
    expect(isDisabled('execute-restore-btn')).toBe(true);
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    const pressReplace = pressNow('execute-restore-btn');
    await act(async () => pressReplace());
    const confirm = screen.queryByTestId('confirm-destructive-action');
    if (confirm) {
      expect(confirm.props.accessibilityState).toMatchObject({ disabled: true });
      await fireEvent.press(confirm);
    }
    expect(confirmedReplaces()).toHaveLength(0);
    expect(io.savedFiles).toHaveLength(0);
    await expectRecordsKept(store, base);

    // The write is acknowledged. The file holds the original reading and note, the
    // rows are untouched, the banner is gone and Replace is offered again.
    await act(async () => {
      releaseWrite();
      await wrote;
    });
    await waitFor(() => expect(screen.queryByTestId('operation-status-banner')).toBeNull());
    expect(io.savedFiles).toHaveLength(1);
    const file = io.savedFiles[0]!;
    expect(file.filename).toBe(`crewsignal-backup-${aId}.json`);
    const backup = JSON.parse(file.content);
    expect(backup.profile.profileId).toBe(aId);
    expect(backup.observations).toEqual(stored.observations);
    expect(file.content).toContain('alpha logged note');
    expect(backup.observations.some((o: { entered: { systolic?: number } }) => o.entered?.systolic === 121)).toBe(true);
    expect(save.mock.calls[0]?.[0]).toMatchObject({ chooseDestination: true, avoidOverwrite: true });
    expect(confirmedReplaces()).toHaveLength(0);
    await expectRecordsKept(store, base);
    expect(isDisabled('execute-restore-btn')).toBe(false);
    // Assistive technology hears the real outcome.
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/Safety backup saved for Commander Alpha/));
  });

  test('S10/G07 lifecycle: a replace still writing when Reports is left and reopened refuses a second Replace, a backup, a reset and a delete', async () => {
    const io = createMockIo();
    const announce = jest.spyOn(ReactNative.AccessibilityInfo, 'announceForAccessibility');
    const { store } = await renderTestApp({ io });
    const base = await setUpReplaceTargets(store);
    const { aId, bId } = base;
    await openAlphaConfirmation(aId);

    // Hold the confirmed replace; dry runs pass straight through.
    const realRestore = store.restoreBackupBundle.bind(store);
    const restore = jest.spyOn(store, 'restoreBackupBundle');
    let releaseRestore: () => void = () => {};
    let restored: Promise<void> = Promise.resolve();
    let held = false;
    restore.mockImplementation((params) => {
      if (params.confirmedReplace === true && !held) {
        held = true;
        return new Promise((resolve, reject) => {
          releaseRestore = () => {
            restored = realRestore(params).then(resolve, reject);
          };
        });
      }
      return realRestore(params);
    });
    const confirmedReplaces = () =>
      restore.mock.calls.filter(([params]) => params.confirmedReplace === true);
    const save = jest.spyOn(io, 'saveTextFile');

    // Confirm and, in the same tick, press Confirm and Save again.
    const pressConfirm = pressNow('confirm-destructive-action');
    const pressSave = pressNow('save-safety-backup');
    await act(async () => {
      pressConfirm();
      pressConfirm();
      pressSave();
    });
    await waitFor(() => expect(confirmedReplaces()).toHaveLength(1));
    expect(save).not.toHaveBeenCalled();
    expect(await screen.findByTestId('replace-progress')).toBeTruthy();

    // Leave Reports for Settings: the profile cannot be deleted or reset while it runs.
    const cancel = screen.queryByText('Cancel');
    if (cancel) await fireEvent.press(cancel);
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-settings'));
    const deleteButton = await screen.findByTestId('delete-personal-btn');
    expect(deleteButton.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(deleteButton);
    const pressDelete = pressNow('delete-personal-btn');
    await act(async () => pressDelete());
    expect(screen.queryByText(/This permanently deletes/i)).toBeNull();
    expect((await store.loadAppSnapshot()).profiles.some((p) => p.profileId === bId)).toBe(true);

    // Back on Reports the operation is still shown, and nothing else can start.
    await fireEvent.press(screen.getByTestId('tab-more'));
    await fireEvent.press(await screen.findByTestId('more-nav-reports'));
    const banner = await screen.findByTestId('operation-status-banner');
    expect(within(banner).getByText(/replace.* is in progress/i)).toBeTruthy();
    expect(within(banner).getByText(/Writing to SQLite/)).toBeTruthy();
    await fireEvent.press(await screen.findByText('Load Backup Sample'));
    await fireEvent.press(await screen.findByTestId('restore-dest-replace'));
    await fireEvent.press(screen.getByTestId(`restore-target-${aId}`));
    await waitFor(() => expect(screen.queryByTestId('restore-preview-pending')).toBeNull());
    expect(isDisabled('execute-restore-btn')).toBe(true);
    const pressReplaceAgain = pressNow('execute-restore-btn');
    await act(async () => pressReplaceAgain());
    const reopened = screen.queryByTestId('confirm-destructive-action');
    if (reopened) await fireEvent.press(reopened);
    expect(confirmedReplaces()).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();

    // Acknowledged: the outcome is shown on the new Reports screen and announced,
    // only Alpha's drafts are gone, and the controls come back.
    await act(async () => {
      releaseRestore();
      await restored;
    });
    expect(await screen.findByText(/Restored ".*" cleanly into SQLite storage\./)).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('operation-status-banner')).toBeNull());
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/Restored ".*" cleanly/));
    expect(confirmedReplaces()).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
    expect(await countDrafts(store, aId)).toBe(0);
    // Alpha now holds the sample backup's readings instead of its own; Bravo is untouched.
    const alphaAfter = await profileRecords(store, aId);
    expect(alphaAfter.observations).toHaveLength(11);
    expect(JSON.stringify(alphaAfter.observations)).not.toContain('alpha logged note');
    expect(await profileRecords(store, bId)).toEqual(base.bravo);
    expect(await countDrafts(store, bId)).toBe(0);
    expect(isDisabled('execute-restore-btn')).toBe(false);
  });

  test('S10/G07 production file adapter: cancel, refusal, write failure and collisions keep the preview and overwrite nothing; the saved file reimports as a separate profile', async () => {
    // The production adapter, with only the native folder picker stubbed.
    const { store } = await renderTestApp({ io: defaultPlatformIo });
    const base = await setUpReplaceTargets(store);
    const { aId } = base;
    const stored = base.alpha as Awaited<ReturnType<typeof profileRecords>>;
    await openAlphaConfirmation(aId);
    const expectStatus = (re: RegExp) =>
      waitFor(() => expect(screen.getByTestId('safety-backup-status').props.children).toMatch(re));

    const written: Array<{ name: string; mimeType: string; content: string }> = [];
    const folder = (options: { existing?: string[]; createError?: Error; writeError?: Error } = {}) => ({
      uri: 'content://picked-folder',
      ...(options.existing ? { list: () => options.existing!.map((name) => ({ name })) } : {}),
      createFile: (name: string, mimeType: string) => {
        if (options.createError) throw options.createError;
        return {
          uri: `content://picked-folder/${name}`,
          write: (content: string) => {
            if (options.writeError) throw options.writeError;
            written.push({ name, mimeType, content });
          },
        };
      },
    });
    const picker = jest.fn<() => Promise<unknown>>();
    const originalPicker = Directory.pickDirectoryAsync;
    (Directory as unknown as { pickDirectoryAsync: unknown }).pickDirectoryAsync = picker;
    cleanups.push(async () => {
      (Directory as unknown as { pickDirectoryAsync: unknown }).pickDirectoryAsync = originalPicker;
    });
    const expectIntact = async () => {
      expect(screen.queryByText(/Safety backup saved/)).toBeNull();
      expect(screen.getByText(/No safety backup of Commander Alpha yet/)).toBeTruthy();
      expect(screen.getByText(/Overwriting "Commander Alpha".*its open draft/)).toBeTruthy();
      expect(isDisabled('confirm-destructive-action')).toBe(false);
      expect(screen.queryByTestId('safety-backup-progress')).toBeNull();
      await expectRecordsKept(store, base);
    };
    await fireEvent.press(screen.getByTestId('safety-backup-consent'));

    // 1. The system refuses permission to the folder.
    picker.mockRejectedValueOnce(new Error('Permission denied by the system'));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectStatus(/Safety backup not saved for Commander Alpha\. File access refused\. Permission to write/);
    expect(written).toHaveLength(0);
    await expectIntact();

    // 2. The folder is picked and the write fails.
    picker.mockResolvedValueOnce(folder({ writeError: new Error('ENOSPC: no space left on device') }));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectStatus(/Safety backup not saved for Commander Alpha\. Write failed\. ENOSPC/);
    expect(written).toHaveLength(0);
    await expectIntact();

    // 3. The name is taken and the platform will not let the app rename: nothing is overwritten.
    picker.mockResolvedValueOnce(folder({ createError: new Error('A file with that name already exists') }));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectStatus(
      /Safety backup not saved for Commander Alpha\. File already exists\. A file named crewsignal-backup-.*Nothing was overwritten/,
    );
    expect(written).toHaveLength(0);
    await expectIntact();

    // 4. A recovery copy from an earlier save is already in the folder: the new
    //    copy gets its own name and the old one is left alone.
    const taken = `crewsignal-backup-${aId}.json`;
    picker.mockResolvedValueOnce(folder({ existing: [taken.toUpperCase()] }));
    await fireEvent.press(screen.getByTestId('save-safety-backup'));
    await expectStatus(
      /Safety backup saved for Commander Alpha\. Saved crewsignal-backup-.* \(2\)\.json to the selected folder\..*was already there and was left untouched/,
    );
    expect(picker).toHaveBeenCalledTimes(4);
    expect(written).toHaveLength(1);
    expect(written[0]?.name).toBe(`crewsignal-backup-${aId} (2).json`);
    expect(written[0]?.mimeType).toBe('application/json');
    const backup = JSON.parse(written[0]!.content);
    expect(backup.profile.profileId).toBe(aId);
    expect(backup.preferences.activeProfileId).toBe(aId);
    expect(backup.observations).toEqual(stored.observations);
    expect(written[0]?.content).toContain('alpha logged note');
    expect(await screen.findByText(/Safety backup saved for Commander Alpha at /)).toBeTruthy();
    await expectRecordsKept(store, base);

    // 5. The saved file is a valid backup: reimported as a separate profile it keeps
    //    its records under a new identity and leaves every existing profile alone.
    await fireEvent.press(screen.getByText('Cancel'));
    const picked = jest.spyOn(defaultPlatformIo, 'pickTextFile').mockResolvedValue({
      outcome: 'picked',
      label: 'File selected',
      detail: 'Selected the safety backup.',
      fileName: written[0]!.name,
      content: written[0]!.content,
    });
    const before = (await store.loadAppSnapshot()).profiles.map((p) => p.profileId);
    await fireEvent.press(screen.getByTestId('pick-backup-json-btn'));
    expect(await screen.findByText(/Backup verified/)).toBeTruthy();
    expect(picked).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('restore-dest-separate'));
    await fireEvent.press(screen.getByTestId('execute-restore-btn'));
    await waitFor(async () =>
      expect((await store.loadAppSnapshot()).profiles).toHaveLength(before.length + 1),
    );
    const after = await store.loadAppSnapshot();
    const copy = after.profiles.find((p) => !before.includes(p.profileId))!;
    expect(copy.profileId).not.toBe(aId);
    expect(copy.label).toBe('Commander Alpha (Restored)');
    const copied = await profileRecords(store, copy.profileId);
    expect(copied.observations).toHaveLength(1);
    expect(copied.observations[0]?.profileId).toBe(copy.profileId);
    expect(copied.observations.map((o) => o.entered)).toEqual(stored.observations.map((o) => o.entered));
    expect(JSON.stringify(copied.observations)).toContain('alpha logged note');
    expect(written).toHaveLength(1);
    await expectRecordsKept(store, base);
  });

  test('Local storage startup failure still renders recovery banner and Help route', async () => {
    await renderTestApp({ simulateLoadFailure: true });
    expect(
      await screen.findByText('Unable to load CrewSignal data from device storage'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Open Help'));
    expect(await screen.findByTestId('help-procedure-card')).toBeTruthy();
  });
});
