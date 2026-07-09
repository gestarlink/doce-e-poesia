-- Add estoque column to produtos (null = unlimited)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS estoque integer;

-- Trigger to auto-disable product when stock reaches 0
CREATE OR REPLACE FUNCTION public.check_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estoque IS NOT NULL AND NEW.estoque <= 0 THEN
    NEW.ativo = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_estoque ON public.produtos;
CREATE TRIGGER trg_check_estoque
  BEFORE INSERT OR UPDATE OF estoque ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.check_estoque();

-- Function to decrement stock when order is placed
CREATE OR REPLACE FUNCTION public.decrement_estoque()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.produtos
  SET estoque = GREATEST(COALESCE(estoque, 0) - NEW.quantidade, 0)
  WHERE id = NEW.produto_id AND estoque IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_decrement_estoque ON public.itens_pedido;
CREATE TRIGGER trg_decrement_estoque
  AFTER INSERT ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.decrement_estoque();

-- Add columns for entregador online status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS entregador_online boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz;
