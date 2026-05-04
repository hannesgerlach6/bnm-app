-- Push-Notification Webhooks
-- Speichert den Service-Role-Key sicher im Vault und richtet 3 Datenbank-Trigger ein,
-- die bei INSERT die send-push Edge Function via pg_net aufrufen.
--
-- Tabellen:
--   messages         → Chat-Nachrichten  → send-push
--   admin_messages   → Admin-DM          → send-push
--   notifications    → Alle Push-Typen  → send-push

-- ── Service-Role-Key in Vault speichern ──────────────────────────────────────
-- Erst prüfen ob bereits vorhanden, dann upsert:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'send_push_service_role_key'
  ) THEN
    PERFORM vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZnVpa2N4bGl3Ym15aHdsbWdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI1MTUwOSwiZXhwIjoyMDg5ODI3NTA5fQ.xk_8cZG0txFE1Ir6S4voGhTjWZEfxvJ4dBDAS8LGhhg',
      'send_push_service_role_key'
    );
  END IF;
END;
$$;

-- ── private Schema (für interne Trigger-Funktionen) ──────────────────────────
CREATE SCHEMA IF NOT EXISTS private;

-- ── Hilfsfunktion: HTTP POST → send-push ─────────────────────────────────────
CREATE OR REPLACE FUNCTION private.call_send_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  service_key text;
  payload     jsonb;
BEGIN
  -- Key aus Vault lesen
  SELECT decrypted_secret
    INTO service_key
    FROM vault.decrypted_secrets
   WHERE name = 'send_push_service_role_key'
   LIMIT 1;

  IF service_key IS NULL THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'table',  TG_TABLE_NAME,
    'type',   TG_OP,
    'record', row_to_json(NEW)::jsonb
  );

  PERFORM net.http_post(
    url     := 'https://cufuikcxliwbmyhwlmga.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := payload::text
  );

  RETURN NEW;
END;
$$;

-- ── Trigger: messages ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_send_push_messages ON messages;
CREATE TRIGGER trg_send_push_messages
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION private.call_send_push();

-- ── Trigger: admin_messages ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_send_push_admin_messages ON admin_messages;
CREATE TRIGGER trg_send_push_admin_messages
  AFTER INSERT ON admin_messages
  FOR EACH ROW EXECUTE FUNCTION private.call_send_push();

-- ── Trigger: notifications ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_send_push_notifications ON notifications;
CREATE TRIGGER trg_send_push_notifications
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION private.call_send_push();
