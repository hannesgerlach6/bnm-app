<span style="color:#0a3a5a;">'''BNM'''</span>

<span style="color:#444444;">''App Store Release — Vollständige Anleitung''</span>

<span style="color:#777777;">Stand: 10. April 2026 | Projekt: BNM | Organisation: neuemuslime.com</span>

'''Status — Was bereits erledigt ist'''* ✅ Expo SDK 54 Projekt mit EAS konfiguriert (Project ID: 189bfd5b-ec7f-447f-a625-99c0dcbec17b)
* ✅ Bundle ID im Code gesetzt: ngo.iman.bnm (iOS + Android)
* ✅ App-Icon vorhanden (assets/images/bnm-logo.png)
* ✅ Store-Listing Texte fertig (Deutsch + Englisch) in store-listing.md
* ✅ Account-Löschung implementiert (Soft-Delete via supabase.rpc("delete_own_account"))
* ✅ Datenschutzseite in der App vorhanden (app/legal/datenschutz.tsx)
* ✅ ITSAppUsesNonExemptEncryption: false gesetzt
* ✅ Camera/Photo Usage Descriptions in app.json konfiguriert
* ✅ Tablet-Screenshots vorhanden (8 Stück für Google Play)
* ✅ eas.json mit Build-Profilen konfiguriert (development, preview, production)





'''Was noch gemacht werden muss'''

'''1. Apple Developer Account einrichten'''

Voraussetzung für alles Weitere. Ohne Apple Developer Account ($99/Jahr) kann kein Build erstellt und nichts hochgeladen werden.

'''Schritte:'''* Apple Developer Program beitreten: https://developer.apple.com/programs/enroll/
* Organisation: neuemuslime.com (oder Individuell)
* Dauer: 1–2 Werktage bis Freischaltung
* Nach Freischaltung: Team ID notieren (unter developer.apple.com/account → Membership)





'''2. App in App Store Connect anlegen'''

'''Ort: '''''https://appstoreconnect.apple.com → „+“ → „Neue App“''* '''Plattform: '''iOS
* '''Name: '''BNM - Betreuung neuer Muslime
* '''Primärsprache: '''Deutsch
* '''Bundle-ID: '''ngo.iman.bnm (muss vorher als App ID registriert sein)
* '''SKU: '''bnm-ios-001





'''Nach dem Anlegen notieren:'''* ASC App ID (steht unter App-Informationen)
* Team ID (steht unter Membership)
* Apple ID (E-Mail des Developer Accounts)





'''3. EAS-Credentials eintragen'''

'''Ort: '''''bnm-app/eas.json → submit.production.ios''

Die Platzhalter in eas.json mit den echten Werten ersetzen:

<div style="margin-left:0.635cm;"><span style="color:#333333;">{</span></div>

<div style="margin-left:0.635cm;"><span style="color:#333333;">"appleId": "echte-email@example.com",</span></div>

<div style="margin-left:0.635cm;"><span style="color:#333333;">"ascAppId": "1234567890",</span></div>

<div style="margin-left:0.635cm;"><span style="color:#333333;">"appleTeamId": "ABC123XYZ"</span></div>

<div style="margin-left:0.635cm;"><span style="color:#333333;">}</span></div>


'''4. Screenshots erstellen und hochladen'''

'''Ort: '''''App Store Connect → Apps → BNM → App Store → Screenshots''

Screenshots werden für mindestens diese Gerätegrößen benötigt:* '''6.7” Display '''(iPhone 15 Pro Max / 16 Pro Max) — 1290 x 2796 px
* '''6.5” Display '''(iPhone 11 Pro Max / XS Max) — 1242 x 2688 px





Optional aber empfohlen:* '''6.1” Display '''(iPhone 15 Pro / 16 Pro)





Weil supportsTablet: true gesetzt ist, auch iPad-Screenshots:* '''iPad Pro 12.9” '''(6. Gen) — 2048 x 2732 px





Mindestens 3 Screenshots pro Gerätegröße, maximal 10. Folgende Screens zeigen:# Login/Onboarding-Screen
# Mentee-Dashboard (Fortschritt, XP, Gamification)
# Chat-Ansicht (Mentor-Mentee Kommunikation)
# Lernplan / Sessions-Übersicht
# Admin-Dashboard (Mentoren/Mentees-Übersicht)
# Optional: Profil-Seite oder Q&A-Bereich





'''Wie Screenshots erstellen:'''* App im iOS Simulator laufen lassen und Screenshots machen:



<div style="margin-left:0.635cm;"><span style="color:#333333;">cd bnm-app && npx expo start --clear</span></div>* Dann „i“ drücken für iOS Simulator, im Simulator: Cmd+S = Screenshot
* Oder auf echtem iPhone über TestFlight testen und dort Screenshots machen
* Für Marketing-Screenshots mit Text-Overlays: Figma, Canva oder screenshots.pro





'''5. App-Beschreibung und Keywords'''

'''Ort: '''''App Store Connect → Apps → BNM → App Store''


'''Untertitel (max 30 Zeichen):'''

Mentoring für neue Muslime

'''Promotional Text (max 170 Zeichen):'''

Erfahrene Muslime begleiten Konvertierte auf ihrem Weg im Islam. Strukturiertes Mentoring mit persönlichem Ansprechpartner, Lernplan und Fortschrittstracking.

'''Description:'''

BNM (Betreuung neuer Muslime) ist eine Mentoring-Plattform, die neue Muslime mit erfahrenen Mentoren zusammenbringt. Die App bietet ein strukturiertes Begleitprogramm für Menschen, die den Islam angenommen haben.

'''FÜR MENTEES (NEUE MUSLIME)'''* Persönlicher Mentor, der dich auf deinem Weg begleitet
* Strukturierter Lernplan mit Fortschrittstracking
* Gamification-Elemente, die dich motivieren
* Direkter Chat mit deinem Mentor
* Fragen & Antworten Bereich





'''FÜR MENTOREN'''* Übersichtliches Dashboard mit allen Mentees
* Fortschritt deiner Mentees im Blick
* Chat-Funktion für persönliche Betreuung
* Sitzungsprotokollierung





'''FÜR ADMINS & KOORDINATOREN'''* Verwaltung aller Mentoren und Mentees
* Automatische Geschlechtertrennung
* Zuweisungssystem für Mentor-Mentee-Paare
* Reporting und Statistiken
* E-Mail-Benachrichtigungen





'''FUNKTIONEN'''* Persönliches Mentoring mit 1:1-Betreuung
* Fortschrittstracking mit XP und Leveln
* Integrierter Chat zwischen Mentor und Mentee
* Push-Benachrichtigungen für neue Nachrichten
* Profilbild-Upload mit Kamera oder Galerie
* Verfügbar auf Deutsch und Englisch





BNM wird betrieben von neuemuslime.com und unterstützt Gemeinden dabei, neue Muslime professionell und herzlich zu betreuen.

'''Keywords (max 100 Zeichen, kommagetrennt):'''

Islam,Mentoring,Muslime,Konvertiten,Betreuung,Gemeinde,Lernen,Begleitung,Mentor,Neumuslim


'''6. Privacy Policy URL bereitstellen (KRITISCH!)'''

<span style="color:#cc0000;">'''Apple verlangt eine öffentlich erreichbare Datenschutz-URL. Ohne wird die App abgelehnt!'''</span>

Die Datenschutzseite existiert zwar in der App (app/legal/datenschutz.tsx), aber Apple braucht eine Web-URL.

'''Optionen:'''* '''Auf neuemuslime.com hosten '''(z.B. https://neuemuslime.com/bnm/datenschutz) — bevorzugt
* '''GitHub Pages: '''Im Repo unter docs/datenschutz.html
* Einfache HTML-Seite auf beliebigem Webspace





'''Zusätzlich benötigt:'''* '''Support-URL '''(z.B. E-Mail-Adresse oder Kontaktseite auf neuemuslime.com)
* '''Marketing-URL '''(optional, z.B. https://neuemuslime.com/bnm)





'''7. App-Prüfungsinformationen (App Review)'''

'''Ort: '''''App Store Connect → Apps → BNM → App Review Information''

<span style="color:#cc0000;">'''Apple Review braucht einen Test-Account um die App zu prüfen. Ohne gültige Zugangsdaten wird Apple die App ablehnen!'''</span>

'''Anmeldeinformationen:'''* '''Benutzername: '''(Test-Mentee-Account anlegen, z.B. review@neuemuslime.com)
* '''Passwort: '''(Passwort für diesen Account)





'''Wichtig: Dem Test-Account muss ein Mentor zugewiesen sein, damit der Reviewer Chat, Sessions und Fortschritt sehen kann.'''

'''Anmerkungen für das Review-Team:'''

''BNM is a mentoring app for Muslim communities operated by neuemuslime.com. It connects new Muslims (mentees) with experienced mentors for structured guidance. To test the app: 1) Log in with the provided test credentials. 2) View the mentee dashboard with progress tracking and XP. 3) Open the chat to see mentor communication. 4) Check the learning plan and sessions. The app uses camera and photo library for profile picture upload only. The app requires an internet connection for all features. Account deletion is available under Settings for mentors and mentees.''

'''8. App-Icon prüfen'''* Das App-Icon wird automatisch aus dem Build gezogen (assets/images/bnm-logo.png)
* Prüfe in App Store Connect ob es korrekt angezeigt wird und nicht schwarz/leer ist
* Das Icon muss 1024x1024 px sein, KEIN Alphakanal (keine Transparenz), keine abgerundeten Ecken
* Falls das Icon Transparenz hat: Weißen Hintergrund hinzufügen und neu builden





'''9. Compliance-Informationen'''

'''Ort: '''''App Store Connect → Apps → BNM → App Information''

'''Verschlüsselung:'''* Does your app use encryption? → Ja (HTTPS/TLS)
* Is your app exempt? → Ja (nur Standard-HTTPS)
* In app.json ist bereits ITSAppUsesNonExemptEncryption: false gesetzt





'''Gesetz über digitale Dienste (EU DSA):'''* Geschäftsadresse von neuemuslime.com angeben





'''Compliance-Anforderungen:'''* Agierst du als Händler? → Nein





'''10. Preise und Verfügbarkeit'''* '''Preis: '''Kostenlos (Free)
* '''Verfügbarkeit: '''Alle Länder (oder nach Absprache einschränken)





'''11. Production Build erstellen und hochladen'''

Voraussetzung: EAS-Credentials aus Schritt 3 müssen eingetragen sein.

'''Build starten:'''

<div style="margin-left:0.635cm;"><span style="color:#333333;">cd bnm-app && eas build --platform ios --profile production</span></div>


* EAS Build läuft in der Cloud (kein Mac nötig), dauert ~15–30 Minuten
* Beim ersten Mal fragt EAS nach Apple-Credentials (Apple ID, Passwort, 2FA-Code) und erstellt automatisch Distribution Certificate + Provisioning Profile





'''Build hochladen:'''

<div style="margin-left:0.635cm;"><span style="color:#333333;">eas submit --platform ios --latest</span></div>* Der Build erscheint nach 5–30 Minuten in App Store Connect unter TestFlight





'''12. Build der Version zuweisen'''

'''Ort: '''''App Store Connect → Apps → BNM → App Store → iOS App''* Unter „Build“ → klicke auf das „+“ Symbol
* Wähle den hochgeladenen Build aus
* Falls der Build noch nicht sichtbar ist: Apple braucht manchmal 5–30 Minuten zum Verarbeiten
* Prüfe unter TestFlight ob der Build dort erscheint





'''13. Zur Prüfung einreichen'''

Wenn alle obigen Punkte erledigt sind:# App Store Connect → Apps → BNM
# Prüfe dass bei der Version alles grün/vollständig ist (keine roten Warnings)
# Klicke „Add for Review“
# Dann „Submit to App Review“





Review-Dauer: Typischerweise 24–48 Stunden.

'''Häufige Ablehnungsgründe:'''* Fehlende/ungültige Test-Zugangsdaten
* Screenshots die nicht zur App passen
* Fehlende Datenschutzerklärung
* App crasht beim Review
* Fehlender Account-Lösch-Button (bei BNM bereits vorhanden!)





'''14. Android Build (optional, parallel)'''

Falls auch Google Play gewünscht:

<div style="margin-left:0.635cm;"><span style="color:#333333;">cd bnm-app && eas build --platform android --profile production</span></div>


Danach:

<div style="margin-left:0.635cm;"><span style="color:#333333;">eas submit --platform android</span></div>


Für Google Play wird zusätzlich benötigt:* Google Play Developer Account (25$ einmalig)
* Google Play Service Account JSON (Pfad in eas.json konfiguriert)
* Ähnliche Screenshots (Tablet-Screenshots sind bereits vorhanden!)
* Gleiche Beschreibung/Keywords
* Content Rating Fragebogen





'''Prioritätenübersicht'''


{| style="border-spacing:0;width:15.921cm;"
|- style="background-color:#0a3a5a;border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;"
|| <span style="color:#ffffff;">'''Priorität'''</span>
|| <span style="color:#ffffff;">'''Aufgabe'''</span>
|| <span style="color:#ffffff;">'''Zuständig'''</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🔴 HOCH</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Apple Developer Account einrichten</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes / neuemuslime.com</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🔴 HOCH</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">App in App Store Connect anlegen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🔴 HOCH</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Privacy Policy URL bereitstellen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes / neuemuslime.com</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🔴 HOCH</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Test-Account für Apple Review erstellen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Admin</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🔴 HOCH</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">iPhone-Screenshots erstellen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🟡 MITTEL</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">EAS-Credentials eintragen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Claude / Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🟡 MITTEL</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">App-Beschreibung und Keywords eintragen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Claude / Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🟡 MITTEL</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Production Build erstellen und hochladen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Claude / Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🟡 MITTEL</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Build der Version zuweisen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🟢 NIEDRIG</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Compliance/DSA Informationen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🟢 NIEDRIG</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Preise und Verfügbarkeit setzen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">🟢 NIEDRIG</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Zur Prüfung einreichen</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Hannes</span>
|-
|}




'''Wichtige Links & Daten'''


{| style="border-spacing:0;width:15.921cm;"
|- style="background-color:#0a3a5a;border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;"
|| <span style="color:#ffffff;">'''Bezeichnung'''</span>
|| <span style="color:#ffffff;">'''Wert'''</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">App Store Connect</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">(wird nach Anlegen der App verfügbar)</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Apple Developer</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">https://developer.apple.com/account</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">EAS Dashboard</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">https://expo.dev (Project ID: 189bfd5b...)</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">GitHub Repo</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">https://github.com/hannesgerlach6/bnm-app</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Supabase</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">https://cufuikcxliwbmyhwlmga.supabase.co</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Bundle ID</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">ngo.iman.bnm</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">ASC App ID</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">(nach Anlegen eintragen)</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Team ID</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">(nach Developer Account eintragen)</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Apple ID</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">(nach Developer Account eintragen)</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">SKU</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">bnm-ios-001</span>
|-
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">Version</span>
| style="border:0.1pt solid #cccccc;padding-top:0.141cm;padding-bottom:0.141cm;padding-left:0.212cm;padding-right:0.212cm;" | <span style="color:#000000;">1.0.0 (Build 1)</span>
|-
|}

