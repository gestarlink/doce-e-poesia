
-- Fix 1: Prevent privilege escalation on profiles
-- Drop and recreate INSERT policy to force tipo='cliente'
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND tipo = 'cliente');

-- Drop and recreate UPDATE policy to prevent changing tipo
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND tipo = (SELECT p.tipo FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Fix 2: Prevent payment status bypass
DROP POLICY IF EXISTS "Users can insert payments" ON public.pagamentos;
CREATE POLICY "Users can insert payments" ON public.pagamentos
  FOR INSERT TO public
  WITH CHECK (
    status = 'pendente' AND
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = pagamentos.pedido_id
      AND pedidos.cliente_id = auth.uid()
    )
  );

-- Fix 3: Scope itens_pedido INSERT to authenticated role
DROP POLICY IF EXISTS "Users can insert order items" ON public.itens_pedido;
CREATE POLICY "Users can insert order items" ON public.itens_pedido
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos
      WHERE pedidos.id = itens_pedido.pedido_id
      AND pedidos.cliente_id = auth.uid()
    )
  );
