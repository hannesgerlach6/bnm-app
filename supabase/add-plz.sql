-- PLZ-Feld zu profiles hinzufügen
-- Ermöglicht PLZ-basiertes Radius-Matching im Assign-Screen

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plz TEXT DEFAULT '';
