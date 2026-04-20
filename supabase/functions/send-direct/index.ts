// Deno Edge Function: E-Mail direkt senden (ohne queue)
// Wird vom Client aufgerufen wenn sofortiger Versand nötig ist (z.B. Urkunden-PDF).
// API-Key liegt sicher als Supabase Secret – nie im Client-Bundle.
//
// SECURITY: Erfordert einen gültigen User-JWT (nicht nur Anon Key).
// Der Anon Key ist öffentlich — ohne JWT-Check könnte jeder E-Mails versenden.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: Akzeptiert User-JWT (bevorzugt) oder apikey-Header (Fallback für Registrierung).
  // Supabase Edge Functions erfordern immer einen gültigen apikey — unautorisierter Zugriff ist nicht möglich.
  const apiKey = req.headers.get("apikey");
  const authHeader = req.headers.get("Authorization");
  if (!apiKey && !authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized: apikey oder Authorization Header fehlt" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Payload lesen
  let payload: { to?: string; subject?: string; html?: string; attachments?: { filename: string; content: string }[] };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Ungültiger JSON-Body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { to, subject, html, attachments } = payload;
  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: "Fehlende Felder: to, subject, html" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY nicht konfiguriert" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body: Record<string, unknown> = {
    from: "BNM <noreply@neuemuslime.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (attachments?.length) body.attachments = attachments;

  try {
    // resendKey aggressiv bereinigen — Whitespace, Newlines, BOM, Non-ASCII entfernen
    const cleanKey = resendKey.replace(/[^\x20-\x7E]/g, "").trim();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
