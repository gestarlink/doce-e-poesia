import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Clock, CheckCircle2, ChefHat, Truck, Package, Phone, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type OrderStatus = "recebido" | "em_preparo" | "saiu_entrega" | "entregue";

interface Order {
  id: string;
  status: OrderStatus;
  endereco: string;
  valor_total: number;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  entregador_lat: number | null;
  entregador_lng: number | null;
}

const STATUS_STEPS: { key: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { key: "recebido", label: "Pedido recebido", icon: <Package className="w-5 h-5" /> },
  { key: "em_preparo", label: "Em preparo", icon: <ChefHat className="w-5 h-5" /> },
  { key: "saiu_entrega", label: "Saiu para entrega", icon: <Truck className="w-5 h-5" /> },
  { key: "entregue", label: "Entregue", icon: <CheckCircle2 className="w-5 h-5" /> },
];

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DeliveryMap = ({ order }: { order: Order }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const deliveryMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const loadMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      leafletRef.current = L;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      if (!order.latitude || !order.longitude) return;
      const custLat = Number(order.latitude);
      const custLng = Number(order.longitude);
      const map = L.map(mapRef.current!, { zoomControl: false, attributionControl: false }).setView([custLat, custLng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      const customerIcon = L.divIcon({
        className: "",
        html: `<div style="background:#ef4444;border:3px solid white;border-radius:50%;width:18px;height:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });
      L.marker([custLat, custLng], { icon: customerIcon }).addTo(map).bindPopup("📍 Seu endereço");
      if (order.entregador_lat && order.entregador_lng) {
        const deliveryIcon = L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;background:#f97316;border:3px solid white;border-radius:50%;width:36px;height:36px;box-shadow:0 2px 12px rgba(0,0,0,0.35);font-size:18px;">🛵</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        });
        deliveryMarkerRef.current = L.marker([order.entregador_lat, order.entregador_lng], { icon: deliveryIcon }).addTo(map).bindPopup("🛵 Entregador");
        routeLineRef.current = L.polyline(
          [[order.entregador_lat, order.entregador_lng], [custLat, custLng]],
          { color: "#3b82f6", weight: 4, opacity: 0.6, dashArray: "8,8" }
        ).addTo(map);
        const dist = calcDistance(order.entregador_lat, order.entregador_lng, custLat, custLng);
        const mins = Math.max(1, Math.ceil(dist * 12));
        setEta(`${mins} min`);
        map.fitBounds([[custLat, custLng], [order.entregador_lat, order.entregador_lng]], { padding: [60, 60] });
      }
      mapInstanceRef.current = map;
    };
    loadMap();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [order.id]);

  useEffect(() => {
    if (!order || order.status !== "saiu_entrega") return;
    const updateMarker = (lat: number, lng: number) => {
      const L = leafletRef.current;
      const map = mapInstanceRef.current;
      if (!L || !map) return;
      if (!order.latitude || !order.longitude) return;
      const custLat = Number(order.latitude);
      const custLng = Number(order.longitude);
      if (deliveryMarkerRef.current) {
        deliveryMarkerRef.current.setLatLng([lat, lng]);
      } else {
        const deliveryIcon = L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;background:#f97316;border:3px solid white;border-radius:50%;width:36px;height:36px;box-shadow:0 2px 12px rgba(0,0,0,0.35);font-size:18px;">🛵</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        });
        deliveryMarkerRef.current = L.marker([lat, lng], { icon: deliveryIcon }).addTo(map).bindPopup("🛵 Entregador");
      }
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs([[lat, lng], [custLat, custLng]]);
      } else {
        routeLineRef.current = L.polyline(
          [[lat, lng], [custLat, custLng]],
          { color: "#3b82f6", weight: 4, opacity: 0.6, dashArray: "8,8" }
        ).addTo(map);
      }
      const dist = calcDistance(lat, lng, custLat, custLng);
      const mins = Math.max(1, Math.ceil(dist * 12));
      setEta(`${mins} min`);
      map.fitBounds([[custLat, custLng], [lat, lng]], { padding: [60, 60], maxZoom: 16, animate: true });
    };

    const ch1 = supabase
      .channel(`track-loc-${order.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entregador_localizacao", filter: `pedido_id=eq.${order.id}` },
        (payload) => { const d = payload.new as any; if (d?.latitude && d?.longitude) updateMarker(Number(d.latitude), Number(d.longitude)); }
      ).subscribe();
    const ch2 = supabase
      .channel(`track-ped-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${order.id}` },
        (payload) => { const d = payload.new as any; if (d?.entregador_lat && d?.entregador_lng) updateMarker(Number(d.entregador_lat), Number(d.entregador_lng)); }
      ).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [order?.id, order?.status]);

  return <div ref={mapRef} className="w-full h-full" />;
};

const TrackOrderPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      const { data } = await supabase.from("pedidos").select("*").eq("id", id).maybeSingle();
      setOrder(data as Order | null);
      setLoading(false);
    };
    fetchOrder();
    const channel = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${id}` },
        (payload) => { setOrder((prev) => (prev ? { ...prev, ...payload.new } : prev)); }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const currentStepIndex = order ? STATUS_STEPS.findIndex((s) => s.key === order.status) : -1;

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (!order) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
      <p className="text-4xl">🔍</p>
      <p className="text-muted-foreground font-medium">Pedido não encontrado</p>
      <Button variant="outline" onClick={() => navigate("/")}>Voltar ao cardápio</Button>
    </div>
  );

  const isDelivery = order.status === "saiu_entrega";
  const isDelivered = order.status === "entregue";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-primary shadow-md">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/minha-conta")} className="p-2 -ml-2 rounded-lg hover:bg-primary-foreground/10 active:scale-95 transition-transform">
              <ArrowLeft className="w-5 h-5 text-primary-foreground" />
            </button>
            <div>
              <h1 className="font-display font-bold text-sm leading-tight text-primary-foreground">
                {isDelivery ? "Entregador a caminho" : isDelivered ? "Pedido entregue" : "Acompanhar pedido"}
              </h1>
              <p className="text-primary-foreground/60 text-[11px]">#{order.id.slice(0, 8)}</p>
            </div>
          </div>
          {isDelivery && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-full px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Ao vivo
            </div>
          )}
        </div>
      </header>

      <div className="relative w-full h-64 sm:h-80 bg-muted overflow-hidden flex-shrink-0">
        {isDelivery ? (
          <DeliveryMap order={order} />
        ) : isDelivered ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-emerald-50">
            <div className="text-5xl">🎉</div>
            <p className="text-sm font-semibold text-emerald-700">Pedido entregue com sucesso!</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MapPin className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium text-center px-6">O mapa será exibido quando o pedido sair para entrega</p>
          </div>
        )}
      </div>

      {isDelivery && (
        <div className="container max-w-lg -mt-4 relative z-10 px-4">
          <div className="bg-card rounded-2xl border shadow-lg p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">🛵</div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm">Entregador a caminho</p>
              <p className="text-xs text-muted-foreground">Acompanhe em tempo real</p>
            </div>
            <button className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 active:scale-95 transition-all">
              <Phone className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="container max-w-lg py-5 flex-1">
        <div className="bg-card rounded-2xl border p-5">
          <h2 className="font-display font-semibold text-sm mb-5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Status do pedido
          </h2>
          <div className="space-y-0">
            {STATUS_STEPS.map((step, i) => {
              const isCompleted = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : isCompleted ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {step.icon}
                    </div>
                    {i < STATUS_STEPS.length - 1 && <div className={`w-0.5 h-8 my-1 rounded-full transition-colors ${i < currentStepIndex ? "bg-primary/40" : "bg-border"}`} />}
                  </div>
                  <div className="pt-1.5">
                    <p className={`text-sm font-medium leading-tight ${isCurrent ? "text-foreground" : isCompleted ? "text-foreground/70" : "text-muted-foreground"}`}>{step.label}</p>
                    {isCurrent && <p className="text-xs text-muted-foreground mt-0.5">Em andamento...</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-4 mt-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Endereço de entrega</p>
              <p className="text-sm mt-0.5">{order.endereco || "Não informado"}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-4 mt-3 flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total do pedido</span>
          <span className="font-display font-bold text-primary tabular-nums">R$ {Number(order.valor_total).toFixed(2).replace(".", ",")}</span>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-3">
          Pedido realizado {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ptBR })}
        </p>

        <Button variant="outline" className="w-full mt-4" onClick={() => navigate("/minha-conta")}>Meus pedidos</Button>
      </div>
    </div>
  );
};

export default TrackOrderPage;
