-- ============================================================
-- BNM: Mentor Self-Assignment & Abbruch-Grund Migration
-- ============================================================
-- Ausführen in Supabase SQL Editor (einmalig)

-- 1. cancel_reason Spalte zur mentorships-Tabelle hinzufügen
--    (wird für den Abbruch-Flow mit Pflichtfeld benötigt)
ALTER TABLE mentorships
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2. cancelled_at Spalte sicherstellen (falls noch nicht vorhanden)
ALTER TABLE mentorships
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 3. pending_approval Status: kein ENUM — mentorships.status ist TEXT
--    Bereits mit fix-pending-approval.sql kompatibel.
--    Kein weiterer Schritt nötig.

-- Überprüfung:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'mentorships'
-- ORDER BY ordinal_position;
