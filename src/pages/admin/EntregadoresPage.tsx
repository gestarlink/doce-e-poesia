import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Truck, User, Wifi, WifiOff, Eye } from "lucide-react";

const devEntregadorEmails = import.meta.env.VITE_DEV_ENTREGADOR_EMAILS?.split(",").map(e => e.trim().toLowerCase()) || [];

interface Entregador {
  user_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  heartbeat: string | null;
  lat: number | null;
  lng: number | null;
  lastSeen: string | null;
  pedido_id: string | null;
  pedido_endereco: string | null;
  pedido_status: string | null;
}

const EntregadoresPage = () => {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Entregador | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const leafletRef = useRef<any>(null);
  const detailMapRef = useRef<HTMLDivElement>(null);
  const detailMapInstanceRef = useRef<any>(null);
  const detailMarkerRef = useRef<any>(null);

  const updateDriverLocation = useCallback((userId: string, lat: number, lng: number) => {
    setEntregadores(prev => prev.map(d => {
      if (d.user_id === userId) {
        return { ...d, lat, lng, lastSeen: new Date().toISOString() };
      }
      return d;
    }));
    setSelectedDriver(prev => prev?.user_id === userId
      ? { ...prev, lat, lng, lastSeen: new Date().toISOString() }
      : prev
    );
    if (detailMarkerRef.current) {
      detailMarkerRef.current.setLatLng([lat, lng]);
    }
  }, []);

  const fetchEntregadores = async () => {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, nome, email, telefone, updated_at");
    const profiles = ((allProfiles || []) as any[]).filter(p =>
      p.tipo === "entregador" || devEntregadorEmails.includes(p.email?.toLowerCase())
    );

    if (!profiles || profiles.length === 0) {
      setEntregadores([]);
      setLoading(false);
      return;
    }

    const userIds = profiles.map(p => p.user_id);

    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id, endereco, status, entregador_id")
      .in("entregador_id", userIds)
      .eq("status", "saiu_entrega");

    const pedidoMap = new Map((pedidos || []).map(p => [p.entregador_id!, p]));

    const mapped: Entregador[] = profiles.map(p => {
      const ped = pedidoMap.get(p.user_id);
      return {
        user_id: p.user_id,
        nome: p.nome || "Entregador",
        email: p.email,
        telefone: p.telefone,
        heartbeat: p.updated_at || null,
        lat: null,
        lng: null,
        lastSeen: null,
        pedido_id: ped?.id || null,
        pedido_endereco: ped?.endereco || null,
        pedido_status: ped?.status || null,
      };
    });

    setEntregadores(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntregadores();
    const chPedidos = supabase.channel("admin-drivers-ped")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchEntregadores())
      .subscribe();

    // Listen for real-time location broadcasts from entregadores
    const chLocation = supabase.channel("location-broadcast", {
      config: { broadcast: { self: false } },
    });
    chLocation.on("broadcast", { event: "location_update" }, (payload) => {
      const { user_id, lat, lng } = payload.payload;
      if (user_id && lat != null && lng != null) {
        updateDriverLocation(user_id, Number(lat), Number(lng));
      }
    }).subscribe();

    return () => { supabase.removeChannel(chPedidos); supabase.removeChannel(chLocation); };
  }, [updateDriverLocation]);

  const isOnline = (entregador: Entregador) => {
    const ref = entregador.lastSeen || entregador.heartbeat;
    if (!ref) return false;
    const diff = Date.now() - new Date(ref).getTime();
    return diff < 5 * 60 * 1000;
  };

  const activeDrivers = entregadores.filter(e => e.pedido_id);
  const onlineDrivers = entregadores.filter(e => isOnline(e) && !e.pedido_id);
  const offlineDrivers = entregadores.filter(e => !isOnline(e) && !e.pedido_id);

  // Main map showing all active drivers
  useEffect(() => {
    if (!mapRef.current) return;

    const loadMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      markersRef.current.clear();

      const map = L.map(mapRef.current!, { zoomControl: false, attributionControl: false })
        .setView([-23.5505, -46.6333], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      leafletRef.current = L;

      mapInstanceRef.current = map;
    };

    loadMap();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; markersRef.current.clear(); } };
  }, []);

  // Update or add markers when active drivers change location
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const activeUserIds = new Set(activeDrivers.map(d => d.user_id));

    // Remove markers for drivers no longer active
    for (const [userId, marker] of markersRef.current.entries()) {
      if (!activeUserIds.has(userId)) {
        map.removeLayer(marker);
        markersRef.current.delete(userId);
      }
    }

    const bounds: [number, number][] = [];

    activeDrivers.forEach(d => {
      if (!d.lat || !d.lng) return;

      let marker = markersRef.current.get(d.user_id);
      if (marker) {
        marker.setLatLng([d.lat, d.lng]);
      } else {
        const icon = L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;background:#22c55e;border:3px solid white;border-radius:50%;width:36px;height:36px;box-shadow:0 2px 12px rgba(0,0,0,0.35);font-size:18px;">🛵</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18],
        });
        marker = L.marker([d.lat, d.lng], { icon })
          .addTo(map)
          .bindPopup(`🛵 ${d.nome}<br>📦 Pedido #${d.pedido_id?.slice(0, 8)}<br>📍 ${d.pedido_endereco}`);
        markersRef.current.set(d.user_id, marker);
      }
      bounds.push([d.lat, d.lng]);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
  }, [activeDrivers.map(d => `${d.user_id}-${d.lat}-${d.lng}`).join(",")]);

  // Detail map for selected driver
  useEffect(() => {
    if (!detailMapRef.current || !selectedDriver?.lat || !selectedDriver?.lng) {
      if (detailMapInstanceRef.current) { detailMapInstanceRef.current.remove(); detailMapInstanceRef.current = null; }
      return;
    }

    const loadDetailMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      leafletRef.current = L;

      if (detailMapInstanceRef.current) { detailMapInstanceRef.current.remove(); detailMapInstanceRef.current = null; }

      const map = L.map(detailMapRef.current!, { zoomControl: false, attributionControl: false })
        .setView([selectedDriver.lat!, selectedDriver.lng!], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;justify-content:center;background:#22c55e;border:3px solid white;border-radius:50%;width:44px;height:44px;box-shadow:0 2px 12px rgba(0,0,0,0.35);font-size:22px;">🛵</div>`,
        iconSize: [44, 44], iconAnchor: [22, 22],
      });
      detailMarkerRef.current = L.marker([selectedDriver.lat!, selectedDriver.lng!], { icon }).addTo(map)
        .bindPopup(`🛵 ${selectedDriver.nome}`).openPopup();

      detailMapInstanceRef.current = map;
    };

    loadDetailMap();
    return () => { if (detailMapInstanceRef.current) { detailMapInstanceRef.current.remove(); detailMapInstanceRef.current = null; } };
  }, [selectedDriver?.user_id, selectedDriver?.lat, selectedDriver?.lng]);

  if (loading) return <div className="container py-6"><div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}</div></div>;

  const DriverCard = ({ driver, showLocation }: { driver: Entregador; showLocation?: boolean }) => {
    const online = isOnline(driver);
    const inRoute = !!driver.pedido_id;

    return (
      <div
        key={driver.user_id}
        className={`bg-card rounded-xl border p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${selectedDriver?.user_id === driver.user_id ? "ring-2 ring-primary" : ""}`}
        onClick={() => setSelectedDriver(selectedDriver?.user_id === driver.user_id ? null : driver)}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${inRoute ? "bg-emerald-500/10" : online ? "bg-blue-500/10" : "bg-muted"}`}>
          {inRoute ? "🛵" : <User className={`w-5 h-5 ${online ? "text-blue-500" : "text-muted-foreground"}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{driver.nome}</p>
          <p className="text-xs text-muted-foreground">
            {inRoute ? (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Pedido #{driver.pedido_id?.slice(0, 8)}</span>
            ) : driver.telefone ? driver.telefone : driver.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {inRoute && <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">Em rota</Badge>}
          {!inRoute && online && <Badge className="bg-blue-500/10 text-blue-600 border-0 text-xs gap-1"><Wifi className="w-3 h-3" /> Online</Badge>}
          {!inRoute && !online && <Badge variant="secondary" className="text-xs gap-1"><WifiOff className="w-3 h-3" /> Offline</Badge>}
          {(driver.lat && driver.lng) && <Eye className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>
    );
  };

  return (
    <div className="container py-6 space-y-6">
      <h2 className="font-display font-bold text-xl flex items-center gap-2">
        <Truck className="w-5 h-5" /> Entregadores
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border p-3 text-center">
          <p className="font-display font-bold text-xl">{entregadores.length}</p>
          <p className="text-xs text-muted-foreground">Cadastrados</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-3 text-center">
          <p className="font-display font-bold text-xl text-emerald-600">{activeDrivers.length + onlineDrivers.length}</p>
          <p className="text-xs text-emerald-600">Ativos</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20 p-3 text-center">
          <p className="font-display font-bold text-xl text-blue-600">{activeDrivers.length}</p>
          <p className="text-xs text-blue-600">Em rota</p>
        </div>
      </div>

      {/* Map of active drivers */}
      {activeDrivers.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm mb-2">Mapa de entregas ativas</h3>
          <div ref={mapRef} className="w-full h-72 md:h-96 rounded-2xl overflow-hidden border" />
        </div>
      )}

      {/* Selected driver detail map */}
      {selectedDriver && selectedDriver.lat && selectedDriver.lng && (
        <div className="bg-card rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-semibold text-sm">📍 Localização: {selectedDriver.nome}</p>
              <p className="text-xs text-muted-foreground">
                {selectedDriver.pedido_id ? `Entregando pedido #${selectedDriver.pedido_id.slice(0, 8)}` : "Última posição conhecida"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedDriver(null)}>Fechar</Button>
          </div>
          <div ref={detailMapRef} className="w-full h-64 rounded-xl overflow-hidden" />
        </div>
      )}

      {selectedDriver && (!selectedDriver.lat || !selectedDriver.lng) && (
        <div className="bg-card rounded-xl border p-4 text-center text-sm text-muted-foreground">
          <p>📍 Aguardando localização de {selectedDriver.nome}</p>
          <p className="text-xs mt-1">A localização aparece automaticamente quando o entregador ativar o GPS</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setSelectedDriver(null)}>Fechar</Button>
        </div>
      )}

      {/* Em rota */}
      {activeDrivers.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative rounded-full h-2 w-2 bg-emerald-500" /></span>
            Em rota ({activeDrivers.length})
          </h3>
          <div className="space-y-2">
            {activeDrivers.map(d => <DriverCard key={d.user_id} driver={d} />)}
          </div>
        </div>
      )}

      {/* Online */}
      {onlineDrivers.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm mb-2">Online ({onlineDrivers.length})</h3>
          <div className="space-y-2">
            {onlineDrivers.map(d => <DriverCard key={d.user_id} driver={d} />)}
          </div>
        </div>
      )}

      {/* Offline */}
      {offlineDrivers.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm mb-2 text-muted-foreground">Offline ({offlineDrivers.length})</h3>
          <div className="space-y-2">
            {offlineDrivers.map(d => <DriverCard key={d.user_id} driver={d} />)}
          </div>
        </div>
      )}

      {entregadores.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">🛵</p>
          <p className="text-muted-foreground text-sm">Nenhum entregador cadastrado</p>
        </div>
      )}
    </div>
  );
};

export default EntregadoresPage;
