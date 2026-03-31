-- Admin kann Passwort eines beliebigen Users zurücksetzen
-- Benötigt pgcrypto (in Supabase standardmäßig aktiv)
-- Nutzt SECURITY DEFINER → läuft als DB-Owner mit Zugriff auf auth.users

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_reset_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS void AS $$
BEGIN
  -- Nur Admin darf diese Funktion aufrufen
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password too short (minimum 6 characters)';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Zugriff für eingeloggte User erlauben (RLS-Check erfolgt intern via get_user_role)
GRANT EXECUTE ON FUNCTION admin_reset_user_password(UUID, TEXT) TO authenticated;
