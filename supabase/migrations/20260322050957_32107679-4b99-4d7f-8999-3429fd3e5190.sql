-- Add entregador tracking fields to pedidos
ALTER TABLE public.pedidos 
  ADD COLUMN IF NOT EXISTS entregador_id uuid,
  ADD COLUMN IF NOT EXISTS entregador_lat numeric,
  ADD COLUMN IF NOT EXISTS entregador_lng numeric;

-- Create entregador location tracking table
CREATE TABLE IF NOT EXISTS public.entregador_localizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entregador_id uuid NOT NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entregador_localizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entregador can manage own location" ON public.entregador_localizacao
  FOR ALL TO authenticated
  USING (entregador_id = auth.uid())
  WITH CHECK (entregador_id = auth.uid());

CREATE POLICY "Admin can view all locations" ON public.entregador_localizacao
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Cliente can view own order delivery location" ON public.entregador_localizacao
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos 
    WHERE pedidos.id = entregador_localizacao.pedido_id 
    AND pedidos.cliente_id = auth.uid()
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.entregador_localizacao;

CREATE POLICY "Entregador can view assigned orders" ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'entregador')
    AND (entregador_id = auth.uid() OR (entregador_id IS NULL AND status = 'recebido'))
  );

CREATE POLICY "Entregador can update assigned orders" ON public.pedidos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND tipo = 'entregador')
    AND entregador_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.is_entregador(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND tipo = 'entregador'
  )
$$;

-- Entregador can view items of assigned orders
CREATE POLICY "Entregador can view order items" ON public.itens_pedido
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos 
    WHERE pedidos.id = itens_pedido.pedido_id 
    AND pedidos.entregador_id = auth.uid()
  ));