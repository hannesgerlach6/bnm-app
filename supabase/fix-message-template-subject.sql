-- ============================================================
-- message_templates: subject-Spalte hinzufügen (2026-05-05)
-- Vorher wurde der Betreff in body als "Betreff: ...\n---\n..." gespeichert.
-- Jetzt gibt es eine eigene subject-Spalte für robusteres Parsing.
-- ============================================================

ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT '';

-- Bestehende E-Mail-Vorlagen migrieren: Betreff aus body extrahieren
UPDATE message_templates
SET subject = trim(regexp_replace(
  split_part(body, E'\n---\n', 1),
  '^Betreff:\\s*', ''
))
WHERE title LIKE '[E-Mail]%'
  AND (subject IS NULL OR subject = '')
  AND body LIKE 'Betreff: %';
