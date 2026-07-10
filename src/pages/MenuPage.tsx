import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/ProductCard";
import ProductDetailModal from "@/components/ProductDetailModal";
import CartSheet from "@/components/CartSheet";
import PromoBanner from "@/components/PromoBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import logoDocePoesia from "@/assets/logo-doce-poesia.png";
import { Search, Star, ChevronDown, LogOut, User, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import BottomNav from "@/components/BottomNav";
import { useMenuState } from "@/hooks/useMenuState";

interface Product {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
  ativo: boolean;
  categoria: string | null;
  estoque?: number | null;
}

const CATEGORY_ORDER = ["Destaques", "Mais Amados", "Combos", "Cookies", "Brownies", "Edição Especial"];

const MenuPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { restoreState, saveSearch, saveCategory } = useMenuState();
  const restored = restoreState();
  const [search, setSearch] = useState(restored.search);
  const [activeCategory, setActiveCategory] = useState(restored.activeCategory);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { user, profile, isAdmin, signOut } = useAuth();
  const { itemCount } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      const prods = (data as Product[]) || [];
      setProducts(prods);
      const present = new Set(prods.map((p) => p.categoria).filter(Boolean) as string[]);
      const ordered = CATEGORY_ORDER.filter((c) => present.has(c));
      const extras = [...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
      setCategories([...ordered, ...extras]);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory === "Todos" || p.categoria === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const allCategories = ["Todos", ...categories];

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* ─── Minimal Header (iFood style) ─── */}
      <div className="ifood-header flex items-center">
        <div className="container flex items-center justify-between h-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm overflow-hidden">
              <img src={logoDocePoesia} alt="Doce & Poesia" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight">Doce & Poesia</h1>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>4.8</span>
                <span className="text-border mx-1">|</span>
                <span>Brownies artesanais</span>
              </div>
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="relative flex w-2.5 h-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-500" />
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs text-muted-foreground bg-muted rounded-full px-3 py-1 hover:bg-muted/80 cursor-pointer">
                    {profile?.nome?.split(" ")[0] || "Conta"}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => window.location.href = "/admin"}>
                      <Shield className="w-4 h-4 mr-2" /> Painel Admin
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => window.location.href = "/minha-conta"}>
                    <User className="w-4 h-4 mr-2" /> Meus pedidos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button onClick={() => signOut()} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors" title="Sair">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a href="/auth" className="text-xs font-semibold text-primary">Entrar</a>
          )}
        </div>
      </div>

      {/* ─── Search ─── */}
      <div className="container mt-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="menu-search"
            placeholder="Buscar no cardápio"
            value={search}
            onChange={(e) => { setSearch(e.target.value); saveSearch(e.target.value); }}
            className="pl-10 h-10 rounded-xl bg-muted/50 border-0 text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* ─── Category Pills (iFood style) ─── */}
      {allCategories.length > 1 && (
        <div className="container mt-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {allCategories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); saveCategory(cat); }}
                  className={`ifood-category-btn ${isActive ? "ifood-category-active" : "ifood-category-inactive"}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Promo Banner ─── */}
      <div className="container mt-4">
        <PromoBanner />
      </div>

      {/* ─── Section title ─── */}
      <div className="container mt-5 mb-3 flex items-center justify-between">
        <h2 className="font-bold text-base text-foreground">
          {activeCategory === "Todos" ? "Produtos" : activeCategory}
        </h2>
        <span className="text-xs text-muted-foreground">{filteredProducts.length} {filteredProducts.length === 1 ? "item" : "itens"}</span>
      </div>

      {/* ─── Product Grid ─── */}
      <div className="container">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl border overflow-hidden">
                <div className="aspect-square ifood-skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-3 ifood-skeleton rounded w-3/4" />
                  <div className="h-2 ifood-skeleton rounded w-1/2" />
                  <div className="h-4 ifood-skeleton rounded w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🍫</p>
            <p className="text-foreground font-bold text-base">
              {search ? "Nenhum item encontrado" : "Nenhum produto disponível"}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {search ? "Tente buscar por outro item" : "Estamos preparando novidades!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((p) => (
              <ProductCard key={p.id} {...p} estoque={p.estoque} onClick={() => handleProductClick(p)} />
            ))}
          </div>
        )}
      </div>

      <ProductDetailModal product={selectedProduct} open={modalOpen} onOpenChange={setModalOpen} />
      {itemCount > 0 && <CartSheet />}
      <BottomNav />
    </div>
  );
};

export default MenuPage;
