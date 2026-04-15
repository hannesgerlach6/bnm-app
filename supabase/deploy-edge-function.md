# Edge Function Deployment

## Voraussetzungen
- Supabase CLI installiert: `npm install -g supabase`
- Eingeloggt: `supabase login`

## Secrets setzen
```bash
supabase secrets set RESEND_API_KEY=re_NEUER_KEY_HIER --project-ref cufuikcxliwbmyhwlmga
```

## Deployen
```bash
supabase functions deploy send-emails --project-ref cufuikcxliwbmyhwlmga
```

## Testen
```bash
curl -X POST https://cufuikcxliwbmyhwlmga.supabase.co/functions/v1/send-emails \
  -H "Authorization: Bearer SUPABASE_ANON_KEY"
```

## Automatisch per Cron (alle 5 Minuten)
- Supabase Dashboard → Database → Extensions → pg_cron aktivieren
- SQL ausführen:

```sql
SELECT cron.schedule('send-emails', '*/5 * * * *', $$
  SELECT net.http_post(
    'https://cufuikcxliwbmyhwlmga.supabase.co/functions/v1/send-emails',
    '{}',
    '{"Authorization": "Bearer SUPABASE_ANON_KEY"}'
  );
$$);
```

## Hinweise
- `override_to` in der email_queue-Tabelle leitet alle Mails um (z.B. an hasan.sevenler@partner.ki für Tests)
- Die Funktion verarbeitet max. 50 Mails pro Aufruf
- Fehlgeschlagene Mails werden mit Status "failed" markiert und können manuell neu versucht werden
