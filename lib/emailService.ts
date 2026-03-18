import { supabase } from "./supabase";

// ============================================================
// E-Mail Service — Resend API + email_queue als Backup/Log
//
// Alle Mails gehen aktuell an OVERRIDE_RECIPIENT.
// Wenn Kunden-Resend-Account da: RESEND_API_KEY + FROM_EMAIL ändern.
// ============================================================

const RESEND_API_KEY = "re_6mXaja3u_DF424Shzf42tKVP1Zk2qeyRo";
const FROM_EMAIL = "BNM <onboarding@resend.dev>"; // Später: "BNM <noreply@bnm-domain.de>"
const OVERRIDE_RECIPIENT = "hasan.sevenler@partner.ki";

async function sendViaResend(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const recipient = OVERRIDE_RECIPIENT || to;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipient],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  // 1. Resend versuchen
  const sent = await sendViaResend(to, subject, body);

  // 2. In Queue loggen (Backup + Audit-Trail)
  await supabase.from("email_queue").insert({
    to_email: to,
    subject,
    body,
    override_to: OVERRIDE_RECIPIENT,
    status: sent ? "sent" : "failed",
    sent_at: sent ? new Date().toISOString() : null,
  });

  return sent;
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
