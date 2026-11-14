import { ScheduledNotifications } from './ScheduledNotifications';
import { getDueCheckIns } from '../shared/src';
import React, { useState } from "react";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Compass,
  FileText,
  HardDrive,
  HelpCircle,
  Home,
  LineChart,
  MoreHorizontal,
  Settings,
  X,
} from "lucide-react";
import { computeMissionDay, formatUtcTimeHHMM } from "../shared/src";
import { useApp, type AppRoute } from "../state/AppContext";

const PRIMARY_NAV: ReadonlyArray<{
  route: AppRoute;
  label: string;
  compactLabel: string;
  Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
}> = [
  { route: "overview", label: "Overview", compactLabel: "Overview", Icon: Home },
  { route: "check_in", label: "Check-in", compactLabel: "Check-in", Icon: ClipboardCheck },
  { route: "explorer", label: "Health Explorer", compactLabel: "Explorer", Icon: Activity },
  { route: "trends", label: "Trends", compactLabel: "Trends", Icon: LineChart },
  { route: "reports", label: "Reports", compactLabel: "Reports", Icon: FileText },
];

const SECONDARY_NAV: ReadonlyArray<{
  route: AppRoute;
  label: string;
  compactLabel: string;
  Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
}> = [
  { route: "actions", label: "Actions", compactLabel: "Actions", Icon: Compass },
  { route: "sources", label: "Sources", compactLabel: "Sources", Icon: BookOpen },
  { route: "settings", label: "Settings", compactLabel: "Settings", Icon: Settings },
  { route: "help", label: "Help", compactLabel: "Help", Icon: HelpCircle },
];

const ROUTE_TITLES: Record<AppRoute, string> = {
  overview: "Overview",
  check_in: "Check-in",
  explorer: "Health Explorer",
  trends: "Trends",
  reports: "Reports & Export",
  actions: "Actions",
  sources: "Sources & Evidence",
  settings: "Settings",
  help: "Help",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    route,
    navigate,
    gettingStarted,
    openGettingStarted,
    activeProfile,
    snapshot,
    activeDraft,
    currentReferenceNowUtc,
    toast,
    dismissToast,
    liveAnnouncement,
    pendingUpdateBlocked,
    setPendingUpdateBlocked,
    openDraftForMetric,
  } = useApp();

  const dueCount = getDueCheckIns(activeProfile, snapshot?.profileData.observations ?? [], currentReferenceNowUtc).length;
  const [moreOpen, setMoreOpen] = useState(false);

  const missionDay = activeProfile
    ? Math.max(1, computeMissionDay(currentReferenceNowUtc, activeProfile.missionEpochUtc))
    : 1;
  const clockHHMM = formatUtcTimeHHMM(currentReferenceNowUtc);
  const modeLabel =
    activeProfile?.mode === "demo"
      ? `${activeProfile.scenarioId ?? "SIM-01"} · Demo · Synthetic data`
      : "Personal · Local log";

  const handlePrimaryCta = () => {
    if (activeDraft) {
      navigate("check_in");
    } else {
      void openDraftForMetric("blood_pressure");
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <ScheduledNotifications />
      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="sidebar-brand">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span className="brand-title">CrewSignal</span>
            <span className="brand-compact-mark" aria-hidden="true">
              CS
            </span>
          </div>
          <div className="sidebar-mission-meta">
            <div>
              {activeProfile?.mode === "demo"
                ? `${activeProfile.scenarioId ?? "SIM-01"} · ${activeProfile.missionName}`
                : activeProfile?.label ?? "Personal profile"}
            </div>
            <div>
              Day {missionDay} · {clockHHMM} {activeProfile?.displayTimezone ?? "UTC"}
            </div>
          </div>
        </div>

        <nav aria-label="Main views" className="sidebar-nav-group">
          {PRIMARY_NAV.map(({ route: itemRoute, label, compactLabel, Icon }) => (
            <button
              key={itemRoute}
              type="button"
              className="nav-item"
              aria-label={itemRoute === 'check_in' && dueCount ? `Check-in, ${dueCount} due` : label}
              aria-current={route === itemRoute ? "page" : undefined}
              onClick={() => {
                setMoreOpen(false);
                navigate(itemRoute);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-item-label" aria-hidden="true">
                <span className="brand-title">{label}</span>
                <span className="brand-compact-mark">{compactLabel}</span>
                {itemRoute === 'check_in' && dueCount > 0 && <span> ({dueCount})</span>}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-nav-spacer" />

        <nav aria-label="Workspace and support" className="sidebar-nav-group">
          {SECONDARY_NAV.map(({ route: itemRoute, label, compactLabel, Icon }) => (
            <button
              key={itemRoute}
              type="button"
              className="nav-item"
              aria-label={label}
              aria-current={route === itemRoute ? "page" : undefined}
              onClick={() => {
                setMoreOpen(false);
                navigate(itemRoute);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-item-label" aria-hidden="true">
                <span className="brand-title">{label}</span>
                <span className="brand-compact-mark">{compactLabel}</span>
              </span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="sidebar-profile-line"
          onClick={() => navigate("settings")}
          title="Switch profile or open settings"
        >
          <span className="sidebar-profile-alias-full">
            {activeProfile?.label ?? "Crew member 01"}
          </span>
          <span className="brand-compact-mark">Profile</span>
        </button>
      </aside>

      <div className="app-content-column">
        <header className="app-topbar">
          <div className="topbar-left">
            <div className="topbar-breadcrumb">
              <strong>{ROUTE_TITLES[route]}</strong>
              <span className="demo-synthetic-label">{modeLabel}</span>
              <span className="topbar-compact-mission">
                Day {missionDay} · {clockHHMM} {activeProfile?.displayTimezone ?? "UTC"}
              </span>
            </div>
          </div>

          <div className="topbar-right">
            <span className="status-chip" title="Summaries and database reside locally on this device">
              <HardDrive size={14} aria-hidden="true" />
              <span>Offline ready</span>
            </span>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("help")}
              aria-current={route === "help" ? "page" : undefined}
            >
              <HelpCircle size={16} aria-hidden="true" />
              <span>Help</span>
            </button>

            <button type="button" className="btn-primary" onClick={handlePrimaryCta}>
              {activeDraft ? "Continue draft" : "Start check-in"}
            </button>
          </div>
        </header>

        <main id="main-content" className="app-main" tabIndex={-1}>
          {gettingStarted && route !== "help" && (
            <div style={{ marginBottom: 16 }}>
              <button type="button" className="btn-secondary" onClick={openGettingStarted}>
                Back to Getting started
              </button>
            </div>
          )}
          {pendingUpdateBlocked && activeDraft ? (
            <div className="notice-banner notice-banner-review" style={{ marginBottom: 16 }} role="status">
              <div>
                <strong>Update waits for your draft.</strong>{" "}
                Finish or export your active draft before applying an application update.
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPendingUpdateBlocked(false)}
              >
                Dismiss notice
              </button>
            </div>
          ) : null}

          {toast ? (
            <div
              className={`toast-banner ${
                toast.tone === "success"
                  ? "notice-banner-success"
                  : toast.tone === "danger"
                    ? "notice-banner-danger"
                    : toast.tone === "review"
                      ? "notice-banner-review"
                      : ""
              }`}
              role="status"
            >
              <div>
                <strong>{toast.title}</strong>
                {toast.detail ? (
                  <div style={{ color: "var(--text-body)", marginTop: 2 }}>{toast.detail}</div>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={dismissToast}
                aria-label="Dismiss notification"
                style={{ minWidth: 44 }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {children}
        </main>
      </div>

      {moreOpen ? (
        <div className="mobile-more-drawer no-print" role="region" aria-label="More views">
          {[
            { route: "reports" as const, label: "Reports & Export" },
            { route: "actions" as const, label: "Actions" },
            { route: "sources" as const, label: "Sources & Evidence" },
            { route: "settings" as const, label: "Settings" },
            { route: "help" as const, label: "Help" },
          ].map((item) => (
            <button
              key={item.route}
              type="button"
              className="nav-item"
              aria-current={route === item.route ? "page" : undefined}
              onClick={() => {
                setMoreOpen(false);
                navigate(item.route);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <nav className="mobile-bottom-nav no-print" aria-label="Compact navigation">
        {PRIMARY_NAV.slice(0, 4).map(({ route: itemRoute, compactLabel, Icon }) => (
          <button
            key={itemRoute}
            type="button"
            className="mobile-nav-btn"
            aria-current={route === itemRoute ? "page" : undefined}
            onClick={() => {
              setMoreOpen(false);
              navigate(itemRoute);
            }}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{compactLabel}{itemRoute === 'check_in' && dueCount > 0 ? ` (${dueCount})` : ''}</span>
          </button>
        ))}
        <button
          type="button"
          className="mobile-nav-btn"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>
    </div>
  );
}
