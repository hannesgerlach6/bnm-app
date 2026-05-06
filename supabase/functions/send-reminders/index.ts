// Supabase Edge Function: send-reminders
// Täglich via pg_cron aufgerufen – sendet Erinnerungen an Mentoren
// die keine Session in den letzten 3 Tagen dokumentiert haben.
//
// Macht 3 Dinge:
//   1. Notification in DB einfügen (erscheint im Notification-Center der App)
//   2. Push Notification via Expo Push API
//   3. E-Mail direkt via Resend API
//
// Deploy:
//   supabase functions deploy send-reminders --project-ref cufuikcxliwbmyhwlmga
//
// Manuell testen:
//   curl -X POST https://cufuikcxliwbmyhwlmga.supabase.co/functions/v1/send-reminders \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const REMINDER_THRESHOLD_DAYS = 3;  // Erinnerung wenn keine Session seit X Tagen
const REMINDER_COOLDOWN_DAYS = 2;   // Keine Doppel-Erinnerung innerhalb X Tage

// Lädt E-Mail-Template aus DB (im Format "Betreff: ...\n---\n...") und ersetzt Platzhalter.
// Fallback auf null falls Template nicht existiert.
async function loadTemplate(
  supabase: any,
  templateKey: string,
  vars: Record<string, string>
): Promise<{ subject: string; body: string } | null> {
  try {
    const { data } = await supabase
      .from("message_templates")
      .select("body")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .maybeSingle();
    if (!data?.body) return null;
    const parts = String(data.body).split(/\n---\n/);
    if (parts.length < 2) return null;
    const subjectLine = parts[0].replace(/^Betreff:\s*/i, "").trim();
    let body = parts.slice(1).join("\n---\n").trim();
    let subject = subjectLine;
    for (const [key, val] of Object.entries(vars)) {
      const re = new RegExp(`\\{${key}\\}`, "g");
      body = body.replace(re, val);
      subject = subject.replace(re, val);
    }
    return { subject, body };
  } catch (e) {
    return null;
  }
}

// Konvertiert Plaintext-Body zu HTML (für Resend)
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; background: #f8f7f4; padding: 32px; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0A3A5A; font-size: 22px; margin: 0;">Betreuung neuer Muslime</h1>
      </div>
      <div style="color: #475467; line-height: 1.5;">${escaped}</div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="https://neuemuslime.com" style="display: inline-block; padding: 12px 28px; background: #EEA71B; color: #0A3A5A; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px;">Zur BNM-App →</a>
      </div>
      <p style="color: #98A2B3; font-size: 12px; margin-top: 24px; text-align: center;">
        Betreuung neuer Muslime · <a href="https://neuemuslime.com" style="color: #98A2B3;">neuemuslime.com</a>
      </p>
    </div>`;
}

Deno.serve(async (req: Request) => {
  // GET + POST erlauben (pg_cron nutzt manchmal GET)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const now = new Date();
  const thresholdDate = new Date(now.getTime() - REMINDER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cooldownDate = new Date(now.getTime() - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Alle aktiven Mentorships mit Mentor- und Mentee-Daten laden
  const { data: mentorships, error: mError } = await supabase
    .from("mentorships")
    .select(`
      id,
      mentor_id,
      mentee_id,
      assigned_at,
      mentor:profiles!mentor_id(name, email, push_token),
      mentee:profiles!mentee_id(name)
    `)
    .eq("status", "active");

  if (mError || !mentorships?.length) {
    return new Response(
      JSON.stringify({ ok: true, processed: 0, reason: mError?.message ?? "no active mentorships" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  let notifCount = 0;
  let pushCount = 0;
  let emailCount = 0;
  const errors: string[] = [];

  for (const m of mentorships) {
    const mentorData = m.mentor as { name?: string; email?: string; push_token?: string } | null;
    const menteeData = m.mentee as { name?: string } | null;
    const menteeName = menteeData?.name ?? "deinem Mentee";

    // Letzte Session ermitteln
    const { data: lastSessionRow } = await supabase
      .from("sessions")
      .select("date")
      .eq("mentorship_id", m.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastActivityDate = lastSessionRow?.date ?? m.assigned_at;

    // Schwellwert-Check: Letzte Aktivität < threshold?
    if (new Date(lastActivityDate) > new Date(thresholdDate)) continue;

    // Cooldown-Check: Bereits eine Erinnerung in den letzten 2 Tagen?
    const { data: existingReminder } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", m.mentor_id)
      .eq("type", "reminder")
      .eq("related_id", m.id)
      .gte("created_at", cooldownDate)
      .maybeSingle();

    if (existingReminder) continue;

    // ── 1. Notification in DB ──
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: m.mentor_id,
      type: "reminder",
      title: "Erinnerung: Session dokumentieren",
      body: `Bitte dokumentiere deine letzte Session mit ${menteeName}.`,
      related_id: m.id,
      read: false,
    });

    if (notifError) {
      errors.push(`Notif-Insert Fehler (${m.id}): ${notifError.message}`);
    } else {
      notifCount++;
    }

    // ── 2. Push Notification via Expo ──
    const pushToken = mentorData?.push_token;
    if (pushToken?.startsWith("ExponentPushToken")) {
      try {
        await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
          },
          body: JSON.stringify({
            to: pushToken,
            title: "Erinnerung: Session dokumentieren",
            body: `Bitte dokumentiere deine letzte Session mit ${menteeName}.`,
            sound: "default",
            badge: 1,
            data: { type: "reminder", mentorshipId: m.id },
          }),
        });
        pushCount++;
      } catch (e) {
        errors.push(`Push-Fehler (${m.mentor_id}): ${e}`);
      }
    }

    // ── 3. E-Mail via Resend ──
    if (mentorData?.email && resendKey) {
      try {
        const mentorName = mentorData.name ?? "Mentor";
        // Template aus DB laden (Admin kann anpassen)
        const tpl = await loadTemplate(supabase, "mentor_reminder", {
          name: mentorName,
          mentee_name: menteeName,
          days: String(REMINDER_THRESHOLD_DAYS),
        });
        const subject = tpl?.subject ?? "BNM: Session-Erinnerung";
        const html = tpl
          ? textToHtml(tpl.body)
          : `<p>Hallo ${mentorName},</p><p>Bitte dokumentiere deine letzte Session mit ${menteeName}.</p>`;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "BNM <noreply@neuemuslime.com>",
            to: [mentorData.email],
            subject,
            html,
          }),
        });

        if (emailRes.ok) {
          emailCount++;
        } else {
          const errText = await emailRes.text();
          errors.push(`E-Mail-Fehler (${mentorData.email}): ${errText.slice(0, 200)}`);
        }
      } catch (e) {
        errors.push(`E-Mail-Exception (${mentorData.email}): ${e}`);
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      notifications: notifCount,
      pushes: pushCount,
      emails: emailCount,
      errors: errors.length ? errors : undefined,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
