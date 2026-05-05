import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";
import { APP_URL } from "./appConstants";

// ============================================================
// E-Mail Service — schreibt in die email_queue (Audit-Trail)
// und sendet über die Supabase Edge Function "send-direct".
// Der Resend API-Key liegt serverseitig als Supabase Secret.
// ============================================================

// Admin-E-Mail für Benachrichtigungen (Feedback, neue Anmeldungen, etc.)
// Fallback-Wert — wird zur Laufzeit aus app_settings (key: "admin_email") gelesen.
// Admin kann die Adresse in den App-Einstellungen ändern, ohne Code-Änderung.
const ADMIN_EMAIL = "hasan.sevenler@partner.ki";

/** Liest die Admin-E-Mail aus app_settings; fällt auf ADMIN_EMAIL zurück. */
async function getAdminEmail(): Promise<string> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "admin_email")
      .maybeSingle();
    return data?.value || ADMIN_EMAIL;
  } catch {
    return ADMIN_EMAIL;
  }
}

// Resend-Versand über Supabase Edge Function (kein API-Key im Client).
async function sendViaResend(
  to: string,
  subject: string,
  htmlBody: string,
  attachments?: { filename: string; content: string }[]
): Promise<boolean> {
  try {
    // User-JWT holen — fällt auf Anon Key zurück wenn keine Session
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

    // 10s Timeout damit die UI nie hängen bleibt
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/send-direct`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ to, subject, html: htmlBody, attachments }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    const responseText = await res.text();
    if (!res.ok) {
      console.error(`[emailService] send-direct ${res.status}:`, responseText);
      return false;
    }
    return true;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.error("[emailService] send-direct timeout (10s)");
    } else {
      console.error("[emailService] send-direct exception:", err);
    }
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

/** Subject-Zeile bereinigen — Zeilenumbrüche und Sonderzeichen entfernen (Header-Injection) */
function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n\t]/g, " ").trim().slice(0, 200);
}

// ─── DB-Template-Lookup ─────────────────────────────────────────────────────
// Lädt eine E-Mail-Vorlage aus der DB (message_templates) anhand template_key.
// Format in DB: "Betreff: ...\n---\n..." — Admin kann Text im UI ändern.
// Gibt null zurück wenn kein Template gefunden → Fallback auf hardcoded HTML.

async function getEmailTemplate(
  templateKey: string,
  placeholders: Record<string, string>
): Promise<{ subject: string; body: string } | null> {
  try {
    const { data } = await supabase
      .from("message_templates")
      .select("body")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .maybeSingle();

    if (!data?.body) return null;

    // Parse: "Betreff: ...\n---\n..." format
    const parts = data.body.split("\n---\n");
    const subjectLine = parts[0]?.replace(/^Betreff:\s*/, "").trim() || "";
    const bodyText = parts.slice(1).join("\n---\n").trim() || "";

    // Replace placeholders — Subject bekommt plain value, Body bekommt escaped value
    let subject = subjectLine;
    let bodyEscaped = escapeHtml(bodyText); // Erst gesamten Body escapen
    for (const [key, value] of Object.entries(placeholders)) {
      const escapedValue = escapeHtml(value);
      subject = subject.replace(new RegExp(`\\{${key}\\}`, "g"), value);
      bodyEscaped = bodyEscaped.replace(new RegExp(escapeHtml(`{${key}}`), "g"), escapedValue);
    }

    // Convert newlines to HTML + add BNM footer
    const htmlBody = bodyEscaped.replace(/\n/g, "<br>") +
      `<br><hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>`;

    return { subject: sanitizeSubject(subject), body: htmlBody };
  } catch (err) {
    console.warn("[emailService] getEmailTemplate failed for key:", templateKey, err);
    return null;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    // 1) In die Queue schreiben (Audit-Trail) — mit 8s Timeout
    const insertPromise = supabase.from("email_queue").insert({
      to_email: to,
      subject,
      html_body: body,
      status: "pending",
      sent_at: null,
    });
    const { error } = await Promise.race([
      insertPromise,
      new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: "email_queue timeout" } }), 8_000)
      ),
    ]);

    if (error) console.warn("[emailService] email_queue insert:", error.message ?? error);

    // 2) Direkt versenden
    sendViaResend(to, subject, body).catch((err) =>
      console.error("[emailService] sendViaResend failed:", err)
    );

    return !error;
  } catch (err) {
    console.warn("[emailService] sendEmail failed:", err);
    return false;
  }
}

// ─── Zugangsdaten-E-Mail ─────────────────────────────────────────────────────

export async function sendCredentialsEmail(
  email: string,
  name: string,
  tempPassword: string
): Promise<boolean> {
  // Try DB template first
  const template = await getEmailTemplate("welcome_mentor", {
    name, email, password: tempPassword,
  });
  if (template) return sendEmail(email, template.subject, template.body);

  // Fallback: hardcoded
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
  const subject = sanitizeSubject(`[BNM] Neues Feedback von ${menteeName}`);
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
  return sendEmail(await getAdminEmail(), subject, body);
}

export async function sendFeedbackCopyToMentorEmail(
  mentorEmail: string,
  mentorName: string,
  menteeName: string,
  rating: number,
  comment?: string
) {
  const subject = sanitizeSubject(`[BNM] Feedback von ${menteeName}`);
  const body = `
<p>Hallo ${escapeHtml(mentorName)},</p>
<p>${escapeHtml(menteeName)} hat deine Betreuung bewertet. Hier ist eine Kopie des Feedbacks:</p>
<ul>
  <li><strong>Bewertung:</strong> ${"★".repeat(rating)}${"☆".repeat(5 - rating)} (${rating}/5)</li>
  ${comment ? `<li><strong>Kommentar:</strong> ${escapeHtml(comment)}</li>` : ""}
</ul>
<p>Das vollständige Feedback (inkl. Fragebogen) kannst du in der App unter deinen Betreuungen einsehen.</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – neuemuslime.com</p>
  `.trim();
  return sendEmail(mentorEmail, subject, body);
}

export async function sendNewMenteeRegistrationNotification(
  menteeName: string,
  menteeEmail: string,
  city: string,
  gender: string
) {
  const subject = sanitizeSubject(`[BNM] Neue Mentee-Anmeldung: ${menteeName}`);
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
  return sendEmail(await getAdminEmail(), subject, body);
}

export async function sendNewMentorApplicationNotification(
  applicantName: string,
  applicantEmail: string,
  city: string,
  gender: string
) {
  const subject = sanitizeSubject(`[BNM] Neue Mentor-Bewerbung: ${applicantName}`);
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
  return sendEmail(await getAdminEmail(), subject, body);
}

export async function sendMenteeAssignedNotification(
  mentorName: string,
  mentorEmail: string,
  menteeName: string,
  menteeCity: string
) {
  // Try DB template first
  const template = await getEmailTemplate("mentor_assigned", {
    name: mentorName, mentee_name: menteeName, mentee_city: menteeCity,
  });
  if (template) return sendEmail(mentorEmail, template.subject, template.body);

  // Fallback: hardcoded
  const subject = sanitizeSubject(`[BNM] Dir wurde ein Mentee zugewiesen: ${menteeName}`);
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
  _adminEmail: string,
  mentorName: string,
  menteeName: string,
  newStatus: "completed" | "cancelled"
) {
  // Immer an Admin-E-Mail senden (Parameter wird ignoriert — war oft leer)
  const statusLabel =
    newStatus === "completed" ? "abgeschlossen" : "abgebrochen";
  const subject = sanitizeSubject(`[BNM] Betreuung ${statusLabel}: ${menteeName} & ${mentorName}`);
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
  return sendEmail(await getAdminEmail(), subject, body);
}

export async function sendApplicationRejectionEmail(
  applicantEmail: string,
  applicantName: string,
  type: "mentor" | "mentee",
  reason?: string
): Promise<boolean> {
  // Try DB template first
  const template = await getEmailTemplate("rejection", {
    name: applicantName, reason: reason || "Keine Angabe",
  });
  if (template) return sendEmail(applicantEmail, template.subject, template.body);

  // Fallback: hardcoded
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
  // Try DB template first
  const template = await getEmailTemplate("feedback_request", {
    name: menteeName, mentor_name: mentorName,
  });
  if (template) return sendEmail(menteeEmail, template.subject, template.body);

  // Fallback: hardcoded
  const feedbackUrl = `${APP_URL}/feedback?mentorshipId=${mentorshipId}`;
  const subject = `[BNM] Bitte gib Feedback zu deiner Betreuung`;
  const body = `
<p>Salam Aleikum ${escapeHtml(menteeName)},</p>
<p>deine Betreuung mit <strong>${escapeHtml(mentorName)}</strong> wurde erfolgreich abgeschlossen. Wir würden uns sehr freuen, wenn du kurz dein Feedback teilst — das hilft uns, das BNM-Programm weiter zu verbessern.</p>
<p><a href="${feedbackUrl}" style="display:inline-block;background:#EEA71B;color:#fff;font-weight:700;padding:12px 24px;border-radius:5px;text-decoration:none">Feedback jetzt geben →</a></p>
<p style="color:#98A2B3;font-size:12px">Oder direkt aufrufen: <a href="${feedbackUrl}">${feedbackUrl}</a></p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(menteeEmail, subject, body);
}

// ─── Gesprächs-Einladung ─────────────────────────────────────────────────────

export async function sendInterviewInvitationEmail(
  email: string,
  name: string
): Promise<boolean> {
  // Try DB template first
  const template = await getEmailTemplate("interview_invitation", { name });
  if (template) return sendEmail(email, template.subject, template.body);

  // Fallback: hardcoded
  const subject = "[BNM] Einladung zum Gespräch";
  const body = `
<p>Salam Aleikum ${escapeHtml(name)},</p>
<p>vielen Dank für deine Bewerbung bei BNM – Betreuung neuer Muslime.</p>
<p>Wir würden dich gerne zu einem persönlichen Gespräch einladen, um dich besser kennenzulernen und offene Fragen zu klären.</p>
<p>Bitte antworte auf diese E-Mail mit deinen Verfügbarkeiten, damit wir einen passenden Termin finden können.</p>
<p>Wir freuen uns auf das Gespräch!</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(email, subject, body);
}

// ─── Webinar-Einladung ──────────────────────────────────────────────────────

export async function sendWebinarInvitationEmail(
  email: string,
  name: string
): Promise<boolean> {
  // Try DB template first
  const template = await getEmailTemplate("webinar_invitation", { name });
  if (template) return sendEmail(email, template.subject, template.body);

  // Fallback: hardcoded
  const subject = "[BNM] Einladung zum Einführungswebinar";
  const body = `
<p>Salam Aleikum ${escapeHtml(name)},</p>
<p>vielen Dank für deine Bewerbung bei BNM – Betreuung neuer Muslime.</p>
<p>Wir möchten dich herzlich zu unserem Einführungswebinar einladen. Dort erfährst du alles Wichtige über das BNM-Programm, die Abläufe und deine Rolle als Mentor.</p>
<p>Weitere Details zum Termin und Zugangslink erhältst du in Kürze.</p>
<p>Wir freuen uns auf deine Teilnahme!</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(email, subject, body);
}

// ─── Betreuung abgebrochen – Mentee informieren ─────────────────────────────

export async function sendMentorshipCancelledToMenteeEmail(
  email: string,
  menteeName: string,
  mentorName: string
): Promise<boolean> {
  // Try DB template first
  const template = await getEmailTemplate("mentorship_cancelled", {
    name: menteeName, mentor_name: mentorName,
  });
  if (template) return sendEmail(email, template.subject, template.body);

  // Fallback: hardcoded
  const subject = "[BNM] Deine Betreuung wurde beendet";
  const body = `
<p>Salam Aleikum ${escapeHtml(menteeName)},</p>
<p>deine Betreuung mit <strong>${escapeHtml(mentorName)}</strong> wurde leider beendet.</p>
<p>Wir würden uns sehr freuen, wenn du uns kurz dein Feedback in der BNM-App gibst — das hilft uns, das Programm weiter zu verbessern.</p>
<p>Bei Fragen kannst du uns jederzeit kontaktieren.</p>
<p>Barakallahu fik</p>
<p>Das BNM-Team</p>
<hr><p style="color:#98A2B3;font-size:12px">BNM – Betreuung neuer Muslime</p>
  `.trim();
  return sendEmail(email, subject, body);
}

// ─── Urkunde per E-Mail (mit PDF-Anhang) ─────────────────────────────────────

export async function sendCertificateEmail(
  to: string,
  mentorName: string,
  period: string,
  pdfBytes: Uint8Array,
  templateType: "direct" | "thirdparty" | "custom" = "thirdparty",
  customBody?: string
): Promise<boolean> {
  const subject = sanitizeSubject(`BNM – Urkunde: ${mentorName} – ${period}`);

  // Template 1: Persönliche Nachricht direkt an den Mentor
  const directBody = `
    <h2 style="color:#0A3A5A;margin:0 0 8px">Urkunde: Mentor des Monats</h2>
    <p style="color:#6B7280;margin:0 0 24px">Zeitraum: ${escapeHtml(period)}</p>
    <p style="font-size:16px;color:#111">
      Assalamu alaykum liebe/r <strong>${escapeHtml(mentorName)}</strong>,
    </p>
    <p style="font-size:16px;color:#111">
      herzlichen Glückwunsch! Du wurdest als <strong>Mentor des Monats ${escapeHtml(period)}</strong> ausgezeichnet.
      Dein Einsatz und deine Hingabe in der Betreuung neuer Muslime sind eine große Bereicherung für unser Programm.
      Im Anhang findest du deine persönliche Urkunde.
    </p>
    <p style="font-size:16px;color:#111">Barakallahu fik – möge Allah dich segnen für deine Arbeit.</p>
    <p style="color:#6B7280;margin-top:24px">Das BNM-Team</p>`;

  // Template 2: Neutrale Weiterleitungs-E-Mail (z.B. an Dritte)
  const thirdpartyBody = `
    <h2 style="color:#0A3A5A;margin:0 0 8px">Urkunde: Mentor des Monats</h2>
    <p style="color:#6B7280;margin:0 0 24px">Zeitraum: ${escapeHtml(period)}</p>
    <p style="font-size:16px;color:#111">
      Im Anhang findest du die Urkunde für <strong>${escapeHtml(mentorName)}</strong> als Mentor des Monats ${escapeHtml(period)}.
    </p>
    <p style="color:#6B7280;margin-top:24px">Barakallahu fik<br>Das BNM-Team</p>`;

  // Template 3: Freitext — vom Admin selbst verfasst, Zeilenumbrüche → <br>
  const customBodyHtml = customBody
    ? `<h2 style="color:#0A3A5A;margin:0 0 24px">Urkunde: Mentor des Monats</h2>` +
      `<div style="font-size:16px;color:#111;white-space:pre-line">${escapeHtml(customBody)}</div>`
    : thirdpartyBody;

  const bodyHtml =
    templateType === "direct" ? directBody :
    templateType === "custom" ? customBodyHtml :
    thirdpartyBody;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0A3A5A;padding:24px;text-align:center">
    <h1 style="color:#EEA71B;margin:0;font-size:28px">BNM</h1>
    <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px">Betreuung neuer Muslime</p>
  </div>
  <div style="padding:32px;background:#fff">
    ${bodyHtml}
  </div>
  <div style="padding:16px;background:#F9FAFB;text-align:center">
    <p style="color:#98A2B3;font-size:12px;margin:0">BNM – Betreuung neuer Muslime · neuemuslime.com</p>
  </div>
</div>
  `.trim();

  // PDF als Base64 kodieren
  const base64 = btoa(Array.from(pdfBytes, (b) => String.fromCharCode(b)).join(""));
  const filename = `BNM-Urkunde-${mentorName.replace(/\s+/g, "-")}-${period.replace(/\s+/g, "-")}.pdf`;

  return sendViaResend(to, subject, html, [{ filename, content: base64 }]);
}
