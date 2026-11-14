import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BookOpen,
  ClipboardPlus,
  Compass,
  Download,
  FileText,
} from 'lucide-react';
import {
  METRIC_DEFINITIONS,
  METRIC_ORDER,
  RAISE_READING_LIMIT,
  RAISE_READING_REASONS,
  RAISE_READING_SUGGESTION,
  buildRaiseReadingPrompt,
  buildSleepInsight,
  getMetricAction,
  findCurrentInsightReview,
  compareObservationToReference,
  describeMissionContact,
  formatObservationDisplay,
  formatUtcTimeHHMM,
  getObservedMissionDay,
  getReadingStatus,
  resolveActiveReference,
} from '../shared';
import { useAppState } from '../state/AppStateContext';
import { SleepChart } from '../components/SleepChart';
import { ReadingStatusBadge } from '../components/ReadingStatusBadge';

export function OverviewPage() {
  const {
    activeProfile,
    currentMissionDay,
    scheduleStatusByMetric,
    profileObservations,
    profileReferences,
    profileInsights,
    latestByMetric,
    coveredMetricCount,
    preferences,
  } = useAppState();

  const raisePrompt = useMemo(() => activeProfile && buildRaiseReadingPrompt({
    profileId: activeProfile.profileId,
    observations: profileObservations,
    references: profileReferences,
  }), [activeProfile, profileObservations, profileReferences]);

  const latestBp = latestByMetric.blood_pressure;
  const lastBpDisplay = latestBp
    ? `${formatObservationDisplay(latestBp, preferences.displayUnits).primaryText} · ${
        latestBp.timing.kind === 'instant'
          ? formatUtcTimeHHMM(latestBp.timing.observedAtUtc)
          : formatUtcTimeHHMM(latestBp.recordedAtUtc)
      }`
    : 'No blood pressure logged yet';

  const sleepRef = useMemo(
    () =>
      resolveActiveReference({
        profileId: activeProfile?.profileId ?? '',
        metricId: 'sleep',
        references: profileReferences,
        observations: profileObservations,
        nowUtc: activeProfile?.snapshotUtc ?? new Date().toISOString(),
      }),
    [activeProfile, profileReferences, profileObservations],
  );

  const latestSleep = latestByMetric.sleep;
  const sleepComparison = useMemo(
    () => (latestSleep ? compareObservationToReference(latestSleep, sleepRef) : null),
    [latestSleep, sleepRef],
  );

  const currentSleepInsight = useMemo(() => {
    if (!latestSleep) return null;
    return buildSleepInsight({
      observation: latestSleep,
      reference: sleepRef,
      createdAtUtc: activeProfile?.snapshotUtc ?? latestSleep.recordedAtUtc,
    });
  }, [latestSleep, sleepRef, activeProfile]);
  const sleepReviewed = findCurrentInsightReview(profileInsights, currentSleepInsight);

  const scheduledItems = useMemo(
    () =>
      METRIC_ORDER.map((id) => scheduleStatusByMetric[id]).filter(
        (s) => s.status !== 'not_scheduled',
      ),
    [scheduleStatusByMetric],
  );

  return (
    <div className="cs-stack" style={{ gap: '20px' }}>
      <header className="cs-page-header" style={{ marginBottom: 0 }}>
        <div>
          <span className="cs-mono-stamp">
            {activeProfile?.alias ?? activeProfile?.label ?? 'SIM-01 Demo'} · Day {currentMissionDay}
          </span>
          <h1 className="cs-page-title" style={{ marginTop: '4px' }}>
            Overview
          </h1>
          <p className="cs-helper" style={{ marginTop: '4px' }}>
            Last log entry: <span className="cs-mono-value">{lastBpDisplay}</span> ·{' '}
            <span className="cs-tabular">{coveredMetricCount} of 6</span> indicator types logged (
            <span className="cs-tabular">{profileObservations.length}</span> total entries)
          </p>
        </div>

        <div className="cs-row">
          <Link to="/demo/check-in" className="cs-btn cs-btn-primary">
            <ClipboardPlus size={16} aria-hidden="true" />
            <span>Start check-in</span>
          </Link>
          <Link to="/demo/reports" className="cs-btn cs-btn-secondary">
            <Download size={16} aria-hidden="true" />
            <span>Prepare report</span>
          </Link>
        </div>
      </header>

      {raisePrompt && (
        <section className="cs-card cs-stack" aria-labelledby="raise-reading-heading">
          <h2 id="raise-reading-heading" className="cs-section-title">Consider raising this</h2>
          {raisePrompt.reasons.map((reason) => <p key={reason}>{RAISE_READING_REASONS[reason]}</p>)}
          <ul>
            {raisePrompt.readings.map(({ observation, referenceVersion, differenceText }) => (
              <li key={observation.observationId}>
                Day {getObservedMissionDay(observation)}
                {observation.timing.kind === 'instant' ? ` ${formatUtcTimeHHMM(observation.timing.observedAtUtc)} UTC` : ''}
                {' · '}{METRIC_DEFINITIONS[observation.metricId].name} ·{' '}
                {formatObservationDisplay(observation, preferences.displayUnits).primaryText} ·{' '}
                {differenceText} · Reference version {referenceVersion}
              </li>
            ))}
          </ul>
          <p>{RAISE_READING_SUGGESTION}</p>
          <p>{describeMissionContact(preferences.helpMode)}</p>
          <p className="cs-helper">{RAISE_READING_LIMIT}</p>
          <Link to="/demo/reports" state={raisePrompt.reportScope} className="cs-btn cs-btn-secondary">
            Open report draft
          </Link>
        </section>
      )}

      <div className="cs-overview">
        {/* Next step: the sleep comparison is stated once (review P2: calmer Overview). */}
        <section
          className="cs-card cs-stack cs-overview-next"
          aria-labelledby="sleep-focus-heading"
          style={{ gap: '10px' }}
        >
          {latestSleep ? (
            <>
              <span className="cs-mono-stamp">
                Next step · Latest sleep period · Day {getObservedMissionDay(latestSleep)}
              </span>
              <h2 id="sleep-focus-heading" className="cs-section-title">
                {formatObservationDisplay(latestSleep, preferences.displayUnits).primaryText}
                {sleepComparison?.comparisonAvailable && sleepComparison.differenceText
                  ? ` · ${sleepComparison.differenceText}`
                  : ''}
              </h2>
              {sleepReviewed && (
                <p className="cs-helper">Reviewed educational note · {sleepReviewed.reviewedAtUtc}</p>
              )}
              <div className="cs-row">
                <Link to={`/demo/actions#${getMetricAction('sleep').actionId}`} className="cs-btn cs-btn-secondary">
                  <FileText size={16} aria-hidden="true" />
                  <span>Review sleep routine</span>
                </Link>
                {(currentSleepInsight?.sourceIds ?? []).map((id) => (
                  <Link key={id} to={`/demo/sources/${id}`} className="cs-btn cs-btn-ghost">
                    <BookOpen size={16} aria-hidden="true" />
                    <span>{id} · {currentSleepInsight?.sourceVersions[id]}</span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="cs-mono-stamp">
                {profileObservations.length === 0
                  ? 'No observations logged yet'
                  : 'No sleep period logged yet'}
              </span>
              <h2 id="sleep-focus-heading" className="cs-section-title">
                {profileObservations.length === 0
                  ? 'Ready to record your first observation'
                  : `${profileObservations.length} logged observation${profileObservations.length === 1 ? '' : 's'} (no sleep period recorded)`}
              </h2>
              <p className="cs-helper">
                {profileObservations.length === 0
                  ? `${activeProfile?.label} currently has zero recorded entries. Start a check-in or restore a synthetic scenario from Settings.`
                  : `${activeProfile?.label} does not have a sleep period yet. Record a sleep entry or review schedule status below.`}
              </p>
              <div className="cs-row">
                <Link to="/demo/check-in" className="cs-btn cs-btn-primary">
                  Record first observation
                </Link>
                <Link to="/demo/settings" className="cs-btn cs-btn-secondary">
                  Open data &amp; scenarios
                </Link>
              </div>
            </>
          )}
        </section>

        {/* One joined readings group: 2x3 phone, 3x2 tablet, six-reading rail on
            desktop, one column when the space is narrow or the text is large. */}
        <section
          aria-labelledby="snapshot-grid-heading"
          className="cs-stack cs-overview-readings"
          style={{ gap: '10px' }}
        >
          <div className="cs-row" style={{ justifyContent: 'space-between' }}>
            <h2 id="snapshot-grid-heading" className="cs-section-title">
              Latest readings ({coveredMetricCount} of 6)
            </h2>
            <Link to="/demo/explorer" className="cs-btn cs-btn-ghost">
              <Compass size={16} aria-hidden="true" />
              <span>Body explorer</span>
            </Link>
          </div>
          <div className="cs-readings-wrap">
            <ul className="cs-readings" role="list">
              {METRIC_ORDER.map((metricId) => {
                const def = METRIC_DEFINITIONS[metricId];
                const action = getMetricAction(metricId);
                const obs = latestByMetric[metricId];
                const formatted = obs
                  ? formatObservationDisplay(obs, preferences.displayUnits)
                  : null;
                const activeRef =
                  metricId === 'mood'
                    ? null
                    : resolveActiveReference({
                        profileId: activeProfile?.profileId ?? '',
                        metricId,
                        references: profileReferences,
                        observations: profileObservations,
                        nowUtc: activeProfile?.snapshotUtc ?? new Date().toISOString(),
                      });
                const cmp = obs ? compareObservationToReference(obs, activeRef) : null;
                const sched = scheduleStatusByMetric[metricId];
                const time = obs
                  ? obs.timing.kind === 'instant'
                    ? formatUtcTimeHHMM(obs.timing.observedAtUtc)
                    : formatUtcTimeHHMM(obs.timing.reportedAtUtc)
                  : null;
                // Sleep's difference is already the next-step heading; avoid repeating it.
                const referenceLine = cmp?.comparisonAvailable
                  ? metricId === 'sleep' ? `Reference v${cmp.referenceVersion}` : cmp.differenceText
                  : cmp?.unavailableReason;
                const statusId = `reading-status-${metricId}`;
                const valueId = `${statusId}-value`;
                return (
                  <li
                    key={metricId}
                    className="cs-reading"
                    aria-labelledby={formatted ? `${statusId}-name ${statusId}-value` : `${statusId}-name`}
                    aria-describedby={statusId}
                  >
                    <span id={`${statusId}-name`} className="cs-mono-stamp">{def.shortLabel}</span>
                    {obs && formatted ? (
                      <>
                        <span id={valueId} className="cs-mono-value cs-reading-value">
                          {formatted.primaryText}
                        </span>
                        <ReadingStatusBadge id={statusId} status={getReadingStatus(obs, cmp, sched)} />
                        {formatted.isConvertedDisplay && (
                          <span className="cs-helper">Entered: {formatted.enteredText}</span>
                        )}
                        {referenceLine && <span className="cs-helper">{referenceLine}</span>}
                        <span className="cs-mono-stamp">
                          {obs.method} · {time} UTC
                          {sched.status === 'past_interval' ? ` · Overdue ${sched.ageLabel}` : ''}
                        </span>
                        <Link
                          to={`/demo/check-in?metric=${metricId}`}
                          className="cs-reading-link"
                          aria-label={`Log ${def.shortLabel.toLowerCase()}`}
                          aria-describedby={`${valueId} ${statusId}`}
                        >
                          Log
                        </Link>
                      </>
                    ) : (
                      <>
                        <span className="cs-reading-value cs-reading-missing">Not recorded</span>
                        <ReadingStatusBadge id={statusId} status="not_logged" />
                        <Link
                          to={`/demo/check-in?metric=${metricId}`}
                          className="cs-reading-link"
                          aria-label={`Add ${def.shortLabel.toLowerCase()}`}
                          aria-describedby={statusId}
                        >
                          Add
                        </Link>
                      </>
                    )}
                    {(metricId !== 'sleep' || !latestSleep) && (
                      <Link to={`/demo/actions#${action.actionId}`} className="cs-reading-link">
                        {action.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {latestSleep && (
          <section
            className="cs-card cs-stack cs-overview-chart"
            aria-labelledby="sleep-chart-heading"
            style={{ gap: '10px' }}
          >
            <div className="cs-row" style={{ justifyContent: 'space-between' }}>
              <h2 id="sleep-chart-heading" className="cs-section-title">
                Sleep over time
              </h2>
              <Link to="/demo/trends" className="cs-btn cs-btn-ghost">
                <Activity size={16} aria-hidden="true" />
                <span>View trends</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <SleepChart
              observations={profileObservations}
              sleepReference={sleepRef}
              range="7d"
              currentMissionDay={currentMissionDay}
              compact
              allowTableToggle={false}
            />
          </section>
        )}

        {scheduledItems.length > 0 && (
          <section
            className="cs-banner cs-overview-schedule"
            aria-label="Configured check-in schedules"
          >
            <div className="cs-stack" style={{ gap: '4px' }}>
              <span className="cs-mono-stamp">Configured schedule status</span>
              {scheduledItems.map((sched) => {
                const name = METRIC_DEFINITIONS[sched.metricId].shortLabel;
                const detail =
                  sched.status === 'past_interval'
                    ? `Overdue · ${sched.ageLabel} since last entry (${sched.intervalLabel} interval)`
                    : sched.status === 'within_interval'
                      ? `Within ${sched.intervalLabel} interval · last logged ${sched.ageLabel} ago`
                      : `First check-in due · ${sched.intervalLabel} interval configured`;
                return (
                  <div key={sched.metricId} style={{ fontSize: '0.875rem' }}>
                    <strong>{name}</strong>: {detail}
                  </div>
                );
              })}
            </div>
            <Link
              to={`/demo/check-in?metric=${scheduledItems[0]!.metricId}`}
              className="cs-btn cs-btn-secondary"
            >
              Log scheduled reading
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
