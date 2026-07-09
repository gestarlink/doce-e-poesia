import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, Package, UserCheck, MapPin } from "lucide-react";

const isOnline = (updatedAt: string) => {
  return Date.now() - new Date(updatedAt).getTime() < 90000;
};

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
  entregador_id: string | null;
  cliente_nome?: string;
  cliente_telefone?: string;
}

interface EntregadorOption {
  user_id: string;
  nome: string;
  telefone: string | null;
  updated_at: string;
}

const devEntregadorEmails = import.meta.env.VITE_DEV_ENTREGADOR_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];

const PedidosPage = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [entregadores, setEntregadores] = useState<EntregadorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchPedidoId, setDispatchPedidoId] = useState<string | null>(null);
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

  const fetchEntregadores = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, nome, telefone, email, updated_at");
    const list = ((data as (EntregadorOption & { email: string; tipo: string })[]) || []).filter(p =>
      p.tipo === "entregador" || devEntregadorEmails.includes(p.email?.toLowerCase())
    ).map(({ email, tipo, ...rest }) => rest);
    setEntregadores(list);
  };

  useEffect(() => {
    fetchPedidos();
    fetchEntregadores();

    const channel = supabase
      .channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => { fetchPedidos(); })
      .subscribe();

    const entregChannel = supabase
      .channel("entreg-online")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: "tipo=eq.entregador" }, () => { fetchEntregadores(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(entregChannel); };
  }, []);

  const prepararPedido = async (pedidoId: string) => {
    const { error } = await supabase.from("pedidos").update({ status: "em_preparo" }).eq("id", pedidoId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Pedido em preparo!");
  };

  const despacharPedido = async (pedidoId: string, entregadorId: string) => {
    const { error } = await supabase.from("pedidos").update({
      status: "saiu_entrega",
      entregador_id: entregadorId,
    }).eq("id", pedidoId);
    if (error) { toast.error("Erro ao despachar"); return; }
    toast.success("Pedido despachado! Entregador notificado.");
    setDispatchOpen(false);
    setDispatchPedidoId(null);
  };

  const confirmarEntrega = async (pedidoId: string) => {
    const { error } = await supabase.from("pedidos").update({ status: "entregue" }).eq("id", pedidoId);
    if (error) { toast.error("Erro ao confirmar"); return; }
    toast.success("Pedido entregue! 🎉");
  };

  const openDispatch = (pedidoId: string) => {
    setDispatchPedidoId(pedidoId);
    setDispatchOpen(true);
    fetchEntregadores();
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

  if (loading) return <div className="container py-6"><div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}</div></div>;

  return (
    <div className="container py-6">
      <h2 className="font-display font-bold text-xl mb-4">Pedidos</h2>
      {pedidos.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum pedido ainda</p>
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => {
            const assignedEntreg = p.entregador_id ? entregadores.find(e => e.user_id === p.entregador_id) : null;
            return (
              <div key={p.id} className="bg-card rounded-xl border p-4 animate-fade-up">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-display font-semibold text-sm">#{p.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className={`status-${p.status} border-0 text-xs`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </Badge>
                </div>
                {(p.cliente_nome || p.cliente_telefone) && (
                  <p className="text-sm text-muted-foreground">
                    {p.cliente_nome}{p.cliente_telefone ? ` • ${p.cliente_telefone}` : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" /> {p.endereco}
                </p>
                {assignedEntreg && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${p.status === "em_preparo" ? "text-amber-600" : "text-primary"}`}>
                    <Truck className="w-3 h-3" />
                    {p.status === "em_preparo" ? `Entregador aceitou: ${assignedEntreg.nome} (aguardando despacho)` : `Entregador: ${assignedEntreg.nome}`}
                  </p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="font-display font-bold text-primary">
                    R$ {Number(p.valor_total).toFixed(2).replace(".", ",")}
                  </span>
                  <div className="flex items-center gap-2">
                    {getActionForStatus(p)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Despachar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <p className="text-sm text-muted-foreground mb-3">Selecione o entregador:</p>
            {(() => {
              const currentPedido = dispatchPedidoId ? pedidos.find(p => p.id === dispatchPedidoId) : null;
              const assignedEnt = currentPedido?.entregador_id ? entregadores.find(e => e.user_id === currentPedido.entregador_id) : null;

              if (assignedEnt) {
                return (
                  <button
                    onClick={() => dispatchPedidoId && despacharPedido(dispatchPedidoId, assignedEnt.user_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-lg text-white">
                      🛵
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{assignedEnt.nome} <span className="text-xs text-primary font-normal">(aceitou)</span></p>
                      <p className="text-xs text-muted-foreground">{assignedEnt.telefone || ""}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary">Despachar →</span>
                  </button>
                );
              }

              const online = entregadores.filter(e => isOnline(e.updated_at));
              if (online.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-2">🛵</p>
                    <p className="text-sm text-muted-foreground">Nenhum entregador online no momento</p>
                    {entregadores.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {entregadores.length} entregador(es) offline
                      </p>
                    )}
                  </div>
                );
              }

              return online.map((ent) => (
                <button
                  key={ent.user_id}
                  onClick={() => dispatchPedidoId && despacharPedido(dispatchPedidoId, ent.user_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-accent transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                    🛵
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ent.nome}</p>
                    <p className="text-xs text-muted-foreground">{ent.telefone || ""}</p>
                  </div>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                </button>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PedidosPage;
