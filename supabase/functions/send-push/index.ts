// Supabase Edge Function: send-push
// Wird via Database Webhook aufgerufen bei INSERT in:
//   - messages         → Chat-Nachricht
//   - admin_messages   → Admin-Direktnachricht
//   - notifications    → Alle anderen Push-Typen (Zuweisung, Kalender, System, ...)
//
// Deploy:
//   supabase functions deploy send-push --project-ref cufuikcxliwbmyhwlmga
//
// Webhooks im Dashboard einrichten (Database → Webhooks):
//   1. Table: messages,       Event: INSERT → send-push
//   2. Table: admin_messages, Event: INSERT → send-push
//   3. Table: notifications,  Event: INSERT → send-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const NOTIFICATION_TITLES: Record<string, string> = {
  assignment:     "Neue Zuweisung",
  reminder:       "Erinnerung",
  progress:       "Betreuungs-Update",
  message:        "Neue Nachricht",
  feedback:       "Feedback",
  system:         "BNM",
  calendar_invite:"Neuer Termin",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = (payload.record ?? payload) as Record<string, unknown>;
  const table = (payload.table as string) ?? "notifications";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let recipientId: string | null = null;
  let pushTitle = "BNM";
  let pushBody = "";

  // ── notifications table (alle Benachrichtigungs-Typen) ───────────────────
  if (table === "notifications") {
    recipientId = record.user_id as string;
    const notifType = (record.type as string) ?? "system";
    pushTitle = NOTIFICATION_TITLES[notifType] ?? "BNM";
    pushBody  = (record.body as string) ?? (record.title as string) ?? "";

  // ── messages (Mentorship-Chat) ────────────────────────────────────────────
  } else if (table === "messages") {
    const mentorshipId = record.mentorship_id as string;
    const senderId     = record.sender_id as string;
    pushBody           = (record.content as string) ?? "";

    const { data: mentorship } = await supabase
      .from("mentorships")
      .select("mentor_id, mentee_id")
      .eq("id", mentorshipId)
      .single();

    if (mentorship) {
      recipientId =
        senderId === mentorship.mentor_id
          ? mentorship.mentee_id
          : mentorship.mentor_id;
    }

    const { data: sender } = await supabase
      .from("profiles").select("name").eq("id", senderId).single();
    pushTitle = `Neue Nachricht von ${sender?.name ?? "BNM"}`;

  // ── admin_messages ────────────────────────────────────────────────────────
  } else if (table === "admin_messages") {
    const adminId  = record.admin_id as string | undefined;
    const userId   = record.user_id as string;
    const senderId = record.sender_id as string;
    pushBody       = (record.content as string) ?? "";

    recipientId = senderId === userId ? (adminId ?? null) : userId;

    const { data: sender } = await supabase
      .from("profiles").select("name").eq("id", senderId).single();
    pushTitle = `Neue Nachricht von ${sender?.name ?? "BNM"}`;
  }

  if (!recipientId) {
    return new Response(JSON.stringify({ ok: false, reason: "no recipient" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Push Token des Empfängers
  const { data: recipient } = await supabase
    .from("profiles").select("push_token").eq("id", recipientId).single();

  const pushToken = recipient?.push_token as string | null;
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
    return new Response(
      JSON.stringify({ ok: false, reason: "no valid push token", recipient: recipientId }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const body = pushBody.length > 120 ? pushBody.substring(0, 120) + "…" : pushBody;

  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      to:    pushToken,
      title: pushTitle,
      body,
      sound: "default",
      badge: 1,
      data:  { table, type: record.type ?? null },
    }),
  });

  const pushResult = await pushRes.json();

  return new Response(JSON.stringify({ ok: true, pushResult }), {
    headers: { "Content-Type": "application/json" },
  });
});
