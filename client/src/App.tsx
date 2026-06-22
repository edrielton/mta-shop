import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { Header } from "@/components/header";
import AdminGuard from "@/components/AdminGuard";
import NotFound from "@/pages/not-found";
import PlayerDashboard from "@/pages/player-dashboard";
import ResourcesPage from "@/pages/resources";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth";
import ProductsPage from "@/pages/products";
import ProductDetailPage from "@/pages/product-detail";
import DashboardPage from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import CheckoutSuccessPage from "@/pages/checkout-success";
import CheckoutCancelPage from "@/pages/checkout-cancel";

// Detecta se está no subdomínio admin (admin.mtastore.site)
function isAdminSubdomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.startsWith("admin.");
}

// Roteador para o subdomínio admin
function AdminSubdomainRouter() {
  return (
    <Switch>
      <Route path="/">
        {() => (
          <AdminGuard>
            <AdminPage />
          </AdminGuard>
        )}
      </Route>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route>
        {() => (
          <AdminGuard>
            <AdminPage />
          </AdminGuard>
        )}
      </Route>
    </Switch>
  );
}

// Roteador principal do site
function MainRouter() {
  return (
    <Switch>
      <Route path="/"                  component={Home} />
      <Route path="/auth"              component={AuthPage} />
      <Route path="/login"             component={AuthPage} />
      <Route path="/entrar"            component={PlayerDashboard} />
      <Route path="/products"          component={ProductsPage} />
      <Route path="/products/:id"      component={ProductDetailPage} />
      <Route path="/resources"         component={ResourcesPage} />
      <Route path="/dashboard"         component={DashboardPage} />
      <Route path="/checkout/success"  component={CheckoutSuccessPage} />
      <Route path="/checkout/cancel"   component={CheckoutCancelPage} />
      <Route path="/admin">
        {() => (
          <AdminGuard>
            <AdminPage />
          </AdminGuard>
        )}
      </Route>
      <Route path="/admin/:rest*">
        {() => (
          <AdminGuard>
            <AdminPage />
          </AdminGuard>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const onAdminSubdomain = isAdminSubdomain();

  // No subdomínio admin, não mostra o Header principal
  return (
    <div className="min-h-screen flex flex-col">
      {!onAdminSubdomain && <Header />}
      <main className="flex-1">
        {onAdminSubdomain ? <AdminSubdomainRouter /> : <MainRouter />}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
