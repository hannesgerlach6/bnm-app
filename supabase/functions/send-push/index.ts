// Supabase Edge Function: send-push
// Wird via Database Webhook bei INSERT in messages / admin_messages aufgerufen.
// Sendet Push-Notification via Expo Push API an den Empfänger.
//
// Deploy:
//   supabase functions deploy send-push --project-ref cufuikcxliwbmyhwlmga
//
// Webhook im Dashboard einrichten:
//   Database → Webhooks → Create Webhook
//   → Table: messages, Event: INSERT, URL: <function-url>/send-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req: Request) => {
  // Nur POST erlauben
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Supabase Webhook liefert { type, table, record, old_record, schema }
  const record = (payload.record ?? payload) as Record<string, unknown>;
  const table = (payload.table as string) ?? "messages";

  // Service-Role-Client für DB-Zugriff
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let recipientId: string | null = null;
  let senderName = "BNM";
  let messageText = "";

  if (table === "messages") {
    // Chat-Nachricht: Empfänger ist der ANDERE im Mentorship
    const mentorshipId = record.mentorship_id as string;
    const senderId = record.sender_id as string;
    messageText = (record.content as string) ?? "";

    // Mentorship laden um Empfänger zu ermitteln
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

    // Sender-Name laden
    const { data: sender } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", senderId)
      .single();
    if (sender) senderName = sender.name;

  } else if (table === "admin_messages") {
    // Admin-Nachricht: Empfänger ist user_id (wenn Admin schreibt)
    // oder Admin (wenn User schreibt) — wir benachrichtigen immer den user_id-Träger
    const adminId = record.admin_id as string | undefined;
    const userId = record.user_id as string;
    const senderId = record.sender_id as string;
    messageText = (record.content as string) ?? "";

    // Empfänger: wer hat die Nachricht NICHT geschrieben?
    if (senderId === userId) {
      // User schreibt → Admin bekommt Push (admin_id aus record)
      recipientId = adminId ?? null;
    } else {
      // Admin schreibt → User bekommt Push
      recipientId = userId;
    }

    // Sender-Name
    const { data: sender } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", senderId)
      .single();
    if (sender) senderName = sender.name;
  }

  if (!recipientId) {
    return new Response(JSON.stringify({ ok: false, reason: "no recipient" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Push Token des Empfängers laden
  const { data: recipient } = await supabase
    .from("profiles")
    .select("push_token, name")
    .eq("id", recipientId)
    .single();

  const pushToken = recipient?.push_token as string | null;
  if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
    return new Response(
      JSON.stringify({ ok: false, reason: "no valid push token", recipient: recipientId }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Nachricht kürzen
  const body =
    messageText.length > 100 ? messageText.substring(0, 100) + "…" : messageText;

  // Expo Push API aufrufen
  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: pushToken,
      title: `Neue Nachricht von ${senderName}`,
      body,
      sound: "default",
      badge: 1,
      data: { table, senderId: record.sender_id },
    }),
  });

  const pushResult = await pushRes.json();

  return new Response(JSON.stringify({ ok: true, pushResult }), {
    headers: { "Content-Type": "application/json" },
  });
});
