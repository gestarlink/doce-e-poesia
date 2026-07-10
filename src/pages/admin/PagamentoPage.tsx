import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, QrCode, DollarSign, CheckCircle2, Clock, XCircle } from "lucide-react";

const PagamentoPage = () => {
  const [config, setConfig] = useState({
    mercadoPagoToken: "",
    pixAtivo: true,
    cartaoAtivo: true,
    pixChave: "",
    pixNome: "",
  });
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("gestar_pagamento_config");
    if (saved) setConfig(JSON.parse(saved));

    const fetchPayments = async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("*, pedidos(id, valor_total, endereco, created_at)")
        .order("created_at", { ascending: false })
        .limit(50);
      setPayments(data || []);
      setLoading(false);
    };
    fetchPayments();

    const channel = supabase
      .channel("pagamentos-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "pagamentos" }, () => fetchPayments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSave = () => {
    localStorage.setItem("gestar_pagamento_config", JSON.stringify(config));
    toast.success("Configurações de pagamento salvas!");
  };

  const updatePaymentStatus = async (p: any, status: "pago" | "recusado") => {
    if (p.metodo === "pix" && status === "pago") {
      const { error: fnErr } = await supabase.functions.invoke("mercado-pago", {
        body: { action: "confirm_pix", pedido_id: p.pedido_id },
      });
      if (fnErr) { toast.error("Erro ao confirmar"); return; }
      toast.success("Pix confirmado!");
    } else {
      const { error } = await supabase.from("pagamentos").update({ 
        status, 
        data_pagamento: status === "pago" ? new Date().toISOString() : null 
      }).eq("id", p.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success(status === "pago" ? "Pagamento confirmado!" : "Pagamento recusado");
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "pago": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "recusado": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "pago": return "Pago";
      case "recusado": return "Recusado";
      default: return "Pendente";
    }
  };

  const totalRecebido = payments.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.pedidos?.valor_total || 0), 0);
  const totalPendente = payments.filter(p => p.status === "pendente").reduce((s, p) => s + Number(p.pedidos?.valor_total || 0), 0);

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display font-bold text-xl">Pagamento</h2>
          <p className="text-muted-foreground text-xs">Configure meios de pagamento e gerencie transações</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-4">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Total Recebido</p>
          <p className="font-display font-bold text-xl tabular-nums text-emerald-700 dark:text-emerald-400">
            R$ {totalRecebido.toFixed(2).replace(".", ",")}
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20 p-4">
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">Pendente</p>
          <p className="font-display font-bold text-xl tabular-nums text-amber-700 dark:text-amber-400">
            R$ {totalPendente.toFixed(2).replace(".", ",")}
          </p>
        </div>
      </div>

      {/* Config */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Mercado Pago
        </h3>

        <div className="space-y-2">
          <Label>Access Token do Mercado Pago</Label>
          <Input
            type="password"
            placeholder="APP_USR-..."
            value={config.mercadoPagoToken}
            onChange={(e) => setConfig({ ...config, mercadoPagoToken: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Obtenha em: mercadopago.com.br → Seu negócio → Configurações → Credenciais
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Pix</p>
              <p className="text-xs text-muted-foreground">Receba pagamentos instantâneos via Pix</p>
            </div>
          </div>
          <Switch checked={config.pixAtivo} onCheckedChange={(v) => setConfig({ ...config, pixAtivo: v })} />
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Cartão de Crédito/Débito</p>
              <p className="text-xs text-muted-foreground">Aceite Visa, Mastercard, Elo, etc.</p>
            </div>
          </div>
          <Switch checked={config.cartaoAtivo} onCheckedChange={(v) => setConfig({ ...config, cartaoAtivo: v })} />
        </div>

        {config.pixAtivo && (
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Pix Manual</h4>
            <div className="space-y-2">
              <Label>Chave Pix</Label>
              <Input placeholder="email@exemplo.com" value={config.pixChave} onChange={(e) => setConfig({ ...config, pixChave: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nome do titular</Label>
              <Input placeholder="Nome completo" value={config.pixNome} onChange={(e) => setConfig({ ...config, pixNome: e.target.value })} />
            </div>
          </div>
        )}

        <Button onClick={handleSave} className="w-full">Salvar configurações</Button>
      </div>

      {/* Transações */}
      <div className="bg-card rounded-xl border p-5">
        <h3 className="font-display font-semibold text-sm mb-4">Transações recentes</h3>
        {loading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : payments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">Nenhuma transação encontrada</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                {statusIcon(p.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Pedido #{(p.pedidos?.id || p.pedido_id).slice(0, 8)}</p>
                  <p className="text-[10px] text-muted-foreground">{statusLabel(p.status)}</p>
                </div>
                <p className="font-display font-bold text-sm tabular-nums">
                  R$ {Number(p.pedidos?.valor_total || 0).toFixed(2).replace(".", ",")}
                </p>
                {p.metodo && (
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    p.metodo === "pix" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    p.metodo === "cartao" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" :
                    "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                  }`}>
                    {p.metodo === "pix" ? <QrCode className="w-3.5 h-3.5" /> :
                     p.metodo === "cartao" ? <CreditCard className="w-3.5 h-3.5" /> :
                     <DollarSign className="w-3.5 h-3.5" />}
                  </div>
                )}
                {p.status === "pendente" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-emerald-600" onClick={() => updatePaymentStatus(p, "pago")}>
                      ✓ Pago
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-destructive" onClick={() => updatePaymentStatus(p, "recusado")}>
                      ✗
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PagamentoPage;
