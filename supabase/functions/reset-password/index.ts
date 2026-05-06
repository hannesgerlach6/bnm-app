// Deno Edge Function: Passwort-Reset per Resend (statt Supabase Built-in Mailer)
// Generiert einen Reset-Link über Supabase Admin API und sendet ihn per Resend.
// Damit umgeht man das Supabase Free Plan E-Mail-Limit (3/Stunde).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: { email?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ungültiger JSON-Body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { email } = payload;
  if (!email) {
    return new Response(JSON.stringify({ error: "E-Mail fehlt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";

  if (!serviceRoleKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Server-Konfiguration fehlt" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Reset-Link über Supabase Admin API generieren
  const appUrl = "https://neuemuslime.com";
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: { redirectTo: `${appUrl}/reset-password` },
  });

  if (error || !data?.properties?.action_link) {
    // Kein Fehler zurückgeben ob die E-Mail existiert oder nicht (verhindert E-Mail-Enumeration)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resetLink = data.properties.action_link;

  // Template aus DB laden — Admin kann Text anpassen
  let subject = "[BNM] Passwort zurücksetzen";
  let bodyText: string | null = null;
  try {
    const { data: tplRow } = await supabase
      .from("message_templates")
      .select("body")
      .eq("template_key", "password_reset")
      .eq("is_active", true)
      .maybeSingle();
    if (tplRow?.body) {
      const parts = String(tplRow.body).split(/\n---\n/);
      if (parts.length >= 2) {
        const subjectLine = parts[0].replace(/^Betreff:\s*/i, "").trim();
        let body = parts.slice(1).join("\n---\n").trim();
        // Username aus E-Mail ableiten (vor @)
        const emailLocal = email.split("@")[0];
        const vars: Record<string, string> = {
          name: emailLocal,
          reset_link: resetLink,
        };
        for (const [k, v] of Object.entries(vars)) {
          const re = new RegExp(`\\{${k}\\}`, "g");
          body = body.replace(re, v);
        }
        subject = subjectLine || subject;
        bodyText = body;
      }
    }
  } catch {
    // Template-Lookup fehlgeschlagen — Fallback unten
  }

  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const htmlBody = bodyText
    ? `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0A3A5A;padding:24px;text-align:center">
    <h1 style="color:#EEA71B;margin:0;font-size:28px">BNM</h1>
    <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px">Betreuung neuer Muslime</p>
  </div>
  <div style="padding:32px;background:#fff">
    <div style="color:#475467;font-size:14px;line-height:22px;white-space:pre-line">${escapeHtml(bodyText)}</div>
  </div>
  <div style="padding:16px;background:#F9FAFB;text-align:center">
    <p style="color:#98A2B3;font-size:12px;margin:0">BNM – Betreuung neuer Muslime · neuemuslime.com</p>
  </div>
</div>`.trim()
    : `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0A3A5A;padding:24px;text-align:center">
    <h1 style="color:#EEA71B;margin:0;font-size:28px">BNM</h1>
  </div>
  <div style="padding:32px;background:#fff">
    <h2 style="color:#0A3A5A">Passwort zurücksetzen</h2>
    <p>Klicke auf den folgenden Link, um ein neues Passwort zu wählen:</p>
    <a href="${resetLink}" style="display:inline-block;background:#0A3A5A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Neues Passwort wählen</a>
    <p style="color:#98A2B3;font-size:12px">Der Link ist 1 Stunde gültig.</p>
  </div>
</div>`.trim();

  try {
    const cleanKey = resendKey.replace(/[^\x20-\x7E]/g, "").trim();
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BNM <noreply@neuemuslime.com>",
        to: [email.trim().toLowerCase()],
        subject,
        html: htmlBody,
      }),
    });
  } catch {
    // Fehler beim Senden ignorieren — User sieht trotzdem Erfolgs-Meldung
  }

  // Immer OK zurückgeben (E-Mail-Enumeration verhindern)
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
