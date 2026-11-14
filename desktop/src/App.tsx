import { AppProvider, useApp } from "./state/AppContext";
import { AppShell } from "./components/AppShell";
import { AppModals } from "./components/AppModals";
import { OverviewRoute } from "./routes/OverviewRoute";
import { CheckInRoute } from "./routes/CheckInRoute";
import { ExplorerRoute } from "./routes/ExplorerRoute";
import { TrendsRoute } from "./routes/TrendsRoute";
import { ActionsRoute } from "./routes/ActionsRoute";
import { SourcesRoute } from "./routes/SourcesRoute";
import { ReportsRoute } from "./routes/ReportsRoute";
import { SettingsRoute } from "./routes/SettingsRoute";
import { HelpRoute } from "./routes/HelpRoute";

function RouteSwitch() {
  const { route, readingReportScope, activeProfile } = useApp();

  switch (route) {
    case "overview":
      return <OverviewRoute />;
    case "check_in":
      return null;
    case "explorer":
      return <ExplorerRoute />;
    case "trends":
      return <TrendsRoute />;
    case "actions":
      return <ActionsRoute />;
    case "sources":
      return <SourcesRoute />;
    case "reports":
      return <ReportsRoute key={readingReportScope ? `selected-readings:${activeProfile?.profileId}` : "general-report"} />;
    case "settings":
      return <SettingsRoute />;
    case "help":
      return <HelpRoute />;
    default:
      return <OverviewRoute />;
  }
}

function AppContent() {
  const { route, helpReturnRoute, gettingStarted } = useApp();
  const showCheckIn = route === "check_in";
  const keepCheckIn = helpReturnRoute === "check_in" && (route === "help" || gettingStarted);
  return (
    <AppShell>
      {(showCheckIn || keepCheckIn) && (
        <div hidden={!showCheckIn}><CheckInRoute /></div>
      )}
      <RouteSwitch />
    </AppShell>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
      <AppModals />
    </AppProvider>
  );
}

export default App;
