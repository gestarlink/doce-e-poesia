import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, ImageIcon, Package } from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
  ativo: boolean;
  categoria: string | null;
  estoque: number | null;
}

const CATEGORIAS = ["Brownies", "Tortas", "Bebidas", "Combos", "Outros"];
const emptyForm = { nome: "", descricao: "", preco: "", imagem_url: "", ativo: true, categoria: "Brownies", estoque: "" };

const ProdutosPage = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasEstoque, setHasEstoque] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProdutos = async () => {
    const { data } = await supabase.from("produtos").select("*").order("nome");
    const list = (data as Produto[]) || [];
    if (list.length > 0 && !("estoque" in list[0])) {
      setHasEstoque(false);
    }
    setProdutos(list);
    setLoading(false);
  };

  useEffect(() => { fetchProdutos(); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("produtos").upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) { toast.error("Erro ao enviar imagem"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("produtos").getPublicUrl(fileName);
    setForm((prev) => ({ ...prev, imagem_url: urlData.publicUrl }));
    setPreviewUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const handleSave = async () => {
    const payload: any = {
      nome: form.nome,
      descricao: form.descricao,
      preco: parseFloat(form.preco) || 0,
      imagem_url: form.imagem_url,
      ativo: form.ativo,
      categoria: form.categoria,
    };
    if (hasEstoque) {
      const est = form.estoque === "" ? null : parseInt(form.estoque, 10);
      if (est !== null && (isNaN(est) || est < 0)) {
        toast.error("Estoque deve ser um número positivo ou vazio (ilimitado)");
        return;
      }
      payload.estoque = est;
    }

    if (editId) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from("produtos").insert(payload);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Produto criado!");
    }
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm);
    setPreviewUrl(null);
    fetchProdutos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    await supabase.from("produtos").delete().eq("id", id);
    toast.success("Produto excluído");
    fetchProdutos();
  };

  const toggleAtivo = async (p: Produto) => {
    const novoAtivo = !p.ativo;
    const { error } = await supabase.from("produtos").update({ ativo: novoAtivo }).eq("id", p.id);
    if (error) { toast.error("Erro ao alterar status"); return; }
    toast.success(novoAtivo ? "Produto ativado" : "Produto desativado");
    fetchProdutos();
  };

  const openEdit = (p: Produto) => {
    setEditId(p.id);
    setForm({ nome: p.nome, descricao: p.descricao || "", preco: String(p.preco), imagem_url: p.imagem_url || "", ativo: p.ativo, categoria: p.categoria || "Brownies", estoque: p.estoque === null || p.estoque === undefined ? "" : String(p.estoque) });
    setPreviewUrl(p.imagem_url || null);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setPreviewUrl(null);
    setDialogOpen(true);
  };

  const getEstoqueDisplay = (p: Produto) => {
    if (!hasEstoque || p.estoque === null || p.estoque === undefined) return null;
    if (p.estoque <= 0) return { text: "Sem estoque", cls: "bg-red-100 text-red-700" };
    if (p.estoque <= 5) return { text: `${p.estoque} und`, cls: "bg-amber-100 text-amber-700" };
    return { text: `${p.estoque} und`, cls: "bg-emerald-100 text-emerald-700" };
  };

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl">Produtos</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={openNew}><Plus className="w-4 h-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasEstoque && (
                <div className="space-y-2">
                  <Label>Estoque <span className="text-muted-foreground font-normal">(deixe vazio para ilimitado)</span></Label>
                  <Input type="number" min="0" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} placeholder="Ilimitado" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Imagem do produto</Label>
                <div className="flex gap-3 items-start">
                  <div
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="w-4 h-4" />
                      {uploading ? "Enviando..." : "Enviar imagem"}
                    </Button>
                    <p className="text-xs text-muted-foreground">ou cole uma URL abaixo</p>
                    <Input
                      value={form.imagem_url}
                      onChange={(e) => { setForm({ ...form, imagem_url: e.target.value }); setPreviewUrl(e.target.value || null); }}
                      placeholder="https://..."
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Ativo</Label>
              </div>
              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : produtos.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum produto cadastrado</p>
      ) : (
        <div className="space-y-2">
          {produtos.map((p) => {
            const stock = getEstoqueDisplay(p);
            return (
              <div key={p.id} className="bg-card rounded-xl border p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {p.imagem_url ? <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.nome}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-primary font-bold text-sm">R$ {Number(p.preco).toFixed(2).replace(".", ",")}</p>
                    {p.categoria && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">{p.categoria}</span>}
                    {stock && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stock.cls}`}>{stock.text}</span>}
                  </div>
                </div>
                <button onClick={() => toggleAtivo(p)} className={`p-2 rounded-lg ${p.ativo ? "text-emerald-600 hover:bg-emerald-50" : "text-muted-foreground hover:bg-muted"}`} title={p.ativo ? "Desativar" : "Ativar"}>
                  {p.ativo ? "✓" : "✗"}
                </button>
                <button onClick={() => openEdit(p)} className="p-2 hover:bg-muted rounded-lg"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-destructive/10 rounded-lg text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
      {!hasEstoque && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <Package className="w-4 h-4 flex-shrink-0" />
          <span>Configure o estoque no SQL Editor do Supabase. Migration disponível em supabase/migrations/20260709000001_estoque_and_delivery.sql</span>
        </div>
      )}
    </div>
  );
};

export default ProdutosPage;
