import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Package, MapPin, User, ArrowLeft, LogOut } from "lucide-react";
import { useEntregadorOnline } from "@/hooks/useEntregadorOnline";

const navItems = [
  { path: "/entregador", icon: Package, label: "Entregas" },
  { path: "/entregador/ativa", icon: MapPin, label: "Em rota" },
  { path: "/entregador/perfil", icon: User, label: "Perfil" },
];

const EntregadorLayout = () => {
  const { profile, isDevEntregador, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEntregadorOnline();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if ((profile?.tipo as string) !== "entregador" && !isDevEntregador) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b">
        <div className="container flex items-center h-14 gap-3">
          <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white text-sm">🛵</div>
            <h1 className="font-display font-bold text-lg">Entregas</h1>
          </div>
          <div className="ml-auto">
            <button onClick={signOut} className="p-2 rounded-lg hover:bg-muted active:scale-95 text-muted-foreground hover:text-destructive transition-colors" aria-label="Sair">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t flex z-50">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default EntregadorLayout;
