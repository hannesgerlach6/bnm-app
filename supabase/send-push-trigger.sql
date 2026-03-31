-- Push-Notification Setup für BNM
-- ============================================================
-- SCHRITT 1: Edge Function deployen (Terminal)
--
--   supabase functions deploy send-push --project-ref cufuikcxliwbmyhwlmga
--
-- SCHRITT 2: Database Webhook im Supabase Dashboard einrichten
--   Dashboard → Database → Webhooks → "Create a new hook"
--
--   Hook 1 (Chat-Nachrichten):
--     Name:   push_on_new_message
--     Table:  messages
--     Events: INSERT
--     Type:   Supabase Edge Functions
--     Function: send-push
--
--   Hook 2 (Admin-Nachrichten):
--     Name:   push_on_new_admin_message
--     Table:  admin_messages
--     Events: INSERT
--     Type:   Supabase Edge Functions
--     Function: send-push
--
-- SCHRITT 3: Push-Token-Spalte sicherstellen (nur falls noch nicht vorhanden)
-- (Ist bereits in push_token.sql enthalten)

-- Prüfen ob push_token-Spalte existiert:
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'push_token';
