import { Plus, Minus } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface ProductCardProps {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
  estoque?: number | null;
  onClick?: () => void;
}

const ProductCard = ({ id, nome, descricao, preco, imagem_url, estoque, onClick }: ProductCardProps) => {
  const { addItem } = useCart();
  const outOfStock = estoque !== undefined && estoque !== null && estoque <= 0;

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    addItem({ id, nome, preco, imagem_url });
  };

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl border overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="aspect-square bg-muted relative">
        {imagem_url ? (
          <img src={imagem_url} alt={nome} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-muted to-accent">🍫</div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full">
              Indisponível
            </span>
          </div>
        )}
      </div>
      <div className="p-2.5 pb-3">
        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{nome}</h3>
        {descricao && (
          <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-1">{descricao}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-sm text-primary">R$ {preco.toFixed(2).replace(".", ",")}</span>
          <button
            onClick={handleAddClick}
            disabled={outOfStock}
            className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm ${outOfStock ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground"}`}
            aria-label={`Adicionar ${nome}`}
          >
            {outOfStock ? <Minus className="w-4 h-4" strokeWidth={2.5} /> : <Plus className="w-4 h-4" strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
