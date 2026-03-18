-- ============================================================
-- BNM Web-App – Datenbank-Migration
-- Ausführen im Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. CUSTOM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'office', 'mentor', 'mentee');
CREATE TYPE gender_type AS ENUM ('male', 'female');
CREATE TYPE mentorship_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE contact_preference AS ENUM ('whatsapp', 'phone', 'email', 'telegram');

-- 2. PROFILES TABLE (extends Supabase Auth)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'mentee',
  gender gender_type NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  age INTEGER NOT NULL DEFAULT 0,
  phone TEXT DEFAULT '',
  contact_preference contact_preference DEFAULT 'whatsapp',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Geschlechtertrennung
CREATE INDEX idx_profiles_gender ON profiles(gender);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_city ON profiles(city);

-- 3. SESSION TYPES (Admin-konfigurierbar)
-- ============================================================

CREATE TABLE session_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  allows_multiple BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standard-Session-Typen einfügen
INSERT INTO session_types (name, description, sort_order, is_default, allows_multiple) VALUES
  ('Registrierung', 'Neuer Muslim registriert sich im System', 1, true, false),
  ('Zuweisung', 'Mentor wird zugewiesen', 2, true, false),
  ('Erstkontakt', 'Mentor kontaktiert Mentee zum ersten Mal', 3, true, true),
  ('Ersttreffen', 'Persönliches oder Online-Treffen', 4, true, false),
  ('BNM-Box', 'Übergabe der Geschenkbox', 5, true, false),
  ('Wudu-Session', 'Gebetswaschung lehren', 6, true, true),
  ('Salah-Session', 'Gebet lehren (Theorie + Praxis)', 7, true, true),
  ('Koran-Session', '5 Suren: Al-Fatiha, Al-Kawthar, Al-Ikhlas, Al-Falaq, Al-Nas', 8, true, true),
  ('Community', 'Eingliederung in örtliche Moschee/Community', 9, true, false),
  ('Nachbetreuung', 'Refresher nach Abschluss', 10, true, true);

-- 4. MENTORSHIPS
-- ============================================================

CREATE TABLE mentorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status mentorship_status NOT NULL DEFAULT 'active',
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX idx_mentorships_status ON mentorships(status);

-- 5. SESSIONS
-- ============================================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id UUID NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
  session_type_id UUID NOT NULL REFERENCES session_types(id),
  date DATE NOT NULL,
  is_online BOOLEAN DEFAULT FALSE,
  details TEXT DEFAULT '',
  duration_minutes INTEGER,
  attempt_number INTEGER DEFAULT 1,
  documented_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_mentorship ON sessions(mentorship_id);
CREATE INDEX idx_sessions_type ON sessions(session_type_id);
CREATE INDEX idx_sessions_date ON sessions(date);

-- 6. FEEDBACK
-- ============================================================

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id UUID NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comments TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_mentorship ON feedback(mentorship_id);

-- 7. MESSAGES (Chat)
-- ============================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_id UUID NOT NULL REFERENCES mentorships(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_mentorship ON messages(mentorship_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- 8. MENTOR APPLICATIONS
-- ============================================================

CREATE TABLE mentor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  gender gender_type NOT NULL,
  city TEXT NOT NULL,
  age INTEGER NOT NULL,
  experience TEXT DEFAULT '',
  motivation TEXT DEFAULT '',
  status application_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applications_status ON mentor_applications(status);

-- 9. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'assignment', 'reminder', 'progress', 'message', 'system'
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  read_at TIMESTAMPTZ,
  related_id TEXT, -- ID der verknüpften Entität
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read_at);

-- 10. APP SETTINGS
-- ============================================================

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('mentor_of_month_visible', 'true');

-- 11. HADITHE
-- ============================================================

CREATE TABLE hadithe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_de TEXT NOT NULL,
  source TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO hadithe (text_de, source, sort_order) VALUES
  ('Die besten unter euch sind diejenigen, die den Quran lernen und lehren.', 'Sahih al-Bukhari', 1),
  ('Wer einen Weg einschlägt, um Wissen zu erlangen, dem erleichtert Allah einen Weg zum Paradies.', 'Sahih Muslim', 2),
  ('Keiner von euch glaubt wirklich, bis er für seinen Bruder wünscht, was er für sich selbst wünscht.', 'Sahih al-Bukhari & Muslim', 3),
  ('Die Religion ist Aufrichtigkeit.', 'Sahih Muslim', 4),
  ('Lächle deinen Bruder an – es ist eine Sadaqa.', 'At-Tirmidhi', 5),
  ('Wer an Allah und den Jüngsten Tag glaubt, soll Gutes sprechen oder schweigen.', 'Sahih al-Bukhari & Muslim', 6),
  ('Der Starke ist nicht der, der andere niederringt, sondern der, der sich in der Wut beherrscht.', 'Sahih al-Bukhari', 7),
  ('Allah ist barmherzig zu denen, die barmherzig zu anderen sind.', 'At-Tirmidhi', 8),
  ('Macht es leicht und macht es nicht schwer, und gebt frohe Botschaft und schreckt nicht ab.', 'Sahih al-Bukhari', 9),
  ('Das Gebet ist die Säule der Religion.', 'At-Tabarani', 10);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Alle Tabellen RLS aktivieren
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hadithe ENABLE ROW LEVEL SECURITY;

-- Helper: Rolle des aktuellen Users
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: Geschlecht des aktuellen Users
CREATE OR REPLACE FUNCTION get_user_gender()
RETURNS gender_type AS $$
  SELECT gender FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
-- Admin/Office: Alle sehen
-- Mentor/Mentee: Nur gleiches Geschlecht + eigenes Profil
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  get_user_role() IN ('admin', 'office')
  OR id = auth.uid()
  OR gender = get_user_gender()
);

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (
  id = auth.uid()
);

CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (
  id = auth.uid() OR get_user_role() IN ('admin', 'office')
);

-- SESSION TYPES
-- Jeder kann lesen, nur Admin kann ändern
CREATE POLICY "session_types_select" ON session_types FOR SELECT USING (true);
CREATE POLICY "session_types_admin" ON session_types FOR ALL USING (
  get_user_role() = 'admin'
);

-- MENTORSHIPS
-- Admin/Office: Alle sehen
-- Mentor: Nur eigene (als Mentor)
-- Mentee: Nur eigene (als Mentee)
CREATE POLICY "mentorships_select" ON mentorships FOR SELECT USING (
  get_user_role() IN ('admin', 'office')
  OR mentor_id = auth.uid()
  OR mentee_id = auth.uid()
);

CREATE POLICY "mentorships_insert" ON mentorships FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'office')
  OR mentor_id = auth.uid()
);

CREATE POLICY "mentorships_update" ON mentorships FOR UPDATE USING (
  get_user_role() IN ('admin', 'office')
  OR mentor_id = auth.uid()
);

-- SESSIONS
-- Sichtbar wenn Mentorship sichtbar
CREATE POLICY "sessions_select" ON sessions FOR SELECT USING (
  get_user_role() IN ('admin', 'office')
  OR mentorship_id IN (
    SELECT id FROM mentorships WHERE mentor_id = auth.uid() OR mentee_id = auth.uid()
  )
);

CREATE POLICY "sessions_insert" ON sessions FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'office')
  OR documented_by = auth.uid()
);

-- FEEDBACK
CREATE POLICY "feedback_select" ON feedback FOR SELECT USING (
  get_user_role() IN ('admin', 'office')
  OR submitted_by = auth.uid()
);

CREATE POLICY "feedback_insert" ON feedback FOR INSERT WITH CHECK (
  submitted_by = auth.uid() OR get_user_role() IN ('admin', 'office')
);

-- MESSAGES
-- Nur Teilnehmer der Mentorship
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  mentorship_id IN (
    SELECT id FROM mentorships WHERE mentor_id = auth.uid() OR mentee_id = auth.uid()
  )
  OR get_user_role() IN ('admin', 'office')
);

CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
);

-- MENTOR APPLICATIONS
CREATE POLICY "applications_select" ON mentor_applications FOR SELECT USING (
  get_user_role() IN ('admin', 'office')
);

CREATE POLICY "applications_insert" ON mentor_applications FOR INSERT WITH CHECK (true);

CREATE POLICY "applications_update" ON mentor_applications FOR UPDATE USING (
  get_user_role() IN ('admin', 'office')
);

-- NOTIFICATIONS
-- Nur eigene
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (
  user_id = auth.uid()
);

CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (
  user_id = auth.uid()
);

-- APP SETTINGS
CREATE POLICY "settings_select" ON app_settings FOR SELECT USING (true);
CREATE POLICY "settings_update" ON app_settings FOR UPDATE USING (
  get_user_role() = 'admin'
);

-- HADITHE
CREATE POLICY "hadithe_select" ON hadithe FOR SELECT USING (true);
CREATE POLICY "hadithe_admin" ON hadithe FOR ALL USING (
  get_user_role() = 'admin'
);

-- ============================================================
-- AUTO-TRIGGER: Profil bei User-Registrierung erstellen
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role, gender, city, age)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'mentee'),
    COALESCE((NEW.raw_user_meta_data->>'gender')::gender_type, 'male'),
    COALESCE(NEW.raw_user_meta_data->>'city', ''),
    COALESCE((NEW.raw_user_meta_data->>'age')::integer, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- AUTO-TRIGGER: updated_at aktualisieren
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- REALTIME aktivieren für Chat
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================================
-- FERTIG! Alle Tabellen, Policies und Trigger erstellt.
-- ============================================================
