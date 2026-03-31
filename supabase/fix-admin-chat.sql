-- Migration: Admin/Office darf in Chats schreiben
-- Führe dieses SQL im Supabase Dashboard → SQL Editor aus

-- messages_insert: Admin/Office darf ebenfalls Nachrichten einfügen
DROP POLICY IF EXISTS "messages_insert" ON messages;

CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND (
    -- Normaler User: nur in eigenen Mentorships
    mentorship_id IN (
      SELECT id FROM mentorships WHERE mentor_id = auth.uid() OR mentee_id = auth.uid()
    )
    -- Admin/Office: in allen Mentorships
    OR get_user_role() IN ('admin', 'office')
  )
);

-- messages_delete: Admin/Office darf löschen; sonst nur eigene Nachrichten
DROP POLICY IF EXISTS "messages_delete" ON messages;

CREATE POLICY "messages_delete" ON messages FOR DELETE USING (
  sender_id = auth.uid()
  OR get_user_role() IN ('admin', 'office')
);
