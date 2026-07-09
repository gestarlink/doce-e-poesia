import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MessageCircle, Bot, Send, Link2, Settings2, Zap, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "gestar_atendimento_config";

const defaultConfig = {
  // MEGA API credentials
  megaApiHost: "apistart01.megaapi.com.br",
  megaApiToken: "",
  megaApiInstanceKey: "",
  whatsappNumero: "",
  // Agent settings
  agenteAtivo: false,
  respostaAutomatica: true,
  enviarCardapioAutomatico: true,
  confirmarPagamentoAutomatico: true,
  enviarLinkRastreamento: true,
  // Webhook
  webhookUrl: "",
  // Messages
  mensagemBoasVindas: "Olá! 👋 Bem-vindo ao *Gestar One Food*! Como posso ajudar?\n\n1️⃣ 📋 Ver Cardápio\n2️⃣ 🛒 Fazer Pedido\n3️⃣ 📦 Acompanhar Pedido\n4️⃣ 💬 Falar com atendente",
  mensagemCardapio: "📋 Acesse nosso cardápio digital e faça seu pedido:\n👉 {link_cardapio}\n\nÉ rápido e fácil! Qualquer dúvida estou aqui 😊",
  mensagemPedidoConfirmado: "✅ *Pedido confirmado!*\n\n📦 Pedido *#{pedido_id}*\n💰 Total: *R$ {valor_total}*\n\n📍 Acompanhe sua entrega em tempo real:\n👉 {link_rastreamento}",
  mensagemPagamentoConfirmado: "💳 *Pagamento confirmado!*\n\nSeu pedido está sendo preparado com carinho 🧑‍🍳\nVocê receberá atualizações sobre o status.",
  mensagemEntregaSaiu: "🚗 *Seu pedido saiu para entrega!*\n\nO entregador está a caminho.\n📍 Acompanhe em tempo real:\n👉 {link_rastreamento}",
  mensagemEntregaConcluida: "🎉 *Pedido entregue!*\n\nObrigado por pedir com a gente! Esperamos que goste 😋\n⭐ Avalie sua experiência!",
};

const AtendimentoPage = () => {
  const [config, setConfig] = useState(defaultConfig);
  const [testingConnection, setTestingConnection] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testNumber, setTestNumber] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setConfig({ ...defaultConfig, ...JSON.parse(saved) });
      } catch {}
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast.success("Configurações salvas com sucesso!");
  };

  const testConnection = async () => {
    if (!config.megaApiToken || !config.megaApiInstanceKey) {
      toast.error("Preencha o Token e a Instance Key da MEGA API");
      return;
    }
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-megaapi", {
        body: {
          action: "status",
          host: config.megaApiHost,
          instanceKey: config.megaApiInstanceKey,
          token: config.megaApiToken,
        },
      });
      if (error) throw error;
      if (data?.connected) {
        toast.success("✅ WhatsApp conectado via MEGA API!");
      } else {
        const errorDetail = data?.error || "Verifique suas credenciais";
        toast.warning("⚠️ Não conectado. Erro: " + errorDetail);
      }
    } catch (err: any) {
      toast.error("Erro ao conectar: " + (err.message || "Verifique suas credenciais"));
    } finally {
      setTestingConnection(false);
    }
  };

  const sendTestMessage = async () => {
    const num = testNumber.replace(/\D/g, "");
    if (!num || num.length < 10) {
      toast.error("Informe um número válido com DDD");
      return;
    }
    if (!config.megaApiToken || !config.megaApiInstanceKey) {
      toast.error("Configure as credenciais MEGA API primeiro");
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-megaapi", {
        body: {
          action: "send",
          host: config.megaApiHost,
          instanceKey: config.megaApiInstanceKey,
          token: config.megaApiToken,
          to: num,
          text: config.mensagemBoasVindas,
        },
      });
      if (error) throw error;
      toast.success("✅ Mensagem de teste enviada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente"));
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="container py-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-display font-bold text-xl">Atendimento WhatsApp</h2>
          <p className="text-muted-foreground text-xs">Configure o agente de vendas inteligente via MEGA API</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* MEGA API Config */}
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <h3 className="font-display font-semibold text-sm">Conexão MEGA API</h3>
            </div>
            <a
              href="https://mega-api.app.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              Acessar MEGA API <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como configurar:</p>
            <p>1. Crie uma conta em <strong>mega-api.app.br</strong></p>
            <p>2. Crie uma instância e conecte seu WhatsApp (escaneie o QR Code)</p>
            <p>3. Copie o <strong>Token</strong> e a <strong>Instance Key</strong> do painel</p>
            <p>4. Informe o <strong>Host</strong> fornecido pela MEGA API</p>
            <p>5. Cole abaixo e teste a conexão</p>
          </div>

          <div className="space-y-2">
            <Label>Host da MEGA API</Label>
            <Input
              placeholder="apistart01.megaapi.com.br"
              value={config.megaApiHost}
              onChange={(e) => setConfig({ ...config, megaApiHost: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground">Host fornecido no painel da MEGA API (sem https://)</p>
          </div>

          <div className="space-y-2">
            <Label>Instance Key</Label>
            <Input
              placeholder="sua-instance-key"
              value={config.megaApiInstanceKey}
              onChange={(e) => setConfig({ ...config, megaApiInstanceKey: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Token de API</Label>
            <Input
              type="password"
              placeholder="seu-token-mega-api"
              value={config.megaApiToken}
              onChange={(e) => setConfig({ ...config, megaApiToken: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Número do WhatsApp (com DDD)</Label>
            <Input
              placeholder="5511999999999"
              value={config.whatsappNumero}
              onChange={(e) => setConfig({ ...config, whatsappNumero: e.target.value })}
            />
          </div>

          <Button
            variant="outline"
            onClick={testConnection}
            disabled={testingConnection}
            className="w-full"
          >
            {testingConnection ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...</>
            ) : (
              "🔌 Testar conexão"
            )}
          </Button>
        </div>

        {/* Test message */}
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-4 h-4 text-emerald-600" />
            <h3 className="font-display font-semibold text-sm">Enviar mensagem de teste</h3>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="5511999999999"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              className="flex-1"
            />
            <Button onClick={sendTestMessage} disabled={sendingTest} size="sm">
              {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Envia a mensagem de boas-vindas para o número informado</p>
        </div>

        {/* Agent toggle */}
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-emerald-600" />
            <h3 className="font-display font-semibold text-sm">Agente Inteligente</h3>
          </div>
          <div className="flex items-center justify-between p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
            <div>
              <p className="text-sm font-medium">Ativar Agente Automatizado</p>
              <p className="text-xs text-muted-foreground">Responde automaticamente, envia cardápio, confirma pedidos e rastreia entregas</p>
            </div>
            <Switch checked={config.agenteAtivo} onCheckedChange={(v) => setConfig({ ...config, agenteAtivo: v })} />
          </div>
        </div>

        {/* Automações */}
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Automações do Agente</h3>
          </div>
          {[
            { key: "respostaAutomatica", label: "Resposta automática de boas-vindas", desc: "Enviar saudação quando o cliente iniciar conversa" },
            { key: "enviarCardapioAutomatico", label: "Enviar cardápio automaticamente", desc: "Enviar link do cardápio digital quando solicitado" },
            { key: "confirmarPagamentoAutomatico", label: "Confirmar pagamento automaticamente", desc: "Notificar cliente quando pagamento for confirmado" },
            { key: "enviarLinkRastreamento", label: "Enviar link de rastreamento", desc: "Enviar link de acompanhamento da entrega em tempo real" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={(config as any)[item.key]}
                onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })}
              />
            </div>
          ))}
        </div>

        {/* Webhook */}
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Webhook Externo (Opcional)</h3>
          </div>
          <div className="space-y-2">
            <Label>URL do Webhook (N8N / Zapier / Make)</Label>
            <Input
              placeholder="https://hooks.zapier.com/..."
              value={config.webhookUrl}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Conecte com N8N, Zapier ou Make para automações personalizadas</p>
          </div>
        </div>

        {/* Mensagens */}
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Send className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-sm">Mensagens do Agente</h3>
          </div>
          {[
            { key: "mensagemBoasVindas", label: "Mensagem de boas-vindas" },
            { key: "mensagemCardapio", label: "Mensagem com cardápio" },
            { key: "mensagemPedidoConfirmado", label: "Pedido confirmado" },
            { key: "mensagemPagamentoConfirmado", label: "Pagamento confirmado" },
            { key: "mensagemEntregaSaiu", label: "Entrega saiu" },
            { key: "mensagemEntregaConcluida", label: "Entrega concluída" },
          ].map((item) => (
            <div key={item.key} className="space-y-2">
              <Label>{item.label}</Label>
              <Textarea
                value={(config as any)[item.key]}
                onChange={(e) => setConfig({ ...config, [item.key]: e.target.value })}
                rows={4}
                className="text-xs"
              />
            </div>
          ))}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium mb-1">Variáveis disponíveis:</p>
            <div className="flex flex-wrap gap-1.5">
              {["{nome_cliente}", "{pedido_id}", "{valor_total}", "{link_cardapio}", "{link_rastreamento}", "{status_pedido}"].map(v => (
                <code key={v} className="text-[10px] bg-background px-1.5 py-0.5 rounded border">{v}</code>
              ))}
            </div>
          </div>
        </div>

        {/* Fluxo */}
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <h3 className="font-display font-semibold text-sm">Fluxo do Agente</h3>
          </div>
          <div className="space-y-2">
            {[
              "1. Cliente envia mensagem no WhatsApp",
              "2. MEGA API recebe via webhook e envia para o agente",
              "3. Agente responde com saudação e menu interativo",
              "4. Cliente escolhe opção → agente envia cardápio digital",
              "5. Cliente faz pedido pelo cardápio → sistema registra",
              "6. Agente orienta pagamento (Pix/Cartão via Mercado Pago)",
              "7. Pagamento confirmado → agente notifica via WhatsApp",
              "8. Agente envia link de rastreamento em tempo real",
              "9. Entrega concluída → mensagem de agradecimento",
            ].map((step) => (
              <div key={step} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                {step}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} className="w-full h-12 font-display text-base">
          Salvar configurações
        </Button>
      </div>
    </div>
  );
};

export default AtendimentoPage;
