# BNM Web-App – Projekt-Gehirn

Automatisch geladen. Immer aktuell halten. Nach jeder Arbeit Fortschritts-Log updaten.
Alle SQL-Änderungen dokumentieren. Selbstständig handeln.

---

## PROJEKT

**BNM – Betreuung neuer Muslime.** Mentoring-Programm für Konvertierte (~40 Mentoren). Zeitrahmen: **~8 Wochen.**

## TECH-STACK

- **Framework:** Expo SDK 55 (React Native) – eine Codebase für Web + iOS + Android
- **Routing:** Expo Router | **Styling:** StyleSheet.create() + COLORS (constants/Colors.ts)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **E-Mail:** Resend API (lib/emailService.ts), Override an hasan.sevenler@partner.ki
- **Repo:** github.com/hsevenlerpartnerki/bnm-app (private)

## SUPABASE

- **URL:** `https://jbuvnmjlvebzknbmzryb.supabase.co`
- **Config:** `lib/supabase.ts`
- **SQL-Dateien für Umzug (Reihenfolge):**
  1. `supabase/migration.sql` — Tabellen, RLS, Seed-Daten
  2. `supabase/storage.sql` — Avatars-Bucket
  3. `supabase/email-queue.sql` — E-Mail-Queue
  4. `supabase/fix-applications.sql` — contact_preference Spalte
  5. `supabase/fix-realtime.sql` — Realtime für profiles + mentorships
  6. `supabase/fix-duplicate-check.sql` — Duplikats-Check Funktion
  7. `supabase/qa-table.sql` — Q&A Tabelle
  8. `supabase/fix-mentorship-notes.sql` — notes-Spalte für Mentorships
  9. `supabase/fix-admin-chat.sql` — Admin darf in Chats schreiben (RLS)
  10. `supabase/fix-profiles-rls.sql` — Admin/Office-Profile für alle sichtbar (Chat-Name-Fix)
  12. Dashboard: Auth → Email → "Confirm email" OFF
  13. Test-User manuell anlegen + Profile-INSERT
  14. `lib/supabase.ts`: URL + Anon Key ändern (2 Zeilen)

## ROLLEN

- **Admin:** Volles Dashboard, System-Settings, Reporting, Zuweisungen
- **Office:** Admin-Ansicht OHNE System-Settings
- **Mentor:** NUR eigene Mentees, **Geschlechtertrennung via RLS**
- **Mentee:** Eigener Fortschritt, Gamification

## BRANDING

iman.ngo-Stil. Dunkelblau (#0A3A5A) + Gold (#EEA71B). `constants/Colors.ts`.
Buttons: borderRadius 5. Cards: borderRadius 8 + Schatten. Logo: `assets/images/bnm-logo.png`.
