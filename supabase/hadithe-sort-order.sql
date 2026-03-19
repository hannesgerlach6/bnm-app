-- Hadithe: sort_order Spalte hinzufügen
-- In Supabase SQL Editor ausführen

ALTER TABLE hadithe ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Bestehende Einträge nummerieren (nach Erstellungsdatum)
UPDATE hadithe
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM hadithe
) sub
WHERE hadithe.id = sub.id;
