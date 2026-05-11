import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { DesignSystemProvider } from "@/contexts/DesignSystemContext";
import { useAuth } from "@/hooks/use-auth";
import { Auth } from "@/components/Auth";
import { HomeButton } from "@/components/HomeButton";
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

  if (loading) {
    return <RouteFallback />;
  }

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
          <Route path="/dashboard/:userId" element={<CoachDashboard />} />

          {/* Protected routes require authentication */}
          <Route
            path="/"
            element={user ? <Index /> : <Auth />}
          />

          <Route path="/calibrate" element={user ? <CalibratePage /> : <Auth />} />
          <Route path="/print-form" element={user ? <PrintFormPage /> : <Auth />} />
          <Route path="/print-live-abs" element={user ? <PrintLiveAbsPage /> : <Auth />} />
          <Route path="/accountability" element={user ? <WorkoutAccountabilityPage /> : <Auth />} />

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
