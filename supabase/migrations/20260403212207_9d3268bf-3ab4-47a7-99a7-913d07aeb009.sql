
-- Add categoria column to produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Brownies';

-- Create banners table
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  subtitulo text DEFAULT '',
  emoji text DEFAULT '🎉',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Anyone can view active banners
CREATE POLICY "Anyone can view active banners" ON public.banners
  FOR SELECT TO public USING (true);

-- Admins can manage banners
CREATE POLICY "Admins can insert banners" ON public.banners
  FOR INSERT TO public WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update banners" ON public.banners
  FOR UPDATE TO public USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete banners" ON public.banners
  FOR DELETE TO public USING (is_admin(auth.uid()));
