-- Migration: Admin/Office-Profile für alle User sichtbar machen
-- Grund: Mentoren/Mentees können Admin-Profile nicht sehen wenn Geschlecht abweicht →
--        Chat zeigt falschen Absendernamen (Fallback statt "Admin")
-- Führe dieses SQL im Supabase Dashboard → SQL Editor aus

DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  -- Admin/Office sehen alle Profile
  get_user_role() IN ('admin', 'office')
  -- Jeder sieht sein eigenes Profil
  OR id = auth.uid()
  -- Gleiche Geschlecht (Geschlechtertrennung für Mentor/Mentee)
  OR gender = get_user_gender()
  -- Admin/Office-Profile sind für alle sichtbar (nötig für Chat-Absendernamen)
  OR role IN ('admin', 'office')
);
