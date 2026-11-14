import { ExternalLink, HardDrive } from "lucide-react";
import { EVIDENCE_REGISTRY, EVIDENCE_LIST, METRIC_DEFINITIONS } from "../shared/src";
import { desktopBridge } from "../bridge/desktopBridge";
import { useApp } from "../state/AppContext";

export function SourcesRoute() {
  const { showToast, navigate, selectedResearch, researchReturnRoute } = useApp();

  const sourceList = selectedResearch ? [EVIDENCE_REGISTRY[selectedResearch.sourceId]!] : EVIDENCE_LIST;

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast({ tone: "neutral", title: "Source URL copied" });
    } catch {
      showToast({ tone: "danger", title: "Could not copy source URL", detail: "Select and copy the URL shown on the card." });
    }
  };

  const handleOpenExternal = async (url: string, title: string) => {
    try {
      await desktopBridge.openExternalUrl(url);
    } catch (err) {
      showToast({
        tone: "danger",
        title: "Could not open browser link",
        detail: `${title}: ${String(err)}. You can copy the source URL.`,
      });
    }
  };

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sources & Evidence</h1>
          <p className="page-subtitle">
            Concise attributed research and unit-conversion summaries bundled offline. Opening full pages launches your system browser.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate(selectedResearch ? researchReturnRoute : "actions")}>
          {selectedResearch ? "Back to previous screen" : "Back to Actions"}
        </button>
      </div>

      <div className="notice-banner" role="status">
        <div>
          <strong>Independent prototype attribution:</strong> Bundled research sources provide mission and measurement context. Neither affiliation nor endorsement is implied.
        </div>
      </div>

      <div className="stack-md">
        {sourceList.map((ev) => (
          <section
            key={ev.sourceId}
            className="panel-card stack-sm"
            aria-labelledby={`src-${ev.sourceId}`}
          >
            <div className="row-wrap" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 id={`src-${ev.sourceId}`} className="panel-heading">
                  {ev.title}
                </h2>
                <div style={{ fontSize: 13, color: "var(--text-supporting)", marginTop: 2 }}>
                  {ev.publisher} · {ev.summaryVersion} · Checked {ev.checkedDate}
                </div>
              </div>
              <span className="status-chip">
                <HardDrive size={14} aria-hidden="true" />
                <span>{ev.offlineAccessNote}</span>
              </span>
            </div>

            {selectedResearch && <p>{selectedResearch.text}</p>}
            <p style={{ margin: 0, color: "var(--text-body)" }}>{ev.summaryText}</p>
            <p style={{ overflowWrap: "anywhere", userSelect: "text" }}>{ev.url}</p>

            <div style={{ fontSize: 13, color: "var(--text-supporting)" }}>
              <strong>Limitation:</strong> {ev.limitations}
            </div>

            <div className="row-wrap" style={{ justifyContent: "space-between", paddingTop: 6 }}>
              <div className="chip-group">
                {ev.relatedMetricIds.map((mId) => (
                  <span key={mId} className="badge-neutral">
                    {METRIC_DEFINITIONS[mId].shortLabel}
                  </span>
                ))}
              </div>
              <button type="button" className="btn-secondary" onClick={() => void handleCopyUrl(ev.url)}>
                Copy source URL
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleOpenExternal(ev.url, ev.shortTitle)}
              >
                <ExternalLink size={15} aria-hidden="true" />
                <span>Open source URL</span>
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
