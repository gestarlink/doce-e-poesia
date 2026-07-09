import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MP_API = "https://api.mercadopago.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const MP_TOKEN = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!MP_TOKEN) {
    return new Response(JSON.stringify({ error: "MERCADO_PAGO_ACCESS_TOKEN not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { action, pedido_id, metodo, valor, payer_email, card_token, installments } = body;

    if (!action || !pedido_id) {
      return new Response(JSON.stringify({ error: "action and pedido_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify order exists
    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("id, valor_total, cliente_id")
      .eq("id", pedido_id)
      .single();

    if (pedidoErr || !pedido) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = valor || Number(pedido.valor_total);

    if (action === "pix") {
      // Create Pix payment
      const mpRes = await fetch(`${MP_API}/v1/payments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MP_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `pix-${pedido_id}-${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description: `Pedido #${pedido_id.slice(0, 8)} - Gestar One Food`,
          payment_method_id: "pix",
          payer: { email: payer_email || "cliente@gestarfood.com" },
        }),
      });

      const mpData = await mpRes.json();

      if (!mpRes.ok) {
        return new Response(JSON.stringify({ error: "Mercado Pago error", details: mpData }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update payment record
      await supabase.from("pagamentos").update({
        status: mpData.status === "approved" ? "pago" : "pendente",
        metodo: "pix",
      }).eq("pedido_id", pedido_id);

      return new Response(JSON.stringify({
        success: true,
        payment_id: mpData.id,
        status: mpData.status,
        qr_code: mpData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: mpData.point_of_interaction?.transaction_data?.ticket_url,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "card") {
      if (!card_token) {
        return new Response(JSON.stringify({ error: "card_token is required for card payments" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mpRes = await fetch(`${MP_API}/v1/payments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MP_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `card-${pedido_id}-${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description: `Pedido #${pedido_id.slice(0, 8)} - Gestar One Food`,
          token: card_token,
          installments: installments || 1,
          payment_method_id: metodo || "visa",
          payer: { email: payer_email || "cliente@gestarfood.com" },
        }),
      });

      const mpData = await mpRes.json();

      if (!mpRes.ok) {
        return new Response(JSON.stringify({ error: "Mercado Pago error", details: mpData }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paymentStatus = mpData.status === "approved" ? "pago" : mpData.status === "rejected" ? "recusado" : "pendente";

      await supabase.from("pagamentos").update({
        status: paymentStatus,
        metodo: "cartao",
        data_pagamento: mpData.status === "approved" ? new Date().toISOString() : null,
      }).eq("pedido_id", pedido_id);

      return new Response(JSON.stringify({
        success: mpData.status === "approved",
        payment_id: mpData.id,
        status: mpData.status,
        status_detail: mpData.status_detail,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_status") {
      // Check payment status from Mercado Pago
      const { data: pagamento } = await supabase
        .from("pagamentos")
        .select("*")
        .eq("pedido_id", pedido_id)
        .single();

      return new Response(JSON.stringify({
        status: pagamento?.status || "pendente",
        metodo: pagamento?.metodo,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: pix, card, check_status" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
