import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type LocationStatus = "sharing" | "unavailable" | "denied" | "unsupported";

export function useEntregadorLocation() {
  const { user, profile, isDevEntregador } = useAuth();
  const [status, setStatus] = useState<LocationStatus>("unavailable");
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const broadcastRef = useRef<boolean>(true);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const isEntregador = profile?.tipo === "entregador";
    if (!user || !(isEntregador || isDevEntregador)) {
      setStatus("unavailable");
      return;
    }

    broadcastRef.current = true;

    // Create a broadcast channel for real-time location sharing
    channelRef.current = supabase.channel("location-broadcast", {
      config: { broadcast: { self: true } },
    });
    channelRef.current.subscribe();

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition({ lat, lng });
        setStatus("sharing");

        // Broadcast to all clients (admin, customer tracking)
        if (broadcastRef.current) {
          channelRef.current?.send({
            type: "broadcast",
            event: "location_update",
            payload: {
              user_id: user.id,
              lat,
              lng,
              timestamp: new Date().toISOString(),
            },
          });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
        } else {
          setStatus("unavailable");
        }
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );

    return () => {
      broadcastRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, profile?.tipo, isDevEntregador]);

  return { status, position };
}
