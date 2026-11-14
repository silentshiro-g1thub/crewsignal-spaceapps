import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import {
  buildReportBundle,
  CANONICAL_ACCEPTANCE_VECTORS,
  convertGlucose,
  convertTemperature,
  CSV_REVIEW_FIXTURE_CSV,
  parseAndReconcileCsv,
  SIM_01_EPOCH_UTC,
  SIM_01_OBSERVATIONS,
  SIM_01_PROFILE,
  SIM_01_REFERENCES,
} from "../../src/shared/src";
import { browserMockBackend, buildDemoSeedInput } from "../../src/bridge/desktopBridge";
import { App } from "../../src/App";

function resetMockStore() {
  browserMockBackend.setHooks({
    simulateDraftRetentionFailure: false,
    simulateCommitRollback: false,
    simulateLostAck: false,
    simulateLookupUnavailable: false,
    simulateLogReadFailure: false,
    simulateFileOutcome: null,
  });
  browserMockBackend.setStorageUnavailable(false);
  browserMockBackend.resetDemo(buildDemoSeedInput(false));
  window.__CREWSIGNAL_MOCK_FILES__ = undefined;
}

describe("CrewSignal Desktop Canonical Vectors & UI Flows", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("opens Getting started from Demo Overview and returns to a draft in Review", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Getting started" }));
    expect(await screen.findByRole("heading", { name: "Getting started" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Open Sleep Trends" }));
    expect(await screen.findByRole("heading", { name: /^Trends$/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to Getting started" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Reports preview" }));
    expect(await screen.findByRole("heading", { name: "Filtered report preview" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to Getting started" }));
    fireEvent.click(screen.getByRole("button", { name: "Return to previous screen" }));
    expect(await screen.findByText(/11 observations across 5 of 6 types/i)).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: /^Check-in$/ })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: /Load Day 42 07:18 BP draft/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Next: Review" }));
    await screen.findByRole("heading", { name: /Review before adding to your log/i });
    fireEvent.click(screen.getAllByRole("button", { name: /^Help$/ })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Getting started" }));
    fireEvent.click(screen.getByRole("button", { name: "Help procedures and sources" }));
    expect(screen.getByRole("heading", { name: "Cached reference summaries" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Return to previous screen" }));
    expect(await screen.findByRole("heading", { name: /Review before adding to your log/i })).toBeVisible();
    expect(screen.getByText("118/76 mmHg")).toBeVisible();
  }, 15000);

  it("opens a private report draft with the readings shown in the Overview prompt", async () => {
    render(<App />);

    const prompt = await screen.findByRole("region", { name: "Consider raising this" });
    expect(within(prompt).getAllByText(/Reference version 1/)).toHaveLength(4);
    expect(within(prompt).getByText(/No mission contact route is configured/)).toBeInTheDocument();
    fireEvent.click(within(prompt).getByRole("button", { name: "Open report draft" }));

    expect(await screen.findByText("4 observations across 2 types")).toBeInTheDocument();
    expect(screen.getByText(/Excluded types .*Mood.*Private notes are EXCLUDED/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start a general report" }));
    expect(await screen.findByText("10 observations across 4 types")).toBeInTheDocument();
  });

  it("matches all canonical arithmetic and CSV 5-row acceptance vectors", () => {
    // Glucose 5.4 mmol/L -> ~97.3 mg/dL
    const g = convertGlucose(5.4, "mmol/L", "mg/dL");
    expect(g.rounded1).toBe(97.3);

    // Temp 36.7 C -> ~98.1 F
    const t = convertTemperature(36.7, "C", "F");
    expect(t.rounded1).toBe(98.1);

    // SIM-01 baseline: 11 obs, 5 types
    expect(SIM_01_OBSERVATIONS.length).toBe(
      CANONICAL_ACCEPTANCE_VECTORS.vectors[0]?.expectedObservationCount ?? 11,
    );

    // Default report Day 36-42 = 10 obs across 4 types
    const report = buildReportBundle({
      profile: SIM_01_PROFILE,
      observations: SIM_01_OBSERVATIONS,
      references: SIM_01_REFERENCES,
      startDay: 36,
      endDay: 42,
      generatedAtUtc: "2026-11-13T07:18:00Z",
    });
    expect(report.totalObservations).toBe(10);
    expect(report.includedTypesCount).toBe(4);
    expect(report.excludedMetricIds).toContain("mood");

    // 5-row CSV fixture
    const csv = parseAndReconcileCsv({
      csvText: CSV_REVIEW_FIXTURE_CSV,
      existingObservations: SIM_01_OBSERVATIONS,
      profileId: SIM_01_PROFILE.profileId,
      missionEpochUtc: SIM_01_EPOCH_UTC,
      importBatchId: "batch-test",
      nowUtc: "2026-11-13T07:18:00Z",
    });
    expect(csv.counts.total).toBe(5);
    expect(csv.counts.valid).toBe(2);
    expect(csv.counts.duplicate).toBe(1);
    expect(csv.counts.conflict).toBe(1);
    expect(csv.counts.rejected).toBe(1);
  });

  it("renders SIM-01 Overview with Offline ready chip, 7h 06m padded Day 38 sleep, and Not recorded Glucose", async () => {
    render(<App />);

    await screen.findByText(/11 observations across 5 of 6 types/i);
    expect(screen.getByText(/Offline ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Not recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/Sleep 5h 48m/i)).toBeInTheDocument();

    // Switch to Trends -> Data table to inspect padded 7h 06m Day 38 sleep
    fireEvent.click(screen.getAllByRole("button", { name: /^Trends$/i })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Data table/i }));
    const paddedCells = await screen.findAllByText(/7h 06m/i);
    expect(paddedCells.length).toBeGreaterThanOrEqual(2);
  });

  it("switches appearance theme & display units without losing route or mutating stored precision", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);

    fireEvent.click(screen.getAllByRole("button", { name: /Settings/i })[0]!);
    await screen.findByRole("heading", { name: /Appearance/i });

    fireEvent.click(screen.getByRole("button", { name: /^Light$/i }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
    });

    fireEvent.click(screen.getByRole("button", { name: "°F" }));
    await waitFor(() => {
      expect(screen.getByText(/Display units updated/i)).toBeInTheDocument();
    });

    // Return to Overview and verify 36.7 °C renders as 98.1 °F while citing Entered 36.7 °C
    fireEvent.click(screen.getAllByRole("button", { name: /^Overview$/i })[0]!);
    expect(await screen.findByText("98.1")).toBeInTheDocument();
    expect(screen.getByText(/Entered 36\.7 °C/i)).toBeInTheDocument();
  });

  it("executes Check-in Record -> Review -> Saved for Day 42 BP draft and handles ER-02 rollback + ER-03 lost-ack recovery", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);

    fireEvent.click(screen.getAllByRole("button", { name: /Check-in/i })[0]!);
    const loadBpBtn = await screen.findByRole("button", {
      name: /Load Day 42 07:18 BP draft/i,
    });
    fireEvent.click(loadBpBtn);

    fireEvent.click(await screen.findByRole("button", { name: /Next: Review/i }));
    await screen.findByRole("heading", { name: /Review before adding to your log/i });
    expect(screen.getByText("118/76 mmHg")).toBeInTheDocument();

    // Test ER-02 rollback first: preserves draft in Review
    browserMockBackend.setHooks({
      ...browserMockBackend.getHooks(),
      simulateCommitRollback: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Add to log/i }));
    expect(await screen.findByText(/The addition did not finish/i)).toBeInTheDocument();

    // Switch to ER-03 lost acknowledgement after commit -> "Check the log" resolves "Already in your log"
    browserMockBackend.setHooks({
      ...browserMockBackend.getHooks(),
      simulateCommitRollback: false,
      simulateLostAck: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Add to log/i }));
    expect(await screen.findByRole("button", { name: /Check the log/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Check the log/i }));
    await screen.findByRole("heading", { name: /Already in your log/i });
    expect(screen.getByText(/No duplicate entry was created/i)).toBeInTheDocument();

    // Overview now shows 12 observations
    fireEvent.click(screen.getByRole("button", { name: /Back to overview/i }));
    await screen.findByText(/12 observations across 5 of 6 types/i);
  });

  it("S05/G04: checks an odd reading in Review and recovers a single flagged save", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);
    fireEvent.click(screen.getAllByRole("button", { name: /Check-in/i })[0]!);
    const primary = await screen.findByLabelText("Heart rate (bpm)");
    fireEvent.change(primary, { target: { value: "350oops" } });
    fireEvent.click(screen.getByRole("button", { name: /Next: Review/i }));
    expect((await screen.findAllByText(/Enter a positive resting heart rate in bpm\./i)).length).toBeGreaterThan(0);
    expect(browserMockBackend.snapshot().profileData.observations).toHaveLength(11);

    fireEvent.change(primary, { target: { value: "350" } });
    fireEvent.click(screen.getByRole("button", { name: /Next: Review/i }));
    const flag = await screen.findByRole("checkbox", { name: "Needs recheck" });
    await waitFor(() => expect(flag).toBeEnabled());
    fireEvent.click(flag);
    await waitFor(() => expect(browserMockBackend.snapshot().profileData.drafts[0]?.quality).toBe("questionable"));
    browserMockBackend.setHooks({ ...browserMockBackend.getHooks(), simulateLostAck: true });
    const add = screen.getByRole("button", { name: "Add to log" });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    fireEvent.click(await screen.findByRole("button", { name: "Check the log" }));
    await screen.findByRole("heading", { name: "Already in your log" });
    expect(screen.getByText("Needs recheck")).toBeInTheDocument();
    const { observations, drafts } = browserMockBackend.snapshot().profileData;
    expect(observations).toHaveLength(12);
    expect(observations.filter((o) => o.quality === "questionable")).toEqual([
      expect.objectContaining({ entered: expect.objectContaining({ value: 350, unit: "bpm" }), qualityNote: null }),
    ]);
    expect(drafts).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Log a new reading" }));
    expect(await screen.findByLabelText("Heart rate (bpm)")).toHaveValue("");
  });

  it("opens a due blood pressure check-in from SIM-SCHEDULE", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Load SIM-SCHEDULE fixture" }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Overview$/ })[0]!);
    await screen.findByRole("heading", { name: "Due now" });
    expect(screen.getByRole("button", { name: "Check-in, 1 due" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log blood pressure" }));
    expect(await screen.findByLabelText("Systolic (mmHg)")).toBeInTheDocument();
  });

  it("opens close guard dialog when unfinished draft exists and triggers close request", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);

    fireEvent.click(screen.getByRole("button", { name: /Start check-in/i }));
    await screen.findByRole("heading", { name: /Blood pressure/i });

    await waitFor(() => {
      const allowed = browserMockBackend.triggerMockCloseRequest();
      expect(allowed).toBe(false);
    });

    expect(
      await screen.findByRole("heading", { name: /Save or export before closing\?/i }),
    ).toBeInTheDocument();
  });

  it("preserves report preview cleanly when file access is refused (ER-04)", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);

    fireEvent.click(screen.getAllByRole("button", { name: /^Reports$/i })[0]!);
    await screen.findAllByText(/10 observations across 4 types/i);

    window.__CREWSIGNAL_MOCK_FILES__ = {
      saveOutcome: {
        status: "permission_refused",
        path: null,
        bytesWritten: null,
        message: "Permission denied for selected folder.",
      },
    };
    fireEvent.click(screen.getByRole("button", { name: /Export Report JSON/i }));

    expect(await screen.findByText(/File access wasn't granted/i)).toBeInTheDocument();
    // Preview remains completely intact
    expect(screen.getAllByText(/10 observations across 4 types/i).length).toBeGreaterThanOrEqual(1);
  });

  it("creates blank Personal profile isolated from Demo reset", async () => {
    render(<App />);
    await screen.findByText(/11 observations across 5 of 6 types/i);

    fireEvent.click(screen.getAllByRole("button", { name: /Settings/i })[0]!);
    const aliasInput = await screen.findByLabelText(/New personal profile alias/i);
    fireEvent.change(aliasInput, { target: { value: "Commander Nova" } });
    fireEvent.click(screen.getByRole("button", { name: /Create blank Personal profile/i }));

    await screen.findByText(/Personal profile created/i);
    fireEvent.click(screen.getAllByRole("button", { name: /^Overview$/i })[0]!);
    expect(await screen.findByRole("heading", { name: /No observations yet/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Getting started" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /^Help$/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Getting started" }));
    expect(screen.getByText(/Your Personal profile stays active/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open Demo Overview" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to previous screen" }));
    expect(await screen.findByRole("heading", { name: /No observations yet/i })).toBeInTheDocument();
  });

  it("keeps Help and recovery reachable when local storage cannot be opened, then recovers on retry", async () => {
    browserMockBackend.setStorageUnavailable(true);
    render(<App />);

    expect(await screen.findByText(/Local storage could not be opened/i)).toBeInTheDocument();
    expect(screen.getByText(/left your saved file unchanged/i)).toBeInTheDocument();
    expect(screen.getByText("DB_PRAGMA_FAILED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Help/i })).toBeInTheDocument();

    // Access returns: retry loads the seeded log without restarting the app.
    browserMockBackend.setStorageUnavailable(false);
    fireEvent.click(screen.getByRole("button", { name: /Try opening storage again/i }));
    await screen.findByText(/11 observations across 5 of 6 types/i);
  });
});
