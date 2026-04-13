-- ============================================================
-- BNM App – Automatische Erinnerungen via pg_cron
-- ============================================================
--
-- VORAUSSETZUNGEN (einmalig im Supabase Dashboard):
--   1. pg_cron aktivieren:  Database → Extensions → pg_cron → Enable
--   2. pg_net aktivieren:   Database → Extensions → pg_net  → Enable
--      (nur für Option B mit Edge Function + Push + E-Mail)
--
-- DEPLOY der Edge Function (einmalig, in Terminal):
--   supabase functions deploy send-reminders --project-ref cufuikcxliwbmyhwlmga
--
-- DANN: SQL unten ausführen (im Supabase SQL-Editor)
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- OPTION A: pg_cron – direktes SQL (nur DB-Notifications)
-- Zuverlässigste Methode, kein pg_net nötig.
-- Täglich 09:00 UTC → Erinnerungen für Mentoren ohne Session seit 3 Tagen.
-- ════════════════════════════════════════════════════════════

SELECT cron.schedule('bnm-reminder-check', '0 9 * * *', $$
  INSERT INTO notifications (user_id, type, title, body, related_id, read)
  SELECT
    m.mentor_id,
    'reminder',
    'Erinnerung: Session dokumentieren',
    'Bitte dokumentiere deine letzte Session mit ' || p.name || '.',
    m.id,
    false
  FROM mentorships m
  JOIN profiles p ON p.id = m.mentee_id
  WHERE m.status = 'active'
  -- Keine Session in den letzten 3 Tagen
  AND NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.mentorship_id = m.id
    AND s.date > NOW() - INTERVAL '3 days'
  )
  -- Noch keine Erinnerung in den letzten 2 Tagen
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = m.mentor_id
    AND n.type = 'reminder'
    AND n.related_id = m.id
    AND n.created_at > NOW() - INTERVAL '2 days'
  );
$$);


-- ════════════════════════════════════════════════════════════
-- OPTION B: pg_cron + Edge Function (DB + Push + E-Mail)
-- Erfordert pg_net Extension + deployete send-reminders Function.
-- Den Job aus Option A vorher entfernen:
--   SELECT cron.unschedule('bnm-reminder-check');
-- Dann diesen Block einkommentieren und ausführen:
-- ════════════════════════════════════════════════════════════

-- SELECT cron.schedule('bnm-reminders-full', '0 9 * * *', $$
--   SELECT net.http_post(
--     url     := 'https://cufuikcxliwbmyhwlmga.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--     ),
--     body    := '{}'::jsonb
--   );
-- $$);
--
-- Vorher den Service-Role-Key als GUC setzen (einmalig in SQL-Editor):
-- ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE';


-- ════════════════════════════════════════════════════════════
-- Jobs verwalten
-- ════════════════════════════════════════════════════════════

-- Aktive Jobs anzeigen:
-- SELECT * FROM cron.job;

-- Job deaktivieren:
-- SELECT cron.unschedule('bnm-reminder-check');
-- SELECT cron.unschedule('bnm-reminders-full');
