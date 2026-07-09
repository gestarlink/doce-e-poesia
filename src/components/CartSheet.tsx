import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";

const CartSheet = () => {
  const { items, total, itemCount, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-lg mx-auto" style={{ width: "calc(100% - 2rem)" }}>
      <Sheet>
        <SheetTrigger asChild>
          <button className="w-full bg-primary text-primary-foreground rounded-xl px-5 py-3.5 flex items-center justify-between shadow-xl active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 bg-card text-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {itemCount}
                </span>
              </div>
              <span className="font-semibold text-sm">Ver carrinho</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">R$ {total.toFixed(2).replace(".", ",")}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] border-0 shadow-2xl p-0">
          <SheetHeader className="px-5 pt-5 pb-2">
            <SheetTitle className="text-left font-bold text-lg">Seu pedido</SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-5 space-y-3 overflow-y-auto max-h-[50vh]">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {item.imagem_url ? (
                    <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">🍫</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.nome}</p>
                  <p className="font-bold text-sm text-primary mt-0.5">
                    R$ {(item.preco * item.quantidade).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantidade - 1)}
                    className="w-7 h-7 rounded-full border flex items-center justify-center active:scale-90 transition-transform bg-card"
                  >
                    {item.quantidade === 1 ? <Trash2 className="w-3.5 h-3.5 text-destructive" /> : <Minus className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-sm font-bold w-5 text-center tabular-nums">{item.quantidade}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantidade + 1)}
                    className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 pt-3 border-t">
            <div className="flex justify-between items-center mb-4">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-xl text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
            </div>
            <Button
              className="w-full h-12 text-base font-semibold rounded-xl gap-2"
              onClick={() => navigate("/checkout")}
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CartSheet;
