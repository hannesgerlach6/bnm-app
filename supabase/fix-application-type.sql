-- ============================================================
-- mentor_applications: application_type-Spalte hinzufügen (2026-05-05)
-- Unterscheidet sauber zwischen Mentor-Bewerbungen und Mentee-Anmeldungen,
-- statt auf fragilen Freitext-Vergleich über motivation-Feld zu setzen.
-- ============================================================

ALTER TABLE mentor_applications
  ADD COLUMN IF NOT EXISTS application_type TEXT NOT NULL DEFAULT 'mentor';

-- Bestehende Mentee-Anmeldungen markieren (alte motivation-basierte Erkennung)
UPDATE mentor_applications
SET application_type = 'mentee'
WHERE motivation = 'Anmeldung als neuer Muslim (öffentliches Formular)'
  AND application_type = 'mentor';
