import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { DesignSystemProvider } from "@/contexts/DesignSystemContext";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { Auth } from "@/components/Auth";
import { HomeButton } from "@/components/HomeButton";
import { Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Secondary routes are split out so the primary coach flow loads fast.
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard"));
const TeamDashboard = lazy(() => import("./pages/TeamDashboard"));
const CoachDashboard = lazy(() => import("./pages/CoachDashboard"));
const TeamWallPage = lazy(() => import("./pages/TeamWallPage"));
const CalibratePage = lazy(() => import("./pages/CalibratePage"));
const PrintFormPage = lazy(() => import("./pages/PrintFormPage"));
const PrintLiveAbsPage = lazy(() => import("./pages/PrintLiveAbsPage"));
const DesignSystemPage = lazy(() => import("./pages/DesignSystemPage"));
const WorkoutAccountabilityPage = lazy(() => import("./pages/WorkoutAccountabilityPage"));
const PodiumPage = lazy(() => import("./pages/PodiumPage"));
const GameModePage = lazy(() => import("./pages/GameModePage"));
const GamesPage = lazy(() => import("./pages/GamesPage"));

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
