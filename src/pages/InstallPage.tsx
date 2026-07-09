import { useState, useEffect } from "react";
import { ArrowLeft, Share, MoreVertical, Plus, Download, Smartphone, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logoDocePoesia from "@/assets/logo-doce-poesia.png";

const InstallPage = () => {
  const navigate = useNavigate();
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  if (isStandalone) {
    return (
      <div className="min-h-screen min-h-dvh bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">App já instalado!</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Você já está usando o Doce & Poesia como aplicativo.
        </p>
        <Button onClick={() => navigate("/")} className="rounded-full px-8">
          Ir para o cardápio
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-background safe-bottom">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-sm border-b">
        <div className="container flex items-center h-14 gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 -ml-2 rounded-lg hover:bg-muted active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-base">Instalar App</h1>
        </div>
      </header>

      <div className="container max-w-md py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <img
            src={logoDocePoesia}
            alt="Doce & Poesia"
            className="w-24 h-24 rounded-3xl shadow-lg mx-auto object-contain"
          />
          <div>
            <h2 className="font-display text-xl font-bold">Doce & Poesia</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Instale na sua tela inicial para acesso rápido
            </p>
          </div>

          {deferredPrompt && (
            <Button
              onClick={handleInstallClick}
              size="lg"
              className="rounded-full px-8 gap-2 shadow-md"
            >
              <Download className="w-5 h-5" />
              Instalar agora
            </Button>
          )}
        </div>

        {/* Benefits */}
        <div className="bg-card rounded-2xl border p-5 space-y-4">
          <h3 className="font-display font-bold text-sm">Por que instalar?</h3>
          <div className="space-y-3">
            {[
              { emoji: "⚡", text: "Acesso rápido direto da tela inicial" },
              { emoji: "📱", text: "Experiência de app nativo, sem barra do navegador" },
              { emoji: "🔔", text: "Receba notificações do seu pedido em tempo real" },
              { emoji: "🚀", text: "Carregamento mais rápido" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <span className="text-xl">{item.emoji}</span>
                <span className="text-sm text-muted-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {isIOS ? (
          <div className="bg-card rounded-2xl border p-5 space-y-5">
            <h3 className="font-display font-bold text-sm">Como instalar no iPhone / iPad</h3>

            <div className="space-y-5">
              <Step
                number={1}
                title="Toque no botão Compartilhar"
                description='Na barra inferior do Safari, toque no ícone de compartilhar'
                icon={<Share className="w-5 h-5" />}
              />
              <Step
                number={2}
                title='"Adicionar à Tela de Início"'
                description="Role para baixo e toque nessa opção"
                icon={<Plus className="w-5 h-5" />}
              />
              <Step
                number={3}
                title='Toque em "Adicionar"'
                description="Confirme para instalar o app na sua tela inicial"
                icon={<CheckCircle2 className="w-5 h-5" />}
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800">
                <strong>Importante:</strong> Use o <strong>Safari</strong> para instalar. Outros navegadores no iOS não suportam esta função.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border p-5 space-y-5">
            <h3 className="font-display font-bold text-sm">Como instalar no Android</h3>

            <div className="space-y-5">
              {deferredPrompt ? (
                <div className="text-center py-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    Basta clicar no botão acima! Ou siga os passos manuais:
                  </p>
                </div>
              ) : null}

              <Step
                number={1}
                title="Toque no menu do navegador"
                description='Toque nos 3 pontinhos (⋮) no canto superior direito do Chrome'
                icon={<MoreVertical className="w-5 h-5" />}
              />
              <Step
                number={2}
                title='"Adicionar à tela inicial"'
                description="Selecione essa opção no menu"
                icon={<Smartphone className="w-5 h-5" />}
              />
              <Step
                number={3}
                title='Toque em "Instalar"'
                description="Confirme para instalar o app"
                icon={<CheckCircle2 className="w-5 h-5" />}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Step = ({
  number,
  title,
  description,
  icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
      {number}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  </div>
);

export default InstallPage;
