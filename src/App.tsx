import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { Suspense, lazy, useEffect, type ComponentType } from "react";
import { DesignSystemProvider, useDesignSystem } from "@/contexts/DesignSystemContext";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { useTeamMemberships } from "@/hooks/use-team-memberships";
import { isRankingsAdminEmail } from "@/lib/admin-access";
import { Auth } from "@/components/Auth";
import { HomeButton } from "@/components/HomeButton";
import { CreateOrJoinTeamDialog } from "@/components/CreateOrJoinTeamDialog";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Auto-reload if a lazy chunk fails (typically after a redeploy invalidated the
// chunk hashes the current page still references). The guard is time-based so a
// later, unrelated failure can still recover instead of showing a blank screen.
const CHUNK_RELOAD_KEY = "lovable:chunk-reload-at";
const CHUNK_RELOAD_WINDOW_MS = 15_000;

function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err) => {
      if (typeof window !== "undefined") {
        const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (!last || Date.now() - last > CHUNK_RELOAD_WINDOW_MS) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
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
const PitchingPlannerPage = lazyWithReload(() => import("./pages/PitchingPlannerPage"));
const BullpenChartPage = lazyWithReload(() => import("./pages/BullpenChartPage"));
const GameChartPage = lazyWithReload(() => import("./pages/GameChartPage"));
const LiveAbsChartPage = lazyWithReload(() => import("./pages/LiveAbsChartPage"));
const OAuthConsent = lazyWithReload(() => import("./pages/OAuthConsent"));


// Forwards a legacy /game/:gameId or /games/:gameId bookmark to its renamed
// route, preserving the gameId. The destination route owns all auth/role
// gating — this component never renders protected content itself.
function LegacyGameRedirect({ base }: { base: string }) {
  const { gameId } = useParams();
  return <Navigate to={`${base}/${gameId}`} replace />;
}

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

// Shown in place of the routed app for an approved user who hasn't created
// or joined a team yet. Always open (no dismiss) — the app underneath has
// nothing meaningful to show without at least one team membership.
function CreateOrJoinTeamGate({ onTeamReady }: { onTeamReady: (teamId: string) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <CreateOrJoinTeamDialog open onOpenChange={() => {}} onTeamReady={onTeamReady} />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { isScorekeeper, loading: roleLoading } = useUserRole();
  const { memberships, activeTeamId, loading: membershipsLoading, refetch: refetchMemberships, setActiveTeamId } = useTeamMemberships();
  const { setSystem } = useDesignSystem();

  // Apply the active team's branding whenever it changes — replaces the
  // old unscoped "grab whatever team is first" fetch in DesignSystemContext.
  useEffect(() => {
    if (!activeTeamId) return;
    let cancelled = false;
    supabase.rpc('get_public_team_info', { p_team_id: activeTeamId }).then(({ data }) => {
      if (cancelled) return;
      const team = data?.[0];
      setSystem(team?.design_system || 'athlete');
    });
    return () => { cancelled = true; };
  }, [activeTeamId, setSystem]);

  if (loading || (user && (roleLoading || membershipsLoading))) {
    return <RouteFallback />;
  }

  const handleTeamReady = async (teamId: string) => {
    await refetchMemberships();
    setActiveTeamId(teamId);
  };

  // Scorekeepers can ONLY access the live pitch counter. An approved user
  // with zero team memberships sees the create/join gate instead of the
  // routed app — public routes below (player/team/podium links) are
  // unaffected since they never go through gate().
  const gate = (el: JSX.Element) =>
    !user ? <Auth /> :
    isScorekeeper ? <Navigate to="/counter" replace /> :
    memberships.length === 0 ? <CreateOrJoinTeamGate onTeamReady={handleTeamReady} /> :
    el;

  // Player Rankings is restricted to a small allow-list of coach emails.
  const rankingsGate = (el: JSX.Element) => {
    if (!user) return <Auth />;
    if (isScorekeeper) return <Navigate to="/counter" replace />;
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
          <Route path="/planner" element={gate(<PitchingPlannerPage />)} />
          {/* Legacy redirect: old tournament route now points at the planner. */}
          <Route path="/tournament" element={gate(<PitchingPlannerPage />)} />
          <Route path="/chart/bullpen" element={gate(<BullpenChartPage />)} />
          <Route path="/chart/game" element={gate(<GameChartPage />)} />
          <Route path="/chart/live-abs" element={gate(<LiveAbsChartPage />)} />
          {/* Live pitch counter is allowed for scorekeepers */}
          <Route path="/counter" element={user ? <GameModePage /> : <Auth />} />
          <Route path="/counter/:gameId" element={user ? <GameModePage /> : <Auth />} />
          <Route path="/game-log" element={gate(<GamesPage />)} />
          <Route path="/game-log/:gameId" element={isScorekeeper ? <Navigate to="/counter" replace /> : <GamesPage />} />
          {/* Legacy path redirects — old bookmarks/PWA shortcuts keep working.
              These forward only; the real auth/role gating lives on the routes above. */}
          <Route path="/game" element={<Navigate to="/counter" replace />} />
          <Route path="/game/:gameId" element={<LegacyGameRedirect base="/counter" />} />
          <Route path="/games" element={<Navigate to="/game-log" replace />} />
          <Route path="/games/:gameId" element={<LegacyGameRedirect base="/game-log" />} />

          {/* Design system evaluation — no auth required */}
          <Route path="/design-systems" element={<DesignSystemPage />} />

          {/* Supabase OAuth 2.1 consent screen — MCP clients redirect here. */}
          <Route path="/.lovable/oauth/consent" element={gate(<OAuthConsent />)} />

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
