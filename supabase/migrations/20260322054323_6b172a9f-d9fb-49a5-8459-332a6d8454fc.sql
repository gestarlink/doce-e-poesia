
DROP POLICY "Entregador can view assigned orders" ON public.pedidos;
CREATE POLICY "Entregador can view assigned orders"
  ON public.pedidos FOR SELECT
  TO authenticated
  USING (
    (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.tipo = 'entregador'))
    AND (
      (entregador_id = auth.uid())
      OR ((entregador_id IS NULL) AND (status = 'em_preparo'::order_status))
    )
  );
