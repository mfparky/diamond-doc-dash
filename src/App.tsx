import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, type ComponentType } from "react";
import { DesignSystemProvider } from "@/contexts/DesignSystemContext";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { isRankingsAdminEmail } from "@/lib/admin-access";
import { Auth } from "@/components/Auth";
import { HomeButton } from "@/components/HomeButton";
import { Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Auto-reload once if a lazy chunk fails (typically after a redeploy
// invalidated the chunk hashes the current page is still referencing).
function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err) => {
      const key = "lovable:chunk-reload";
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    })
  );
}

// Secondary routes are split out so the primary coach flow loads fast.
const PlayerDashboard = lazyWithReload(() => import("./pages/PlayerDashboard"));
const TeamDashboard = lazyWithReload(() => import("./pages/TeamDashboard"));
const CoachDashboard = lazyWithReload(() => import("./pages/CoachDashboard"));
const TeamWallPage = lazyWithReload(() => import("./pages/TeamWallPage"));
const CalibratePage = lazyWithReload(() => import("./pages/CalibratePage"));
const PrintFormPage = lazyWithReload(() => import("./pages/PrintFormPage"));
const PrintLiveAbsPage = lazyWithReload(() => import("./pages/PrintLiveAbsPage"));
const DesignSystemPage = lazyWithReload(() => import("./pages/DesignSystemPage"));
const WorkoutAccountabilityPage = lazyWithReload(() => import("./pages/WorkoutAccountabilityPage"));
const PodiumPage = lazyWithReload(() => import("./pages/PodiumPage"));
const GameModePage = lazyWithReload(() => import("./pages/GameModePage"));
const GamesPage = lazyWithReload(() => import("./pages/GamesPage"));
const RankingsPage = lazyWithReload(() => import("./pages/RankingsPage"));
const LineupPage = lazyWithReload(() => import("./pages/LineupPage"));
const ReportCardPage = lazyWithReload(() => import("./pages/ReportCardPage"));
const TournamentPlanPage = lazyWithReload(() => import("./pages/TournamentPlanPage"));
const BullpenChartPage = lazyWithReload(() => import("./pages/BullpenChartPage"));
const GameChartPage = lazyWithReload(() => import("./pages/GameChartPage"));
const LiveAbsChartPage = lazyWithReload(() => import("./pages/LiveAbsChartPage"));


const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { isScorekeeper, loading: roleLoading } = useUserRole();

  if (loading || (user && roleLoading)) {
    return <RouteFallback />;
  }

  // Scorekeepers can ONLY access the live pitch counter.
  const gate = (el: JSX.Element) =>
    !user ? <Auth /> : isScorekeeper ? <Navigate to="/game" replace /> : el;

  // Player Rankings is restricted to a small allow-list of coach emails.
  const rankingsGate = (el: JSX.Element) => {
    if (!user) return <Auth />;
    if (isScorekeeper) return <Navigate to="/game" replace />;
    if (!isRankingsAdminEmail(user.email)) return <Navigate to="/" replace />;
    return el;
  };

  return (
    <BrowserRouter>
      <HomeButton />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public dashboards for parents */}
          <Route path="/player/:playerId" element={<PlayerDashboard />} />
          <Route path="/team/:teamId" element={<TeamDashboard />} />
          <Route path="/team/:teamId/wall" element={<TeamWallPage />} />
          <Route path="/team/:teamId/podium" element={<PodiumPage />} />
          <Route path="/podium" element={<PodiumPage />} />
          <Route path="/dashboard/:userId" element={<CoachDashboard />} />

          {/* Protected routes require authentication */}
          <Route path="/" element={gate(<Index />)} />

          <Route path="/calibrate" element={gate(<CalibratePage />)} />
          <Route path="/print-form" element={gate(<PrintFormPage />)} />
          <Route path="/print-live-abs" element={gate(<PrintLiveAbsPage />)} />
          <Route path="/accountability" element={gate(<WorkoutAccountabilityPage />)} />
          <Route path="/rankings" element={rankingsGate(<RankingsPage />)} />
          <Route path="/lineup" element={gate(<LineupPage />)} />
          <Route path="/report-card" element={gate(<ReportCardPage />)} />
          <Route path="/tournament" element={gate(<TournamentPlanPage />)} />
          <Route path="/chart/bullpen" element={gate(<BullpenChartPage />)} />
          <Route path="/chart/game" element={gate(<GameChartPage />)} />
          <Route path="/chart/live-abs" element={gate(<LiveAbsChartPage />)} />
          {/* Game mode is allowed for scorekeepers */}
          <Route path="/game" element={user ? <GameModePage /> : <Auth />} />
          <Route path="/game/:gameId" element={user ? <GameModePage /> : <Auth />} />
          <Route path="/games" element={gate(<GamesPage />)} />
          <Route path="/games/:gameId" element={isScorekeeper ? <Navigate to="/game" replace /> : <GamesPage />} />

          {/* Design system evaluation — no auth required */}
          <Route path="/design-systems" element={<DesignSystemPage />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <DesignSystemProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </DesignSystemProvider>
  </QueryClientProvider>
);

export default App;
