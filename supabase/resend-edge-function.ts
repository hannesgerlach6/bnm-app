// ============================================================
// Supabase Edge Function: resend-mailer
//
// Deployment:
//   supabase functions deploy resend-mailer
//
// Secrets (einmalig setzen, NIE in den Code):
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set FROM_EMAIL="BNM <noreply@bnm-app.de>"
//
// Diese Funktion liest pending E-Mails aus der email_queue
// und sendet sie via Resend. Sie kann per Supabase Cron oder
// externem Webhook getriggert werden.
// ============================================================

/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "BNM <noreply@bnm-app.de>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Alle pending E-Mails laden (max. 50 pro Durchlauf)
  const { data: emails, error } = await supabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .limit(50);

  if (error || !emails || emails.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  let processed = 0;

  for (const mail of emails) {
    const recipient = mail.override_to || mail.to_email;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [recipient],
        subject: mail.subject,
        html: mail.body,
      }),
    });

    const newStatus = res.ok ? "sent" : "failed";
    await supabase
      .from("email_queue")
      .update({ status: newStatus, sent_at: res.ok ? new Date().toISOString() : null })
      .eq("id", mail.id);

    if (res.ok) processed++;
  }

  return new Response(JSON.stringify({ processed }), { status: 200 });
});
*/
