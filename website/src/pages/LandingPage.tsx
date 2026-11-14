import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Globe,
  Menu,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  X,
} from "lucide-react";
import {
  EVIDENCE_LIST,
  SIM_01_REFERENCES,
  SIM_01_SLEEP_OBSERVATIONS,
  type AppearancePreference,
} from "../shared";
import { useAppState } from "../state/AppStateContext";
import { SleepChart } from "../components/SleepChart";
import nativeReleaseConfig from "../config/native-releases.json";

type NativeRelease = {
  version: string;
  fileName: string;
  requirements: string;
  url: string;
};

const nativeReleases: Record<"android" | "windows", NativeRelease | null> =
  nativeReleaseConfig;

const APPEARANCE_ITEMS: ReadonlyArray<{
  value: AppearancePreference;
  label: string;
  icon: typeof Monitor;
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const TEAM_ENTRY_URL =
  "https://www.spaceappschallenge.org/2026/find-a-team/pop-n-seb-phases-of-the-moon-never-separated-beneath/";
const MANILA_EVENT_URL =
  "https://www.spaceappschallenge.org/2026/local-events/manila/";

const SECTION_STYLE: React.CSSProperties = {
  borderTop: "1px solid var(--border-subtle)",
  padding: "56px 20px",
};
const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1180px",
  margin: "0 auto",
};
const BODY_TEXT: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "0.9375rem",
};

function NativeDownload({
  platform,
  release,
  install,
}: {
  platform: string;
  release: NativeRelease | null;
  install: string;
}) {
  if (!release) {
    return <p style={BODY_TEXT}>Download pending release verification.</p>;
  }

  return (
    <>
      <p style={BODY_TEXT}>{release.requirements}</p>
      <p style={BODY_TEXT}>{release.fileName}</p>
      <div>
        <a href={release.url} className="cs-btn cs-btn-secondary">
          Download {platform} {release.version}
        </a>
      </div>
      <p style={BODY_TEXT}>
        {install} Open CrewSignal and try the SIM-01 synthetic demo on Overview.
      </p>
    </>
  );
}

export function LandingPage() {
  const { preferences, setAppearance } = useAppState();
  const sleepRef = SIM_01_REFERENCES[0] ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div>
      <a href="#landing-main" className="skip-link">
        Skip to content
      </a>

      <header className="cs-landing-header">
        <div className="cs-landing-bar">
          <Link to="/" className="cs-landing-brand">
            <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
              <rect
                x="1"
                y="1"
                width="30"
                height="30"
                rx="7"
                fill="var(--bg-surface-elevated)"
                stroke="var(--border-strong)"
                strokeWidth="1.5"
              />
              <path
                d="M7 18h4l2.5-6 4 11 2.5-5H25"
                fill="none"
                stroke="var(--text-primary)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>CrewSignal</span>
          </Link>

          <button
            type="button"
            className="cs-btn cs-btn-ghost cs-landing-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="landing-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X size={16} aria-hidden="true" />
            ) : (
              <Menu size={16} aria-hidden="true" />
            )}
            <span>Menu</span>
          </button>

          <div
            id="landing-menu"
            className="cs-landing-menu"
            data-open={menuOpen ? "true" : "false"}
          >
            <nav aria-label="Landing navigation" className="cs-landing-nav">
              <a
                href="#project"
                className="cs-btn cs-btn-ghost"
                onClick={closeMenu}
              >
                Project
              </a>
              <a
                href="#evidence"
                className="cs-btn cs-btn-ghost"
                onClick={closeMenu}
              >
                Evidence
              </a>
              <a
                href="#team"
                className="cs-btn cs-btn-ghost"
                onClick={closeMenu}
              >
                Team
              </a>
            </nav>

            <div
              role="group"
              aria-label="Appearance"
              className="cs-landing-appearance"
            >
              {APPEARANCE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = preferences.appearance === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    className={
                      active ? "cs-btn cs-btn-primary" : "cs-btn cs-btn-ghost"
                    }
                    style={{
                      minHeight: "44px",
                      padding: "0 10px",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => {
                      void setAppearance(item.value);
                    }}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Link
            to="/demo"
            className="cs-btn cs-btn-secondary cs-landing-open-demo"
          >
            Open demo
          </Link>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        {/* Hero */}
        <section
          style={{
            background: "var(--hero-gradient)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "56px 20px",
          }}
        >
          <div
            style={{
              ...INNER_STYLE,
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
              gap: "32px",
              alignItems: "center",
            }}
          >
            <div className="cs-stack" style={{ gap: "18px" }}>
              <div>
                <span className="cs-pill cs-mono-stamp">
                  SPACE APPS 2026 · POP N&apos; SEB
                </span>
              </div>

              <h1
                style={{
                  fontSize: "clamp(2rem, 4.5vw, 3.25rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  fontWeight: "var(--heading-strong-weight)",
                }}
              >
                Your observations. A clearer next step.
              </h1>

              <p
                style={{
                  fontSize: "1.0625rem",
                  color: "var(--text-secondary)",
                  maxWidth: "54ch",
                }}
              >
                A health-monitoring research prototype for long missions. Record
                observations, explore changes, and prepare a report.
              </p>

              <div className="cs-row" style={{ gap: "12px" }}>
                <Link to="/demo" className="cs-btn cs-btn-primary">
                  Open synthetic demo
                </Link>
                <a href="#platforms" className="cs-btn cs-btn-secondary">
                  Native app downloads
                </a>
              </div>

              <p className="cs-helper">
                Manual entry · Local processing · Offline after initial setup.
              </p>

              <div className="cs-landing-steps-wrap">
                <ol
                  className="cs-landing-steps"
                  aria-label="How CrewSignal works"
                >
                  <li>
                    <span className="cs-mono-stamp">01 · Record</span>
                    <span>Log one optional observation.</span>
                  </li>
                  <li>
                    <span className="cs-mono-stamp">02 · Understand</span>
                    <span>Explore entries, references and sources.</span>
                  </li>
                  <li>
                    <span className="cs-mono-stamp">03 · Share</span>
                    <span>Preview and export selected data.</span>
                  </li>
                </ol>
              </div>
            </div>

            <figure
              className="cs-card cs-stack"
              style={{ gap: "14px", margin: 0 }}
            >
              <div>
                <span className="cs-mono-stamp">
                  SIM-01 · Synthetic transit habitat
                </span>
                <h2 className="cs-section-title" style={{ marginTop: "4px" }}>
                  Day 42 sleep duration: 5h 48m
                </h2>
              </div>

              <SleepChart
                observations={SIM_01_SLEEP_OBSERVATIONS}
                sleepReference={sleepRef}
                range="7d"
                currentMissionDay={42}
                compact
                allowTableToggle={false}
              />

              <figcaption className="cs-stack" style={{ gap: "8px" }}>
                <p className="cs-helper" id="hero-chart-summary">
                  Synthetic sleep periods for Days 36–42. Day 42 is 5h 48m, 1h
                  36m below the 7h 24m preflight reference. Not real crew data.
                </p>
                <Link
                  to="/demo/trends"
                  className="cs-btn cs-btn-ghost"
                  style={{ alignSelf: "flex-start" }}
                >
                  <Activity size={16} aria-hidden="true" />
                  <span>View this data in the demo</span>
                </Link>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Project */}
        <section id="project" style={{ padding: "56px 20px" }}>
          <div className="cs-stack" style={{ ...INNER_STYLE, gap: "20px" }}>
            <div>
              <span className="cs-mono-stamp">Project</span>
              <h2 className="cs-page-title" style={{ marginTop: "6px" }}>
                Manual entry with explicit method, units, and recovery
              </h2>
            </div>

            <div className="cs-grid-3">
              <article className="cs-card cs-stack" style={{ gap: "8px" }}>
                <ClipboardCheck size={20} aria-hidden="true" />
                <h3 className="cs-section-title">No silent assumptions</h3>
                <p style={BODY_TEXT}>
                  Every reading keeps the numbers as entered alongside canonical
                  values (CDC NHANES glucose 18.02 factor, NIST temperature
                  formula), and asks before switching populated units.
                </p>
              </article>

              <article className="cs-card cs-stack" style={{ gap: "8px" }}>
                <Activity size={20} aria-hidden="true" />
                <h3 className="cs-section-title">Fair comparisons only</h3>
                <p style={BODY_TEXT}>
                  Comparisons match method and context against a locked
                  preflight or 7-day reference. Unlogged gaps stay blank rather
                  than padded with zero.
                </p>
              </article>

              <article className="cs-card cs-stack" style={{ gap: "8px" }}>
                <ShieldCheck size={20} aria-hidden="true" />
                <h3 className="cs-section-title">You choose what is shared</h3>
                <p style={BODY_TEXT}>
                  Reports leave out personal notes and mood unless you include
                  them. Backups keep personal records apart from the synthetic
                  demo.
                </p>
              </article>
            </div>

            <div className="cs-stack" style={{ gap: "12px" }}>
              <h3 className="cs-section-title" id="platforms">
                Try CrewSignal
              </h3>
              <ul
                className="cs-grid-3"
                role="list"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                <li className="cs-card cs-stack" style={{ gap: "8px" }}>
                  <Globe size={20} aria-hidden="true" />
                  <h4 className="cs-section-title">Browser demo</h4>
                  <p style={BODY_TEXT}>
                    Runs in the browser with local storage and works offline
                    after the first visit.
                  </p>
                  <div>
                    <Link to="/demo" className="cs-btn cs-btn-secondary">
                      Open browser demo
                    </Link>
                  </div>
                </li>
                <li className="cs-card cs-stack" style={{ gap: "8px" }}>
                  <Monitor size={20} aria-hidden="true" />
                  <h4 className="cs-section-title">Windows x64</h4>
                  <NativeDownload
                    platform="Windows"
                    release={nativeReleases.windows}
                    install="Run the setup.exe and follow the installer prompts."
                  />
                </li>
                <li className="cs-card cs-stack" style={{ gap: "8px" }}>
                  <Smartphone size={20} aria-hidden="true" />
                  <h4 className="cs-section-title">Android phones and tablets</h4>
                  <NativeDownload
                    platform="Android"
                    release={nativeReleases.android}
                    install="Open the APK from Downloads and follow Android’s install prompts."
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Evidence, then limits */}
        <section id="evidence" style={SECTION_STYLE}>
          <div style={INNER_STYLE} className="cs-grid-2">
            <div className="cs-card cs-stack" style={{ gap: "10px" }}>
              <span className="cs-mono-stamp">Evidence</span>
              <h2 className="cs-section-title">
                {EVIDENCE_LIST.length} cited sources
              </h2>
              <p style={BODY_TEXT}>
                Short attributed summaries are bundled with the app, so unit
                formulas and sleep and schedule context can be checked offline.
                Citation does not imply endorsement.
              </p>
              <div className="cs-row">
                <Link to="/demo/sources" className="cs-btn cs-btn-secondary">
                  <BookOpen size={16} aria-hidden="true" />
                  <span>Browse sources</span>
                </Link>
              </div>
            </div>

            <div
              id="limits"
              className="cs-card cs-stack"
              style={{ gap: "10px" }}
            >
              <span className="cs-mono-stamp">Limits</span>
              <h2 className="cs-section-title">
                What this prototype does not do
              </h2>
              <ul style={{ margin: 0, paddingLeft: "18px", ...BODY_TEXT }}>
                <li>
                  It doesn&apos;t diagnose, calculate clinical risk scores, or
                  assess fitness for duty.
                </li>
                <li>
                  It doesn&apos;t contact clinicians, dispatch emergencies, or
                  sync telemetry.
                </li>
                <li>
                  The public web demo uses synthetic data and rejects personal
                  backups.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Team */}
        <section id="team" style={SECTION_STYLE} aria-labelledby="team-heading">
          <div style={INNER_STYLE} className="cs-stack">
            <div>
              <span className="cs-mono-stamp">Team</span>
              <h2
                id="team-heading"
                className="cs-page-title"
                style={{ marginTop: "6px" }}
              >
                POP N&apos;SEB
              </h2>
              <p style={{ ...BODY_TEXT, marginTop: "6px" }}>
                Manila · NASA Space Apps Challenge 2026
              </p>
            </div>
            <div className="cs-row">
              <a
                href={TEAM_ENTRY_URL}
                className="cs-btn cs-btn-secondary"
                rel="noopener noreferrer"
              >
                Team entry on spaceappschallenge.org
              </a>
              <a
                href={MANILA_EVENT_URL}
                className="cs-btn cs-btn-ghost"
                rel="noopener noreferrer"
              >
                Manila local event
              </a>
            </div>
          </div>
        </section>

        {/* Sources and credits */}
        <section
          id="credits"
          style={{ ...SECTION_STYLE, background: "var(--bg-surface)" }}
          aria-labelledby="credits-heading"
        >
          <div style={INNER_STYLE} className="cs-stack">
            <h2 id="credits-heading" className="cs-page-title">
              Sources and credits
            </h2>
            <dl className="cs-landing-credits">
              <div>
                <dt>Research</dt>
                <dd>
                  NASA Human Research Program (sleep and schedule risk, Standard
                  Measures), CDC NHANES glucose method, NIST temperature
                  conversion. <Link to="/demo/sources">All sources</Link>
                </dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>
                  SIM-01, SIM-SCHEDULE and SIM-EMPTY are synthetic scenarios
                  made for this demo.
                </dd>
              </div>
              <div>
                <dt>Fonts</dt>
                <dd>
                  Inter and Geist Mono, SIL Open Font License 1.1, bundled
                  locally.
                </dd>
              </div>
              <div>
                <dt>Libraries</dt>
                <dd>
                  React and React Router (MIT), Recharts (MIT), Dexie
                  (Apache-2.0), Lucide icons (ISC).
                </dd>
              </div>
              <div>
                <dt>Tool assistance</dt>
                <dd>
                  AI coding tools assisted with drafting, tests and
                  documentation; the team reviewed the requirements and results.
                </dd>
              </div>
              <div>
                <dt>Licence</dt>
                <dd>
                  CrewSignal is Apache-2.0. Full notices are in CREDITS.md and
                  THIRD-PARTY-NOTICES.md in the source package.
                </dd>
              </div>
            </dl>
            <p className="cs-helper">
              Independent of NASA, CSA, CDC and NIST. Research prototype, not a
              medical device.
            </p>
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "28px 20px",
        }}
      >
        <div
          style={{
            ...INNER_STYLE,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <strong>CrewSignal</strong> · POP N&apos;SEB · NASA Space Apps 2026
            <div className="cs-helper">
              Research prototype using synthetic scenarios.
            </div>
          </div>
          <div className="cs-row">
            <Link to="/demo" className="cs-btn cs-btn-primary">
              Open synthetic demo
            </Link>
            <Link to="/demo/help" className="cs-btn cs-btn-secondary">
              Offline Help
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
