import { currentActionReview } from '../bridge/desktopBridge';
import {
  buildRaiseReadingPrompt,
  buildSleepInsight,
  compareObservationToReference,
  computeMissionDay,
  describeMissionContact,
  evaluateMetricSchedule,
  getDueCheckIns,
  formatObservationDisplay,
  NEEDS_RECHECK_LABEL,
  formatUtcTimeHHMM,
  getLatestObservationsByMetric,
  getObservedMissionDay,
  getReadingStatus,
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  RAISE_READING_LIMIT,
  RAISE_READING_REASONS,
  RAISE_READING_SUGGESTION,
  type MetricId,
} from "../shared/src";
import { useApp } from "../state/AppContext";
import { TrendChart } from "../components/TrendChart";
import { ReadingStatusBadge } from "../components/ReadingStatusBadge";

export function OverviewRoute() {
  const {
    loading,
    loadError,
    storageStatus,
    retryStorage,
    refreshSnapshot,
    snapshot,
    activeProfile,
    preferences,
    activeDraft,
    currentReferenceNowUtc,
    activeReferencesByMetric,
    trendRangeDays,
    setTrendRangeDays,
    navigate,
    openGettingStarted,
    gettingStarted,
    setSelectedTrendMetric,
    openDraftForMetric,
  } = useApp();

  if (storageStatus && !storageStatus.available) {
    return (
      <div className="stack-lg">
        <div className="page-header">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Local storage is unavailable.</p>
          </div>
        </div>
        <div className="notice-banner notice-banner-danger" role="alert">
          <div className="stack-sm">
            <strong>Local storage could not be opened.</strong>
            <span>
              CrewSignal left your saved file unchanged. Check that the folder is available and
              not blocked, then try again. Help and offline guidance remain available.
            </span>
            {storageStatus.dbPath ? (
              <span>
                File: <code>{storageStatus.dbPath}</code>
              </span>
            ) : null}
            {storageStatus.code ? (
              <span>
                Status: <code>{storageStatus.code}</code>
              </span>
            ) : null}
          </div>
          <div className="row-wrap">
            <button type="button" className="btn-primary" onClick={() => void retryStorage()}>
              Try opening storage again
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("help")}>
              Open Help
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="stack-lg">
        <div className="page-header">
          <div>
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Unable to load observations from local SQLite store.</p>
          </div>
        </div>
        <div className="notice-banner notice-banner-danger" role="alert">
          <div>
            <strong>Stored records could not be loaded.</strong>{" "}
            {loadError} Help and offline guidance remain available.
          </div>
          <div className="row-wrap">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void refreshSnapshot(activeProfile?.profileId)}
            >
              Retry loading log
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("help")}>
              Open Help
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !snapshot || !activeProfile) {
    return (
      <div className="stack-md">
        <h1 className="page-title">Overview</h1>
        <div className="panel-card">
          <p style={{ margin: 0, color: "var(--text-supporting)" }}>
            Loading local observations…
          </p>
        </div>
      </div>
    );
  }

  const observations = snapshot.profileData.observations;
  const dueCheckIns = getDueCheckIns(activeProfile, observations, currentReferenceNowUtc);
  const raisePrompt = buildRaiseReadingPrompt({
    profileId: activeProfile.profileId,
    observations,
    references: snapshot.profileData.references,
  });
  const missionDay = Math.max(
    1,
    computeMissionDay(currentReferenceNowUtc, activeProfile.missionEpochUtc),
  );
  const clockHHMM = formatUtcTimeHHMM(currentReferenceNowUtc);
  const latestByMetric = getLatestObservationsByMetric(observations);
  const latestSleep = latestByMetric.sleep;
  const sleepRef = activeReferencesByMetric.sleep;

  const sleepInsight = latestSleep
    ? buildSleepInsight({
        observation: latestSleep,
        reference: sleepRef,
        createdAtUtc: currentReferenceNowUtc,
      })
    : null;

  const latestReview = currentActionReview(snapshot.profileData.actionReviews, sleepInsight);

  const openMetricTrend = (metricId: MetricId) => {
    setSelectedTrendMetric(metricId);
    navigate("trends");
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            Mission Day {missionDay} · {clockHHMM} {activeProfile.displayTimezone} ·{" "}
            {observations.length === 0
              ? "No observations yet"
              : `${observations.length} ${observations.length === 1 ? "observation" : "observations"} across ${
                  new Set(observations.map((o) => o.metricId)).size
                } of 6 types`}
          </p>
        </div>
        <div className="row-wrap">
          {activeProfile.mode === "demo" && !gettingStarted && (
            <button type="button" className="btn-secondary" onClick={openGettingStarted}>
              Getting started
            </button>
          )}
          {activeDraft ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("check_in")}
            >
              Resume draft ({METRIC_DEFINITIONS[activeDraft.metricId].shortLabel})
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("reports")}
          >
            Reports & CSV
          </button>
        </div>
      </div>

      {dueCheckIns.length > 0 && (
        <section className="panel-card stack-sm" aria-labelledby="due-now-heading">
          <h2 id="due-now-heading" className="panel-heading">Due now</h2>
          {dueCheckIns.map(({ metricId, status }) => (
            <div className="row-wrap" key={metricId}>
              <span>{METRIC_DEFINITIONS[metricId].name}</span>
              <span>{status === "due_no_entries" ? "First check-in due" : "Check-in due"}</span>
              <button type="button" className="btn-secondary" onClick={() => void openDraftForMetric(metricId)}>
                Log {METRIC_DEFINITIONS[metricId].shortLabel.toLowerCase()}
              </button>
            </div>
          ))}
        </section>
      )}

      {raisePrompt && (
        <section className="panel-card stack-sm" aria-labelledby="raise-reading-heading">
          <h2 id="raise-reading-heading" className="panel-heading">Consider raising this</h2>
          {raisePrompt.reasons.map((reason) => <p key={reason}>{RAISE_READING_REASONS[reason]}</p>)}
          <ul>
            {raisePrompt.readings.map(({ observation, referenceVersion, differenceText }) => (
              <li key={observation.observationId}>
                Day {getObservedMissionDay(observation)}
                {observation.timing.kind === "instant" ? ` ${formatUtcTimeHHMM(observation.timing.observedAtUtc)} UTC` : ""}
                {" · "}{METRIC_DEFINITIONS[observation.metricId].name} ·{" "}
                {formatObservationDisplay(observation, preferences.displayUnits).primaryText} ·{" "}
                {differenceText} · Reference version {referenceVersion}
              </li>
            ))}
          </ul>
          <p>{RAISE_READING_SUGGESTION}</p>
          <p>{describeMissionContact(preferences.helpMode)}</p>
          <p>{RAISE_READING_LIMIT}</p>
          <button type="button" className="btn-secondary" onClick={() => navigate("reports", raisePrompt.reportScope)}>
            Open report draft
          </button>
        </section>
      )}

      {activeDraft ? (
        <div className="notice-banner notice-banner-review" role="status">
          <div>
            <strong>Draft kept on this device.</strong>{" "}
            {METRIC_DEFINITIONS[activeDraft.metricId].name} entry in {activeDraft.stage} stage is waiting before adding to your log.
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("check_in")}
          >
            Open draft
          </button>
        </div>
      ) : null}

      {observations.length === 0 ? (
        <section className="panel-card stack-md" aria-labelledby="empty-overview-heading">
          <div>
            <h2 id="empty-overview-heading" className="panel-heading">
              No observations yet
            </h2>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              This personal profile starts blank using your device clock without synthetic demo records. Record a check-in or import your own CSV file when ready.
            </p>
          </div>
          <div className="row-wrap">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void openDraftForMetric("heart_rate")}
            >
              Start check-in
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("reports")}
            >
              Import CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("help")}
            >
              Help
            </button>
          </div>
        </section>
      ) : (
        <>
          {sleepInsight ? (
            <section
              className="panel-card next-step-strip"
              aria-labelledby="next-step-heading"
            >
              <div className="stack-sm">
                <span className="mono-label">Next step</span>
                <h2 id="next-step-heading" className="panel-heading">
                  {sleepInsight.summary}
                </h2>
                <span style={{ fontSize: 13, color: "var(--text-supporting)" }}>
                  {latestReview ? `Reviewed ${latestReview.reviewedAtUtc}` : "Educational · Prototype"} · Reference v
                  {sleepInsight.referenceVersion ?? "—"} · Rule {sleepInsight.ruleVersion}
                </span>
              </div>
              <button type="button" className="btn-primary" onClick={() => navigate("actions")}>
                Review sleep →
              </button>
            </section>
          ) : null}

          <section className="panel-card" aria-labelledby="latest-readings-heading">
            <div className="panel-header-row">
              <div>
                <h2 id="latest-readings-heading" className="panel-heading">
                  Latest readings
                </h2>
                <span className="mono-label">
                  Measured & self-reported · {activeProfile.mode === "demo" ? "Synthetic fixture" : "Local log"}
                </span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => navigate("explorer")}
              >
                Explore body systems →
              </button>
            </div>

            <div className="readings-rail">
              {METRIC_ORDER.map((metricId) => {
                const def = METRIC_DEFINITIONS[metricId];
                const obs = latestByMetric[metricId];
                const schedule = activeProfile.schedules[metricId];
                const schedStatus = evaluateMetricSchedule({
                  metricId,
                  latestObservation: obs,
                  schedule,
                  referenceNowUtc: currentReferenceNowUtc,
                });
                const comparison = obs ? compareObservationToReference(obs, activeReferencesByMetric[metricId]) : null;
                const status = getReadingStatus(obs, comparison, schedStatus);
                const statusId = `reading-status-${metricId}`;

                const display = obs
                  ? formatObservationDisplay(obs, preferences.displayUnits)
                  : null;
                const obsDay = obs ? getObservedMissionDay(obs) : null;
                const obsTime =
                  obs?.timing.kind === "instant"
                    ? obs.timing.missionTimeLabel
                    : obs?.timing.kind === "period"
                      ? obs.timing.sleepType.replace("_", " ")
                      : null;

                return (
                  <div key={metricId} className="reading-cell">
                    <div className="row-wrap" style={{ justifyContent: "space-between", gap: 4 }}>
                      <span className="mono-label">{def.shortLabel}</span>
                      {schedStatus.status === "past_interval" ? (
                        <span className="badge-review" title="Optional scheduled check-in interval elapsed">
                          Past interval
                        </span>
                      ) : schedStatus.status === "within_interval" ? (
                        <span className="badge-neutral">On schedule</span>
                      ) : schedStatus.status === "due_no_entries" ? (
                        <span className="badge-review">First check-in due</span>
                      ) : null}
                    </div>

                    {obs && display ? (
                      <>
                        <div className="reading-value tabular-value">
                          {display.valueOnlyText}
                          <span className="reading-unit">{display.unitLabel}</span>
                        </div>
                        <ReadingStatusBadge status={status} id={statusId} />
                        <div className="reading-sub">
                          Day {obsDay} · {obsTime}
                          {schedStatus.status === "past_interval" &&
                          schedStatus.ageLabel &&
                          schedStatus.intervalLabel
                            ? ` · ${schedStatus.ageLabel} ago / ${schedStatus.intervalLabel}`
                            : ""}
                        </div>
                        {obs.quality === "questionable" && <div>{NEEDS_RECHECK_LABEL}</div>}
                        <div className="reading-provenance">
                          {display.isConvertedDisplay
                            ? `Entered ${display.enteredText}`
                            : obs.method}
                        </div>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ marginTop: 4, fontSize: 12 }}
                          aria-describedby={statusId}
                          onClick={() => openMetricTrend(metricId)}
                        >
                          Trend & history
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="reading-missing">Not recorded</div>
                        <ReadingStatusBadge status={status} id={statusId} />
                        <div className="reading-sub">
                          {metricId === "blood_glucose"
                            ? "Optional measurement"
                            : "No entries yet"}
                        </div>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ marginTop: 6, fontSize: 12 }}
                          aria-describedby={statusId}
                          onClick={() => void openDraftForMetric(metricId)}
                        >
                          Record {def.shortLabel.toLowerCase()}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="overview-grid">
            <section className="panel-card" aria-labelledby="sleep-trend-heading">
              <div className="panel-header-row">
                <div>
                  <h2 id="sleep-trend-heading" className="panel-heading">
                    Sleep over time
                  </h2>
                  <p className="page-subtitle" style={{ fontSize: 13 }}>
                    Main sleep duration vs. personal reference (gaps remain unrecorded)
                  </p>
                </div>
                <div className="row-wrap">
                  <div className="segmented-group" role="group" aria-label="Chart range">
                    <button
                      type="button"
                      className="segmented-btn"
                      aria-pressed={trendRangeDays === 7}
                      onClick={() => setTrendRangeDays(7)}
                    >
                      7 days
                    </button>
                    <button
                      type="button"
                      className="segmented-btn"
                      aria-pressed={trendRangeDays === 30}
                      onClick={() => setTrendRangeDays(30)}
                    >
                      30 days
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => openMetricTrend("sleep")}
                  >
                    Full trends →
                  </button>
                </div>
              </div>

              <TrendChart
                metricId="sleep"
                observations={observations}
                reference={sleepRef}
                rangeDays={trendRangeDays}
                currentMissionDay={missionDay}
                displayUnits={preferences.displayUnits}
              />
            </section>

            <section className="panel-card stack-md" aria-labelledby="next-steps-heading">
              <div>
                <h2 id="next-steps-heading" className="panel-heading">
                  Next steps
                </h2>
                <p className="page-subtitle" style={{ fontSize: 13 }}>
                  Conservative educational review · Not medical advice
                </p>
              </div>

              <div className="action-list">
                <button
                  type="button"
                  className="action-row-btn"
                  onClick={() => navigate("actions")}
                >
                  <div>
                    <div className="action-row-title">Review sleep routine</div>
                    <div className="action-row-desc">
                      Educational guidance & mission context
                    </div>
                  </div>
                  <span className="action-row-trailing">Open →</span>
                </button>

                <button
                  type="button"
                  className="action-row-btn"
                  onClick={() => void openDraftForMetric("blood_pressure")}
                >
                  <div>
                    <div className="action-row-title">Log blood pressure check-in</div>
                    <div className="action-row-desc">
                      Manual systolic & diastolic pair with explicit method
                    </div>
                  </div>
                  <span className="action-row-trailing">Record →</span>
                </button>

                <button
                  type="button"
                  className="action-row-btn"
                  onClick={() => navigate("sources")}
                >
                  <div>
                    <div className="action-row-title">Offline source summaries</div>
                    <div className="action-row-desc">
                      NASA, CDC & NIST unit references cached locally
                    </div>
                  </div>
                  <span className="action-row-trailing">View →</span>
                </button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
