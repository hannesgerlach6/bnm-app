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
  13. `supabase/fix-self-delete.sql` — Self-Deactivate für Mentor/Mentee (Deaktivierung statt Löschung, Daten bleiben erhalten)
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

### 2026-04-10 — Professionelle PDF-Reports (Monatsbericht + Spenderbericht)
**Komplettes Redesign von `lib/pdfGenerator.tsx`:**

**Neue Chart-Helper-Funktionen:**
- `drawKpiCardPro()` — KPI-Karte mit farbigem Akzentstreifen oben (statt einfacher Farbpunkt)
- `drawHorizontalBars()` — Horizontale Balkendiagramme (Session-Verteilung)
- `drawVerticalBarChart()` — Vertikale Balkendiagramme mit Grid-Linien + Labels
- `drawDonutChart()` — Kreisdiagramm mit innerem Loch + Legende + Prozentanzeige
- `drawProgressBar()` — Fortschrittsbalken mit Label + Prozentwert
- `drawCompletionGauge()` — Abschlussquote mit Farbzonen-Gauge (Rot/Gold/Gruen)
- `drawImpactCard()` — Grosse Impact-Karte mit Icon-Kreis + Akzentstreifen

**Monatsbericht: 2 → 3 Seiten:**
- S1: KPI-Dashboard (8 Cards) + Betreuungs-Status Donut + Session-Verteilung Balken + Mentor des Monats
- S2: Sessions nach Typ (vertikale Balken) + Top-5-Mentoren Fortschrittsbalken + Completion-Rate Gauge
- S3: Ranking-Tabelle (15 Mentoren, Medaillen fuer Top 3) + Zusammenfassung

**Spenderbericht: 1 → 2 Seiten:**
- S1: KPI-Dashboard (8 Cards) + Session-Verteilung (vertikale Balken) + Betreuungs-Donut
- S2: 4 Impact-Cards + Session-Details (horizontale Balken) + Nachbetreuungs-Rate + Zusammenfassung

**Design:**
- Professioneller Header mit BNM-Branding + Gold-Akzentlinie
- Navy-Hintergrund (#0A3A5A) + Gold (#EEA71B) + Gruen (#0D9C6E)
- Alle Charts manuell mit pdf-lib Primitiven gebaut (keine externe Chart-Library)
- Interfaces bleiben 100% abwaertskompatibel (keine Aenderungen an reports.tsx / donor-report.tsx)
