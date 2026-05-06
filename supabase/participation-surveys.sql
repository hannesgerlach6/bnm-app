-- Teilnahmeabfragen fuer Mentees
-- Migration #27: 2026-05-06

CREATE TABLE IF NOT EXISTS participation_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  survey_date DATE,
  visible_to TEXT NOT NULL DEFAULT 'all' CHECK (visible_to IN ('all', 'male', 'female')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE participation_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active surveys"
  ON participation_surveys FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Admin and office can view all surveys"
  ON participation_surveys FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office')));

CREATE POLICY "Admin and office can manage surveys"
  ON participation_surveys FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office')));

-- Antworten auf Teilnahmeabfragen
CREATE TABLE IF NOT EXISTS participation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES participation_surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes', 'maybe', 'no')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(survey_id, user_id)
);

ALTER TABLE participation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own responses"
  ON participation_responses FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin and office can view all responses"
  ON participation_responses FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office')));
