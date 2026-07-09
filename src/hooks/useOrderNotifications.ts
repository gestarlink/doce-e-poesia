import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notificationSound";

const STATUS_LABELS: Record<string, string> = {
  recebido: "Pedido recebido ✅",
  em_preparo: "Seu pedido está sendo preparado 👨‍🍳",
  saiu_entrega: "Entregador a caminho! 🛵",
  entregue: "Pedido entregue! 🎉",
};

export const useOrderNotifications = () => {
  const { user } = useAuth();
  const permRef = useRef(false);

  useEffect(() => {
    // Request browser notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        permRef.current = perm === "granted";
      });
    } else if ("Notification" in window) {
      permRef.current = Notification.permission === "granted";
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("order-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          const clienteId = (payload.new as any)?.cliente_id;

          // Only notify if this is the customer's own order
          if (clienteId !== user.id) return;

          const message = STATUS_LABELS[newStatus] || `Status: ${newStatus}`;

          // Sound notification
          playNotificationSound();

          // Toast notification
          toast.info(message, {
            duration: 5000,
            icon: newStatus === "saiu_entrega" ? "🛵" : newStatus === "entregue" ? "🎉" : "📦",
          });

          // Browser push notification
          if (permRef.current && "Notification" in window) {
            new Notification("Doce & Poesia", {
              body: message,
              icon: "/icons/icon-192.png",
              tag: `order-${(payload.new as any)?.id}`,
            } as NotificationOptions);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);
};
