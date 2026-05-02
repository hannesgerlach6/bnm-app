/**
 * Edge Function: google-calendar-auth
 * Tauscht einen Google OAuth Auth-Code sicher gegen Access + Refresh Token.
 * Das GOOGLE_CLIENT_SECRET wird NICHT im Frontend gespeichert — nur hier.
 *
 * Deploy: supabase functions deploy google-calendar-auth --project-ref cufuikcxliwbmyhwlmga
 * Secrets: supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // ── JWT-Authentifizierung ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Request-Body lesen ────────────────────────────────────────────────────
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Google Token-Tausch ───────────────────────────────────────────────────
    const clientId     = Deno.env.get("GOOGLE_CLIENT_ID")     ?? "";
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

    if (!clientId || !clientSecret) {
      console.error("[google-calendar-auth] GOOGLE_CLIENT_ID oder GOOGLE_CLIENT_SECRET fehlt — bitte Supabase Secrets setzen");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type:    "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[google-calendar-auth] Google Token-Fehler:", tokenRes.status, errText);
      return new Response(JSON.stringify({ error: "Google token exchange failed", detail: errText }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ error: "No access_token in response" }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        access_token:  tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? "",
        expires_in:    tokenData.expires_in,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[google-calendar-auth] Unerwarteter Fehler:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
