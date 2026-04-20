-- Fix: testmentor01 und testmentorin01 von 'mentee' auf 'mentor' setzen
-- (waren falsch als mentee angelegt weil handle_new_user() Rolle überschrieb)

UPDATE profiles
SET role = 'mentor'
WHERE email IN ('testmentorin01@test.de', 'testmentor01@test.de')
  AND role = 'mentee';

-- Prüfen:
SELECT id, email, name, role, gender FROM profiles
WHERE email IN ('testmentorin01@test.de', 'testmentor01@test.de');
