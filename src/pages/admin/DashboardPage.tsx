import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, DollarSign, Clock, CheckCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  recebido: "Recebido",
  em_preparo: "Em preparo",
  saiu_entrega: "Saiu p/ entrega",
  entregue: "Entregue",
};

const DashboardPage = () => {
  const [stats, setStats] = useState({ totalPedidos: 0, faturamentoHoje: 0, emAndamento: 0, entregues: 0 });
  const [recentes, setRecentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [allOrders, todayOrders, recentOrders] = await Promise.all([
        supabase.from("pedidos").select("id, status, valor_total, created_at"),
        supabase.from("pedidos").select("valor_total").gte("created_at", today),
        supabase.from("pedidos").select("id, status, valor_total, endereco, created_at, cliente_id").order("created_at", { ascending: false }).limit(5),
      ]);

      const orders = allOrders.data || [];
      const faturamento = (todayOrders.data || []).reduce((sum: number, o: any) => sum + Number(o.valor_total), 0);
      const emAndamento = orders.filter((o: any) => o.status !== "entregue").length;
      const entregues = orders.filter((o: any) => o.status === "entregue").length;

      const recent = recentOrders.data || [];
      if (recent.length > 0) {
        const ids = [...new Set(recent.map((r: any) => r.cliente_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, nome").in("user_id", ids);
        const map = new Map((profiles || []).map((p: any) => [p.user_id, p.nome]));
        setRecentes(recent.map((r: any) => ({ ...r, cliente_nome: map.get(r.cliente_id) || "" })));
      }

      setStats({ totalPedidos: orders.length, faturamentoHoje: faturamento, emAndamento, entregues });
      setLoading(false);
    };
    fetchStats();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const cards = [
    { label: "Pedidos hoje", value: String(stats.totalPedidos), icon: ShoppingBag, color: "text-primary", bg: "bg-primary/10" },
    { label: "Faturamento hoje", value: `R$ ${stats.faturamentoHoje.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Em andamento", value: String(stats.emAndamento), icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Entregues", value: String(stats.entregues), icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="container py-6 max-w-5xl">
      <h2 className="font-display font-bold text-xl mb-5">Visão Geral</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`bg-card rounded-2xl p-4 shadow-sm border animate-fade-up`}>
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-muted-foreground text-xs mb-1">{card.label}</p>
            <p className="font-display font-bold text-xl tabular-nums">
              {loading ? "..." : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-card rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Pedidos recentes</h3>
          <button onClick={() => navigate("/admin/pedidos")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-border/50">
          {recentes.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10">
              {loading ? "Carregando..." : "Nenhum pedido recente"}
            </p>
          ) : (
            recentes.map((p) => (
              <button key={p.id} onClick={() => navigate("/admin/pedidos")} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.cliente_nome || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.endereco}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">R$ {Number(p.valor_total).toFixed(2).replace(".", ",")}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), "HH:mm", { locale: ptBR })}</p>
                </div>
                <Badge className={`status-${p.status} border-0 text-[10px]`}>
                  {STATUS_LABELS[p.status] || p.status}
                </Badge>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
