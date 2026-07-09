import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GripVertical, Upload, ImageIcon } from "lucide-react";

interface Banner {
  id: string;
  titulo: string;
  subtitulo: string;
  emoji: string;
  ativo: boolean;
  ordem: number;
  imagem_url: string | null;
  link_url: string | null;
}

const emptyForm = { titulo: "", subtitulo: "", emoji: "🎉", ativo: true, ordem: 0, imagem_url: "", link_url: "" };

const BannersPage = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBanners = async () => {
    const { data } = await supabase.from("banners").select("*").order("ordem");
    setBanners((data as Banner[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("banners").upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) { toast.error("Erro ao enviar imagem"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("banners").getPublicUrl(fileName);
    setForm((prev) => ({ ...prev, imagem_url: urlData.publicUrl }));
    setPreviewUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const handleSave = async () => {
    const payload = {
      titulo: form.titulo,
      subtitulo: form.subtitulo,
      emoji: form.emoji,
      ativo: form.ativo,
      ordem: form.ordem,
      imagem_url: form.imagem_url || null,
      link_url: form.link_url || null,
    };

    if (editId) {
      const { error } = await supabase.from("banners").update(payload).eq("id", editId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Banner atualizado!");
    } else {
      const { error } = await supabase.from("banners").insert(payload);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Banner criado!");
    }
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm);
    setPreviewUrl(null);
    fetchBanners();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir banner?")) return;
    await supabase.from("banners").delete().eq("id", id);
    toast.success("Banner excluído");
    fetchBanners();
  };

  const openEdit = (b: Banner) => {
    setEditId(b.id);
    setForm({ titulo: b.titulo, subtitulo: b.subtitulo || "", emoji: b.emoji || "🎉", ativo: b.ativo, ordem: b.ordem, imagem_url: b.imagem_url || "", link_url: b.link_url || "" });
    setPreviewUrl(b.imagem_url || null);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ ...emptyForm, ordem: banners.length });
    setPreviewUrl(null);
    setDialogOpen(true);
  };

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl">Banners / Promoções</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={openNew}><Plus className="w-4 h-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editId ? "Editar Banner" : "Novo Banner"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Combo Especial 🍫" />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo</Label>
                <Input value={form.subtitulo} onChange={(e) => setForm({ ...form, subtitulo: e.target.value })} placeholder="Ex: 3 brownies por R$ 25,00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Emoji</Label>
                  <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} placeholder="🎉" />
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              {/* Link */}
              <div className="space-y-2">
                <Label>Link ao clicar (opcional)</Label>
                <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://... ou /checkout" />
                <p className="text-xs text-muted-foreground">Use URL completa ou caminho interno (ex: /checkout)</p>
              </div>

              <div className="space-y-2">
                <Label>Imagem de fundo (opcional)</Label>
                <div className="flex gap-3 items-start">
                  <div
                    className="w-24 h-14 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="w-4 h-4" />
                      {uploading ? "Enviando..." : "Enviar imagem"}
                    </Button>
                    <Input
                      value={form.imagem_url}
                      onChange={(e) => { setForm({ ...form, imagem_url: e.target.value }); setPreviewUrl(e.target.value || null); }}
                      placeholder="ou cole uma URL..."
                      className="text-xs h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Ativo</Label>
              </div>

              {/* Live preview */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                <div
                  className="relative rounded-xl overflow-hidden min-h-[88px] flex items-center p-4"
                  style={previewUrl ? { backgroundImage: `url(${previewUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
                >
                  {previewUrl && <div className="absolute inset-0 bg-black/50" />}
                  {!previewUrl && <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />}
                  <div className="relative flex-1 min-w-0">
                    <p className="font-display font-bold text-base text-primary-foreground leading-tight">{form.titulo || "Título"}</p>
                    <p className="text-primary-foreground/80 text-xs mt-1">{form.subtitulo || "Subtítulo"}</p>
                  </div>
                  <span className="relative text-4xl ml-3">{form.emoji}</span>
                </div>
              </div>

              <Button className="w-full" onClick={handleSave}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : banners.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum banner cadastrado</p>
          <p className="text-muted-foreground text-sm mt-1">Crie banners para exibir promoções no cardápio</p>
        </div>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => (
            <div key={b.id} className="bg-card rounded-xl border p-3 flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              {b.imagem_url ? (
                <div className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={b.imagem_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <span className="text-2xl flex-shrink-0">{b.emoji}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{b.titulo}</p>
                <p className="text-muted-foreground text-xs truncate">{b.subtitulo}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${b.ativo ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                {b.ativo ? "Ativo" : "Inativo"}
              </span>
              <button onClick={() => openEdit(b)} className="p-2 hover:bg-muted rounded-lg"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(b.id)} className="p-2 hover:bg-destructive/10 rounded-lg text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BannersPage;
