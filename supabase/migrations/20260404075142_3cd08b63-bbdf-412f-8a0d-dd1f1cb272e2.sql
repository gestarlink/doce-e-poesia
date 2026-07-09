
-- Fix: Restrict public SELECT on produtos to active items only
DROP POLICY IF EXISTS "Anyone can view active products" ON public.produtos;
CREATE POLICY "Anyone can view active products" ON public.produtos
  FOR SELECT TO public
  USING (ativo = true);

-- Add admin SELECT policy for produtos so admins can see all (including inactive)
DROP POLICY IF EXISTS "Admins can view all products" ON public.produtos;
CREATE POLICY "Admins can view all products" ON public.produtos
  FOR SELECT TO public
  USING (is_admin(auth.uid()));

-- Fix: Restrict public SELECT on banners to active items only
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
CREATE POLICY "Anyone can view active banners" ON public.banners
  FOR SELECT TO public
  USING (ativo = true);

-- Add admin SELECT policy for banners so admins can see all (including inactive)
DROP POLICY IF EXISTS "Admins can view all banners" ON public.banners;
CREATE POLICY "Admins can view all banners" ON public.banners
  FOR SELECT TO public
  USING (is_admin(auth.uid()));
