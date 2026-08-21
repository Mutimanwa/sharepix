-- =========================================================
-- 1. CRÉATION DES TABLES
-- =========================================================

-- Table des albums
CREATE TABLE IF NOT EXISTS public.albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- Le code à 8 lettres
  creator_name TEXT DEFAULT 'Anonyme',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des photos
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Le chemin vers l'image dans Supabase Storage
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================================
-- 2. ACTIVATION DE LA SÉCURITÉ (Row Level Security)
-- =========================================================

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 3. RÈGLES DE SÉCURITÉ (POLICIES)
-- =========================================================

-- --- POLITIQUES POUR LES ALBUMS ---

-- Lecture : N'importe qui peut lire un album (la sécurité repose sur le code à 8 lettres qui est secret)
CREATE POLICY "Public read albums" ON public.albums 
  FOR SELECT USING (true);

-- Création : Seul l'utilisateur connecté peut créer un album
CREATE POLICY "Creators can insert albums" ON public.albums 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Modification : Seul le créateur peut modifier son album
CREATE POLICY "Creators can update albums" ON public.albums 
  FOR UPDATE USING (auth.uid() = user_id);

-- Suppression : Seul le créateur peut supprimer son album
CREATE POLICY "Creators can delete albums" ON public.albums 
  FOR DELETE USING (auth.uid() = user_id);


-- --- POLITIQUES POUR LES PHOTOS ---

-- Lecture : N'importe qui peut voir les photos d'un album (si il a le code)
CREATE POLICY "Public read photos" ON public.photos 
  FOR SELECT USING (true);

-- Ajout : On ne peut ajouter une photo QUE si on est le créateur de l'album parent
CREATE POLICY "Album creators can insert photos" ON public.photos 
  FOR INSERT WITH CHECK (
    album_id IN (SELECT id FROM public.albums WHERE user_id = auth.uid())
  );

-- Suppression : On ne peut supprimer une photo QUE si on est le créateur de l'album parent
CREATE POLICY "Album creators can delete photos" ON public.photos 
  FOR DELETE USING (
    album_id IN (SELECT id FROM public.albums WHERE user_id = auth.uid())
  );