-- Create user type enum
CREATE TYPE public.user_type AS ENUM ('admin', 'cliente');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('recebido', 'em_preparo', 'saiu_entrega', 'entregue');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'recusado');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  tipo public.user_type NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create produtos table
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  imagem_url TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pedidos table
CREATE TABLE public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'recebido',
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  endereco TEXT NOT NULL DEFAULT '',
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create itens_pedido table
CREATE TABLE public.itens_pedido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- Create pagamentos table
CREATE TABLE public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status public.payment_status NOT NULL DEFAULT 'pendente',
  metodo TEXT DEFAULT '',
  data_pagamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Enable realtime for pedidos
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;

-- Create security definer function for role check
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND tipo = 'admin'
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Produtos policies (public read, admin write)
CREATE POLICY "Anyone can view active products" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Admins can insert products" ON public.produtos FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update products" ON public.produtos FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete products" ON public.produtos FOR DELETE USING (public.is_admin(auth.uid()));

-- Pedidos policies
CREATE POLICY "Users can view own orders" ON public.pedidos FOR SELECT USING (auth.uid() = cliente_id);
CREATE POLICY "Admins can view all orders" ON public.pedidos FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can create orders" ON public.pedidos FOR INSERT WITH CHECK (auth.uid() = cliente_id);
CREATE POLICY "Admins can update orders" ON public.pedidos FOR UPDATE USING (public.is_admin(auth.uid()));

-- Itens pedido policies
CREATE POLICY "Users can view own order items" ON public.itens_pedido FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.pedido_id AND pedidos.cliente_id = auth.uid())
);
CREATE POLICY "Admins can view all order items" ON public.itens_pedido FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can insert order items" ON public.itens_pedido FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = itens_pedido.pedido_id AND pedidos.cliente_id = auth.uid())
);

-- Pagamentos policies
CREATE POLICY "Users can view own payments" ON public.pagamentos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = pagamentos.pedido_id AND pedidos.cliente_id = auth.uid())
);
CREATE POLICY "Admins can view all payments" ON public.pagamentos FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can insert payments" ON public.pagamentos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.pedidos WHERE pedidos.id = pagamentos.pedido_id AND pedidos.cliente_id = auth.uid())
);
CREATE POLICY "Admins can update payments" ON public.pagamentos FOR UPDATE USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;