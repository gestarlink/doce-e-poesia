import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, host, instanceKey, token, to, text } = await req.json();

    if (!host || !instanceKey || !token) {
      return new Response(
        JSON.stringify({ error: "host, instanceKey e token são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = `https://${host}/rest`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Check connection status
    if (action === "status") {
      const url = `${baseUrl}/instance/${instanceKey}`;
      console.log("Checking status at:", url);
      const res = await fetch(url, { headers });
      const responseText = await res.text();
      console.log("MEGA API response:", res.status, responseText);
      
      if (!res.ok) {
        return new Response(
          JSON.stringify({ connected: false, error: responseText }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      let data;
      try { data = JSON.parse(responseText); } catch { data = {}; }
      const connected = !!data?.user;
      
      return new Response(
        JSON.stringify({ connected, instance: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send text message
    if (action === "send") {
      if (!to || !text) {
        return new Response(
          JSON.stringify({ error: "to e text são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanNumber = to.replace(/\D/g, "");
      const whatsappId = `${cleanNumber}@s.whatsapp.net`;

      const res = await fetch(`${baseUrl}/sendMessage/${instanceKey}/text`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messageData: {
            to: whatsappId,
            text,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("MEGA API send error:", errText);
        return new Response(
          JSON.stringify({ success: false, error: "Falha ao enviar mensagem" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "action inválida. Use 'status' ou 'send'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("WhatsApp MEGA API error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
