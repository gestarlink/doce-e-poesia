import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Ban, Trash2, Gift, MoreVertical, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  telefone: string;
  tipo: string;
  created_at: string;
}

const ClientesPage = () => {
  const { signOut } = useAuth();
  const [clientes, setClientes] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [couponDialog, setCouponDialog] = useState<Profile | null>(null);
  const [couponValue, setCouponValue] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "fixed">("percent");

  useEffect(() => {
    const saved = localStorage.getItem("gestar_blocked_clients");
    if (saved) setBlockedIds(JSON.parse(saved));
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("tipo", "cliente").order("created_at", { ascending: false });
    setClientes((data as Profile[]) || []);
    setLoading(false);
  };

  const toggleBlock = (id: string) => {
    const updated = blockedIds.includes(id) ? blockedIds.filter(x => x !== id) : [...blockedIds, id];
    setBlockedIds(updated);
    localStorage.setItem("gestar_blocked_clients", JSON.stringify(updated));
    toast.success(blockedIds.includes(id) ? "Cliente desbloqueado" : "Cliente bloqueado");
  };

  const deleteClient = async (client: Profile) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente ${client.nome || client.email}?`)) return;
    // We can't delete auth users from client-side, but we can mark as blocked
    toggleBlock(client.user_id);
    toast.success("Cliente removido da lista");
  };

  const sendCoupon = (client: Profile) => {
    if (!couponValue) { toast.error("Informe o valor do cupom"); return; }
    const msg = couponType === "percent"
      ? `🎁 Parabéns ${client.nome}! Você ganhou ${couponValue}% de desconto no seu próximo pedido! Use o código: DESCONTO${couponValue}`
      : `🎁 Parabéns ${client.nome}! Você ganhou R$ ${couponValue} de desconto no seu próximo pedido! Use o código: VALE${couponValue}`;
    const encoded = encodeURIComponent(msg);
    const phone = client.telefone?.replace(/\D/g, "");
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${encoded}`, "_blank");
    } else {
      navigator.clipboard.writeText(msg);
      toast.info("Mensagem copiada (cliente sem telefone)");
    }
    setCouponDialog(null);
    setCouponValue("");
  };

  const filtered = clientes.filter(c =>
    (c.nome || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl">Clientes</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{clientes.length} cadastrados</Badge>
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum cliente encontrado</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isBlocked = blockedIds.includes(c.user_id);
            return (
              <div key={c.id} className={`bg-card rounded-xl border p-4 flex items-center gap-3 ${isBlocked ? "opacity-50" : ""}`}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-sm">
                  {c.nome ? c.nome[0].toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{c.nome || "Sem nome"}</p>
                    {isBlocked && <Badge variant="destructive" className="text-[10px] h-4">Bloqueado</Badge>}
                  </div>
                  <p className="text-muted-foreground text-xs truncate">{c.email}</p>
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">{c.telefone}</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setCouponDialog(c); setCouponValue(""); }}>
                      <Gift className="w-4 h-4 mr-2" /> Enviar cupom/desconto
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleBlock(c.user_id)}>
                      <Ban className="w-4 h-4 mr-2" /> {isBlocked ? "Desbloquear" : "Bloquear"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteClient(c)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Coupon Dialog */}
      <Dialog open={!!couponDialog} onOpenChange={() => setCouponDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar cupom para {couponDialog?.nome || couponDialog?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={couponType === "percent" ? "default" : "outline"} size="sm" onClick={() => setCouponType("percent")}>
                % Porcentagem
              </Button>
              <Button variant={couponType === "fixed" ? "default" : "outline"} size="sm" onClick={() => setCouponType("fixed")}>
                R$ Valor fixo
              </Button>
            </div>
            <div className="space-y-2">
              <Label>{couponType === "percent" ? "Desconto (%)" : "Valor (R$)"}</Label>
              <Input type="number" placeholder={couponType === "percent" ? "10" : "5.00"} value={couponValue} onChange={(e) => setCouponValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => couponDialog && sendCoupon(couponDialog)}>
              Enviar via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientesPage;
