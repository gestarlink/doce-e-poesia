import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";

interface Product {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string;
  estoque?: number | null;
}

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProductDetailModal = ({ product, open, onOpenChange }: ProductDetailModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  if (!product) return null;

  const outOfStock = product.estoque !== undefined && product.estoque !== null && product.estoque <= 0;
  const maxQuantity = product.estoque !== null && product.estoque !== undefined ? product.estoque : 99;

  const handleAdd = () => {
    if (outOfStock) return;
    for (let i = 0; i < quantity; i++) {
      addItem({ id: product.id, nome: product.nome, preco: product.preco, imagem_url: product.imagem_url });
    }
    setQuantity(1);
    onOpenChange(false);
  };

  const totalPrice = product.preco * quantity;

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuantity(1); }}>
      <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[85vh] overflow-y-auto border-0 shadow-2xl">
        <div className="aspect-video bg-muted relative">
          {product.imagem_url ? (
            <img src={product.imagem_url} alt={product.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-muted to-accent">🍫</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h2 className="font-bold text-xl leading-tight">{product.nome}</h2>
            <p className="text-primary font-bold text-lg mt-1">
              R$ {product.preco.toFixed(2).replace(".", ",")}
            </p>
          </div>

          {product.descricao && (
            <p className="text-sm text-muted-foreground leading-relaxed">{product.descricao}</p>
          )}

          {outOfStock && (
            <div className="bg-destructive/10 text-destructive text-sm font-medium rounded-xl p-3 text-center">
              Produto indisponível no momento
            </div>
          )}

          {!outOfStock && (
            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
              <span className="text-sm font-medium">Quantidade</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg border flex items-center justify-center active:scale-90 transition-transform bg-card"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bold text-base w-6 text-center tabular-nums">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                  className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {!outOfStock && (
            <Button
              onClick={handleAdd}
              className="w-full h-12 text-base font-semibold gap-2 rounded-xl"
            >
              <ShoppingCart className="w-5 h-5" />
              Adicionar - R$ {totalPrice.toFixed(2).replace(".", ",")}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProductDetailModal;
