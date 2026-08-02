import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOrderAlert, stopOrderAlert } from "@/lib/orderAlertSound";

/**
 * Hook for admin panel: listens for new orders and plays a phone-ring alert.
 * Shows a persistent toast with a button to silence the alert.
 * The sound is stopped automatically when the admin clicks any order action
 * (via stopOrderAlert() called in the admin pages).
 */
export function useAdminOrderAlert() {
  useEffect(() => {
    const channel = supabase
      .channel("admin-new-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        (payload) => {
          const orderId = (payload.new as any)?.id?.slice(0, 8);

          // Start phone-ring alert (stops any previous one)
          startOrderAlert();

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
                stopOrderAlert();
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
      stopOrderAlert();
      supabase.removeChannel(channel);
    };
  }, []);
}
