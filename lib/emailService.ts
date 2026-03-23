import { supabase } from "./supabase";

// ============================================================
// E-Mail Service — schreibt in die email_queue UND sendet
// direkt über die Resend API (Client-seitiger Fallback).
//
// WICHTIG: Der API-Key unten gehört langfristig serverseitig
// in eine Supabase Edge Function oder einen sicheren Proxy.
// Er ist hier nur als Übergangslösung hinterlegt, bis eine
// Edge Function deployt werden kann (erfordert Supabase CLI).
// ============================================================

const OVERRIDE_RECIPIENT = "hasan.sevenler@partner.ki";

// Resend-Versand direkt vom Client (Übergangslösung).
// API-Key MUSS später serverseitig verwaltet werden.
async function sendViaResend(
  to: string,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer re_6mXaja3u_DF424Shzf42tKVP1Zk2qeyRo",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BNM <onboarding@resend.dev>",
        to: [to],
        subject,
        html: htmlBody,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** HTML-Sonderzeichen escapen um XSS in E-Mails zu verhindern */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  // 1) In die Queue schreiben (Audit-Trail)
  const { error } = await supabase.from("email_queue").insert({
    to_email: to,
    subject,
    body,
    override_to: OVERRIDE_RECIPIENT,
    status: "pending",
    sent_at: null,
  });

  // 2) Direkt versenden — Empfänger ist immer OVERRIDE_RECIPIENT
  // fire-and-forget: Fehler beim Versand blockieren nicht den Rückgabewert
  sendViaResend(OVERRIDE_RECIPIENT, subject, body).catch(() => {});

  return !error;
}

// ─── Zugangsdaten-E-Mail ─────────────────────────────────────────────────────

export async function sendCredentialsEmail(
  email: string,
  name: string,
  tempPassword: string
): Promise<boolean> {
  const subject = "[BNM] Deine Zugangsdaten";
  const body = `
<p>Salam Aleikum ${escapeHtml(name)},</p>
<p>dein BNM-Account wurde erstellt. Hier sind deine Zugangsdaten:</p>
<ul>
  <li><strong>E-Mail:</strong> ${escapeHtml(email)}</li>
  <li><strong>Temporäres Passwort:</strong> ${escapeHtml(tempPassword)}</li>
</ul>
<p>Bitte ändere dein Passwort nach dem ersten Login.</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(email, subject, body);
}

// ─── Vordefinierte E-Mail-Templates ─────────────────────────────────────────

export async function sendNewFeedbackNotification(
  mentorName: string,
  menteeName: string,
  rating: number,
  comment?: string
) {
  const subject = `[BNM] Neues Feedback von ${menteeName}`;
  const body = `
<p>Es wurde ein neues Feedback eingegangen.</p>
<ul>
  <li><strong>Mentor:</strong> ${escapeHtml(mentorName)}</li>
  <li><strong>Mentee:</strong> ${escapeHtml(menteeName)}</li>
  <li><strong>Bewertung:</strong> ${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)</li>
  ${comment ? `<li><strong>Kommentar:</strong> ${escapeHtml(comment)}</li>` : ""}
</ul>
<p>Bitte im Admin-Dashboard einsehen.</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(OVERRIDE_RECIPIENT, subject, body);
}

export async function sendNewMenteeRegistrationNotification(
  menteeName: string,
  menteeEmail: string,
  city: string,
  gender: string
) {
  const subject = `[BNM] Neue Mentee-Anmeldung: ${menteeName}`;
  const body = `
<p>Eine neue Mentee-Anmeldung wurde eingereicht.</p>
<ul>
  <li><strong>Name:</strong> ${escapeHtml(menteeName)}</li>
  <li><strong>E-Mail:</strong> ${escapeHtml(menteeEmail)}</li>
  <li><strong>Stadt:</strong> ${escapeHtml(city)}</li>
  <li><strong>Geschlecht:</strong> ${gender === "male" ? "Bruder" : "Schwester"}</li>
</ul>
<p>Bitte im Admin-Dashboard unter "Anmeldungen" prüfen.</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(OVERRIDE_RECIPIENT, subject, body);
}

export async function sendNewMentorApplicationNotification(
  applicantName: string,
  applicantEmail: string,
  city: string,
  gender: string
) {
  const subject = `[BNM] Neue Mentor-Bewerbung: ${applicantName}`;
  const body = `
<p>Eine neue Mentor-Bewerbung wurde eingereicht.</p>
<ul>
  <li><strong>Name:</strong> ${escapeHtml(applicantName)}</li>
  <li><strong>E-Mail:</strong> ${escapeHtml(applicantEmail)}</li>
  <li><strong>Stadt:</strong> ${escapeHtml(city)}</li>
  <li><strong>Geschlecht:</strong> ${gender === "male" ? "Bruder" : "Schwester"}</li>
</ul>
<p>Bitte im Admin-Dashboard unter "Bewerbungen" prüfen.</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(OVERRIDE_RECIPIENT, subject, body);
}

export async function sendMenteeAssignedNotification(
  mentorName: string,
  mentorEmail: string,
  menteeName: string,
  menteeCity: string
) {
  const subject = `[BNM] Dir wurde ein Mentee zugewiesen: ${menteeName}`;
  const body = `
<p>Salam Aleikum ${escapeHtml(mentorName)},</p>
<p>dir wurde ein neuer Mentee zugewiesen.</p>
<ul>
  <li><strong>Mentee:</strong> ${escapeHtml(menteeName)}</li>
  <li><strong>Stadt:</strong> ${escapeHtml(menteeCity)}</li>
</ul>
<p>Bitte melde dich zeitnah in der App, um den ersten Kontakt herzustellen.</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(mentorEmail, subject, body);
}

export async function sendMentorshipStatusChangeNotification(
  adminEmail: string,
  mentorName: string,
  menteeName: string,
  newStatus: "completed" | "cancelled"
) {
  const statusLabel =
    newStatus === "completed" ? "abgeschlossen" : "abgebrochen";
  const subject = `[BNM] Betreuung ${statusLabel}: ${menteeName} & ${mentorName}`;
  const body = `
<p>Eine Betreuung wurde als <strong>${statusLabel}</strong> markiert.</p>
<ul>
  <li><strong>Mentor:</strong> ${escapeHtml(mentorName)}</li>
  <li><strong>Mentee:</strong> ${escapeHtml(menteeName)}</li>
  <li><strong>Status:</strong> ${statusLabel}</li>
</ul>
<p>Details im Admin-Dashboard einsehen.</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(adminEmail, subject, body);
}

export async function sendApplicationRejectionEmail(
  applicantEmail: string,
  applicantName: string,
  type: "mentor" | "mentee",
  reason?: string
): Promise<boolean> {
  const subject =
    type === "mentor"
      ? "[BNM] Deine Mentor-Bewerbung"
      : "[BNM] Deine Anmeldung bei BNM";

  const reasonHtml = reason
    ? `<p>Grund: <strong>${escapeHtml(reason)}</strong></p>`
    : "";

  const body =
    type === "mentor"
      ? `
<p>Salam Aleikum ${escapeHtml(applicantName)},</p>
<p>vielen Dank für deine Bewerbung als Mentor bei BNM – Betreuung neuer Muslime.</p>
<p>Nach sorgfältiger Prüfung müssen wir dir leider mitteilen, dass wir deine Bewerbung zu diesem Zeitpunkt nicht annehmen können.</p>
${reasonHtml}
<p>Das bedeutet nicht, dass du nicht wertvoll für die Gemeinschaft bist. Wir ermutigen dich, es zu einem späteren Zeitpunkt erneut zu versuchen.</p>
<p>Bei Fragen kannst du uns jederzeit kontaktieren.</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
      `.trim()
      : `
<p>Salam Aleikum ${escapeHtml(applicantName)},</p>
<p>vielen Dank für deine Anmeldung bei BNM – Betreuung neuer Muslime.</p>
<p>Nach Prüfung deiner Anmeldung können wir dir leider mitteilen, dass wir dir aktuell keinen Mentor zuweisen können.</p>
${reasonHtml}
<p>Wir melden uns, sobald sich die Situation ändert. Bei Fragen kannst du uns jederzeit kontaktieren.</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
      `.trim();

  return sendEmail(applicantEmail, subject, body);
}

export async function sendFeedbackRequestEmail(
  menteeEmail: string,
  menteeName: string,
  mentorName: string,
  mentorshipId: string
) {
  const subject = `[BNM] Bitte gib Feedback zu deiner Betreuung`;
  const body = `
<p>Salam Aleikum ${escapeHtml(menteeName)},</p>
<p>deine Betreuung mit <strong>${escapeHtml(mentorName)}</strong> wurde erfolgreich abgeschlossen. Wir würden uns sehr freuen, wenn du kurz dein Feedback teilst — das hilft uns, das BNM-Programm weiter zu verbessern.</p>
<p>Bitte öffne die BNM-App und gib dein Feedback zur Betreuung (ID: ${mentorshipId}) ab.</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(menteeEmail, subject, body);
}
