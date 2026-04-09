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
- **Repo:** github.com/hannesgerlach6/bnm-app (private)

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
  11. `supabase/fix-messages-update.sql` — messages UPDATE Policy (markChatAsRead + Badge-Fix)
  12. `supabase/fix-missing-rls.sql` — sessions/notifications/mentorships/profiles Policies
  13. `supabase/fix-self-delete.sql` — Self-Delete für Mentor/Mentee (Soft-Delete, Reports bleiben)
  14. `supabase/feedback-questionnaire.sql` — JSONB answers-Spalte für Feedback-Fragebogen
  15. `supabase/message-templates.sql` — Nachrichtenvorlagen-Tabelle + Seed-Daten
  16. Dashboard: Auth → Email → "Confirm email" OFF
  13. Test-User manuell anlegen + Profile-INSERT
  14. `lib/supabase.ts`: URL + Anon Key ändern (2 Zeilen)

## ROLLEN

- **Admin:** Volles Dashboard, System-Settings, Reporting, Zuweisungen
- **Office:** Admin-Ansicht OHNE System-Settings
- **Mentor:** NUR eigene Mentees, **Geschlechtertrennung via RLS**
- **Mentee:** Eigener Fortschritt, Gamification

## BRANDING

iman.ngo-Stil. Dunkelblau (#0A3A5A) + Gold (#EEA71B). `constants/Colors.ts`.
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

## FORTSCHRITTS-LOG

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
