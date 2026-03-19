import { supabase } from "./supabase";

// ============================================================
// E-Mail Service — schreibt ausschließlich in die email_queue.
//
// Der tatsächliche Versand erfolgt serverseitig über eine
// Supabase Edge Function (siehe supabase/resend-edge-function.ts).
// Der Resend API-Key darf NIEMALS im Client-Code stehen.
// ============================================================

const OVERRIDE_RECIPIENT = "hasan.sevenler@partner.ki";

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const { error } = await supabase.from("email_queue").insert({
    to_email: to,
    subject,
    body,
    override_to: OVERRIDE_RECIPIENT,
    status: "pending",
    sent_at: null,
  });

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
<p>Salam Aleikum ${name},</p>
<p>dein BNM-Account wurde erstellt. Hier sind deine Zugangsdaten:</p>
<ul>
  <li><strong>E-Mail:</strong> ${email}</li>
  <li><strong>Temporäres Passwort:</strong> ${tempPassword}</li>
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
  <li><strong>Mentor:</strong> ${mentorName}</li>
  <li><strong>Mentee:</strong> ${menteeName}</li>
  <li><strong>Bewertung:</strong> ${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)</li>
  ${comment ? `<li><strong>Kommentar:</strong> ${comment}</li>` : ""}
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
  <li><strong>Name:</strong> ${menteeName}</li>
  <li><strong>E-Mail:</strong> ${menteeEmail}</li>
  <li><strong>Stadt:</strong> ${city}</li>
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
  <li><strong>Name:</strong> ${applicantName}</li>
  <li><strong>E-Mail:</strong> ${applicantEmail}</li>
  <li><strong>Stadt:</strong> ${city}</li>
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
<p>Salam Aleikum ${mentorName},</p>
<p>dir wurde ein neuer Mentee zugewiesen.</p>
<ul>
  <li><strong>Mentee:</strong> ${menteeName}</li>
  <li><strong>Stadt:</strong> ${menteeCity}</li>
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
  <li><strong>Mentor:</strong> ${mentorName}</li>
  <li><strong>Mentee:</strong> ${menteeName}</li>
  <li><strong>Status:</strong> ${statusLabel}</li>
</ul>
<p>Details im Admin-Dashboard einsehen.</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(adminEmail, subject, body);
}

export async function sendFeedbackRequestEmail(
  menteeEmail: string,
  menteeName: string,
  mentorName: string,
  mentorshipId: string
) {
  const subject = `[BNM] Bitte gib Feedback zu deiner Betreuung`;
  const body = `
<p>Salam Aleikum ${menteeName},</p>
<p>deine Betreuung mit <strong>${mentorName}</strong> wurde erfolgreich abgeschlossen. Wir würden uns sehr freuen, wenn du kurz dein Feedback teilst — das hilft uns, das BNM-Programm weiter zu verbessern.</p>
<p>Bitte öffne die BNM-App und gib dein Feedback zur Betreuung (ID: ${mentorshipId}) ab.</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(menteeEmail, subject, body);
}
