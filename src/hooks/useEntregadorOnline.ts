import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useEntregadorOnline() {
  const { user, profile, isDevEntregador } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || (profile?.tipo !== "entregador" && !isDevEntregador)) return;

    const sendHeartbeat = async () => {
      await supabase.from("profiles").update({
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    };

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, profile?.tipo, isDevEntregador]);
}
