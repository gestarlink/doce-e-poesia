import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Truck, UserCheck, MapPin, Phone, CheckCircle2 } from "lucide-react";

const STATUS_FLOW = ["recebido", "em_preparo", "saiu_entrega", "entregue"] as const;
const STATUS_LABELS: Record<string, string> = {
  recebido: "Recebido",
  em_preparo: "Em preparo",
  saiu_entrega: "Saiu p/ entrega",
  entregue: "Entregue",
};

interface Pedido {
  id: string;
  status: string;
  valor_total: number;
  endereco: string;
  created_at: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_telefone?: string;
}

const PedidosPage = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [despacharId, setDespacharId] = useState<string | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);

  const fetchPedidos = async () => {
    const { data: pedidosData } = await supabase
      .from("pedidos")
      .select("*")
      .order("created_at", { ascending: false });

    if (!pedidosData || pedidosData.length === 0) {
      setPedidos([]);
      setLoading(false);
      return;
    }

    const clienteIds = [...new Set(pedidosData.map((p: any) => p.cliente_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome, telefone")
      .in("user_id", clienteIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    const enriched = pedidosData.map((p: any) => {
      const prof = profileMap.get(p.cliente_id);
      return { ...p, cliente_nome: prof?.nome || "", cliente_telefone: prof?.telefone || "" };
    });

    setPedidos(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchPedidos();

    const channel = supabase
      .channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => { fetchPedidos(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const prepararPedido = async (pedidoId: string) => {
    const { error } = await supabase.from("pedidos").update({ status: "em_preparo" }).eq("id", pedidoId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Pedido em preparo!");
  };

  const despacharPedido = async (pedidoId: string) => {
    const { error } = await supabase.from("pedidos").update({ status: "saiu_entrega" }).eq("id", pedidoId);
    if (error) { toast.error("Erro ao despachar"); return; }
    toast.success("Pedido despachado! 🛵");
    setDispatchOpen(false);
    setDespacharId(null);
  };

  const confirmarEntrega = async (pedidoId: string) => {
    const { error } = await supabase.from("pedidos").update({ status: "entregue" }).eq("id", pedidoId);
    if (error) { toast.error("Erro ao confirmar"); return; }
    toast.success("Pedido entregue! 🎉");
  };

  const openDispatch = (pedidoId: string) => {
    setDespacharId(pedidoId);
    setDispatchOpen(true);
  };

  const getActionForStatus = (p: Pedido) => {
    switch (p.status) {
      case "recebido":
        return (
          <Button size="sm" variant="default" onClick={() => prepararPedido(p.id)}>
            <Package className="w-3.5 h-3.5 mr-1" /> Preparar
          </Button>
        );
      case "em_preparo":
        return (
          <Button size="sm" variant="default" onClick={() => openDispatch(p.id)}>
            <Truck className="w-3.5 h-3.5 mr-1" /> Despachar
          </Button>
        );
      case "saiu_entrega":
        return (
          <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => confirmarEntrega(p.id)}>
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Confirmar entrega
          </Button>
        );
      default:
        return null;
    }
  };

  const activePedidos = pedidos.filter((p) => p.status !== "entregue");
  const historico = pedidos.filter((p) => p.status === "entregue");

  if (loading) return <div className="container py-6"><div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}</div></div>;

  const PedidoCard = ({ p }: { p: Pedido }) => {
    const isNew = p.status === "recebido";
    return (
      <div className={`bg-card rounded-2xl p-4 shadow-sm border animate-fade-up ${isNew ? "border-primary/30" : "border-transparent"}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isNew && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-primary" /></span>}
            <div>
              <p className="font-bold text-sm">#{p.id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(p.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          <Badge className={`status-${p.status} border-0 text-xs`}>
            {STATUS_LABELS[p.status] || p.status}
          </Badge>
        </div>

        {(p.cliente_nome || p.cliente_telefone) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{p.cliente_nome}</p>
            {p.cliente_telefone && (
              <a href={`tel:${p.cliente_telefone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="w-3 h-3" /> {p.cliente_telefone}
              </a>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-1.5 truncate flex items-center gap-1">
          <MapPin className="w-3 h-3 flex-shrink-0" /> {p.endereco}
        </p>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
            <span className="font-display font-bold text-primary">
              R$ {Number(p.valor_total).toFixed(2).replace(".", ",")}
            </span>
          </div>
          {getActionForStatus(p)}
        </div>
      </div>
    );
  };

  return (
    <div className="container py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display font-bold text-xl">Pedidos</h2>
          <p className="text-xs text-muted-foreground">
            {activePedidos.length} em andamento • {historico.length} entregues
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {activePedidos.length} ativos
        </Badge>
      </div>

      <div className="space-y-3">
        {pedidos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-foreground font-bold text-base">Nenhum pedido ainda</p>
            <p className="text-muted-foreground text-sm mt-1">Os novos pedidos aparecem aqui em tempo real</p>
          </div>
        ) : (
          <>
            {activePedidos.map((p) => <PedidoCard key={p.id} p={p} />)}
            {historico.length > 0 && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground pt-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Concluídos
                </h3>
                {historico.map((p) => <PedidoCard key={p.id} p={p} />)}
              </>
            )}
          </>
        )}
      </div>

      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Despachar pedido</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-xl text-white">🛵</div>
              <div>
                <p className="text-sm font-medium">Entrega própria</p>
                <p className="text-xs text-muted-foreground">
                  Confirme que o pedido saiu para entrega. O cliente será notificado.
                </p>
              </div>
            </div>
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={() => despacharPedido(despacharId!)}
            >
              <Truck className="w-5 h-5 mr-2" /> Confirmar saída p/ entrega
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PedidosPage;
