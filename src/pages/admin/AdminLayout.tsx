import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, Users, DollarSign, ArrowLeft, MessageCircle, CreditCard, LogOut, Image, Truck } from "lucide-react";
import { useAdminOrderAlert } from "@/hooks/useAdminOrderAlert";

const navItems = [
  { path: "/admin", icon: LayoutDashboard, label: "Visão Geral" },
  { path: "/admin/pedidos", icon: ShoppingBag, label: "Pedidos" },
  { path: "/admin/cardapio", icon: UtensilsCrossed, label: "Cardápio" },
  { path: "/admin/banners", icon: Image, label: "Banners" },
  { path: "/admin/clientes", icon: Users, label: "Clientes" },
  { path: "/admin/financeiro", icon: DollarSign, label: "Financeiro" },
  { path: "/admin/pagamento", icon: CreditCard, label: "Pagamento" },
  { path: "/admin/entregadores", icon: Truck, label: "Entregadores" },
  { path: "/admin/atendimento", icon: MessageCircle, label: "Atendimento" },
];

const AdminLayout = () => {
  const { isAdmin, isDevAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useAdminOrderAlert();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen min-h-dvh bg-background">
      <header className="sticky top-0 z-40 bg-card border-b">
        <div className="container flex items-center h-14 gap-3">
          <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-lg">Doce & Poesia - Admin</h1>
          {isDevAdmin && (
            <span className="ml-2 text-[11px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-semibold border border-amber-300">
              DEV
            </span>
          )}
          <div className="ml-auto">
            <button onClick={signOut} className="p-2 rounded-lg hover:bg-muted active:scale-95 text-muted-foreground hover:text-destructive transition-colors" aria-label="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <nav className="hidden md:flex flex-col w-56 min-h-[calc(100vh-56px)] border-r bg-card p-3 gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex z-50 overflow-x-auto safe-bottom">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path + item.label}
              onClick={() => navigate(item.path)}
              className={`flex-1 min-w-[56px] flex flex-col items-center py-2.5 gap-0.5 text-[9px] font-medium transition-colors ${active ? "text-primary font-bold" : "text-muted-foreground"}`}
            >
              <item.icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default AdminLayout;
