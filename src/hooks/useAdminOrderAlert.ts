import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let alertCtx: AudioContext | null = null;

function getAlertCtx(): AudioContext | null {
  try {
    if (!alertCtx || alertCtx.state === "closed") {
      alertCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (alertCtx.state === "suspended") {
      alertCtx.resume();
    }
    return alertCtx;
  } catch {
    return null;
  }
}

/**
 * Plays an urgent iFood-style repeating alert sound for new orders.
 * Uses Web Audio API — no external files needed.
 * Returns a stop function to silence the alert.
 */
function playOrderAlert(): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const play = () => {
    if (stopped) return;
    try {
      const ctx = getAlertCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const tones = [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 1175, start: 0.13, dur: 0.12 },
        { freq: 1397, start: 0.26, dur: 0.18 },
        { freq: 880, start: 0.55, dur: 0.12 },
        { freq: 1175, start: 0.68, dur: 0.12 },
        { freq: 1397, start: 0.81, dur: 0.18 },
      ];

      tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.8, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur);
      });

      timer = setTimeout(play, 3000);
    } catch {
      // Audio not available
    }
  };

  play();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

/**
 * Hook for admin panel: listens for new orders and plays an urgent alert sound.
 * Shows a persistent toast with a button to silence the alert.
 */
export function useAdminOrderAlert() {
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        (payload) => {
          const orderId = (payload.new as any)?.id?.slice(0, 8);

          // Stop any previous alert
          stopRef.current?.();

          // Start repeating alert sound
          stopRef.current = playOrderAlert();

          // Browser push notification (works when tab is in background)
          if ("Notification" in window && Notification.permission === "granted") {
            const notif = new Notification("🔔 Novo Pedido!", {
              body: `Pedido #${orderId} recebido. Toque para abrir.`,
              icon: "/icons/icon-192.png",
              tag: `admin-order-${orderId}`,
              requireInteraction: true,
            } as NotificationOptions);
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
          }

          // Persistent toast with silence button
          toast.info(`🔔 Novo pedido #${orderId}!`, {
            duration: 30000,
            action: {
              label: "Silenciar",
              onClick: () => {
                stopRef.current?.();
                stopRef.current = null;
              },
            },
          });
        }
      )
      .subscribe();

    // Request notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      stopRef.current?.();
      supabase.removeChannel(channel);
    };
  }, []);
}
