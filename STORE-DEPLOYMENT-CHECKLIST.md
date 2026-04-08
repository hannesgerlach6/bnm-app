# BNM App Store Deployment Checkliste

## Voraussetzungen

### Accounts (bereits vorhanden)
- [x] Expo Account
- [x] Apple Developer Account ($99/Jahr)
- [x] Google Play Developer Account ($25 einmalig)

### Noch zu erledigen

#### 1. Apple Developer Setup
- [ ] **App Store Connect:** Neue App anlegen
  - Bundle ID: `com.bnm.app`
  - Name: "BNM - Betreuung neuer Muslime"
  - Primäre Sprache: Deutsch
- [ ] **ASC API Key erstellen** (für automatischen Upload via EAS):
  1. App Store Connect → Benutzer und Zugriff → Integrations → App Store Connect API
  2. Neuen Key erstellen (Admin-Rolle)
  3. Key-ID, Issuer-ID und .p8-Datei notieren
- [ ] **eas.json updaten:** `appleId`, `ascAppId`, `appleTeamId` eintragen

#### 2. Google Play Setup
- [ ] **Google Play Console:** Neue App anlegen
  - Paketname: `com.bnm.app`
  - App-Name: "BNM - Betreuung neuer Muslime"
  - Standardsprache: Deutsch
- [ ] **Service Account erstellen** (für automatischen Upload via EAS):
  1. Google Cloud Console → IAM → Service Accounts
  2. Neuen Service Account erstellen
  3. JSON-Key downloaden → als `google-play-service-account.json` im Projekt-Root speichern
  4. In Google Play Console → API-Zugriff → Service Account verknüpfen (Admin-Rechte)
- [ ] `google-play-service-account.json` zur `.gitignore` hinzufügen!

#### 3. App-Icons (WICHTIG - aktuelle Icons zu klein!)
- [ ] **App Icon:** 1024x1024px PNG (ohne Transparenz, ohne Rundungen)
  - Wird für App Store & Play Store verwendet
  - Am besten das BNM-Logo auf weißem/hellblauen Hintergrund
- [ ] **Android Adaptive Icon:**
  - Foreground: 432x432px (Logo zentriert, 66% der Fläche)
  - Background: Kann Farbe (#F9FAFB) bleiben
  - Monochrome: 432x432px (einfarbig, für Material You)
- [ ] **Splash Screen:** 1284x2778px (optional, Logo zentriert)
- [ ] Icons in `assets/images/` ersetzen

#### 4. Datenschutzerklärung
- [ ] Datenschutzerklärung erstellen/hosten (URL benötigt!)
  - Pflicht für beide Stores
  - Muss erklären: welche Daten, warum, wo gespeichert
  - Vorschlag: Auf iman.ngo hosten (z.B. iman.ngo/bnm/datenschutz)
- [ ] URL in App Store Connect & Google Play Console eintragen

#### 5. Screenshots
- [ ] **iPhone Screenshots** (min. 2, empfohlen 5-8):
  - 6.7" (1290x2796) — iPhone 15 Pro Max
  - 6.5" (1284x2778) — iPhone 14 Plus
  - 5.5" (1242x2208) — iPhone 8 Plus (optional)
- [ ] **iPad Screenshots** (falls supportsTablet):
  - 12.9" (2048x2732)
- [ ] **Android Screenshots** (min. 2, empfohlen 4-8):
  - Phone: 1080x1920 oder höher
  - Tablet 7": 1200x1920 (optional)
  - Tablet 10": 1600x2560 (optional)
- [ ] **Google Play Feature-Grafik:** 1024x500px

---

## Build & Deploy Schritte

### Schritt 1: Erster Build
```bash
cd bnm-app

# EAS CLI installieren (falls nicht vorhanden)
npm install -g eas-cli

# Bei Expo einloggen
eas login

# Preview Build für internen Test
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

### Schritt 2: Preview testen
- Android: APK von expo.dev downloaden und auf Testgerät installieren
- iOS: In TestFlight installieren (nach Upload)

### Schritt 3: Production Build
```bash
# Production Build für Store-Upload
eas build --platform android --profile production
eas build --platform ios --profile production
```

### Schritt 4: Store Upload
```bash
# Android → Google Play (interner Test)
eas submit --platform android --profile production

# iOS → App Store Connect (TestFlight)
eas submit --platform ios --profile production
```

### Schritt 5: Interner Test
- **Google Play Console:** Interner Test → Tester hinzufügen → Link teilen
- **TestFlight:** Tester einladen → App testen

### Schritt 6: Veröffentlichung
- **Google Play:** Interner Test → Geschlossener Test → Offener Test → Produktion
- **App Store:** TestFlight → Review einreichen → Veröffentlichen

---

## Store-Listing Infos
Siehe `store-listing.md` für vorbereitete Texte (DE + EN).

## Altersfreigabe
- Google Play: Fragebogen ausfüllen (IARC) — voraussichtlich "Ab 0" / "Everyone"
- Apple: Alterseinstufung 4+ (keine anstößigen Inhalte)

## Hinweise
- Erste Apple Review dauert ca. 1-3 Tage
- Google Play erster Review dauert ca. 3-7 Tage (bei neuen Accounts länger)
- Nach Ablehnung: Feedback lesen, fixen, erneut einreichen
- `google-play-service-account.json` NIEMALS committen!
