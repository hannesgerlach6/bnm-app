-- Mentee-Bestätigungs-Feld für die mentorships-Tabelle
-- Mentee kann jeden Schritt aus seiner Sicht als erledigt markieren
-- Das Admin/Mentor-System prüft Diskrepanzen (Mentee bestätigt, Mentor nicht dokumentiert)
ALTER TABLE mentorships ADD COLUMN IF NOT EXISTS mentee_confirmed_steps TEXT[] DEFAULT '{}';
