import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type LocationStatus = "sharing" | "unavailable" | "denied" | "unsupported";

export function useEntregadorLocation() {
  const { user, profile, isDevEntregador } = useAuth();
  const [status, setStatus] = useState<LocationStatus>("unavailable");
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const sendRef = useRef<boolean>(true);

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    if (!user || !sendRef.current) return;
    await supabase.from("entregador_localizacao").upsert({
      entregador_id: user.id,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString(),
    }, { onConflict: "entregador_id" });
  }, [user]);

  useEffect(() => {
    const isEntregador = profile?.tipo === "entregador";
    if (!user || !(isEntregador || isDevEntregador)) {
      setStatus("unavailable");
      return;
    }

    sendRef.current = true;

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        lastPosRef.current = { lat, lng };
        setStatus("sharing");
        sendLocation(lat, lng);
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
      sendRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [user?.id, profile?.tipo, isDevEntregador, sendLocation]);

  return { status, position: lastPosRef.current };
}
