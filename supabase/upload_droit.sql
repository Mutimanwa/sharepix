-- Donne le droit aux utilisateurs connectés (et anonymes) d'uploader dans le bucket
CREATE POLICY "Users can upload photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'album-photos' AND auth.role() = 'authenticated');

-- Donne le droit de lire les photos (normalement géré par "Public bucket", mais par sécurité)
CREATE POLICY "Public read photos" ON storage.objects
FOR SELECT USING (bucket_id = 'album-photos');