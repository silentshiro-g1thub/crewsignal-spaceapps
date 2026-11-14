import { useEffect } from "react";
import {
  ACTION_CONTENT_LIST,
  buildMetricInsight,
  EVIDENCE_REGISTRY,
  getLatestObservationsByMetric,
  guidanceReviewIdentity,
  METRIC_ACTION_IDS,
  METRIC_ORDER,
  type ActionContent,
  type Insight,
} from "../shared/src";
import { currentActionReview, desktopBridge } from "../bridge/desktopBridge";
import { useApp } from "../state/AppContext";

export function ActionsRoute() {
  const {
    snapshot,
    activeProfile,
    currentReferenceNowUtc,
    activeReferencesByMetric,
    refreshSnapshot,
    showToast,
    navigate,
    selectedActionId,
  } = useApp();

  const actionsLoaded = Boolean(snapshot && activeProfile);
  useEffect(() => {
    if (actionsLoaded && selectedActionId) document.getElementById(`action-${selectedActionId}`)?.focus();
  }, [actionsLoaded, selectedActionId]);

  if (!snapshot || !activeProfile) {
    return (
      <div className="panel-card">
        <p style={{ margin: 0 }}>Loading actions…</p>
      </div>
    );
  }

  const latestByMetric = getLatestObservationsByMetric(snapshot.profileData.observations);
  const insightsByAction = new Map<string, Insight>();
  for (const metricId of METRIC_ORDER) {
    const observation = latestByMetric[metricId];
    if (!observation) continue;
    const insight = buildMetricInsight(metricId, {
      observation,
      reference: activeReferencesByMetric[metricId],
      createdAtUtc: currentReferenceNowUtc,
    });
    if (insight) insightsByAction.set(METRIC_ACTION_IDS[metricId], insight);
  }

  const handleMarkReviewed = async (action: ActionContent, insight: Insight, sourceVersion: string) => {
    const reviewId = guidanceReviewIdentity(insight);
    if (!reviewId) return;
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    await desktopBridge.recordActionReview(activeProfile.profileId, {
      reviewId,
      profileId: insight.profileId,
      ruleId: insight.ruleId,
      sourceIds: insight.sourceIds,
      sourceVersions: insight.sourceVersions,
      actionId: action.actionId,
      observationId: insight.observationId,
      referenceId: insight.referenceId,
      referenceVersion: insight.referenceVersion,
      ruleVersion: insight.ruleVersion,
      sourceVersion,
      reviewedAtUtc: nowIso,
      reviewed: true,
    });
    await refreshSnapshot(activeProfile.profileId);
    showToast({
      tone: "success",
      title: "Action marked reviewed",
      detail: `Reference v${insight.referenceVersion} · ${insight.ruleVersion}`,
    });
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 className="page-title">Actions</h1>
          <p className="page-subtitle">
            Conservative educational review steps tied to explicit rule, reference, and cached source versions.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate("sources")}>
          Open Sources & Evidence
        </button>
      </div>

      <div className="stack-md">
        {ACTION_CONTENT_LIST.map((action) => {
          const insight = insightsByAction.get(action.actionId);
          const sourceVersion = insight?.sourceVersions[action.sourceIds[0] ?? ""] ?? action.sourceVersion;
          const reviewed = currentActionReview(snapshot.profileData.actionReviews, insight ?? null);
          const relatedEvidence = action.sourceIds
            .map((id) => EVIDENCE_REGISTRY[id])
            .filter((e): e is NonNullable<typeof e> => Boolean(e));

          return (
            <section
              key={action.actionId}
              className="panel-card stack-md"
              aria-labelledby={`action-${action.actionId}`}
            >
              <div className="row-wrap" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2 id={`action-${action.actionId}`} className="panel-heading" tabIndex={-1}>
                    {action.title}
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-supporting)" }}>
                    {action.triggerSummary}
                  </p>
                </div>
                <div className="row-wrap">
                  {reviewed ? (
                    <span className="badge-success">Reviewed (current version)</span>
                  ) : null}
                  <span className={action.enabled ? "badge-neutral" : "badge-review"}>
                    {action.badgeLabel}
                  </span>
                </div>
              </div>

              {!action.enabled && action.disabledReason ? (
                <div className="notice-banner" role="status">
                  <div>
                    <strong>Disabled by safety gate:</strong> {action.disabledReason}
                  </div>
                </div>
              ) : (
                <>
                  {insight ? (
                    <div className="notice-banner" style={{ padding: "12px 14px" }}>
                      <div className="stack-sm">
                        <strong>{insight.summary}</strong>
                        <span style={{ fontSize: 13, color: "var(--text-supporting)" }}>
                          Reading {insight.observationId} · Reference {insight.referenceId} (v{insight.referenceVersion})
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-body)" }}>
                    {action.steps.map((step) => (
                      <li key={step} style={{ marginBottom: 4 }}>
                        {step}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div style={{ fontSize: 13, color: "var(--text-supporting)" }}>
                <p>{action.applicability}</p>
                <strong>Scope limitation:</strong> {action.limitation}
              </div>

              {reviewed && <p>Reviewed {reviewed.reviewedAtUtc}</p>}
              <div className="row-wrap" style={{ justifyContent: "space-between", borderTop: "1px solid var(--border-hairline)", paddingTop: 12 }}>
                <div className="row-wrap" style={{ fontSize: 12, color: "var(--text-supporting)" }}>
                  <span className="mono-label">
                    Rule {action.ruleVersion} · {action.sourceVersion}
                  </span>
                  {relatedEvidence.map((ev) => (
                    <button
                      key={ev.sourceId}
                      type="button"
                      className="btn-link"
                      style={{ fontSize: 12 }}
                      onClick={() => navigate("sources")}
                    >
                      {ev.shortTitle}
                    </button>
                  ))}
                </div>

                {insight ? (
                  <button
                    type="button"
                    className={reviewed ? "btn-secondary" : "btn-primary"}
                    disabled={Boolean(reviewed)}
                    onClick={() => void handleMarkReviewed(action, insight, sourceVersion)}
                  >
                    {reviewed ? "Reviewed for current version" : "Mark reviewed"}
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
