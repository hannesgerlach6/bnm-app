-- Rizgar-Links: URLs korrigieren + fehlende Einträge hinzufügen
-- Stand: 2026-05-06, Quelle: Feedback BNM Webapp.pdf Abschnitt 4.1

-- 1. Bestehende URLs korrigieren
UPDATE resources
SET url = 'https://docs.google.com/forms/d/1vSlYQxl-b41Ga7EJkbLWlQcVQwbiHl0plUJG-M6c5B8/edit'
WHERE title = 'Retreat';

UPDATE resources
SET url = 'https://register.gotowebinar.com/register/7049438990862193750'
WHERE title = 'Registrierung Bildungswebinar';

-- 2. Neue Links einfügen (alle für Mentor-Bereich)
INSERT INTO resources (title, url, category, visible_to, is_active) VALUES
  ('Frag den Muslim',
   'https://fragdenmuslim.com/',
   'lernmaterial', 'mentors', true),

  ('Neue Muslime Portal',
   'https://iman.ngo/produkt/neue-muslime-portal/',
   'lernmaterial', 'mentors', true),

  ('Alifbaa Kurs',
   'https://register.gotowebinar.com/register/1224091147908314710',
   'lernmaterial', 'mentors', true),

  ('Online Dawah Training',
   'https://iman.ngo/produkt/online-dawah-training/',
   'lernmaterial', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 3',
   'https://attendee.gotowebinar.com/recording/1051758067628693855',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 4',
   'https://attendee.gotowebinar.com/recording/7232742947675182430',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 5',
   'https://attendee.gotowebinar.com/recording/3522970924659344900',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 6',
   'https://attendee.gotowebinar.com/recording/2613923298271199746',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 7',
   'https://attendee.gotowebinar.com/recording/2554476003401926998',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 8',
   'https://attendee.gotowebinar.com/recording/8250714794837506735',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 9',
   'https://attendee.gotowebinar.com/recording/5396727855936936540',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 10',
   'https://attendee.gotowebinar.com/recording/1943259690092791040',
   'video', 'mentors', true),

  ('BNM Webinar-Aufzeichnung 11',
   'https://attendee.gotowebinar.com/recording/3494462789340976811',
   'video', 'mentors', true);
