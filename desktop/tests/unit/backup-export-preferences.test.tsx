/**
 * PR #1 re-review P1: a full backup export on a fresh or upgraded Windows
 * profile must validate. Saved preferences written by earlier builds used
 * legacy keys and lacked activeProfileId/helpMode, which made the export throw
 * a ZodError. The export now normalizes them, and if the bundle still cannot
 * be built the user sees an error while the preview stays as it was.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SIM_01_SNAPSHOT_UTC, validateBackupImport } from "../../src/shared/src";
import { browserMockBackend, buildDemoSeedInput } from "../../src/bridge/desktopBridge";
import { normalizeAppPreferences } from "../../src/state/preferences";
import { App } from "../../src/App";

const control = vi.hoisted(() => ({ failBundle: false }));
vi.mock("../../src/shared/src", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/shared/src")>();
  return {
    ...real,
    buildBackupBundle: (...args: Parameters<typeof real.buildBackupBundle>) => {
      if (control.failBundle) throw new Error("simulated bundle validation failure");
      return real.buildBackupBundle(...args);
    },
  };
});

const LEGACY_NATIVE_PREFS = {
  appearance: "system",
  displayUnits: { glucose: "mg/dL", temperature: "C" },
  configuredHelpFixture: false,
  knownSourceUpdateFixture: false,
  offlineSetupIncompleteFixture: false,
};

function setStoredPreferences(value: unknown) {
  (browserMockBackend as unknown as { preferences: unknown }).preferences = structuredClone(value);
}

async function openBackupTab() {
  render(<App />);
  await screen.findByText(/11 observations across 5 of 6 types/i);
  fireEvent.click(screen.getAllByRole("button", { name: /^Reports$/i })[0]!);
  fireEvent.click(await screen.findByRole("tab", { name: /Backup & Restore/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Include all profile data/i }));
}

describe("PR #1 re-review P1: Windows full backup export preferences", () => {
  beforeEach(() => {
    control.failBundle = false;
    browserMockBackend.setStorageUnavailable(false);
    browserMockBackend.resetDemo(buildDemoSeedInput(false));
    window.__CREWSIGNAL_MOCK_FILES__ = undefined;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.__CREWSIGNAL_MOCK_FILES__ = undefined;
  });

  it("redacts report JSON and print through the Windows frontend", async () => {
    const seed = buildDemoSeedInput(false);
    const row = { ...seed.observations.find((obs) => obs.metricId === 'blood_pressure')! };
    row.note = 'READING_SENTINEL';
    row.qualityNote = 'QUALITY_SENTINEL';
    row.correctionHistory = [{ correctionId: 'legacy-correction', correctedAtUtc: SIM_01_SNAPSHOT_UTC,
      reason: 'CORRECTION_SENTINEL', previousEntered: row.entered, previousCanonical: row.canonical,
      previousTiming: row.timing, previousMethod: row.method, previousContext: row.context }];
    seed.observations = seed.observations.map((obs) => obs.observationId === row.observationId ? row : obs);
    browserMockBackend.resetDemo(seed);
    const save = vi.spyOn(browserMockBackend, 'saveExportFile');
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reports' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Export Report JSON' }));
    const json = save.mock.calls[0]![1];
    const print = container.querySelector('.print-report-sheet')!.textContent;
    expect(JSON.parse(json).observations.some((obs: { metricId: string }) => obs.metricId === 'blood_pressure')).toBe(true);
    expect(json).not.toContain('SENTINEL');
    expect(print).toContain('Blood pressure');
    expect(print).not.toContain('SENTINEL');
  });

  it("normalizes legacy native preferences into the shared shape", () => {
    expect(normalizeAppPreferences(LEGACY_NATIVE_PREFS, "sim-01")).toEqual({
      appearance: "system",
      activeProfileId: "sim-01",
      displayUnits: { blood_glucose: "mg/dL", body_temperature: "C" },
      helpMode: "unconfigured",
    });
    expect(
      normalizeAppPreferences(
        { appearance: "dark", displayUnits: { glucose: "mmol/L", temperature: "F" }, configuredHelpFixture: true },
        "personal-1",
      ),
    ).toEqual({
      appearance: "dark",
      activeProfileId: "personal-1",
      displayUnits: { blood_glucose: "mmol/L", body_temperature: "F" },
      helpMode: "configured_fixture",
    });
    expect(normalizeAppPreferences(undefined, "").activeProfileId).toBe("sim-01");
  });

  it("exports a valid full backup from legacy-shaped preferences, then cancel, re-open and restore work", async () => {
    setStoredPreferences(LEGACY_NATIVE_PREFS);
    const saveSpy = vi.spyOn(browserMockBackend, "saveExportFile");
    await openBackupTab();

    fireEvent.click(screen.getByRole("button", { name: /Export full backup JSON/i }));
    expect(await screen.findByText(/File saved/i)).toBeInTheDocument();
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const content = saveSpy.mock.calls[0]![1];
    const parsed = validateBackupImport(JSON.parse(content));
    expect(parsed.valid).toBe(true);
    expect(parsed.bundle!.preferences).toMatchObject({
      activeProfileId: parsed.bundle!.profile.profileId,
      displayUnits: { blood_glucose: "mg/dL", body_temperature: "C" },
      helpMode: "unconfigured",
    });

    // Cancel the save dialog: nothing written, preview intact.
    window.__CREWSIGNAL_MOCK_FILES__ = {
      saveOutcome: { status: "cancelled", path: null, bytesWritten: null, message: null },
    };
    fireEvent.click(screen.getByRole("button", { name: /Export full backup JSON/i }));
    expect(await screen.findByText(/Export cancelled/i)).toBeInTheDocument();

    // Re-open the exported file and restore it as a separate profile.
    window.__CREWSIGNAL_MOCK_FILES__ = { openContent: content, openFileName: "crewsignal-backup-sim-01.json" };
    fireEvent.click(screen.getByRole("button", { name: /Choose Backup or Draft Recovery JSON/i }));
    await screen.findByText(/Valid Demo backup/i);
    fireEvent.click(screen.getByRole("button", { name: /Restore profile atomically/i }));
    expect(await screen.findByText(/Restored into separate profile/i)).toBeInTheDocument();
  });

  it("shows an export error and keeps the backup preview when the bundle cannot be built", async () => {
    const saveSpy = vi.spyOn(browserMockBackend, "saveExportFile");
    await openBackupTab();

    // A backup file is open in the restore preview before the export fails.
    const okSave = vi.spyOn(browserMockBackend, "saveExportFile");
    fireEvent.click(screen.getByRole("button", { name: /Export full backup JSON/i }));
    await screen.findByText(/File saved/i);
    const content = okSave.mock.calls[0]![1];
    window.__CREWSIGNAL_MOCK_FILES__ = { openContent: content, openFileName: "b.json" };
    fireEvent.click(screen.getByRole("button", { name: /Choose Backup or Draft Recovery JSON/i }));
    await screen.findByText(/Valid Demo backup/i);
    saveSpy.mockClear();

    control.failBundle = true;
    fireEvent.click(screen.getByRole("button", { name: /Export full backup JSON/i }));
    expect(await screen.findByText(/Couldn't create backup/i)).toBeInTheDocument();
    expect(saveSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Valid Demo backup/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restore profile atomically/i })).toBeInTheDocument();
  });
});
