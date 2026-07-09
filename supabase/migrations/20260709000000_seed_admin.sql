-- Seed admin user (run after a user is created with email admin@docepoesia.com)
UPDATE public.profiles
SET tipo = 'admin', nome = 'Admin Doce & Poesia'
WHERE email = 'admin@docepoesia.com';
