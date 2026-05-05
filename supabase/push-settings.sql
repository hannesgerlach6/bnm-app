-- Push-Benachrichtigungs-Einstellungen (Admin-steuerbar)
-- Fügt globale Push-Toggles in app_settings ein.
-- Admin kann diese im Settings-Screen aktivieren/deaktivieren.
-- send-push Edge Function prüft diese vor dem Versand.

INSERT INTO app_settings (key, value) VALUES
  ('push_chat_messages',   'true'),
  ('push_assignments',     'true'),
  ('push_calendar',        'true'),
  ('push_reminders',       'true'),
  ('push_system',          'true'),
  -- Sentry DSN: leer lassen = Sentry deaktiviert, DSN eintragen = aktiv
  ('sentry_dsn',           '')
ON CONFLICT (key) DO NOTHING;
