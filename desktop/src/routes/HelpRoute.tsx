import { useEffect, useRef } from "react";
import { ExternalLink, HardDrive } from "lucide-react";
import {
  describeMissionContact, EVIDENCE_LIST, GETTING_STARTED_INTRO, GETTING_STARTED_PERSONAL,
  GETTING_STARTED_STEPS, GETTING_STARTED_STORAGE, resolveHelpContent,
} from "../shared/src";
import { ReadingStatusLegend } from "../components/ReadingStatusBadge";
import { desktopBridge } from "../bridge/desktopBridge";
import { useApp } from "../state/AppContext";

export function HelpRoute() {
  const {
    preferences, setHelpMode, activeDraft, activeProfile, navigate, gettingStarted,
    openGettingStarted, openGettingStartedStep, showHelpProcedures, returnFromHelp,
  } = useApp();
  const helpCard = resolveHelpContent(preferences.helpMode);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus(); }, [gettingStarted]);

  if (gettingStarted) {
    const isDemo = activeProfile?.mode === "demo";
    return (
      <div className="stack-lg">
        <div className="page-header">
          <div>
            <h1 ref={heading} tabIndex={-1} className="page-title">Getting started</h1>
            <p className="page-subtitle">{GETTING_STARTED_INTRO}</p>
          </div>
          <div className="row-wrap">
            <button type="button" className="btn-secondary" onClick={showHelpProcedures}>Help procedures and sources</button>
            <button type="button" className="btn-secondary" onClick={returnFromHelp}>Return to previous screen</button>
          </div>
        </div>
        {activeProfile?.mode === "personal" && <p>{GETTING_STARTED_PERSONAL}</p>}
        <ol className="stack-md" style={{ paddingInlineStart: 24, marginBlock: 0 }}>
          {GETTING_STARTED_STEPS.map((step) => (
            <li key={step.route} className="panel-card">
              <div className="stack-sm">
                <h2 className="panel-heading">{step.title}</h2>
                <p>{step.body}</p>
                {isDemo && <button type="button" className="btn-secondary" onClick={() => openGettingStartedStep(step.route)}>{step.action}</button>}
              </div>
            </li>
          ))}
        </ol>
        <section className="panel-card stack-sm">
          <h2 className="panel-heading">Local storage and export</h2>
          <p>{GETTING_STARTED_STORAGE} On Windows, Export Report JSON writes a copy to the location you select. Print / Save PDF opens the system print dialog. Any onward sharing is up to you.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <h1 ref={heading} tabIndex={-1} className="page-title">Help</h1>
          <p className="page-subtitle">
            Always reachable offline, before any check-in, mid-draft, or if the observation log fails to load.
          </p>
        </div>
        <div className="row-wrap">
          <button type="button" className="btn-secondary" onClick={openGettingStarted}>Getting started</button>
          <button type="button" className="btn-secondary" onClick={returnFromHelp}>Return to previous screen</button>
          {activeDraft && activeDraft.profileId === activeProfile?.profileId ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate("check_in")}
            >
              Return to open draft
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("sources")}
          >
            View offline sources
          </button>
        </div>
      </div>

      <section className="panel-card stack-md">
        <ReadingStatusLegend />
      </section>

      <section className="panel-card stack-md" aria-labelledby="help-procedure-heading">
        <div className="row-wrap" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 id="help-procedure-heading" className="panel-heading">
              {helpCard.statusTitle}
            </h2>
            {helpCard.versionLabel ? (
              <div style={{ fontSize: 13, color: "var(--text-supporting)", marginTop: 2 }}>
                {helpCard.versionLabel}
              </div>
            ) : null}
          </div>
          <div className="row-wrap">
            {helpCard.fixtureBanner ? (
              <span className="badge-review">{helpCard.fixtureBanner}</span>
            ) : null}
            <span className="status-chip">
              <HardDrive size={14} aria-hidden="true" />
              <span>Offline cached</span>
            </span>
          </div>
        </div>

        <p style={{ margin: 0, color: "var(--text-body)" }}>{helpCard.body}</p>
        <p>{describeMissionContact(preferences.helpMode)}</p>

        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-body)" }}>
          {helpCard.steps.map((step) => (
            <li key={step} style={{ marginBottom: 4 }}>
              {step}
            </li>
          ))}
        </ul>

        <div className="notice-banner" role="status">
          <div>
            <strong>Explicit boundary:</strong> {helpCard.limitation}
          </div>
        </div>

        <div>
          <p className="mono-label" style={{ marginBottom: 6 }}>
            Offline capabilities & boundaries
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-supporting)", fontSize: 13 }}>
            {helpCard.offlineFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>

        <details
          style={{
            borderTop: "1px solid var(--border-hairline)",
            paddingTop: 12,
            fontSize: 13,
            color: "var(--text-supporting)",
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--text-body)" }}>
            Diagnostic preview options (C07 test fixture)
          </summary>
          <div className="row-wrap" style={{ justifyContent: "space-between", marginTop: 10 }}>
            <label className="row-wrap" style={{ fontSize: 13, cursor: "pointer", color: "var(--text-body)" }}>
              <input
                type="checkbox"
                checked={preferences.helpMode === "configured_fixture"}
                onChange={(e) =>
                  void setHelpMode(e.target.checked ? "configured_fixture" : "unconfigured")
                }
              />
              <span>Preview configured Help test fixture state (C07)</span>
            </label>
            <button
              type="button"
              className="btn-link"
              style={{ fontSize: 13 }}
              onClick={() => navigate("settings")}
            >
              Open diagnostic hooks in Settings
            </button>
          </div>
        </details>
      </section>

      <section className="panel-card stack-sm" aria-labelledby="help-data-heading">
        <h2 id="help-data-heading" className="panel-heading">Where your data lives</h2>
        <p>On Windows, CrewSignal stores readings and drafts in <code>crewsignal.db</code> in your Windows AppData folder. CrewSignal has no cloud sync and does not encrypt the database or exported files.</p>
        <p>Use Reports to save or restore a full profile backup. It includes that profile's readings, mood and notes. Report exports contain the readings you select and exclude mood and notes by default.</p>
      </section>

      <section className="panel-card stack-sm" aria-labelledby="help-cached-sources-heading">
        <h2 id="help-cached-sources-heading" className="panel-heading">
          Cached reference summaries
        </h2>
        <div className="action-list">
          {EVIDENCE_LIST.slice(0, 4).map((ev) => (
            <div key={ev.sourceId} className="action-row-btn" style={{ cursor: "default" }}>
              <div>
                <div className="action-row-title">{ev.title}</div>
                <div className="action-row-desc">
                  {ev.publisher} · {ev.offlineAccessNote}
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                aria-label={`Open online: ${ev.title} (external browser)`}
                onClick={() => void desktopBridge.openExternalUrl(ev.url)}
              >
                <span>Open online</span>
                <ExternalLink size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
