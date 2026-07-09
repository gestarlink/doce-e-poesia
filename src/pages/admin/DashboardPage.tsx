import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, DollarSign, Clock, CheckCircle } from "lucide-react";

const DashboardPage = () => {
  const [stats, setStats] = useState({ totalPedidos: 0, faturamentoHoje: 0, emAndamento: 0, entregues: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [allOrders, todayOrders] = await Promise.all([
        supabase.from("pedidos").select("id, status, valor_total, created_at"),
        supabase.from("pedidos").select("valor_total").gte("created_at", today),
      ]);

      const orders = allOrders.data || [];
      const faturamento = (todayOrders.data || []).reduce((sum: number, o: any) => sum + Number(o.valor_total), 0);
      const emAndamento = orders.filter((o: any) => o.status !== "entregue").length;
      const entregues = orders.filter((o: any) => o.status === "entregue").length;

      setStats({ totalPedidos: orders.length, faturamentoHoje: faturamento, emAndamento, entregues });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const cards = [
    { label: "Total de Pedidos", value: stats.totalPedidos, icon: ShoppingBag, color: "text-primary" },
    { label: "Faturamento Hoje", value: `R$ ${stats.faturamentoHoje.toFixed(2).replace(".", ",")}`, icon: DollarSign, color: "text-emerald-600" },
    { label: "Em Andamento", value: stats.emAndamento, icon: Clock, color: "text-amber-600" },
    { label: "Entregues", value: stats.entregues, icon: CheckCircle, color: "text-emerald-600" },
  ];

  return (
    <div className="container py-6">
      <h2 className="font-display font-bold text-xl mb-4">Visão Geral</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-card rounded-xl border p-4 animate-fade-up">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-muted-foreground text-xs">{card.label}</span>
            </div>
            <p className="font-display font-bold text-2xl tabular-nums">
              {loading ? "..." : card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
