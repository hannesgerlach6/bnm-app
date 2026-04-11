-- Resource Completions: Mentoren können Ressourcen/Trainings als abgeschlossen markieren
-- Migration #19: 2026-04-11

CREATE TABLE IF NOT EXISTS resource_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, user_id)
);

ALTER TABLE resource_completions ENABLE ROW LEVEL SECURITY;

-- User kann eigene Completions verwalten
CREATE POLICY "Users can manage own completions"
  ON resource_completions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin/Office kann alle Completions sehen
CREATE POLICY "Admin can view all completions"
  ON resource_completions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office')));
