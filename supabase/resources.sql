-- Resources-Tabelle: Links/Ressourcen fuer Mentoren-Dashboard
-- Migration #17: 2026-04-10

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'link-outline',
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  visible_to TEXT NOT NULL DEFAULT 'all' CHECK (visible_to IN ('all', 'mentors', 'mentees', 'male', 'female')),
  visible_until TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Jeder kann aktive Ressourcen lesen
CREATE POLICY "Anyone can read active resources"
  ON resources FOR SELECT
  USING (is_active = true);

-- Nur Admin kann Ressourcen verwalten
CREATE POLICY "Admin can manage resources"
  ON resources FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
