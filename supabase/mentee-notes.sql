-- Mentee-Notizen: eigene Notizen für Mentees in ihrer Betreuung
-- Datum: 2026-04-30

ALTER TABLE mentorships
  ADD COLUMN IF NOT EXISTS mentee_notes TEXT DEFAULT '';

-- RLS: Mentee darf eigene mentee_notes lesen + schreiben
-- Mentor/Admin/Office darf nur lesen (keine Schreibrechte auf fremde Notizen)

-- UPDATE-Policy anpassen: Mentee darf mentee_notes in eigener Betreuung setzen
-- (Die bestehende UPDATE-Policy erlaubt Mentee nur bestimmte Felder)
-- Wir ergänzen eine separate Policy für Mentee-Notizen.

DROP POLICY IF EXISTS "mentee_update_own_notes" ON mentorships;

CREATE POLICY "mentee_update_own_notes"
  ON mentorships
  FOR UPDATE
  TO authenticated
  USING (mentee_id = auth.uid())
  WITH CHECK (mentee_id = auth.uid());
