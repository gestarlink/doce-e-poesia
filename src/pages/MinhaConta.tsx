import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Package, ChefHat, Truck, CheckCircle2, User, Mail, Phone } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type OrderStatus = "recebido" | "em_preparo" | "saiu_entrega" | "entregue";

interface Order {
  id: string;
  status: OrderStatus;
  valor_total: number;
  endereco: string;
  created_at: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  recebido: { label: "Recebido", icon: <Package className="w-4 h-4" />, color: "bg-amber-500" },
  em_preparo: { label: "Em preparo", icon: <ChefHat className="w-4 h-4" />, color: "bg-blue-500" },
  saiu_entrega: { label: "A caminho", icon: <Truck className="w-4 h-4" />, color: "bg-primary" },
  entregue: { label: "Entregue", icon: <CheckCircle2 className="w-4 h-4" />, color: "bg-emerald-500" },
};

const MinhaConta = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ativos" | "historico">("ativos");

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, status, valor_total, endereco, created_at")
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });
      setOrders((data as Order[]) || []);
      setLoading(false);
    };
    fetchOrders();

    const channel = supabase
      .channel("my-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `cliente_id=eq.${user.id}` }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const activeOrders = orders.filter((o) => o.status !== "entregue");
  const pastOrders = orders.filter((o) => o.status === "entregue");
  const displayedOrders = tab === "ativos" ? activeOrders : pastOrders;

  return (
    <div className="min-h-dvh bg-background safe-bottom pb-24">
      <header className="ifood-header flex items-center">
        <div className="container flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base">Meus pedidos</h1>
        </div>
      </header>

      <div className="container max-w-lg pt-5 pb-2">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-base truncate">{profile?.nome || "Cliente"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{profile?.email}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-muted rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold tabular-nums">{orders.length}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="bg-muted rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold tabular-nums">{activeOrders.length}</p>
              <p className="text-[10px] text-muted-foreground">Ativos</p>
            </div>
            <div className="bg-muted rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold tabular-nums">{pastOrders.length}</p>
              <p className="text-[10px] text-muted-foreground">Concluídos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="container max-w-lg py-3">
        <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setTab("ativos")}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${tab === "ativos" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Em andamento {activeOrders.length > 0 && <span className="ml-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{activeOrders.length}</span>}
          </button>
          <button
            onClick={() => setTab("historico")}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${tab === "historico" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Histórico
          </button>
        </div>
      </div>

      {/* Orders list */}
      <div className="container max-w-lg pb-8 space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border p-4">
              <div className="ifood-skeleton h-4 w-1/3 mb-3" />
              <div className="ifood-skeleton h-3 w-2/3 mb-2" />
              <div className="ifood-skeleton h-3 w-1/2" />
            </div>
          ))
        ) : displayedOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">{tab === "ativos" ? "📦" : "🎉"}</p>
            <p className="text-muted-foreground text-sm font-medium">
              {tab === "ativos" ? "Nenhum pedido em andamento" : "Nenhum pedido concluído"}
            </p>
            {tab === "ativos" && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/")}>
                Fazer um pedido
              </Button>
            )}
          </div>
        ) : (
          displayedOrders.map((order) => {
            const cfg = STATUS_CONFIG[order.status];
            return (
              <button
                key={order.id}
                onClick={() => navigate(`/pedido/${order.id}`)}
                className="w-full bg-card rounded-xl border p-4 text-left hover:shadow-md transition-shadow active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Pedido #{order.id.slice(0, 8)}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className={`${cfg.color} text-white rounded-full p-1`}>{cfg.icon}</div>
                      <span className="text-sm font-semibold">{cfg.label}</span>
                      {order.status === "saiu_entrega" && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm text-primary tabular-nums">
                      R$ {Number(order.valor_total).toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
                {order.status === "saiu_entrega" && (
                  <div className="mt-2 pt-2 border-t flex items-center justify-center gap-2 text-xs font-semibold text-primary">
                    <Truck className="w-3.5 h-3.5" />
                    Acompanhar entrega
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default MinhaConta;
