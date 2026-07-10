import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, Navigation, CheckCircle2, Phone, AlertCircle, ArrowUp, CornerDownRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ActiveOrder {
  id: string;
  endereco: string;
  valor_total: number;
  latitude: number | null;
  longitude: number | null;
  cliente_id: string;
  status: string;
}

const EntregaAtivaPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmSlider, setShowConfirmSlider] = useState(false);
  const [sliderProgress, setSliderProgress] = useState(0);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; time: string; instruction: string } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const myMarkerRef = useRef<any>(null);
  const routingRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const leafletRef = useRef<any>(null);

  // Fetch active order
  useEffect(() => {
    if (!user) return;
    const fetchOrder = async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id, endereco, valor_total, latitude, longitude, cliente_id, status")
        .eq("entregador_id", user.id)
        .eq("status", "saiu_entrega")
        .maybeSingle();
      setOrder(data as ActiveOrder | null);
      setLoading(false);
    };
    fetchOrder();

    const channel = supabase
      .channel("entrega-ativa")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos" }, () => fetchOrder())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Watch GPS and send location
  useEffect(() => {
    if (!order || !user) return;

    const sendLocation = async (lat: number, lng: number) => {
      // Update entregador_localizacao
      await supabase.from("entregador_localizacao").upsert({
        entregador_id: user.id,
        pedido_id: order.id,
        latitude: lat,
        longitude: lng,
        updated_at: new Date().toISOString(),
      }, { onConflict: "entregador_id" });
      // Also update pedidos for quick access
      await supabase.from("pedidos").update({
        entregador_lat: lat,
        entregador_lng: lng,
      }).eq("id", order.id);
    };

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMyPos(newPos);
          sendLocation(newPos.lat, newPos.lng);
        },
        () => {
          // GPS unavailable — don't save fake location to DB, just show the map
          // using the customer position as reference
          if (order.latitude && order.longitude) {
            setMyPos({ lat: Number(order.latitude), lng: Number(order.longitude) });
          }
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [order?.id, user]);

  // Initialize map with routing
  useEffect(() => {
    if (!mapRef.current || !order || !myPos) return;

    const loadMap = async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      await import("leaflet-routing-machine");
      await import("leaflet-routing-machine/dist/leaflet-routing-machine.css");

      leafletRef.current = L;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const hasCustCoords = !!order.latitude && !!order.longitude;
      const custLat = hasCustCoords ? Number(order.latitude) : (myPos?.lat || -23.5505);
      const custLng = hasCustCoords ? Number(order.longitude) : (myPos?.lng || -46.6333);

      const map = L.map(mapRef.current!, { zoomControl: false, attributionControl: false })
        .setView([myPos?.lat || custLat, myPos?.lng || custLng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Customer marker (only if real coordinates exist)
      if (hasCustCoords) {
        const custIcon = L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;background:#ef4444;border:3px solid white;border-radius:50%;width:32px;height:32px;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">📍</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16],
        });
        L.marker([custLat, custLng], { icon: custIcon }).addTo(map).bindPopup("📍 Cliente");
      }

      // My marker
      if (myPos) {
        const myIcon = L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;background:#22c55e;border:3px solid white;border-radius:50%;width:44px;height:44px;box-shadow:0 2px 12px rgba(0,0,0,0.35);font-size:22px;">🛵</div>`,
          iconSize: [44, 44], iconAnchor: [22, 22],
        });
        myMarkerRef.current = L.marker([myPos.lat, myPos.lng], { icon: myIcon }).addTo(map);
      }

      // Routing (only if we have both GPS position and customer coordinates)
      if (myPos && hasCustCoords) {
        try {
          const routing = (L as any).Routing.control({
            waypoints: [L.latLng(myPos.lat, myPos.lng), L.latLng(custLat, custLng)],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            showAlternatives: false,
            show: false,
            createMarker: () => null,
            lineOptions: {
              styles: [
                { color: "#3b82f6", weight: 6, opacity: 0.8 },
                { color: "#1d4ed8", weight: 2, opacity: 0.4 },
              ],
              extendToWaypoints: true,
              missingRouteTolerance: 0,
            },
            router: (L as any).Routing.osrmv1({
              serviceUrl: "https://router.project-osrm.org/route/v1",
            }),
          }).addTo(map);

          routing.on("routesfound", (e: any) => {
            const route = e.routes[0];
            const distKm = (route.summary.totalDistance / 1000).toFixed(1);
            const timeMin = Math.ceil(route.summary.totalTime / 60);
            const firstInstruction = route.instructions?.[0]?.text || "Siga em frente";
            setRouteInfo({ distance: `${distKm} km`, time: `${timeMin} min`, instruction: firstInstruction });
          });

          routingRef.current = routing;
        } catch (err) {
          console.error("Routing error:", err);
          L.polyline([[myPos.lat, myPos.lng], [custLat, custLng]], {
            color: "#3b82f6", weight: 4, opacity: 0.7, dashArray: "10, 10",
          }).addTo(map);
        }
      }

      if (myPos && hasCustCoords) {
        map.fitBounds([[myPos.lat, myPos.lng], [custLat, custLng]], { padding: [50, 50] });
      }
      mapInstanceRef.current = map;
    };

    loadMap();
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
    // Only re-create map when order changes, not on every position update
  }, [order?.id, !!myPos]);

  // Update marker position smoothly without recreating map
  useEffect(() => {
    if (!myPos || !myMarkerRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    myMarkerRef.current.setLatLng([myPos.lat, myPos.lng]);
    
    if (routingRef.current && order && order.latitude && order.longitude) {
      try {
        routingRef.current.setWaypoints([
          L.latLng(myPos.lat, myPos.lng),
          L.latLng(Number(order.latitude), Number(order.longitude)),
        ]);
      } catch {}
    }
  }, [myPos]);

  const confirmarEntrega = async () => {
    if (!order || !user) return;
    setConfirming(true);
    const { error } = await supabase
      .from("pedidos")
      .update({ status: "entregue" as const })
      .eq("id", order.id);
    if (error) {
      toast.error("Erro ao confirmar entrega");
    } else {
      toast.success("Entrega confirmada! 🎉");
      navigate("/entregador");
    }
    setConfirming(false);
  };

  const handleSliderMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const progress = Math.max(0, Math.min(1, (clientX - rect.left - 28) / (rect.width - 56)));
    setSliderProgress(progress);
    if (progress > 0.9) {
      setShowConfirmSlider(false);
      setSliderProgress(0);
      confirmarEntrega();
    }
  }, [order]);

  const openGoogleMaps = () => {
    if (!order) return;
    if (order.latitude && order.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}&travelmode=driving`, "_blank");
    } else {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(order.endereco)}`, "_blank");
    }
  };

  const openWaze = () => {
    if (!order) return;
    if (order.latitude && order.longitude) {
      window.open(`https://waze.com/ul?ll=${order.latitude},${order.longitude}&navigate=yes`, "_blank");
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(order.endereco)}&navigate=yes`, "_blank");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (!order) return (
    <div className="container py-16 text-center">
      <p className="text-4xl mb-3">🛵</p>
      <p className="text-muted-foreground font-medium">Nenhuma entrega ativa</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/entregador")}>Ver entregas disponíveis</Button>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px-60px)]">
      {/* Navigation bar (Waze-style) */}
      {routeInfo && (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 z-20">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <CornerDownRight className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{routeInfo.instruction}</p>
            <p className="text-xs opacity-80">{routeInfo.distance} · {routeInfo.time} restantes</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-display font-bold tabular-nums">{routeInfo.time}</p>
            <p className="text-[10px] opacity-70">estimado</p>
          </div>
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} className="flex-1 w-full min-h-[250px]" />

      {/* Bottom card */}
      <div className="bg-card border-t rounded-t-3xl -mt-6 relative z-10 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Pedido #{order.id.slice(0, 8)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm font-semibold truncate">{order.endereco}</p>
            </div>
          </div>
          <p className="font-display font-bold text-primary tabular-nums">
            R$ {Number(order.valor_total).toFixed(2).replace(".", ",")}
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={openGoogleMaps}>
            <Navigation className="w-4 h-4" />
            Google Maps
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={openWaze}>
            <ArrowUp className="w-4 h-4" />
            Waze
          </Button>
          <Button variant="outline" size="icon" className="flex-shrink-0">
            <Phone className="w-4 h-4" />
          </Button>
        </div>

        {/* Confirm delivery */}
        {!showConfirmSlider ? (
          <Button
            className="w-full h-14 text-base font-display gap-2 bg-emerald-500 hover:bg-emerald-600"
            onClick={() => setShowConfirmSlider(true)}
          >
            <CheckCircle2 className="w-5 h-5" />
            Confirmar entrega
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Deslize para confirmar a entrega
            </div>
            <div
              className="relative h-14 bg-emerald-100 rounded-xl overflow-hidden cursor-pointer select-none"
              onTouchMove={handleSliderMove}
              onMouseMove={(e) => e.buttons === 1 && handleSliderMove(e)}
              onMouseUp={() => { if (sliderProgress < 0.9) setSliderProgress(0); }}
              onTouchEnd={() => { if (sliderProgress < 0.9) setSliderProgress(0); }}
            >
              <div
                className="absolute left-0 top-0 h-full bg-emerald-500 transition-all rounded-xl"
                style={{ width: `${Math.max(56, sliderProgress * 100)}%` }}
              />
              <div
                className="absolute top-1 left-1 h-12 w-12 bg-white rounded-lg shadow-md flex items-center justify-center text-emerald-600 font-bold transition-all"
                style={{ transform: `translateX(${sliderProgress * 200}px)` }}
              >
                →
              </div>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-emerald-800 pointer-events-none">
                {confirming ? "Confirmando..." : "Deslize →"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EntregaAtivaPage;
