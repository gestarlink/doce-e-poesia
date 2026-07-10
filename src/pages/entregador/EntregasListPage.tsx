import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, Clock, Package, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
interface Pedido {
  id: string;
  status: string;
  valor_total: number;
  endereco: string;
  created_at: string;
  entregador_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

const EntregasListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const prevAvailableCountRef = useRef(0);

  const fetchPedidos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("pedidos")
      .select("*")
      .or(`entregador_id.eq.${user.id},and(entregador_id.is.null,status.eq.em_preparo)`)
      .order("created_at", { ascending: false });
    setPedidos((data as Pedido[]) || []);
    setLoading(false);
  };

let sharedCtx: AudioContext | null = null;

function getAlertCtx(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedCtx.state === "suspended") {
      sharedCtx.resume();
    }
    return sharedCtx;
  } catch { return null; }
}

  const playAlertSound = () => {
    try {
      const ctx = getAlertCtx();
      if (!ctx) return;
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      playTone(880, 0, 0.12);
      playTone(1175, 0.13, 0.12);
      playTone(1397, 0.26, 0.18);
      playTone(880, 0.55, 0.12);
      playTone(1175, 0.68, 0.12);
      playTone(1397, 0.81, 0.18);
    } catch {}
  };

  useEffect(() => {
    fetchPedidos();
    const channel = supabase
      .channel("entregador-pedidos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, (payload) => {
        const newStatus = (payload.new as any)?.status;
        if (newStatus === "em_preparo") {
          playAlertSound();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("🛵 Nova entrega disponível!", {
              body: "Um novo pedido está disponível para entrega.",
              icon: "/icons/icon-192.png",
              tag: "nova-entrega",
              requireInteraction: true,
            } as NotificationOptions);
          }
          toast.info("🔔 Nova entrega disponível!", {
            duration: 10000,
            action: { label: "Ver", onClick: () => {} },
          });
        }
        fetchPedidos();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, (payload) => {
        const newStatus = (payload.new as any)?.status;
        const newEntregadorId = (payload.new as any)?.entregador_id;
        if (newStatus === "em_preparo" && !newEntregadorId) {
          playAlertSound();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("🛵 Nova entrega disponível!", {
              body: "Um novo pedido está disponível para entrega.",
              icon: "/icons/icon-192.png",
              tag: "nova-entrega",
              requireInteraction: true,
            } as NotificationOptions);
          }
          toast.info("🔔 Nova entrega disponível!", {
            duration: 10000,
            action: { label: "Ver", onClick: () => {} },
          });
        }
        fetchPedidos();
      })
      .subscribe();

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Auto-redirect when admin dispatches
  useEffect(() => {
    const dispatched = pedidos.find(p => p.entregador_id === user?.id && p.status === "saiu_entrega");
    if (dispatched) {
      navigate("/entregador/ativa");
    }
  }, [pedidos, user, navigate]);

  useEffect(() => {
    const available = pedidos.filter(p => !p.entregador_id && p.status === "em_preparo").length;
    if (available > prevAvailableCountRef.current && prevAvailableCountRef.current > 0) {
      playAlertSound();
    }
    prevAvailableCountRef.current = available;
  }, [pedidos]);

  const aceitarEntrega = async (pedidoId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("pedidos")
      .update({ entregador_id: user.id })
      .eq("id", pedidoId)
      .is("entregador_id", null);
    if (error) {
      toast.error("Erro ao aceitar entrega");
    } else {
      toast.success("Entrega aceita! Aguarde o despacho. 🛵");
    }
  };

  const availableOrders = pedidos.filter(p => !p.entregador_id && p.status === "em_preparo");
  const myOrders = pedidos.filter(p => p.entregador_id === user?.id);
  const activeOrder = myOrders.find(p => p.status === "saiu_entrega");
  const waitingDispatch = myOrders.filter(p => p.status === "em_preparo");

  if (loading) return <div className="container py-6"><div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}</div></div>;

  return (
    <div className="container py-5 space-y-6">
      {activeOrder && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="text-sm font-bold text-primary">Entrega em andamento</span>
          </div>
          <p className="text-sm font-medium mb-1">#{activeOrder.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {activeOrder.endereco}
          </p>
          <Button size="sm" className="mt-3 w-full" onClick={() => navigate("/entregador/ativa")}>
            Abrir navegação →
          </Button>
        </div>
      )}

      {waitingDispatch.length > 0 && !activeOrder && (
        <div>
          <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Aguardando despacho
          </h2>
          <div className="space-y-2">
            {waitingDispatch.map(p => (
              <div key={p.id} className="bg-card rounded-xl border p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">#{p.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{p.endereco}</p>
                </div>
                <Badge variant="outline" className="text-xs">Aguardando</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {availableOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-base flex items-center gap-2">
              <Package className="w-4 h-4" /> Entregas disponíveis
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {availableOrders.length}
              </span>
            </h2>
          </div>
          <div className="space-y-3">
            {availableOrders.map(p => (
              <div key={p.id} className="bg-card rounded-xl border p-4 animate-fade-up shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-display font-semibold text-sm">Pedido #{p.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <span className="font-display font-bold text-primary tabular-nums text-sm">
                    R$ {Number(p.valor_total).toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{p.endereco}</span>
                </p>
                <Button
                  size="sm"
                  className="w-full gap-2 h-11 text-base"
                  onClick={() => aceitarEntrega(p.id)}
                >
                  <CheckCircle className="w-4 h-4" />
                  Aceitar entrega
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {myOrders.filter(p => p.status === "entregue").length > 0 && (
        <div>
          <h2 className="font-display font-bold text-base mb-3">Histórico</h2>
          <div className="space-y-2">
            {myOrders.filter(p => p.status === "entregue").map(p => (
              <div key={p.id} className="bg-card rounded-xl border p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">#{p.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{p.endereco}</p>
                </div>
                <Badge variant="secondary" className="text-xs">Entregue ✓</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {availableOrders.length === 0 && !activeOrder && (
        <div className="text-center py-16">
          <p className="text-4xl mb-2">📦</p>
          <p className="text-muted-foreground text-sm font-medium">Nenhuma entrega disponível no momento</p>
          <p className="text-muted-foreground text-xs mt-1">Aguarde novos pedidos</p>
        </div>
      )}
    </div>
  );
};

export default EntregasListPage;
