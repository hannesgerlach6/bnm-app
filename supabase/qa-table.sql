CREATE TABLE IF NOT EXISTS qa_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT DEFAULT 'allgemein',
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE qa_entries ENABLE ROW LEVEL SECURITY;

-- Jeder kann veröffentlichte Fragen lesen
CREATE POLICY "qa_read" ON qa_entries FOR SELECT USING (is_published = true);
-- Admin/Office können alles
CREATE POLICY "qa_admin" ON qa_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'office'))
);

-- Seed-Daten
INSERT INTO qa_entries (question, answer, category) VALUES
  ('Was ist die Shahada?', 'Die Shahada (Glaubensbekenntnis) ist der erste Pfeiler des Islam: "Ich bezeuge, dass es keinen Gott gibt außer Allah, und ich bezeuge, dass Muhammad sein Gesandter ist." Sie wird auf Arabisch gesprochen: "Ash-hadu an la ilaha illa Allah, wa ash-hadu anna Muhammadan rasulu Allah."', 'Grundlagen'),
  ('Wie betet man im Islam?', 'Das Gebet (Salah) wird 5 Mal am Tag verrichtet: Fajr (Morgengebet), Dhuhr (Mittagsgebet), Asr (Nachmittagsgebet), Maghrib (Abendgebet) und Isha (Nachtgebet). Vor dem Gebet wird die Waschung (Wudu) durchgeführt.', 'Gebet'),
  ('Was ist Wudu?', 'Wudu ist die rituelle Waschung vor dem Gebet. Man wäscht: 1) Hände (3x), 2) Mund ausspülen (3x), 3) Nase (3x), 4) Gesicht (3x), 5) Unterarme bis Ellbogen (3x), 6) Über den Kopf streichen (1x), 7) Ohren (1x), 8) Füße bis Knöchel (3x).', 'Gebet'),
  ('Was ist Ramadan?', 'Ramadan ist der 9. Monat im islamischen Kalender, in dem Muslime von Sonnenaufgang bis Sonnenuntergang fasten. Es ist einer der 5 Säulen des Islam. Das Fasten (Sawm) umfasst Verzicht auf Essen, Trinken und weitere Dinge.', 'Grundlagen'),
  ('Was ist Halal und Haram?', 'Halal bedeutet "erlaubt" und Haram bedeutet "verboten". Bei Lebensmitteln: Schweinefleisch und Alkohol sind haram. Fleisch muss nach islamischen Regeln geschlachtet werden (Zabiha/Halal-Schlachtung).', 'Alltag'),
  ('Wie konvertiert man zum Islam?', 'Die Konversion (Shahada) erfolgt durch das aufrichtige Aussprechen des Glaubensbekenntnisses vor Zeugen. Es gibt keine komplizierte Zeremonie. Man spricht: "Ash-hadu an la ilaha illa Allah, wa ash-hadu anna Muhammadan rasulu Allah." Danach wird empfohlen, Ghusl (Ganzkörperwaschung) zu vollziehen.', 'Grundlagen'),
  ('Was sind die 5 Säulen des Islam?', '1. Shahada (Glaubensbekenntnis), 2. Salah (Gebet, 5x täglich), 3. Zakat (Almosen, 2.5% des Vermögens), 4. Sawm (Fasten im Ramadan), 5. Hajj (Pilgerfahrt nach Mekka, mindestens 1x im Leben wenn möglich).', 'Grundlagen'),
  ('Muss ich meinen Namen ändern?', 'Nein, eine Namensänderung ist NICHT erforderlich beim Übertritt zum Islam. Viele neue Muslime wählen freiwillig einen islamischen Namen, aber das ist eine persönliche Entscheidung, keine Pflicht.', 'Alltag'),
  ('Wie finde ich eine Moschee in meiner Nähe?', 'Du kannst online nach "Moschee" + deiner Stadt suchen, oder Apps wie "Muslim Pro" oder "IslamicFinder" nutzen. Dein Mentor kann dir auch eine passende Gemeinde in deiner Nähe empfehlen.', 'Alltag'),
  ('Was mache ich, wenn meine Familie nicht einverstanden ist?', 'Das ist eine häufige Herausforderung. Wichtig: Bleib respektvoll und geduldig. Zeige durch gutes Verhalten die positiven Werte des Islam. Dein Mentor und die BNM-Community können dich dabei unterstützen und beraten.', 'Persönliches');
