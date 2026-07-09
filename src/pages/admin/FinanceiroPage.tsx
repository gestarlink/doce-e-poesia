import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingUp, CreditCard, QrCode, CheckCircle2, Clock } from "lucide-react";

const FinanceiroPage = () => {
  const [stats, setStats] = useState({ diario: 0, semanal: 0, mensal: 0, pagos: 0, pendentes: 0, totalRecebido: 0, totalPendente: 0 });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const now = new Date();
      const dayStart = startOfDay(now).toISOString();
      const weekStart = startOfDay(subDays(now, 7)).toISOString();
      const monthStart = startOfDay(subDays(now, 30)).toISOString();

      const [dayData, weekData, monthData, payments, recentPay] = await Promise.all([
        supabase.from("pagamentos").select("data_pagamento, pedidos(valor_total)").eq("status", "pago").gte("data_pagamento", dayStart),
        supabase.from("pagamentos").select("data_pagamento, pedidos(valor_total)").eq("status", "pago").gte("data_pagamento", weekStart),
        supabase.from("pagamentos").select("data_pagamento, pedidos(valor_total)").eq("status", "pago").gte("data_pagamento", monthStart),
        supabase.from("pagamentos").select("status, pedidos(valor_total)"),
        supabase.from("pagamentos").select("*, pedidos(id, valor_total, endereco, created_at)").order("created_at", { ascending: false }).limit(20),
      ]);

      const sumPedidos = (arr: any[]) => arr.reduce((s, r) => s + Number(r.pedidos?.valor_total || 0), 0);
      const pagosArr = (payments.data || []).filter((p: any) => p.status === "pago");
      const pendentesArr = (payments.data || []).filter((p: any) => p.status === "pendente");

      setStats({
        diario: sumPedidos(dayData.data || []),
        semanal: sumPedidos(weekData.data || []),
        mensal: sumPedidos(monthData.data || []),
        pagos: pagosArr.length,
        pendentes: pendentesArr.length,
        totalRecebido: pagosArr.reduce((s: number, p: any) => s + Number(p.pedidos?.valor_total || 0), 0),
        totalPendente: pendentesArr.reduce((s: number, p: any) => s + Number(p.pedidos?.valor_total || 0), 0),
      });
      setRecentPayments(recentPay.data || []);
      setLoading(false);
    };
    fetchData();

    const channel = supabase
      .channel("financeiro-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pagamentos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const cards = [
    { label: "Faturamento Diário", value: fmt(stats.diario), icon: DollarSign, color: "text-primary" },
    { label: "Faturamento Semanal", value: fmt(stats.semanal), icon: TrendingUp, color: "text-primary" },
    { label: "Faturamento Mensal", value: fmt(stats.mensal), icon: TrendingUp, color: "text-primary" },
    { label: "Total Recebido", value: fmt(stats.totalRecebido), icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Total Pendente", value: fmt(stats.totalPendente), icon: Clock, color: "text-amber-600" },
    { label: "Pedidos Pagos", value: stats.pagos, icon: CreditCard, color: "text-emerald-600" },
    { label: "Pedidos Pendentes", value: stats.pendentes, icon: QrCode, color: "text-amber-600" },
  ];

  return (
    <div className="container py-6 space-y-6">
      <h2 className="font-display font-bold text-xl">Financeiro</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <p className="text-muted-foreground text-xs">{c.label}</p>
            </div>
            <p className="font-display font-bold text-xl tabular-nums">{loading ? "..." : c.value}</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-display font-semibold text-sm mb-4">Últimas transações</h3>
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : recentPayments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhuma transação registrada</p>
        ) : (
          <div className="space-y-2">
            {recentPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                {p.status === "pago" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : p.status === "recusado" ? <Clock className="w-4 h-4 text-destructive" /> : <Clock className="w-4 h-4 text-amber-500" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">#{(p.pedidos?.id || p.pedido_id).slice(0, 8)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.status === "pago" ? "Pago" : p.status === "recusado" ? "Recusado" : "Pendente"}
                    {p.metodo ? ` · ${p.metodo}` : ""}
                  </p>
                </div>
                <p className="font-display font-bold text-sm tabular-nums">
                  {fmt(Number(p.pedidos?.valor_total || 0))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceiroPage;
