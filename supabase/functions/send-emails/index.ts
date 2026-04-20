// Deno Edge Function: E-Mails aus email_queue versenden
// Liest alle pending Mails, sendet via Resend API, markiert als sent/failed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Pending Mails holen (max. 50 pro Aufruf)
  const { data: emails, error } = await supabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!emails?.length) {
    return new Response(JSON.stringify({ sent: 0, total: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;

  for (const email of emails) {
    // override_to wird beachtet: alle Mails an Test-Adresse wenn gesetzt
    const recipient = email.override_to || email.to_email;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "BNM <noreply@neuemuslime.com>",
          to: [recipient],
          subject: email.subject,
          html: email.html_body,
        }),
      });

      if (res.ok) {
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", email.id);
        sent++;
      } else {
        const errBody = await res.text();
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            error: errBody.slice(0, 500),
          })
          .eq("id", email.id);
      }
    } catch (err) {
      await supabase
        .from("email_queue")
        .update({
          status: "failed",
          error: err instanceof Error ? err.message : "Unbekannter Fehler",
        })
        .eq("id", email.id);
    }
  }

  return new Response(JSON.stringify({ sent, total: emails.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
