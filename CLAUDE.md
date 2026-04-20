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
- **E-Mail:** Resend API (lib/emailService.ts) — Domain `neuemuslime.com` verifiziert, `noreply@neuemuslime.com` aktiv
- **Web-Hosting:** Vercel → `https://neuemuslime.com` (Custom Domain aktiv)
- **Repo:** github.com/hannesgerlach6/bnm-app (private)

## SUPABASE

- **URL:** `https://cufuikcxliwbmyhwlmga.supabase.co`
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
  11. `supabase/fix-messages-update.sql` — messages UPDATE Policy (markChatAsRead + Badge-Fix)
  12. `supabase/fix-missing-rls.sql` — sessions/notifications/mentorships/profiles Policies
  13. `supabase/fix-self-delete.sql` — Self-Deactivate für Mentor/Mentee (Deaktivierung statt Löschung, Daten bleiben erhalten)
  14. `supabase/feedback-questionnaire.sql` — JSONB answers-Spalte für Feedback-Fragebogen
  15. `supabase/message-templates.sql` — Nachrichtenvorlagen-Tabelle + Seed-Daten
  16. `supabase/resources.sql` — Ressourcen-Tabelle (Links fuer Mentor-Dashboard)
  17. `supabase/events.sql` — Event-Participations-Tabelle (Teilnahme-Polling fuer Event-Ressourcen)
  18. `supabase/resource-completions.sql` — Ressourcen-Abhaken (Mentoren können Trainings als erledigt markieren)
  19. `supabase/calendar.sql` — Kalender-Events + Teilnehmer + Google Calendar Token
  20. `supabase/email-templates.sql` — template_key Spalte + Default E-Mail-Vorlagen (Admin kann E-Mail-Texte aendern)
  21. `supabase/admin-notes.sql` — Admin-Notizen Spalte fuer Profile
  22. `supabase/delete-applications.sql` — DELETE-Policy fuer mentor_applications (Admin/Office)
  23. Dashboard: Auth → Email → "Confirm email" OFF
  13. Test-User manuell anlegen + Profile-INSERT
  14. `lib/supabase.ts`: URL + Anon Key ändern (2 Zeilen)

## ROLLEN

- **Admin:** Volles Dashboard, System-Settings, Reporting, Zuweisungen
- **Office:** Admin-Ansicht OHNE System-Settings
- **Mentor:** NUR eigene Mentees, **Geschlechtertrennung via RLS**
- **Mentee:** Eigener Fortschritt, Gamification

## BRANDING

neuemuslime.com-Stil. Dunkelblau (#0A3A5A) + Gold (#EEA71B). `constants/Colors.ts`.
**Design-Tokens nutzen:** `RADIUS.sm` (Buttons/Inputs), `RADIUS.md` (Cards), `RADIUS.lg` (Modals). `SHADOWS.sm/md/lg` statt hardcoded Shadows. `TYPOGRAPHY.styles.*` für Text. Logo: `assets/images/bnm-logo.png`.

## DESIGN-KOMPONENTEN

- **BNMPressable:** Drop-in für TouchableOpacity — Haptic (iOS), Ripple (Android), Hover+Transition (Web)
- **BNMInput:** Floating Label + Focus-Glow + Error-Shake. Nutzen statt roher TextInputs.
- **Toast:** `useToast().show("msg", "success")` oder automatisch via `showSuccess()`/`showError()`
- **EmptyState:** Icon-Illustration + Titel + Beschreibung + optionaler CTA. Nutzen statt leerer Texte.
- **StatusBadge:** Dot + Label mit konsistentem Farb-Schema (active/pending/completed/cancelled/none/warning/info)
- **FAB:** Floating Action Button mit Speed-Dial. `<FAB actions={[...]} />` für Multi-Actions.
- **Skeleton:** Shimmer-Effekt (LinearGradient) statt Opacity-Pulse. Braucht `expo-linear-gradient`.
- **GlassTabBar:** Custom TabBar mit `expo-blur` Glassmorphism-Effekt.

## SQL-MIGRATIONEN (NEU)

17. `supabase/fix-security-audit.sql` — Security-Audit-Fixes (2026-04-08):
    - Privilege Escalation: handle_new_user() setzt Rolle immer auf 'mentee'
    - XP/Achievements INSERT nur für eigenen User oder Admin
    - Mentorship INSERT nur Admin/Office (kein Self-Assign)
    - E-Mail-Enumeration: anon Grant von check_duplicate_registration entfernt
    - email_queue INSERT nur für authentifizierte User

## EDGE FUNCTIONS (deploy-Status)

| Function | Status | Beschreibung |
|---|---|---|
| `send-emails` | Gebaut, NICHT deployed | E-Mails aus email_queue versenden |
| `send-push` | Gebaut, NICHT deployed | Push bei neuen Chat-Nachrichten |
| `send-direct` | Gebaut, NICHT deployed | Direkter E-Mail-Versand (mit JWT-Auth) |
| `reset-password` | Gebaut, NICHT deployed | Password-Reset Flow |
| `send-reminders` | **NEU, NICHT deployed** | Tägliche Mentor-Erinnerungen (Notifications + Push + E-Mail) |

**Deploy-Befehl:** `supabase functions deploy <name> --project-ref cufuikcxliwbmyhwlmga`

**Für Erinnerungssystem:** Nach Deploy → `supabase/edge-functions.sql` im SQL-Editor ausführen (pg_cron + pg_net Extensions vorher aktivieren)

---

## FORTSCHRITTS-LOG

### 2026-04-16 — Domain-Umzug von bnm.iman.ngo auf neuemuslime.com
**Neue Datei:** `lib/appConstants.ts` — zentrale URLs/E-Mail-Adressen
**Geaenderte Stellen:**
- Code: calendarService (OAuth), emailService (Footer), geocoding (User-Agent), pdfGenerator + certificateService (Branding), settings (Support/Web), register-public (Anti-Extremismus-Link), Legal-Seiten (Impressum + Datenschutz)
- Edge Functions: send-emails, send-direct, send-reminders, reset-password — alle E-Mail-Absender jetzt `noreply@neuemuslime.com`
- Translations: DE/EN/AR/TR — support/datenschutz/info-Mails + Quellenangaben
- **Muss manuell gemacht werden:** Resend-Domain verifizieren, Google OAuth Redirect URI, Supabase Site URL, Edge Functions redeployen

### 2026-04-15 — Mentor setzt Passwort bei Registrierung
**Neuer Flow:**
1. Mentor registriert sich mit eigenem Passwort (register-mentor.tsx)
2. Auth-Account wird sofort erstellt (via supabaseAnon), Profil auf `is_active=false`
3. Mentor kann sich NICHT einloggen (AuthContext prueft is_active)
4. Admin genehmigt Bewerbung → Profil wird auf `role=mentor, is_active=true` gesetzt
5. Mentor kann sich jetzt einloggen — kein temporaeres Passwort, keine Credentials-E-Mail noetig

**Aenderungen:**
- `register-mentor.tsx`: Passwort + Passwort-bestaetigen Felder, signUp via supabaseAnon, is_active=false
- `DataContext.tsx approveApplication`: existingProfile-Pfad setzt is_active=true + laedt frisches Profil
- Alter signUp-Pfad (fuer Bewerbungen ohne Account) bleibt als Fallback erhalten

### 2026-04-15 — Bewerbungen loeschen (Admin)
- Neue SQL-Migration: `supabase/delete-applications.sql` (DELETE-Policy fuer admin/office)
- `DataContext.tsx`: `deleteApplication()` Funktion + Interface
- `applications.tsx`: Loeschen-Button (trash-outline Icon) in ApplicationCard fuer alle Status
- Nur fuer Admin sichtbar, mit Bestaetigungsdialog (showConfirm)
- Ref-Pattern fuer stabilen Handler in FlatList

### 2026-04-15 — Umfassendes Audit: 9 weitere Stale-Closure-Bugs + Doku-URLs
**Systematische Pruefung aller useCallback-Funktionen im Projekt:**
- `cancelMentorship`: Mentorship + Mentor/Mentee + Admins jetzt aus DB statt Closure
- `addFeedback`: Mentorship + Submitter aus DB
- `confirmStepAsMentee` / `unconfirmStepAsMentee`: confirmed_steps aus DB
- `toggleEventParticipation` / `toggleResourceCompletion`: Existing-Check via DB-Query
- `sendAdminDirectMessage` / `sendAdminMessage` / `replyToAdmin`: authUser direkt statt users.find()
- `applications.tsx`: isApprovingRef zeigt jetzt Feedback statt silent return
- CLAUDE.md + deploy-edge-function.md + Release-Anleitung: Supabase-URL von altem Projekt auf aktives korrigiert

### 2026-04-15 — Stale-Closure-Bugs bei Bewerbungs-/Mentorship-Genehmigung
**Kern-Problem:** `approveApplication`, `approveMentorship`, `rejectMentorship` lasen Daten aus veralteten useCallback-Closures. Beim ersten Klick auf "Annehmen" passierte nichts (kein Account, keine E-Mail), erst nach Seiten-Refresh funktionierte es.
**Root Cause:** `useCallback` Dependencies enthielten `applications`/`mentorships` Arrays — diese Closures waren beim ersten Klick oft leer oder veraltet.
**Fixes:**
- `approveApplication`: Bewerbungsdaten jetzt direkt aus DB (`mentor_applications` SELECT) statt aus Closure
- `approveMentorship`: Mentorship + Mentor/Mentee-Profile aus DB laden statt aus `mentorships.find()`
- `rejectMentorship`: Mentorship-Daten aus DB laden, `mentorships` aus Deps entfernt
- `rejectApplication`: `applications` aus Dependency-Array entfernt (war nie benutzt)
- `applications.tsx`: Ref-Pattern fuer stabile Handler in FlatList `renderItem` (verhindert stale closures)
- `applications.tsx`: `extraData` + `removeClippedSubviews=false` fuer zuverlaessiges Re-Rendering

### 2026-04-15 — Race Condition Fix + PLZ + Passwort-Reset
**Race Condition bei Navigation (8 Stellen gefixt):**
- `showSuccess(msg, () => router.back())` Pattern entfernt — verursachte Haenger
- Problem: Toast-Pfad rief `router.back()` sofort, Komponente unmountete vor `finally`-Block
- Fix: Navigation immer NACH `finally`-Block, Loading-State wird sauber zurueckgesetzt
- Betroffene Dateien: edit-user.tsx (2x), mentorship/[id].tsx (2x), edit-profile.tsx, document-session.tsx (2x), notification-settings.tsx, reset-password.tsx

**PLZ-Feld bei Mentor-Registrierung (register-mentor.tsx):**
- Label "PLZ" → "PLZ *" (Stern fuer Pflichtfeld)
- Placeholder "z.B. 10115" hinzugefuegt
- Container breiter: `width: 120` → `minWidth: 130, maxWidth: 160`

**Passwort-Reset Link "abgelaufen" (Edge Function + reset-password.tsx):**
- Edge Function: action_link direkt verwenden statt Token manuell extrahieren
- Problem: `verifyOtp()` mit extrahiertem Token war unzuverlaessig
- Fix: Supabase verifiziert Token serverseitig und redirected mit Session-Hash
- Neuer "Neuen Link anfordern"-Button bei abgelaufenem Link
- Translation-Key `resetPassword.requestNewLink` in 4 Sprachen
- **WICHTIG: Edge Function muss neu deployed werden!**

### 2026-04-14 — Mentor-Statistiken + Admin-Notizen
**Feature N4: Mentor Self-Statistiken (index.tsx - MentorDashboard):**
- Neue "Meine Statistiken"-Sektion mit 3x2 Stat-Grid (nach Gamification, vor Termine)
- 6 Kennzahlen: Abgeschlossene/Aktive Betreuungen, Sessions, Durchschnittsbewertung, Ranking, Gesamt-Mentoren
- Nutzt bestehende mentorStats + avgRating (kein neuer DB-Call)

**Feature N5: Admin-Notizen bei Mentees/Mentoren:**
- Neue Spalte `admin_notes TEXT` in profiles (`supabase/admin-notes.sql`)
- `types/index.ts`: `admin_notes?: string` im User Interface
- `contexts/DataContext.tsx`: mapProfile mappt admin_notes, updateUser erlaubt admin_notes
- `app/admin/edit-user.tsx`: Multiline-Textarea "Admin-Notizen" (nur fuer Admin sichtbar), wird mit Profil gespeichert
- `components/MenteeDetailPanel.tsx`: Admin-Notizen-Sektion mit "Notizen bearbeiten"-Link
- `components/MentorDetailPanel.tsx`: Admin-Notizen-Sektion mit "Notizen bearbeiten"-Link

### 2026-04-14 — Betreuungs-Dauer fuer Admin (Wochen-Anzeige + Ueberfaellig-Warnung)
**Mentee-Liste (mentees.tsx):**
- `getMentorshipDuration()` Helper: Berechnet Wochen/Tage seit assigned_at
- Farbcodierter Chip bei aktiven Betreuungen: gruen (<=8 Wo), gold (8-12 Wo), rot (>12 Wo)
- Anzeige "Betreuung: seit X Wochen" im AdminMenteesView renderItem

**Mentorship-Detail ([id].tsx):**
- Dauer-Zeile nach Status-Badge (nur Admin/Office sichtbar)
- Aktiv: "Dauer: X Wochen (seit dd.MM.yyyy)"
- Abgeschlossen: "Dauer: X Wochen (abgeschlossen am dd.MM.yyyy)"
- Gleiche Farbcodierung wie Mentee-Liste
- Ionicons Import ergaenzt fuer time-outline Icon

**Admin-Dashboard (index.tsx):**
- Neuer `overdueMentorships` useMemo: Filtert aktive Betreuungen >12 Wochen
- Rote Warn-Box "Ueberfaellige Betreuungen" mit Count-Badge
- Liste: Mentor → Mentee mit Wochen-Anzeige, klickbar zur Mentorship-Detail
- Erscheint VOR den bestehenden Betreuungs-Warnungen

### 2026-04-13 — E-Mail-Vorlagen aus DB (Admin-verwaltbar)
**Integration Admin-Templates in emailService:**
- Neue Spalte `template_key` in `message_templates` (systeminterner Schluessel)
- 7 Default E-Mail-Vorlagen geseeded (welcome_mentor, rejection, interview_invitation, webinar_invitation, feedback_request, mentorship_cancelled, mentor_assigned)
- Neue Funktion `getEmailTemplate()` in emailService.ts: Laedt Template aus DB, parsed "Betreff: ...\n---\n..." Format, ersetzt Platzhalter
- 7 Send-Funktionen aktualisiert: DB-Template zuerst, Fallback auf hardcoded HTML
- Admin-UI: template_key als Badge angezeigt (read-only, zeigt welche Systemfunktion das Template nutzt)
- types/index.ts: `template_key?: string` zu MessageTemplate hinzugefuegt
- DataContext: template_key wird jetzt gemapped
- SQL-Migration: `supabase/email-templates.sql`

### 2026-04-10 — Feedback-Umsetzung (21 Punkte aus User-Tests)

**Phase 1: Bug-Fixes & Quick Wins:**
- Logout-Performance: signOut() fire-and-forget auf Web, sofort redirect
- PLZ-Tool: Auto-Geocoding bei approveApplication + CSV-Import, manueller Button entfernt
- Monatsbericht geprüft (funktioniert, war Wartungsfenster)

**Phase 2: UI-Erweiterungen:**
- Mentee-Liste: Gender-Tabs (Brüder/Schwestern/Alle) + Sort "Anmeldedatum"
- Mentor-Profil: Kontaktdaten-Sektion (E-Mail, Telefon, PLZ, Kontaktpräferenz)
- Session-Typen: Edit-Button mit Inline-Bearbeitung (Name + Beschreibung)
- Abbruch-Datum: Rote Info-Box in Mentorship-Detail
- Leaderboard: Gold-Banner "Du bist auf Platz X" + eigene Zeile hervorgehoben
- Abgebrochene Betreuungen: "Abgebrochen"-Filter + Datum/Grund in Liste
- User-Löschung: Prominenter Soft-Delete + Hard-Delete (Admin, doppelte Bestätigung)
- Archiv-Liste: "Archiv"-Filter in Mentees + Mentoren mit Reaktivieren-Button
- Mentorship-Typ: cancelled_at + cancel_reason zu TypeScript-Interface

**Phase 3: Neue Features:**
- Auto-Feedback bei Abbruch: sendFeedbackRequestEmail + Notification + neue E-Mail an Mentee
- Office-Rechte: Kein CSV-Import, keine Bewerbungs-Genehmigung
- Sitzungsnotizen: Aufklappbare Notizen in Mentorship-Detail
- Feedback-Statistiken: Durchschnitt, Verteilung, Trend, häufigste Themen
- Bewerbungs-Statistiken: Counts, Annahmequote, Geschlechterverteilung
- Bewerbungs-Buttons: "Zum Gespräch einladen" + "Zum Webinar einladen"
- E-Mail-Vorlagen: Tab-System Chat/E-Mail mit Betreff + Platzhaltern
- Ressourcen-Verwaltung: Admin-CRUD + Mentor-Dashboard-Karten (neue DB: resources)
- Event-Teilnahme: Teilnehmen-Toggle + Admin-Teilnehmerliste (neue DB: event_participations)
- Chat-Weiterleitung: Long-Press → Weiterleiten an andere Mentorship-Chats
- Mentee-Reminder: Feedback-Erinnerung + Session-fällig-Erinnerung
- Activity-Log: Detailliert mit Typ-/Zeitraum-Filtern

### 2026-04-10 — Mentee-Reminders + Admin Activity Log
**Mentee-Reminders (lib/reminders.ts):**
- Neue Funktion `checkMenteeReminders()` neben bestehendem `checkReminders()`
- Feedback-Erinnerung: Wenn Betreuung completed/cancelled und kein Feedback vom Mentee → Notification
- Session-fällig-Erinnerung: Aktive Betreuung + letzte Session >7 Tage → "Deine nächste Session steht an"
- Cooldown + Duplikat-Check wie bei Mentor-Reminders (5 Tage Cooldown, ungelesene nicht doppelt)
- Integration in DataContext.tsx: Wird in loadAllData aufgerufen (parallel zu Mentor-Reminders)

**Admin Activity Log (app/(tabs)/index.tsx - AdminDashboard):**
- Bisherige "letzte 5 Sessions" durch umfassendes Aktivitäten-Log ersetzt
- Aggregiert aus: Sessions, Zuweisungen, Abschlüsse/Abbrüche, Feedback
- Filter-Chips: "Alle" / "Sessions" / "Zuweisungen" / "Abschlüsse" / "Feedback"
- Zeitraum-Filter: "7 Tage" / "30 Tage" / "Alles"
- Farbcodierte Icons: Sessions=blau, Zuweisungen=gold, Abschlüsse=grün, Abbrüche=rot, Feedback=amber
- Pagination: 20 Einträge, "Mehr anzeigen" / "Weniger anzeigen"
- Keine neue DB-Tabelle, alles aus bestehenden Daten aggregiert

### 2026-04-10 — Event-Participation + Chat-Weiterleitung
**Event-Participation-Polling (4.2.1):**
- Neue DB-Tabelle: `supabase/events.sql` (event_participations mit resource_id, user_id, status)
- RLS: User verwaltet eigene Teilnahmen, Admin/Office sieht alle
- `types/index.ts`: EventParticipation + EventParticipationStatus Interfaces
- `contexts/DataContext.tsx`: eventParticipations State, Laden in loadAllData, toggleEventParticipation/getEventParticipationsByResourceId/getMyEventParticipation
- `app/(tabs)/index.tsx`: MentorDashboard zeigt fuer Event-Ressourcen Teilnehmer-Count + "Teilnehmen"/"Nicht teilnehmen" Toggle
- `app/admin/resources.tsx`: "event" Kategorie hinzugefuegt, Participation-Count + Teilnehmer-Liste bei Event-Ressourcen

**Chat-Nachricht-Weiterleitung (4.3.2):**
- `app/chat/[mentorshipId].tsx`: Long-Press zeigt jetzt "Weiterleiten" + "Loeschen" (eigene) bzw. nur "Weiterleiten" (fremde)
- Forward-Modal mit Liste der anderen Mentorship-Chats des Users
- Weitergeleitete Nachricht mit Prefix "↪ Weitergeleitet von {Name}:\n{Nachricht}"
- Erfolgs-Toast nach Weiterleitung

### 2026-04-10 — E-Mail-Vorlagen + Ressourcen-Verwaltung
**E-Mail-Vorlagen (message-templates.tsx):**
- Tab-Switcher: "Chat-Vorlagen" / "E-Mail-Vorlagen" mit Ionicons
- E-Mail-Vorlagen nutzen "[E-Mail]" Prefix im Titel + "Betreff: ...\n---\n..." Body-Format
- Separates Betreff-Feld + Platzhalter-Hinweise ({name}, {datum}, {mentor_name}, {mentee_name})
- Eigene Kategorien: einladung, absage, willkommen, general
- Anzeige: Betreff wird in Gold unter Titel angezeigt

**Ressourcen-Verwaltung (neu):**
- Neue DB-Tabelle: `supabase/resources.sql` (id, title, url, description, icon, category, sort_order, is_active)
- RLS: Jeder liest aktive Ressourcen, nur Admin verwaltet
- `types/index.ts`: Resource Interface
- `contexts/DataContext.tsx`: resources State, Laden in loadAllData, addResource/updateResource/deleteResource
- `app/admin/resources.tsx`: CRUD-Screen mit Icon-Picker, Kategorie-Chips, Sortierung, Toggle aktiv/inaktiv
- `app/(tabs)/tools.tsx`: "Ressourcen"-Button im Tool-Grid (admin only)
- `app/(tabs)/index.tsx`: "Ressourcen"-Sektion im MentorDashboard mit klickbaren Cards (Icon + Titel + Beschreibung)

### 2026-04-10 — PLZ-Bug-Fix + Account-Deaktivierung statt Löschung
**PLZ-Bug im Web-Registrierungsformular:**
- Stadt-Feld hatte `label="z.B. Berlin"` statt `label="Wohnort / Stadt *"` → User tippte PLZ ins Stadt-Feld
- BNMInput: `placeholder` Prop wird jetzt sichtbar wenn Label oben schwebt (placeholderTextColor war "transparent")
- PLZ-Feld breiter gemacht (minWidth: 130, maxWidth: 160 statt width: 120)
- PLZ-Fehlermeldung gekürzt ("PLZ ungültig (4–5 Ziffern)" statt langer Satz)
- Row-Layout: `alignItems: "flex-start"` für bessere Fehler-Darstellung

**Account-Löschung → Deaktivierung:**
- SQL: `delete_own_account()` → `deactivate_own_account()` (alte Funktion wird gedroppt)
- Keine Daten mehr gelöscht! Mentorships werden auf 'cancelled' gesetzt statt gelöscht
- Name bekommt Suffix "[deaktiviert]" statt Anonymisierung auf "[Gelöscht]"
- E-Mail, Telefon, Stadt bleiben erhalten (nur Avatar wird entfernt)
- Auth-User wird weiterhin gesperrt (banned_until = 9999)
- Admin kann Account jederzeit über "User entsperren" wieder aktivieren
- UI: Button "Konto deaktivieren" statt "Konto löschen"
- Bestätigungsdialog erklärt: Daten bleiben erhalten, Admin kann reaktivieren
- Translations in 4 Sprachen (DE, EN, AR, TR) aktualisiert

### 2026-04-08 — Vollständiges Security- & Code-Audit + Fixes
**Security (7 Fixes):**
- Privilege Escalation in handle_new_user() behoben (Rolle immer 'mentee')
- XP/Achievements INSERT Policies eingeschränkt (user_id = auth.uid())
- Passwort-Änderung: Altes Passwort wird jetzt verifiziert + Catch-Block fixt
- Mentorship INSERT nur noch Admin/Office
- E-Mail-Enumeration verhindert (anon Grant entfernt)
- E-Mail Subject-Injection: sanitizeSubject() für alle Subjects
- Neue SQL-Migration: supabase/fix-security-audit.sql

**Bugs (6 Fixes):**
- Dark-Mode-Erkennung in Skeleton/Toast/StatusBadge gefixt (#0B0F18 → useTheme().isDark)
- Division durch Null in mentorship/[id].tsx behoben
- Doppelte Notifications bei Mentorship-Abschluss/Abbruch entfernt
- Verschluckte Fehler in DataContext (addSessionType, deleteSessionType, addFeedback) → throw Error
- DataContext Generic-Syntax gefixt (<T,> statt <T>) — TSC-Fehler von 1106 auf ~160 reduziert
- edit-profile.tsx: try/catch/finally für handleSave()

**Performance (1 Fix):**
- DataContext Provider value in useMemo gewrapped (verhindert unnötige Re-Renders)

**Performance (2 Fixes):**
- useFocusEffect(refreshData) in 5 Tabs entfernt (17 Queries pro Tab-Wechsel → 0)

**Cleanup:**
- 14 ungenutzte Imports entfernt (Skeleton, Toast, StatusBadge, Avatar, BNMInput, Confetti, DataContext, etc.)
- 6 tote Dateien gelöscht (mockData, SharedStyles, useClientOnlyValue, useColorScheme)

### 2026-04-08 (Teil 2) — UI-Konsistenz-Refactoring
**TouchableOpacity → BNMPressable Migration:**
- Alle 36+ Dateien komplett migriert, 0 TouchableOpacity verbleibend
- Haptic Feedback (iOS), Ripple (Android), Hover+Transition (Web) jetzt überall aktiv

**Hardcoded Farben → SEMANTIC:**
- isDark-Ternaries in ~12 Dateien durch sem(SEMANTIC.xxx, isDark) ersetzt
- Betrifft: redBg/redBorder/redText, greenBg/greenText, amberBg/amberText, blueBg

**Weitere Fixes:**
- CSV-Import: Session-Wiederherstellung jetzt await statt fire-and-forget
- edit-user.tsx: Falscher Error-Text bei Save-Fehler gefixt
- notifications.tsx: Navigation für progress/message Notifications
- feedback.tsx: Doppelte Navigation auf Native behoben
- borderRadius: 100 → RADIUS.full in leaderboard.tsx
- 2 fehlende Translation Keys ergänzt (changePassword.errorFailed, common.noAccess) in 4 Sprachen

### 2026-04-08 (Teil 3) — Security + Performance
**Security:**
- Edge Function send-direct: JWT-Validierung statt nur Anon Key (verhindert unautorisierten E-Mail-Versand)
- emailService.ts: Sendet jetzt User-JWT statt Anon Key als Bearer Token

**Performance:**
- Mentoren-Liste: Stats vorberechnet in useMemo (O(n*m) → O(1) bei Render)
- Chat-Screen: FlatList inverted (Agent, in Arbeit)

**UI/UX:**
- Accessibility Labels für ~9 Admin-Screens (Agent, in Arbeit)
- Hardcoded Shadows → SHADOWS.* Tokens (Agent, in Arbeit)
- AdminMobileDrawer: #EF5350 → COLORS.error

### 2026-04-09 — Performance
- Mentoren-Liste (mentors.tsx): ScrollView + .map() → FlatList mit renderItem, ListHeaderComponent, ListEmptyComponent, keyExtractor

### 2026-04-09 — Hardcoded Farben → COLORS Tokens (StyleSheet.create)
**Neue COLORS-Tokens (constants/Colors.ts):**
- errorLight, errorDark, errorBorder, errorBg, errorBorderLight
- blue, blueLight, blueBorder
- warning, warningDark, warningBorder
- successDark, successBg
- gray, grayLight, grayMuted, grayBorder, divider, goldText

**Ersetzungen in StyleSheet.create() (13 Dateien):**
- reports.tsx: #f59e0b → COLORS.warning
- csv-import.tsx: #b45309 → COLORS.warningDark
- MentorDetailPanel.tsx: #dcfce7 → COLORS.successBg, #15803d → COLORS.successDark, #92600a → COLORS.goldText
- mentor/[id].tsx: #dcfce7 → COLORS.successBg, #15803d → COLORS.successDark, #92600a → COLORS.goldText
- forgot-password.tsx: #f87171 → COLORS.errorBorder, #fef2f2 → COLORS.errorBg, #fecaca → COLORS.errorBorderLight
- mentor-award.tsx: #6B7280 → COLORS.grayMuted, #E5E7EB → COLORS.divider, #D1D5DB → COLORS.grayBorder
- certificate-generator.tsx: #6B7280 → COLORS.grayMuted, #E5E7EB → COLORS.divider, #D1D5DB → COLORS.grayBorder
- mentors.tsx: #ccc → COLORS.grayLight, #666 → COLORS.gray
- mentees.tsx: #ccc → COLORS.grayLight, #666 → COLORS.gray
- assign.tsx: #bfdbfe → COLORS.blueBorder
- session-types.tsx: #fef2f2 → COLORS.errorBg
- pending-approvals.tsx: #fde68a → COLORS.warningBorder
- Confetti.tsx: #3B82F6 → COLORS.blue, #F59E0B → COLORS.warning

### 2026-04-09 — Hardcoded Shadows → SHADOWS Tokens
**Neue SHADOWS-Tokens (constants/Colors.ts):**
- `goldSubtle` — Dezenter Gold-Schimmer (opacity 0.05, radius 12, offset 2) für Level-/Hadith-Cards
- `goldMedium` — Kräftiger Gold-Schatten (opacity 0.18, radius 12, offset 4) für Award-/Zertifikats-Cards
- `glowSoft(color)` — Weicher Farb-Glow (opacity 0.12, radius 6) für Focus-/Error-States

**Ersetzungen (5 Dateien, 6 Stellen):**
- index.tsx: 2x hardcoded Gold-Shadow → SHADOWS.goldSubtle
- mentor-award.tsx: hardcoded Gold-Shadow → SHADOWS.goldMedium + SHADOWS Import ergänzt
- certificate-generator.tsx: hardcoded Gold-Shadow → SHADOWS.goldMedium + SHADOWS Import ergänzt
- BNMInput.tsx: focusGlow + errorGlow → SHADOWS.glowSoft(color) + SHADOWS Import ergänzt

**Nicht ersetzt (bewusst):**
- login.tsx: Hero-Button-Shadow (nur 1x, kein Token nötig)
- index.tsx: Dynamische Shadows mit lvl.color/barColor (nicht tokenisierbar)

### 2026-04-09 — isDark-Ternaries → SEMANTIC Paare (Runde 2)
**Neue SEMANTIC-Paare (constants/Colors.ts):**
- `darkBorder` — { light: "#E2E8F0", dark: "#2A2A35" } (Dark-Mode Border)
- `selectedBg` — { light: "#F0F4FF", dark: "#1E1E2C" } (Selected/Hover Hintergrund)

**Ersetzungen (2 Dateien, 16 Stellen):**
- chats.tsx: 11x `isDark ? "#2A2A35" : themeColors.border` → sem(SEMANTIC.darkBorder, isDark)
- chats.tsx: 4x `isDark ? "#1E1E2C" : "#F0F4FF"` → sem(SEMANTIC.selectedBg, isDark)
- index.tsx: 1x `isDark ? "#2A2A35" : themeColors.border` → sem(SEMANTIC.darkBorder, isDark)

**Nicht konsolidiert (< 3 Vorkommen oder unterschiedliche Light-Werte):**
- `isDark ? "#1A1A2C" : "#f0f4ff"` — nur 1x (faq.tsx)
- `isDark ? "#FFCA28" : "#f59e0b"` — nur 2x (index.tsx)
- `isDark ? "#42A5F5" : COLORS.gradientStart` — nur 1x (index.tsx)
- `isDark ? "#1C1C28" : "#FFFFFF"` — nur 1x (index.tsx)
- `isDark ? "#1A1A24" : ...` — 3x aber mit 3 verschiedenen Light-Werten
- FAB.tsx: Override auf SHADOWS.lg mit dynamischer Farbe (teilweise Token, teilweise dynamisch)
- onboarding.tsx: Override auf SHADOWS.glow (nur shadowOpacity-Anpassung)

### 2026-04-09 — Android-Bugfixes (Runde 1+2)
**Dashboard Stat-Cards (Android Farben):**
- `hexToRgba()`-Helper statt 8-stelliger Hex-Codes (Android rendert `#RRGGBBAA` anders als iOS)
- Icon-Circle Hintergründe, Card-Borders, Highlight-States alle auf `rgba()` umgestellt
- `statAccentBar` hat jetzt eigene `borderTopLeftRadius`/`borderBottomLeftRadius` (für Android Clipping)
- Android nutzt `elevation: 2` direkt statt SHADOWS.sm (vermeidet overflow:hidden Clipping)

**Ranking-Seite:**
- `overflow: "hidden"` für Android aktiviert auf podiumHero

**Chat Tastatur (Android):**
- `KeyboardAvoidingView` behavior: `"height"` statt `"padding"` auf Android
- `keyboardVerticalOffset: 80` auf Android (war 0)
- Fix in 3 Stellen: chats.tsx (2x ChatPanel/AdminDMPanel) + chat/[mentorshipId].tsx

**Vorlagen (Templates) — komplett neuer Ansatz:**
- Hardcoded FALLBACK_TEMPLATES in `constants/fallbackTemplates.ts` (4 Standard-Vorlagen)
- **Template-Bar**: Prominente goldene Leiste über dem Input statt kleinem Icon-Button
- Leiste zeigt "Vorlagen" Text + Icon, nicht zu übersehen
- Fix in beiden Chat-Screens: chats.tsx + chat/[mentorshipId].tsx

**Send-Button Opacity:**
- Disabled-State: `#B0BEC5` (sichtbares Grau) statt `themeColors.border` (fast unsichtbar)
- Active-State: `COLORS.gradientStart` direkt statt `themeColors.primary` (konsistenter auf Android)
- Fix in 3 Stellen: chats.tsx (ChatPanel + AdminDMPanel) + chat/[mentorshipId].tsx

### 2026-04-09 — Gamification-Extraktion aus DataContext
**Refactoring:**
- Neuer `contexts/GamificationContext.tsx` mit eigenem Provider + `useGamification()` Hook
- 4 State-Variablen extrahiert: xpLog, userAchievements, thanks, streak
- 4 Funktionen extrahiert: awardXP, sendThanks, checkAndUnlockAchievements, updateStreak
- Gamification-Daten werden in eigenem useEffect geladen (nicht mehr in loadAllData)
- DataContext kommuniziert via `gamificationRef` (Ref-Pattern) mit GamificationContext
- DataContext bietet `_updateUserXP` Callback für XP-Updates am users-Array
- `app/_layout.tsx`: GamificationProvider innerhalb DataProvider eingefügt
- `app/(tabs)/index.tsx`: MentorDashboard + MenteeDashboard nutzen useGamification()
- Keine anderen Dateien betroffen (Gamification nur in index.tsx konsumiert)

### 2026-04-09 — Android StatCard Shadow-Fix
**Problem:** StatCards auf Android sahen anders aus als auf iOS (matter, grauer, flacher)
**Ursache:** Android bekam nur `elevation: 2`, iOS bekam `SHADOWS.sm` (farbige Schatten). Zusätzlich clippte `overflow: "hidden"` auf demselben View die Android-Elevation.
**Fix:** Wrapper-View Pattern in StatCard:
- Äußere View: `statCard` mit `SHADOWS.sm` (beide Plattformen identisch, kein Platform-Check mehr)
- Innere View: `statCardClip` mit `overflow: "hidden"`, `borderWidth`, `flexDirection: "row"`
- Platform.OS === "android" Check komplett entfernt

### 2026-04-13 — Erinnerungssystem + Dark Mode Fix + Domain
**Erinnerungssystem (server-seitig):**
- Neue Edge Function: `supabase/functions/send-reminders/index.ts`
- Prüft täglich alle aktiven Mentorships auf fehlende Sessions (> 3 Tage)
- Sendet: DB-Notification + Push (Expo) + E-Mail (Resend, `noreply@neuemuslime.com`)
- Cooldown: Keine Doppel-Erinnerung innerhalb 2 Tagen
- `supabase/edge-functions.sql` aktualisiert: pg_cron Job einkommentiert (Option A: SQL-direkt, Option B: pg_net → Edge Function)
- Deployment-Steps: pg_cron + pg_net Extensions aktivieren → SQL ausführen → `supabase functions deploy send-reminders`

**Dark Mode:**
- `app/+not-found.tsx` auf `useThemeColors()` umgestellt (war einzige Datei ohne Dynamic Colors)

**Domain + Hosting:**
- Web: `https://neuemuslime.com` live (Vercel Custom Domain)
- E-Mail: `noreply@neuemuslime.com` via Resend (Domain verifiziert)

### 2026-04-10 — Professionelle PDF-Reports v2 (Komplettes Redesign)
**Vollstaendiger Rewrite von `lib/pdfGenerator.tsx` — von 0.2/10 auf professionelles Niveau:**

**Neue Architektur:**
- `drawCoverPage()` — Professionelles Titelblatt mit Navy-Banner (270px), innerem Rahmen, BNM-Logo, Gold-Akzenten
- `drawProDonutChart()` — Echte Donut-Segmente via SVG-Pfade (statt gestapelter Kreise), mit Luecken zwischen Segmenten + Fallback
- `drawProKpiCard()` + `drawHeroKpiCard()` — KPI-Karten mit Schatten-Effekt, Akzentstreifen, Icon-Kreisen
- `drawMetricRow()` — Abgeleitete Kennzahlen (Sessions/Mentee, Sessions/Mentor, Nachbetreuungs-Rate)
- `drawCardShadow()` — Simulierte Schatten fuer Card-Tiefe
- `drawCoverFooter()` — Spezieller Cover-Footer
- Erweiterte Farbpalette: 28 Farben (navyLight, navyDark, goldLight, goldMuted, teal, coverText, coverSub, shadow, etc.)

**Monatsbericht: 3 → 4 Seiten:**
- S1: Titelblatt mit Navy-Banner + 4 Hero-KPIs (Betreuungen, Sessions, Mentoren, Abschlussquote) + Executive Summary
- S2: KPI-Dashboard (8 Cards mit Schatten) + Betreuungs-Donut (echte Segmente) + Session-Bars + Mentor des Monats + Analyse-Metriken
- S3: Sessions-Balkendiagramm (mit Gitternetz + Y-Achsen-Labels) + Top-5-Mentoren (Fortschrittsbalken) + Abschlussquote-Gauge
- S4: Professionelle Rangliste-Tabelle (20px Kopfzeile, Medaillen, Zebra-Streifen) + Zusammenfassung

**Spenderbericht: 2 → 3 Seiten:**
- S1: Titelblatt "Wirkungsbericht fuer Foerderer" + 4 Hero-KPIs + Executive Summary
- S2: 8 KPI-Cards + Session-Verteilung (vertikale Balken mit Schatten) + Betreuungs-Donut (echte Segmente)
- S3: 4 Impact-Karten (2x2, mit Icon-Kreisen + Akzentstreifen) + Session-Details + Zusammenfassung

**Design-Verbesserungen:**
- Cover-Seiten: Navy-Banner (33% der Seite) mit innerem Rahmen, zentriertem Logo, Gold-Typografie
- Echte Donut-Charts: SVG-Pfad-Polygone approximieren Kreisboegen (6° pro Segment), Luecken zwischen Segmenten
- Card-Schatten: Offset-Rechtecke simulieren Tiefeneffekt
- Erweiterte Typografie: Hero 28pt, KPI 20pt, Section 12pt, Body 9pt, Caption 7pt
- Berechnete Metriken: Sessions/Mentee, Sessions/Mentor, Nachbetreuungsrate, Abschlussquote
- Professionelle Tabelle: Navy-Kopfzeile, Zebra-Streifen, Medaillen-Kreise, abschliessende Navy-Linie
- Footer: "Vertraulich" + neuemuslime.com Branding + Seitenzahlen
- Interfaces bleiben 100% abwaertskompatibel (keine Aenderungen an reports.tsx / donor-report.tsx)
