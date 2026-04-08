-- ============================================================
-- delete_own_account: Mentoren/Mentees können eigenen Account löschen.
-- Soft-Delete: Profil anonymisieren + Auth sperren (KEIN CASCADE-Problem).
-- Completed Mentorships + Sessions bleiben für Reports erhalten.
--
-- Dieses Statement in Supabase SQL-Editor ausführen.
-- ============================================================

CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
  my_id UUID := auth.uid();
BEGIN
  -- Rolle prüfen: nur Mentor/Mentee dürfen sich selbst löschen
  SELECT role INTO caller_role FROM profiles WHERE id = my_id;
  IF caller_role IS NULL OR caller_role NOT IN ('mentor', 'mentee') THEN
    RETURN FALSE;
  END IF;

  -- 1. Completed Mentorships: eigene Referenz auf NULL setzen (bleibt zählbar)
  IF caller_role = 'mentor' THEN
    UPDATE mentorships SET mentor_id = NULL
      WHERE mentor_id = my_id AND status = 'completed';
  ELSE
    UPDATE mentorships SET mentee_id = NULL
      WHERE mentee_id = my_id AND status = 'completed';
  END IF;

  -- 2. Aktive/Pending Mentorships: zugehörige Daten löschen
  DELETE FROM sessions
    WHERE mentorship_id IN (
      SELECT id FROM mentorships
      WHERE (mentor_id = my_id OR mentee_id = my_id) AND status != 'completed'
    );

  DELETE FROM messages
    WHERE mentorship_id IN (
      SELECT id FROM mentorships
      WHERE (mentor_id = my_id OR mentee_id = my_id) AND status != 'completed'
    );

  DELETE FROM feedback
    WHERE mentorship_id IN (
      SELECT id FROM mentorships
      WHERE (mentor_id = my_id OR mentee_id = my_id) AND status != 'completed'
    );

  DELETE FROM mentorships
    WHERE (mentor_id = my_id OR mentee_id = my_id) AND status != 'completed';

  -- 3. Notifications löschen
  DELETE FROM notifications WHERE user_id = my_id;

  -- 4. Profil anonymisieren
  UPDATE profiles SET
    name       = '[Gelöscht]',
    email      = '',
    phone      = NULL,
    avatar_url = NULL,
    is_active  = FALSE,
    city       = '',
    age        = NULL
  WHERE id = my_id;

  -- 5. Auth-User sperren (KEIN DELETE → kein CASCADE!)
  UPDATE auth.users
  SET banned_until = '9999-12-31 23:59:59+00'::TIMESTAMPTZ
  WHERE id = my_id;

  RETURN TRUE;
END;
$$;

-- Berechtigungen
REVOKE ALL ON FUNCTION delete_own_account() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
