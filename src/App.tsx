import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

import Login from "./pages/Login";
import { ForgotPasswordPage, ResetPasswordPage } from "./pages/ResetPassword";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ClientsPage from "./pages/admin/ClientsPage";
import ReportsListPage from "./pages/admin/ReportsListPage";
import ConsolidadoPage from "./pages/admin/ConsolidadoPage";
import AnaliticoPage from "./pages/admin/AnaliticoPage";
import AnexarRelatorio from "./pages/admin/AnexarRelatorio";
import FechamentoFolhaPage from "./pages/admin/FechamentoFolhaPage";
import ConfiguracoesPage from "./pages/admin/ConfiguracoesPage";
import ClientPortal from "./pages/client/ClientPortal";
import ReportView from "./pages/ReportView";

const queryClient = new QueryClient();

// Root redirect based on auth/role
function RootRedirect() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/portal" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Root → redirect based on role */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute role="admin"><Index /></ProtectedRoute>
            } />
            <Route path="/admin/clientes" element={
              <ProtectedRoute role="admin"><ClientsPage /></ProtectedRoute>
            } />
            <Route path="/admin/relatorios" element={
              <ProtectedRoute role="admin"><ReportsListPage /></ProtectedRoute>
            } />
            <Route path="/admin/consolidado" element={
              <ProtectedRoute role="admin"><ConsolidadoPage /></ProtectedRoute>
            } />
            <Route path="/admin/analitico" element={
              <ProtectedRoute role="admin"><AnaliticoPage /></ProtectedRoute>
            } />
            <Route path="/admin/anexar-relatorio" element={
              <ProtectedRoute role="admin"><AnexarRelatorio /></ProtectedRoute>
            } />
            <Route path="/admin/fechamento-folha" element={
              <ProtectedRoute role="admin"><FechamentoFolhaPage /></ProtectedRoute>
            } />
            <Route path="/admin/configuracoes" element={
              <ProtectedRoute role="admin"><ConfiguracoesPage /></ProtectedRoute>
            } />

            {/* Client routes */}
            <Route path="/portal" element={
              <ProtectedRoute role="client"><ClientPortal /></ProtectedRoute>
            } />

            {/* Shared: report view (admin + client) */}
            <Route path="/relatorio/:id" element={
              <ProtectedRoute><ReportView /></ProtectedRoute>
            } />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
