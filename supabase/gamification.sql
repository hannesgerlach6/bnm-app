-- ============================================================
-- GAMIFICATION: XP, Levels, Achievements, Streaks, Danke
-- ============================================================

-- XP-Log: Jede XP-Transaktion wird geloggt
CREATE TABLE IF NOT EXISTS xp_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL, -- z.B. "session_documented", "mentorship_completed", "feedback_5star", "streak_day"
  related_id TEXT, -- z.B. session_id oder mentorship_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL, -- z.B. "first_completion", "marathon", "punctual_30"
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_key)
);

-- Danke-System
CREATE TABLE IF NOT EXISTS thanks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id UUID NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_type_id UUID, -- optional: nach welcher Session
  message TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streaks: Täglicher Check
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- XP-Feld zum User-Profil hinzufügen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mentor_level TEXT DEFAULT 'bronze';

-- RLS
ALTER TABLE xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE thanks ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- XP: Jeder kann eigene sehen, Admin alle
CREATE POLICY "xp_select" ON xp_log FOR SELECT USING (
  user_id = auth.uid() OR
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'office')
);
CREATE POLICY "xp_insert" ON xp_log FOR INSERT WITH CHECK (true);

-- Achievements: Jeder kann eigene sehen, Admin alle
CREATE POLICY "achievements_select" ON achievements FOR SELECT USING (
  user_id = auth.uid() OR
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'office')
);
CREATE POLICY "achievements_insert" ON achievements FOR INSERT WITH CHECK (true);

-- Thanks: Mentee kann senden, Mentor + Admin kann sehen
CREATE POLICY "thanks_select" ON thanks FOR SELECT USING (
  mentor_id = auth.uid() OR mentee_id = auth.uid() OR
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'office')
);
CREATE POLICY "thanks_insert" ON thanks FOR INSERT WITH CHECK (
  mentee_id = auth.uid()
);

-- Streaks: Eigene sehen, Admin alle
CREATE POLICY "streaks_select" ON streaks FOR SELECT USING (
  user_id = auth.uid() OR
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'office')
);
CREATE POLICY "streaks_upsert" ON streaks FOR ALL USING (
  user_id = auth.uid() OR
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'office')
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE xp_log;
ALTER PUBLICATION supabase_realtime ADD TABLE thanks;
