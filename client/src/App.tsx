import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import GlobalErrorToasts from "@/components/GlobalErrorToasts";
import { AuthProvider } from "./hooks/use-auth";
import { useAuth } from "./hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { ProtectedRoute } from "./lib/protected-route";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import TermsPage from "@/pages/terms";
import HomePage from "@/pages/home-page";
import ChatPage from "@/pages/chat-page";
import ProfilePage from "@/pages/profile-page";
import SettingsPage from "@/pages/settings-page";
import GamesPage from "@/pages/games-page";

// 🔥 новые страницы
import MusicPage from "@/pages/music-page";

import BottomNav from "@/components/BottomNav"; // нижняя панель навигации
import { AudioPlayerProvider } from "./hooks/use-audio-player";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsPage} />
      <ProtectedRoute path="/" component={HomePage} />
  <ProtectedRoute path="/music" component={MusicPage} />
  <ProtectedRoute path="/games" component={GamesPage} />
    <ProtectedRoute path="/messages" component={ChatPage} />
    <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
  {/** Настройки доступны по /settings и частично в профиле */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="app-theme">
        <AuthProvider>
          <TooltipProvider>
            <AudioPlayerProvider>
              <AppContent />
            </AudioPlayerProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

// Внутренний контент приложения, который знает о статусе авторизации
function AppContent() {
  const { user } = useAuth();
  const showBottomNav = Boolean(user);

  return (
    <div className={showBottomNav ? "pb-[4.75rem] pb-safe" : undefined}>
      {/* Background layers */}
      <div className="ui-glow" aria-hidden />
      <div className="ui-noise" aria-hidden />
      <Toaster />
  <GlobalErrorToasts />
      <Router />
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}