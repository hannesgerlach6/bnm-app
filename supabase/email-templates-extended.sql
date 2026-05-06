-- ============================================================
-- E-Mail-Vorlagen: 8 weitere Default-Templates für Admin
-- Macht ALLE rausgehenden Mails im Admin änderbar.
-- Migration #27 — 2026-05-06
-- ============================================================

INSERT INTO message_templates (title, category, body, sort_order, is_active, template_key)
VALUES
  -- 1) Admin: Neues Feedback eingegangen
  ('[E-Mail] Admin: Neues Feedback', 'email',
'Betreff: [BNM] Neues Feedback von {mentee_name}
---
Es wurde ein neues Feedback eingegangen.

Mentor: {mentor_name}
Mentee: {mentee_name}
Bewertung: {rating}/5 Sterne
Kommentar: {comment}

Bitte im Admin-Dashboard einsehen.

Das BNM-Team', 107, true, 'admin_new_feedback'),

  -- 2) Mentor: Feedback-Kopie
  ('[E-Mail] Mentor: Feedback-Kopie', 'email',
'Betreff: [BNM] Feedback von {mentee_name}
---
Hallo {name},

{mentee_name} hat deine Betreuung bewertet. Hier ist eine Kopie des Feedbacks:

Bewertung: {rating}/5 Sterne
Kommentar: {comment}

Das vollständige Feedback (inkl. Fragebogen) kannst du in der App unter deinen Betreuungen einsehen.

Barakallahu fik
Das BNM-Team', 108, true, 'feedback_copy_mentor'),

  -- 3) Admin: Neue Mentee-Anmeldung
  ('[E-Mail] Admin: Neue Mentee-Anmeldung', 'email',
'Betreff: [BNM] Neue Mentee-Anmeldung: {mentee_name}
---
Eine neue Mentee-Anmeldung wurde eingereicht.

Name: {mentee_name}
E-Mail: {mentee_email}
Stadt: {mentee_city}
Geschlecht: {mentee_gender}

Bitte im Admin-Dashboard unter "Anmeldungen" prüfen.

Das BNM-Team', 109, true, 'admin_new_mentee'),

  -- 4) Admin: Neue Mentor-Bewerbung
  ('[E-Mail] Admin: Neue Mentor-Bewerbung', 'email',
'Betreff: [BNM] Neue Mentor-Bewerbung: {applicant_name}
---
Eine neue Mentor-Bewerbung wurde eingereicht.

Name: {applicant_name}
E-Mail: {applicant_email}
Stadt: {applicant_city}
Geschlecht: {applicant_gender}

Bitte im Admin-Dashboard unter "Bewerbungen" prüfen.

Das BNM-Team', 110, true, 'admin_new_application'),

  -- 5) Admin: Betreuung Status-Änderung
  ('[E-Mail] Admin: Betreuungs-Statuswechsel', 'email',
'Betreff: [BNM] Betreuung {status_label}: {mentee_name} & {mentor_name}
---
Eine Betreuung wurde als {status_label} markiert.

Mentor: {mentor_name}
Mentee: {mentee_name}
Status: {status_label}

Details im Admin-Dashboard einsehen.

Das BNM-Team', 111, true, 'admin_status_change'),

  -- 6) Mentor: Tägliche Erinnerung (Edge Function send-reminders)
  ('[E-Mail] Mentor: Erinnerung an Session', 'email',
'Betreff: [BNM] Erinnerung: Session mit {mentee_name} fällig
---
Salam Aleikum {name},

dein letzter dokumentierter Termin mit {mentee_name} ist mehr als {days} Tage her.

Bitte vereinbare zeitnah ein neues Treffen und dokumentiere es in der BNM-App.

Barakallahu fik
Das BNM-Team', 112, true, 'mentor_reminder'),

  -- 7) Passwort-Reset (Edge Function reset-password)
  ('[E-Mail] Passwort zurücksetzen', 'email',
'Betreff: [BNM] Passwort zurücksetzen
---
Salam Aleikum {name},

du hast einen Passwort-Reset angefordert.

Klicke auf den folgenden Link, um ein neues Passwort zu vergeben:
{reset_link}

Der Link ist 1 Stunde gültig. Falls du diesen Reset nicht angefordert hast, ignoriere diese E-Mail einfach.

Barakallahu fik
Das BNM-Team', 113, true, 'password_reset'),

  -- 8) Urkunde — Direkter Versand an Mentor
  ('[E-Mail] Urkunde: Direkt an Mentor', 'email',
'Betreff: BNM – Urkunde: {mentor_name} – {period}
---
Assalamu alaykum liebe/r {mentor_name},

herzlichen Glückwunsch! Du wurdest als Mentor des Monats {period} ausgezeichnet.

Dein Einsatz und deine Hingabe in der Betreuung neuer Muslime sind eine große Bereicherung für unser Programm. Im Anhang findest du deine persönliche Urkunde.

Barakallahu fik – möge Allah dich segnen für deine Arbeit.

Das BNM-Team', 114, true, 'certificate_direct'),

  -- 9) Urkunde — Weiterleitung an Dritte
  ('[E-Mail] Urkunde: Weiterleitung', 'email',
'Betreff: BNM – Urkunde: {mentor_name} – {period}
---
Im Anhang findest du die Urkunde für {mentor_name} als Mentor des Monats {period}.

Barakallahu fik
Das BNM-Team', 115, true, 'certificate_thirdparty')

ON CONFLICT DO NOTHING;
