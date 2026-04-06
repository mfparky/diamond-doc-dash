import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Auth } from "@/components/Auth";
import { HomeButton } from "@/components/HomeButton";
import Index from "./pages/Index";
import PlayerDashboard from "./pages/PlayerDashboard";
import TeamDashboard from "./pages/TeamDashboard";
import CoachDashboard from "./pages/CoachDashboard";
import TeamWallPage from "./pages/TeamWallPage";
import CalibratePage from "./pages/CalibratePage";
import PrintFormPage from "./pages/PrintFormPage";
import DesignSystemPage from "./pages/DesignSystemPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <HomeButton />
      <Routes>
        {/* Public dashboards for parents */}
        <Route path="/player/:playerId" element={<PlayerDashboard />} />
        <Route path="/team/:teamId" element={<TeamDashboard />} />
        <Route path="/dashboard/:userId" element={<CoachDashboard />} />
        
        {/* Protected routes require authentication */}
        <Route
          path="/"
          element={user ? <Index /> : <Auth />}
        />
        
        <Route path="/calibrate" element={user ? <CalibratePage /> : <Auth />} />
        <Route path="/print-form" element={user ? <PrintFormPage /> : <Auth />} />

        {/* Design system evaluation — no auth required */}
        <Route path="/design-systems" element={<DesignSystemPage />} />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppRoutes />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
