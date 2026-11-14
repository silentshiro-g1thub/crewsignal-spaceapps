import { MeasurementEducation } from '../components/MeasurementEducation';
import { useState } from "react";
import {
  BODY_SYSTEM_DEFINITIONS,
  BODY_SYSTEM_RESEARCH,
  EVIDENCE_REGISTRY,
  RADIATION_RESEARCH,
  compareObservationToReference,
  evaluateMetricSchedule,
  formatObservationDisplay,
  getLatestObservationsByMetric,
  getMetricAction,
  getObservedMissionDay,
  getReadingStatus,
  METRIC_DEFINITIONS,
} from "../shared/src";
import { BodyExplorerVisual } from "../components/BodyExplorerVisual";
import { ReadingStatusBadge } from "../components/ReadingStatusBadge";
import { useTabList } from "../components/useTabList";
import { useApp } from "../state/AppContext";

export function ExplorerRoute() {
  const {
    snapshot,
    activeProfile,
    preferences,
    selectedBodySystem,
    setSelectedBodySystem,
    activeReferencesByMetric,
    currentReferenceNowUtc,
    navigate,
    openResearch,
    setSelectedTrendMetric,
    openDraftForMetric,
    openAction,
  } = useApp();

  const [detailTab, setDetailTab] = useState<"summary" | "context">("summary");
  const detailTabs = useTabList({
    ids: ["summary", "context"] as const,
    selected: detailTab,
    onSelect: setDetailTab,
    idPrefix: "explorer-detail",
  });

  if (!snapshot || !activeProfile) {
    return (
      <div className="panel-card">
        <p style={{ margin: 0 }}>Loading body systems explorer…</p>
      </div>
    );
  }

  const systemDef =
    BODY_SYSTEM_DEFINITIONS.find((b) => b.id === selectedBodySystem) ??
    BODY_SYSTEM_DEFINITIONS[0]!;
  const latestByMetric = getLatestObservationsByMetric(snapshot.profileData.observations);

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 className="page-title">Health Explorer</h1>
          <p className="page-subtitle">
            Browse coverage honestly by physiological system. Uncovered systems remain explicitly unassessed.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate("sources")}
        >
          View research context
        </button>
      </div>

      <div className="explorer-layout">
        {/* Left synchronized selector list */}
        <section className="panel-card stack-sm" aria-labelledby="systems-list-heading">
          <h2 id="systems-list-heading" className="panel-heading">
            Systems
          </h2>
          <div className="list-selector" role="group" aria-label="Body systems">
            {BODY_SYSTEM_DEFINITIONS.map((sys) => {
              const selected = sys.id === selectedBodySystem;
              return (
                <button
                  key={sys.id}
                  type="button"
                  className="selector-row-btn"
                  data-selected={selected ? "true" : undefined}
                  aria-pressed={selected}
                  onClick={() => setSelectedBodySystem(sys.id)}
                >
                  <div>
                    <div style={{ fontWeight: "var(--weight-heading)", color: "var(--text-primary)" }}>
                      {sys.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-supporting)" }}>
                      {sys.coverageLabel}
                    </div>
                  </div>
                  <span className="mono-label" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                    {sys.metricIds.length} {sys.metricIds.length === 1 ? "metric" : "metrics"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Center anatomical navigation: 3D model with SVG diagram fallback */}
        <section className="panel-card" aria-labelledby="body-diagram-heading">
          <h2 id="body-diagram-heading" className="panel-heading" style={{ textAlign: "center" }}>
            Regional map
          </h2>
          <BodyExplorerVisual selectedId={selectedBodySystem} onSelect={setSelectedBodySystem} />
        </section>

        {/* Right synchronized detail card */}
        <section className="panel-card explorer-detail-panel stack-md" aria-labelledby="system-detail-heading">
          <div className="row-wrap" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 id="system-detail-heading" className="panel-heading">
                {systemDef.name}
              </h2>
              <span className="badge-neutral" style={{ marginTop: 6 }}>
                {systemDef.coverageLabel}
              </span>
            </div>

            <div className="segmented-group" role="tablist" aria-label="System detail sections">
              <button type="button" className="segmented-btn" {...detailTabs.getTabProps("summary")}>
                Summary
              </button>
              <button type="button" className="segmented-btn" {...detailTabs.getTabProps("context")}>
                Mission context
              </button>
            </div>
          </div>

          <div {...detailTabs.panelProps} style={{ display: "contents" }}>
          {detailTab === "summary" ? (
            <>
              <div className="notice-banner" style={{ padding: "12px 14px" }}>
                <div>
                  <strong>Scope:</strong> {systemDef.summary}
                </div>
              </div>

              {systemDef.metricIds.length === 0 ? (
                <div className="panel-card" style={{ background: "var(--surface-raised)" }}>
                  <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>
                    Not assessed
                  </p>
                  <p style={{ margin: "6px 0 0", color: "var(--text-supporting)", fontSize: 14 }}>
                    {systemDef.limitation}
                  </p>
                </div>
              ) : (
                <div className="stack-sm">
                  {systemDef.metricIds.map((metricId) => {
                    const def = METRIC_DEFINITIONS[metricId];
                    const obs = latestByMetric[metricId];
                    const action = getMetricAction(metricId);
                    const ref = activeReferencesByMetric[metricId];
                    const cmp = obs ? compareObservationToReference(obs, ref) : null;
                    const status = getReadingStatus(obs, cmp, evaluateMetricSchedule({
                      metricId,
                      latestObservation: obs,
                      schedule: activeProfile.schedules[metricId],
                      referenceNowUtc: currentReferenceNowUtc,
                    }));
                    const display = obs
                      ? formatObservationDisplay(obs, preferences.displayUnits)
                      : null;

                    return (
                      <div
                        key={metricId}
                        className="panel-card stack-sm"
                        style={{ background: "var(--surface-raised)", padding: "14px 16px" }}
                      >
                        <div className="row-wrap" style={{ justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontWeight: "var(--weight-heading)" }}>{def.name}</div>
                            <div style={{ fontSize: 12, color: "var(--text-supporting)" }}>
                              {def.entryMode === "self_report" ? "Self-reported" : "Manual spot observation"}
                            </div>
                          </div>
                          {obs && display ? (
                            <div className="reading-value tabular-value" style={{ fontSize: 22 }}>
                              {display.primaryText}
                            </div>
                          ) : null}
                        </div>
                        <ReadingStatusBadge status={status} />

                        {obs ? (
                          <div style={{ fontSize: 13, color: "var(--text-body)" }}>
                            Day {getObservedMissionDay(obs)} · {obs.method} ({obs.context})
                            {cmp ? (
                              <div style={{ color: "var(--text-supporting)", marginTop: 4 }}>
                                {cmp.comparisonAvailable
                                  ? `vs. Reference v${cmp.referenceVersion}: ${cmp.differenceText}`
                                  : cmp.unavailableReason}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: "var(--text-supporting)" }}>
                            No reading recorded yet. Missing optional observations are never scored as zero.
                          </div>
                        )}

                        <MeasurementEducation definition={def} />
                        <div className="row-wrap">
                          <button type="button" className="btn-ghost" onClick={() => openAction(action.actionId)}>
                            {action.title}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void openDraftForMetric(metricId)}
                          >
                            Record {def.shortLabel.toLowerCase()}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => {
                              setSelectedTrendMetric(metricId);
                              navigate("trends");
                            }}
                          >
                            View trend
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="stack-md">
              <div className="notice-banner" style={{ padding: "14px" }}>
                <div>
                  <strong>Boundary & limitation:</strong> {systemDef.limitation}
                </div>
              </div>
              {[BODY_SYSTEM_RESEARCH[systemDef.id], RADIATION_RESEARCH].map((research) => (
                <section className="panel-card stack-sm" key={research.sourceId}>
                  <h3 className="panel-heading">
                    {research === RADIATION_RESEARCH ? "Radiation research" : "Research for this system"}
                  </h3>
                  <p>{research.text}</p>
                  <button type="button" className="btn-secondary" onClick={() => openResearch(research)}>
                    {EVIDENCE_REGISTRY[research.sourceId]!.shortTitle}
                  </button>
                </section>
              ))}
              <div className="row-wrap">
                <button type="button" className="btn-secondary" onClick={() => navigate("sources")}>
                  View all sources
                </button>
                <button type="button" className="btn-secondary" onClick={() => navigate("actions")}>
                  View available actions
                </button>
              </div>
            </div>
          )}
          </div>
        </section>
      </div>
    </div>
  );
}
