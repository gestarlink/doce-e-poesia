import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, ClipboardList, ShoppingCart, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

const NAV_ITEMS = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Search, label: "Buscar", path: "/?search=1" },
  { icon: ClipboardList, label: "Pedidos", path: "/minha-conta" },
  { icon: ShoppingCart, label: "Carrinho", path: "/checkout" },
  { icon: User, label: "Perfil", path: "/auth" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { itemCount } = useCart();

  const handleNav = (item: (typeof NAV_ITEMS)[0]) => {
    if (item.path === "/auth" && user) {
      navigate("/minha-conta");
    } else if (item.path === "/minha-conta" && !user) {
      navigate("/auth?redirect=/minha-conta");
    } else if (item.path === "/checkout" && itemCount === 0) {
      navigate("/");
    } else if (item.path === "/?search=1") {
      navigate("/");
      setTimeout(() => document.getElementById("menu-search")?.focus(), 100);
    } else {
      navigate(item.path);
    }
  };

  const isActive = (item: (typeof NAV_ITEMS)[0]) => {
    if (item.path === "/") return location.pathname === "/" && !location.search.includes("search");
    if (item.path === "/?search=1") return false;
    if (item.path === "/auth") return location.pathname === "/auth" || (user && location.pathname === "/minha-conta");
    if (item.path === "/minha-conta") return location.pathname === "/minha-conta" || location.pathname.startsWith("/pedido");
    return location.pathname === item.path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="max-w-lg mx-auto flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          const isCart = item.path === "/checkout";
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative"
            >
              {isCart && itemCount > 0 && (
                <span className="absolute -top-0.5 right-1/2 translate-x-[10px] bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
              <Icon className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-medium transition-colors ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {item.label === "Perfil" && user ? "Perfil" : item.label}
              </span>
              {active && <span className="absolute -top-0.5 w-5 h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
