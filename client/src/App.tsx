import React, { Suspense } from "react";
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
import { Loader2 } from "lucide-react";

// Route-level code-splitting
const NotFound = React.lazy(() => import("@/pages/not-found"));
const AuthPage = React.lazy(() => import("@/pages/auth-page"));
const PrivacyPolicyPage = React.lazy(() => import("@/pages/privacy-policy"));
const TermsPage = React.lazy(() => import("@/pages/terms"));
const HomePage = React.lazy(() => import("@/pages/home-page"));
const ChatPage = React.lazy(() => import("@/pages/chat-page"));
const ProfilePage = React.lazy(() => import("@/pages/profile-page"));
const SettingsPage = React.lazy(() => import("@/pages/settings-page"));
const GamesPage = React.lazy(() => import("@/pages/games-page"));
// 🔥 новые страницы
const MusicPage = React.lazy(() => import("@/pages/music-page"));

import BottomNav from "@/components/BottomNav"; // нижняя панель навигации
import { AudioPlayerProvider } from "./hooks/use-audio-player";

function Fallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="h-6 w-6 animate-spin text-border" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route
        path="/auth"
        component={() => (
          <Suspense fallback={<Fallback />}>
            <AuthPage />
          </Suspense>
        )}
      />
      <Route
        path="/privacy"
        component={() => (
          <Suspense fallback={<Fallback />}>
            <PrivacyPolicyPage />
          </Suspense>
        )}
      />
      <Route
        path="/terms"
        component={() => (
          <Suspense fallback={<Fallback />}>
            <TermsPage />
          </Suspense>
        )}
      />
      {/* Protected with Suspense wrappers to support React.lazy */}
      <ProtectedRoute path="/" component={() => (
        <Suspense fallback={<Fallback />}>
          <HomePage />
        </Suspense>
      )} />
      <ProtectedRoute path="/music" component={() => (
        <Suspense fallback={<Fallback />}>
          <MusicPage />
        </Suspense>
      )} />
      <ProtectedRoute path="/games" component={() => (
        <Suspense fallback={<Fallback />}>
          <GamesPage />
        </Suspense>
      )} />
      <ProtectedRoute path="/messages" component={() => (
        <Suspense fallback={<Fallback />}>
          <ChatPage />
        </Suspense>
      )} />
      <ProtectedRoute path="/settings" component={() => (
        <Suspense fallback={<Fallback />}>
          <SettingsPage />
        </Suspense>
      )} />
      <ProtectedRoute path="/profile" component={() => (
        <Suspense fallback={<Fallback />}>
          <ProfilePage />
        </Suspense>
      )} />
      {/* 404 */}
      <Route component={() => (
        <Suspense fallback={<Fallback />}>
          <NotFound />
        </Suspense>
      )} />
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
    <div className={showBottomNav ? "pb-bottom-nav" : undefined}>
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