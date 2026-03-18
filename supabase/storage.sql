-- ============================================================
-- BNM App – Supabase Storage: Avatar-Bucket
-- Ausführen im Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- Storage Bucket für Avatare erstellen
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Policy: Jeder authentifizierte User kann sein eigenes Bild hochladen
CREATE POLICY "avatar_upload" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Jeder kann Avatare lesen (public)
CREATE POLICY "avatar_read" ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: User kann eigenes Bild updaten
CREATE POLICY "avatar_update" ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: User kann eigenes Bild löschen
CREATE POLICY "avatar_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
