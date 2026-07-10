import { useState, useEffect, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, MapPin, CreditCard, QrCode, Banknote, Copy, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

type PaymentMethod = "pix" | "cartao" | "dinheiro";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "pix", label: "Pix", icon: <QrCode className="w-5 h-5" />, desc: "Pagamento instantâneo" },
  { value: "cartao", label: "Cartão", icon: <CreditCard className="w-5 h-5" />, desc: "Crédito ou débito" },
  { value: "dinheiro", label: "Dinheiro", icon: <Banknote className="w-5 h-5" />, desc: "Pagamento na entrega" },
];

const CheckoutPage = () => {
  const { items, total, clearCart } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [orderId, setOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cardForm, setCardForm] = useState({ number: "", name: "", expiry: "", cvv: "", installments: 1 });
  const [processingCard, setProcessingCard] = useState(false);
  const [form, setForm] = useState({
    nome: profile?.nome || "",
    telefone: profile?.telefone || "",
    endereco: "",
  });

  if (items.length === 0 && !orderPlaced) {
    navigate("/");
    return null;
  }

  // Poll Pix status
  useEffect(() => {
    if (!orderId || paymentMethod !== "pix" || !pixData) return;
    pollRef.current = setInterval(async () => {
      const { data } = await supabase.functions.invoke("mercado-pago", {
        body: { action: "check_pix", pedido_id: orderId },
      });
      if (data?.status === "pago") {
        setPixStatus("pago");
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, paymentMethod, pixData]);

  const processPixPayment = async (pedidoId: string) => {
    setProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercado-pago", {
        body: {
          action: "pix",
          pedido_id: pedidoId,
          valor: total,
          payer_email: profile?.email || user?.email || "cliente@email.com",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.qr_code) {
        setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 });
      } else {
        toast.info("Pix será confirmado manualmente");
      }
    } catch (err: any) {
      console.error("Pix error:", err);
      toast.info("Pagamento Pix será confirmado manualmente pelo estabelecimento");
    } finally {
      setProcessingPayment(false);
    }
  };

  const processCardPayment = async (pedidoId: string) => {
    const mp = (window as any).MercadoPago;
    if (!mp) { toast.error("Mercado Pago não carregado"); return; }
    setProcessingCard(true);
    try {
      const mpInstance = new mp(import.meta.env.VITE_MP_PUBLIC_KEY || "");
      const cardToken = await mpInstance.createCardToken({
        cardNumber: cardForm.number.replace(/\s/g, ""),
        cardholderName: cardForm.name,
        cardExpirationMonth: cardForm.expiry.split("/")[0],
        cardExpirationYear: cardForm.expiry.split("/")[1],
        securityCode: cardForm.cvv,
      });
      const { data, error } = await supabase.functions.invoke("mercado-pago", {
        body: {
          action: "card",
          pedido_id: pedidoId,
          valor: total,
          card_token: cardToken.id,
          installments: cardForm.installments,
          payer_email: profile?.email || user?.email,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.success) {
        toast.success("Pagamento aprovado!");
      } else {
        toast.error(data?.status_detail || "Pagamento recusado");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro no processamento do cartão");
    } finally {
      setProcessingCard(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Faça login para continuar"); return; }
    if (!paymentMethod) { toast.error("Selecione uma forma de pagamento"); return; }

    setLoading(true);
    try {
      let lat = null, lng = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}

      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: user.id,
          valor_total: total,
          endereco: form.endereco,
          status: "recebido" as const,
          latitude: lat,
          longitude: lng,
        })
        .select()
        .single();
      if (pedidoError) throw pedidoError;

      const itens = items.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.id,
        quantidade: item.quantidade,
        preco_unitario: item.preco,
      }));
      const { error: itensError } = await supabase.from("itens_pedido").insert(itens);
      if (itensError) throw itensError;

      await supabase.from("pagamentos").insert({
        pedido_id: pedido.id,
        status: "pendente",
        metodo: paymentMethod,
      });

      const methodLabel = PAYMENT_OPTIONS.find(p => p.value === paymentMethod)?.label || paymentMethod;
      const msg = `🛒 *Novo Pedido - Doce & Poesia*\n\n👤 *Cliente:* ${form.nome}\n📞 *Telefone:* ${form.telefone}\n📍 *Endereço:* ${form.endereco}\n\n📋 *Itens:*\n${items.map((i) => `• ${i.quantidade}x ${i.nome} - R$ ${(i.preco * i.quantidade).toFixed(2).replace(".", ",")}`).join("\n")}\n\n💰 *Total: R$ ${total.toFixed(2).replace(".", ",")}*\n💳 *Pagamento:* ${methodLabel}\n\n📦 Pedido #${pedido.id.slice(0, 8)}`;
      setWhatsappMsg(msg);
      setOrderId(pedido.id);

      if (paymentMethod === "pix") {
        await processPixPayment(pedido.id);
      }
      if (paymentMethod === "cartao") {
        await processCardPayment(pedido.id);
      }

      toast.success("Pedido realizado com sucesso!");
      clearCart();
      setOrderPlaced(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido");
    } finally {
      setLoading(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setPixCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  if (orderPlaced && paymentMethod === "cartao") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className={`text-6xl mb-2 ${processingCard ? "animate-pulse" : ""}`}>{processingCard ? "⏳" : "✅"}</div>
          <h1 className="text-2xl font-display font-bold">{processingCard ? "Processando pagamento..." : "Pedido enviado!"}</h1>
          {processingCard && <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />}
          {!processingCard && (
            <>
              <p className="text-muted-foreground text-sm">Seu pedido foi recebido e o pagamento está sendo verificado.</p>
              <div className="space-y-3">
                <Button variant="secondary" className="w-full h-12 gap-2" onClick={() => navigate(`/pedido/${orderId}`)}>
                  <MapPin className="w-5 h-5" /> Acompanhar pedido
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Voltar ao cardápio</Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="text-6xl mb-2">{pixStatus === "pago" ? "✅" : "📋"}</div>
          <h1 className="text-2xl font-display font-bold">
            {pixStatus === "pago" ? "Pagamento confirmado!" : "Pedido enviado!"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {pixStatus === "pago"
              ? "Seu pagamento foi aprovado e o pedido já está sendo preparado."
              : "Seu pedido foi recebido e está sendo processado."}
          </p>

          {pixData && (
            <div className="bg-card rounded-2xl border p-5 space-y-3">
              <h3 className="font-display font-semibold text-sm flex items-center gap-2 justify-center">
                <QrCode className="w-4 h-4 text-primary" /> Pague com Pix
              </h3>
              {pixData.qr_code_base64 && (
                <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 mx-auto rounded-lg" />
              )}
              <Button variant="outline" className="w-full gap-2" onClick={copyPixCode}>
                {pixCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {pixCopied ? "Copiado!" : "Copiar código Pix"}
              </Button>
              {pixStatus === "pago" ? (
                <p className="text-xs text-emerald-600 font-medium">✅ Pagamento confirmado!</p>
              ) : (
                <p className="text-xs text-muted-foreground">Escaneie o QR Code ou copie o código para pagar</p>
              )}
            </div>
          )}

          {!pixData && !processingPayment && paymentMethod === "dinheiro" && (
            <p className="text-sm text-muted-foreground">Pagamento na entrega em dinheiro.</p>
          )}

          {processingPayment && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Gerando Pix...
            </div>
          )}

          {pixStatus && pixStatus !== "pago" && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-600">
              <AlertCircle className="w-3.5 h-3.5" /> Aguardando pagamento...
            </div>
          )}

          <div className="space-y-3">
            <Button
              className="w-full h-12 gap-2"
              onClick={() => {
                window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`, "_blank");
              }}
            >
              <MessageCircle className="w-5 h-5" />
              Confirmar no WhatsApp
            </Button>
            <Button variant="secondary" className="w-full h-12 gap-2" onClick={() => navigate(`/pedido/${orderId}`)}>
              <MapPin className="w-5 h-5" />
              Acompanhar pedido
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Voltar ao cardápio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-sm border-b">
        <div className="container flex items-center h-14 gap-3">
          <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-lg">Finalizar pedido</h1>
        </div>
      </header>

      <div className="container max-w-lg py-6">
        <div className="bg-card rounded-xl border p-4 mb-6">
          <h2 className="font-display font-semibold mb-3">Resumo</h2>
          {items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5 text-sm">
              <span>{item.quantidade}x {item.nome}</span>
              <span className="font-medium tabular-nums">R$ {(item.preco * item.quantidade).toFixed(2).replace(".", ",")}</span>
            </div>
          ))}
          <div className="border-t mt-3 pt-3 flex justify-between font-display font-bold">
            <span>Total</span>
            <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="font-semibold mb-3">Forma de pagamento</h2>
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setPaymentMethod(opt.value); }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                  paymentMethod === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${paymentMethod === opt.value ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === opt.value ? "border-primary" : "border-border"}`}>
                  {paymentMethod === opt.value && <div className="w-3 h-3 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
          {!paymentMethod && <p className="text-xs text-destructive mt-2">* Selecione uma forma de pagamento</p>}
        </div>

        {paymentMethod === "cartao" && (
          <div className="bg-card rounded-xl border p-4 mb-6 space-y-4">
            <h3 className="font-semibold text-sm">Dados do cartão</h3>
            <div className="space-y-2">
              <Label>Número do cartão</Label>
              <Input
                value={cardForm.number}
                onChange={(e) => setCardForm({ ...cardForm, number: e.target.value.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").slice(0, 19) })}
                placeholder="0000 0000 0000 0000"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome no cartão</Label>
              <Input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder="Seu nome" className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Validade</Label>
                <Input
                  value={cardForm.expiry}
                  onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value.replace(/\D/g, "").replace(/(\d{2})(?=\d)/, "$1/").slice(0, 5) })}
                  placeholder="MM/AA"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>CVV</Label>
                <Input value={cardForm.cvv} onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="123" className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Parcelas</Label>
              <select
                value={cardForm.installments}
                onChange={(e) => setCardForm({ ...cardForm, installments: Number(e.target.value) })}
                className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>{n}x de R$ {(total / n).toFixed(2).replace(".", ",")}</option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground">Pagamento processado via Mercado Pago 🔒</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checkout-nome">Nome</Label>
            <Input id="checkout-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-telefone">Telefone</Label>
            <Input id="checkout-telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checkout-endereco">Endereço de entrega</Label>
            <Textarea id="checkout-endereco" value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} required rows={3} placeholder="Rua, número, bairro, complemento..." />
          </div>
          <Button type="submit" className="w-full h-12 text-base font-display" disabled={loading || processingCard || !paymentMethod}>
            {loading ? "Processando..." : processingCard ? "Processando cartão..." : "Confirmar pedido"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CheckoutPage;
