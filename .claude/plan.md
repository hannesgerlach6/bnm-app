# Plan: Account-Löschen für Mentoren & Mentees

## Problem
- `profiles` hat `ON DELETE CASCADE` von `auth.users`
- `mentorships` hat `ON DELETE CASCADE` von `profiles`
- Wenn auth.users gelöscht wird → Profile weg → ALLE Mentorships weg → Reports kaputt

## Lösung: Soft-Delete (Anonymisieren + Sperren)

Statt den Auth-User zu löschen, wird der Account **deaktiviert und anonymisiert**. So bleiben alle completed Mentorships + Sessions erhalten.

### Schritt 1: Neue SQL-Funktion `delete_own_account()`

Neue Datei `supabase/fix-self-delete.sql`:

- `SECURITY DEFINER` (läuft als DB-Owner)
- Nur für eigenen Account (`auth.uid()`)
- Nur Mentoren und Mentees (Admin/Office ausgeschlossen)
- Ablauf:
  1. Completed Mentorships: `mentor_id` oder `mentee_id` auf NULL setzen (je nachdem welche Rolle)
  2. Aktive/Pending Mentorships + deren Sessions/Messages/Feedback löschen
  3. Profil anonymisieren: name='[Gelöscht]', email='', phone=NULL, etc., `is_active=FALSE`
  4. Auth-User sperren via `banned_until = '9999-12-31'` (statt DELETE → kein CASCADE!)
  5. Notifications des Users löschen

### Schritt 2: UI-Button in `settings.tsx`

- Neue Sektion "Gefahrenzone" am Ende der ScrollView (vor Footer)
- Roter "Konto löschen"-Button mit Bestätigungsdialog
- Nur für Mentoren und Mentees sichtbar (nicht Admin/Office)
- Nach Bestätigung: RPC aufrufen → Logout

### Schritt 3: `handleDeleteAccount()` in settings.tsx erweitern

- Bestehende Stub-Funktion mit echtem `supabase.rpc('delete_own_account')` verbinden
- Fehlerbehandlung hinzufügen
- Nach Erfolg: `logout()` aufrufen

### Dateien die geändert werden

1. **NEU:** `supabase/fix-self-delete.sql` — RPC-Funktion
2. **EDIT:** `app/settings.tsx` — Button + Handler
3. **EDIT:** `CLAUDE.md` — SQL-Datei in Migration-Liste aufnehmen
