-- Migration: Einführungsvideos für Mentees
-- Fügt "video" als Ressourcen-Kategorie ein und legt Beispiel-Videos an.
-- Im Supabase Dashboard → SQL Editor ausführen.

-- Beispiel-Einführungsvideos (Admin kann diese im Resources-Screen anpassen/ergänzen)
INSERT INTO resources (title, url, description, icon, category, sort_order, is_active, visible_to)
VALUES
  (
    'Willkommen im BNM-Programm',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Eine kurze Einführung in das Betreuungsprogramm – was dich erwartet und wie es abläuft.',
    'play-circle-outline',
    'video',
    1,
    true,
    'mentees'
  ),
  (
    'Dein erstes Treffen mit dem Mentor',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Tipps und Hinweise für das erste Gespräch mit deinem Mentor.',
    'play-circle-outline',
    'video',
    2,
    true,
    'mentees'
  ),
  (
    'Die 5 Säulen des Islam – Überblick',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'Eine verständliche Einführung in die Grundlagen des islamischen Glaubens.',
    'play-circle-outline',
    'video',
    3,
    true,
    'mentees'
  )
ON CONFLICT DO NOTHING;
