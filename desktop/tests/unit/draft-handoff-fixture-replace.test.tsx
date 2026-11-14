/**
 * PR #1 review at 215c55b, desktop P1s:
 *  - Loading SIM-SCHEDULE must use the same handoff as a profile switch, so an
 *    open Personal draft (stored, or memory-only when storage refuses it)
 *    resumes on its own profile afterwards.
 *  - Replacing the active profile from a backup removes its open draft. Reports
 *    says so before the restore and offers a recovery export; after a confirmed
 *    replace the view shows what storage holds; a rolled-back restore changes
 *    nothing about the draft.
 * Drives the real App against the browser backend and mocked file picker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SIM_01_PREFERENCES, SIM_01_PROFILE_ID, buildBackupBundle } from "../../src/shared/src";
import {
  browserMockBackend,
  buildDemoSeedInput,
  desktopBridge,
  profileRecordToConfig,
} from "../../src/bridge/desktopBridge";
import { backupHistoryFrom } from "../../src/state/backupRestore";
import { App } from "../../src/App";

const HOOKS_OFF = {
  simulateDraftRetentionFailure: false,
  simulateCommitRollback: false,
  simulateLostAck: false,
  simulateLookupUnavailable: false,
  simulateLogReadFailure: false,
  simulateFileOutcome: null,
} as const;

type StoredDraft = { profileId: string; values?: unknown };
type StoredBundle = { observations: unknown[]; drafts: StoredDraft[] };
function stored(profileId: string): StoredBundle {
  const b = (browserMockBackend as unknown as { bundles: Map<string, StoredBundle> }).bundles;
  return b.get(profileId) ?? { observations: [], drafts: [] };
}
function activeProfileId(): string {
  return (browserMockBackend as unknown as { activeProfileId: string }).activeProfileId;
}
function nav(name: RegExp) {
  fireEvent.click(screen.getAllByRole("button", { name })[0]!);
}

/** The visible toast only. The sr-only live region repeats some messages. */
async function expectToast(text: RegExp) {
  await waitFor(
    () => {
      const toast = document.querySelector(".toast-banner");
      expect(toast).not.toBeNull();
      expect(toast!.textContent).toMatch(text);
    },
    { timeout: 4000 },
  );
}

async function createPersonal(alias: string): Promise<string> {
  nav(/Settings/i);
  fireEvent.change(await screen.findByLabelText(/New personal profile alias/i), {
    target: { value: alias },
  });
  fireEvent.click(screen.getByRole("button", { name: /Create blank Personal profile/i }));
  await screen.findByText(/Personal profile created/i);
  return activeProfileId();
}

async function enterBp(sys: string, dia: string) {
  nav(/Check-in/i);
  fireEvent.click(await screen.findByRole("button", { name: "Blood pressure" }));
  fireEvent.change(await screen.findByLabelText(/Systolic/i), { target: { value: sys } });
  fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: dia } });
}

async function toReview() {
  fireEvent.click(screen.getByRole("button", { name: /Next: Review/i }));
  await screen.findByRole("heading", { name: /Review before adding to your log/i });
}

async function switchTo(rowText: string | RegExp) {
  nav(/Settings/i);
  let row: HTMLTableRowElement | undefined;
  await waitFor(() => {
    row = screen
      .getAllByText(rowText)
      .map((el) => el.closest("tr"))
      .find((tr): tr is HTMLTableRowElement => tr !== null);
    expect(row).toBeDefined();
  });
  fireEvent.click(row!.querySelector("button")!);
}

async function loadFixture() {
  nav(/Settings/i);
  fireEvent.click(await screen.findByRole("button", { name: /Load SIM-SCHEDULE fixture/i }));
  await expectToast(/SIM-SCHEDULE loaded/);
}

/** A Personal-mode backup whose profile matches `personalId`'s mode, with one BP reading. */
async function personalBackupJson(personalId: string): Promise<string> {
  const snap = await desktopBridge.loadAppSnapshot(personalId);
  const rec = snap.profiles.find((p) => p.id === personalId)!;
  const demo = await desktopBridge.loadAppSnapshot(SIM_01_PROFILE_ID);
  const obs = demo.profileData.observations
    .filter((o) => o.metricId === "blood_pressure")
    .slice(0, 1)
    .map((o) => ({ ...o, profileId: personalId }));
  const bundle = buildBackupBundle({
    confirmedIncludeAllProfileData: true,
    exportedAtUtc: "2026-11-13T08:00:00Z",
    profile: profileRecordToConfig(rec, snap.profileData.schedules),
    preferences: SIM_01_PREFERENCES,
    observations: obs,
    checkInEvents: [],
    references: [],
    insights: [],
    history: backupHistoryFrom(snap.profileData),
  });
  return JSON.stringify(bundle);
}

async function openBackup(json: string) {
  nav(/^Reports$/i);
  fireEvent.click(await screen.findByRole("tab", { name: /Backup & Restore/i }));
  window.__CREWSIGNAL_MOCK_FILES__ = { openContent: json, openFileName: "personal-backup.json" };
  fireEvent.click(screen.getByRole("button", { name: /Choose Backup or Draft Recovery JSON/i }));
  await screen.findByText(/Valid Personal backup/i);
}

function chooseReplace() {
  fireEvent.click(screen.getByRole("radio", { name: /Replace current personal profile/i }));
}

describe("PR #1 review 215c55b: draft handoff for SIM-SCHEDULE and profile replace", () => {
  beforeEach(() => {
    browserMockBackend.setHooks({ ...HOOKS_OFF });
    browserMockBackend.setStorageUnavailable(false);
    browserMockBackend.resetDemo(buildDemoSeedInput(false));
    window.__CREWSIGNAL_MOCK_FILES__ = undefined;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    browserMockBackend.setHooks({ ...HOOKS_OFF });
    window.__CREWSIGNAL_MOCK_FILES__ = undefined;
  });

  it("opens the due blood pressure check-in from Overview", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);
    await loadFixture();
    nav(/^Overview$/i);

    expect(await screen.findByRole("heading", { name: "Due now" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Check-in, 1 due" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Start blood pressure check-in" }));
    expect(await screen.findByLabelText(/Systolic/i)).toBeTruthy();
  });

  it("SIM-SCHEDULE: a stored Record draft is saved with Personal and resumes there", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);
    const personalId = await createPersonal("Commander Vega");
    await enterBp("131", "84");

    await loadFixture();
    await expectToast(/Your open draft was saved with Commander Vega/);
    expect(activeProfileId()).not.toBe(personalId);
    expect(stored(personalId).drafts).toHaveLength(1);
    expect(JSON.stringify(stored(personalId).drafts[0])).toContain("131");

    await switchTo("Commander Vega");
    await waitFor(() => expect(activeProfileId()).toBe(personalId));
    nav(/Check-in/i);
    await waitFor(() => expect(screen.getByLabelText(/Systolic/i)).toHaveValue("131"));
    expect(screen.getByLabelText(/Diastolic/i)).toHaveValue("84");
  }, 15000);

  it("SIM-SCHEDULE: a memory-only Review draft is kept in memory with Personal and resumes there", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);
    const personalId = await createPersonal("Commander Lyra");
    browserMockBackend.setHooks({ ...HOOKS_OFF, simulateDraftRetentionFailure: true });
    await enterBp("129", "83");
    await toReview();
    expect(stored(personalId).drafts).toHaveLength(0);

    await loadFixture();
    await expectToast(/kept in memory with Commander Lyra until you close CrewSignal/);
    expect(stored(personalId).drafts).toHaveLength(0);

    browserMockBackend.setHooks({ ...HOOKS_OFF });
    await switchTo("Commander Lyra");
    await waitFor(() => expect(activeProfileId()).toBe(personalId));
    nav(/Check-in/i);
    expect(await screen.findByText("129/83 mmHg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add to log/i }));
    await screen.findByRole("heading", { name: /Added to your log/i });
    expect(stored(personalId).observations).toHaveLength(1);
  }, 15000);

  it("replace: warns and exports before, cancel keeps the draft, confirmed replace shows storage", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);
    const personalId = await createPersonal("Commander Orion");
    const backup = await personalBackupJson(personalId);
    await enterBp("129", "83");
    await toReview();
    await waitFor(() => expect(stored(personalId).drafts).toHaveLength(1));
    const guardSpy = vi.spyOn(desktopBridge, "setDraftGuardState");

    await openBackup(backup);
    expect(screen.queryByTestId("restore-replace-draft")).toBeNull();
    chooseReplace();
    const notice = screen.getByTestId("restore-replace-draft");
    expect(notice).toHaveTextContent(/Replacing Commander Orion removes its open draft/);
    expect(notice).toHaveTextContent(/copy saved on this device is deleted/);
    expect(screen.getByText(/including its open draft/)).toBeInTheDocument();

    // Recovery copy before the replace.
    const saveSpy = vi.spyOn(browserMockBackend, "saveExportFile");
    fireEvent.click(screen.getByRole("button", { name: /^Export draft recovery$/i }));
    await expectToast(/File saved/);
    const recovery = JSON.parse(saveSpy.mock.calls[0]![1]);
    expect(recovery.kind).toBe("crewsignal-draft-recovery");
    expect(JSON.stringify(recovery)).toContain("129");

    // Cancel: going back to a separate restore leaves the draft alone.
    fireEvent.click(screen.getByRole("radio", { name: /Restore as separate profile/i }));
    expect(screen.queryByTestId("restore-replace-draft")).toBeNull();
    expect(stored(personalId).drafts).toHaveLength(1);

    // Confirmed replace.
    chooseReplace();
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirm overwriting/i }));
    fireEvent.click(screen.getByRole("button", { name: /Restore profile atomically/i }));
    await expectToast(/Profile replaced from backup/);
    await expectToast(/open draft was removed with the replaced profile data/);
    expect(activeProfileId()).toBe(personalId);
    expect(stored(personalId).drafts).toHaveLength(0);
    expect(stored(personalId).observations).toHaveLength(1);
    await waitFor(() =>
      expect(guardSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasUnretainedDraft: false, hasUnfinishedDraft: false }),
      ),
    );

    nav(/Check-in/i);
    await screen.findByRole("button", { name: "Blood pressure" });
    expect(screen.queryByText("129/83 mmHg")).toBeNull();
  }, 20000);

  it("replace with a memory-only draft: says it's only on screen, and clears the unsaved state afterwards", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);
    const personalId = await createPersonal("Commander Rhea");
    const backup = await personalBackupJson(personalId);
    browserMockBackend.setHooks({ ...HOOKS_OFF, simulateDraftRetentionFailure: true });
    await enterBp("129", "83");
    await toReview();
    const guardSpy = vi.spyOn(desktopBridge, "setDraftGuardState");

    await openBackup(backup);
    chooseReplace();
    expect(screen.getByTestId("restore-replace-draft")).toHaveTextContent(/only on this screen/);
    // The separate-restore notice is not shown at the same time.
    expect(screen.queryByTestId("restore-unretained-draft")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /Confirm overwriting/i }));
    fireEvent.click(screen.getByRole("button", { name: /Restore profile atomically/i }));
    await expectToast(/open draft was removed with the replaced profile data/);
    await waitFor(() =>
      expect(guardSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasUnretainedDraft: false, hasUnfinishedDraft: false }),
      ),
    );
    nav(/Check-in/i);
    await screen.findByRole("button", { name: "Blood pressure" });
    expect(screen.queryByText("129/83 mmHg")).toBeNull();
    expect(screen.queryByText(/couldn't retain this draft/i)).toBeNull();
  }, 20000);

  it("replace rollback: a failed restore leaves the draft and its storage unchanged", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);
    const personalId = await createPersonal("Commander Ceres");
    const backup = await personalBackupJson(personalId);
    await enterBp("129", "83");
    await toReview();
    await waitFor(() => expect(stored(personalId).drafts).toHaveLength(1));

    await openBackup(backup);
    chooseReplace();
    fireEvent.click(screen.getByRole("checkbox", { name: /Confirm overwriting/i }));
    vi.spyOn(desktopBridge, "restoreBackup").mockRejectedValue({
      code: "DB_WRITE_FAILED",
      message: "disk I/O error; transaction rolled back",
    });
    fireEvent.click(screen.getByRole("button", { name: /Restore profile atomically/i }));
    await expectToast(/Restore didn't complete/);
    expect(screen.getByTestId("restore-replace-draft")).toBeInTheDocument();
    expect(stored(personalId).drafts).toHaveLength(1);
    expect(stored(personalId).observations).toHaveLength(0);

    nav(/Check-in/i);
    expect(await screen.findByText("129/83 mmHg")).toBeInTheDocument();
  }, 20000);
});
