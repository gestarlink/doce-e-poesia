import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, LogOut } from "lucide-react";

const EntregadorPerfilPage = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="container max-w-lg py-6 space-y-4">
      <div className="bg-card rounded-2xl border p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <User className="w-7 h-7 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg truncate">{profile?.nome || "Entregador"}</h2>
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate">{profile?.email}</span>
            </div>
            {profile?.telefone && (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
                <Phone className="w-3.5 h-3.5" />
                <span>{profile.telefone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={signOut}>
        <LogOut className="w-4 h-4" />
        Sair da conta
      </Button>
    </div>
  );
};

export default EntregadorPerfilPage;
