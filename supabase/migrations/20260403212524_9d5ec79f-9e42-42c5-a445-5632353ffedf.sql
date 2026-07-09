
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS imagem_url text DEFAULT '';

-- Create storage bucket for banner images
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true);

-- Storage policies
CREATE POLICY "Anyone can view banner images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'banners');

CREATE POLICY "Admins can upload banner images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update banner images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'banners' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete banner images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'banners' AND public.is_admin(auth.uid()));
