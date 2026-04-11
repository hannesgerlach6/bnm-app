-- Event-Participations: Teilnahme-Polling fuer Event-Ressourcen
-- Migration #18: 2026-04-10

CREATE TABLE IF NOT EXISTS event_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'confirmed', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, user_id)
);

ALTER TABLE event_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own participations"
  ON event_participations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can view all participations"
  ON event_participations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office')));
