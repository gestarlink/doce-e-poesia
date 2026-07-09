import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import SplashScreen from "@/components/SplashScreen";
import AuthPage from "./pages/AuthPage";
import MenuPage from "./pages/MenuPage";
import InstallPage from "./pages/InstallPage";
import CheckoutPage from "./pages/CheckoutPage";
import TrackOrderPage from "./pages/TrackOrderPage";
import MinhaConta from "./pages/MinhaConta";
import AdminLayout from "./pages/admin/AdminLayout";
import DashboardPage from "./pages/admin/DashboardPage";
import PedidosPage from "./pages/admin/PedidosPage";
import ProdutosPage from "./pages/admin/ProdutosPage";
import ClientesPage from "./pages/admin/ClientesPage";
import FinanceiroPage from "./pages/admin/FinanceiroPage";
import AtendimentoPage from "./pages/admin/AtendimentoPage";
import PagamentoPage from "./pages/admin/PagamentoPage";
import BannersPage from "./pages/admin/BannersPage";
import EntregadoresPage from "./pages/admin/EntregadoresPage";
import EntregadorLayout from "./pages/entregador/EntregadorLayout";
import EntregasListPage from "./pages/entregador/EntregasListPage";
import EntregaAtivaPage from "./pages/entregador/EntregaAtivaPage";
import EntregadorPerfilPage from "./pages/entregador/EntregadorPerfilPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, profile, loading, isAdmin, isEntregador } = useAuth();
  useOrderNotifications();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user && isAdmin) {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="pedidos" element={<PedidosPage />} />
          <Route path="cardapio" element={<ProdutosPage />} />
          <Route path="produtos" element={<ProdutosPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="financeiro" element={<FinanceiroPage />} />
          <Route path="banners" element={<BannersPage />} />
          <Route path="pagamento" element={<PagamentoPage />} />
          <Route path="atendimento" element={<AtendimentoPage />} />
          <Route path="entregadores" element={<EntregadoresPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  if (user && isEntregador) {
    return (
      <Routes>
        <Route path="/entregador" element={<EntregadorLayout />}>
          <Route index element={<EntregasListPage />} />
          <Route path="ativa" element={<EntregaAtivaPage />} />
          <Route path="perfil" element={<EntregadorPerfilPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/entregador" replace />} />
      </Routes>
    );
  }

  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<MenuPage />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route path="/checkout" element={user ? <CheckoutPage /> : <Navigate to="/auth?redirect=/checkout" replace />} />
        <Route path="/pedido/:id" element={user ? <TrackOrderPage /> : <Navigate to="/auth" replace />} />
        <Route path="/minha-conta" element={user ? <MinhaConta /> : <Navigate to="/auth" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CartProvider>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
        <BrowserRouter>
          <AuthProvider>
            <div className="max-w-lg mx-auto min-h-dvh bg-background shadow-xl md:border-x md:border-border relative">
              <AppRoutes />
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
