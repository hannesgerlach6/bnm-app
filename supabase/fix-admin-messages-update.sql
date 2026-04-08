-- Migration: admin_messages UPDATE Policy für markAdminChatAsRead
-- Ohne diese Policy schlägt supabase.update({read_at}) für Mentoren/Mentees lautlos fehl →
-- Chat-Badge (9+) wird nie zurückgesetzt.
-- Führe dieses SQL im Supabase Dashboard → SQL Editor aus.

DROP POLICY IF EXISTS "Users can update read_at on their own admin messages" ON admin_messages;

CREATE POLICY "Users can update read_at on their own admin messages" ON admin_messages
  FOR UPDATE USING (
    user_id = auth.uid()
  );
