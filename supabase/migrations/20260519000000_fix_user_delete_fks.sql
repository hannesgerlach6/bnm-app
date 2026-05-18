-- Fix: User-Löschung scheitert an FK-Constraints ohne ON DELETE-Klausel
--
-- Problem: Wenn ein Admin/Office-User gelöscht werden soll, der zuvor
-- Mentorships zugewiesen, Bewerbungen reviewed oder QA-Einträge erstellt hat,
-- blockiert die FK ohne ON DELETE-Klausel (default NO ACTION) das DELETE
-- mit Fehler 23503.
--
-- Beobachteter Fehler:
--   update or delete on table "profiles" violates foreign key constraint
--   "mentorships_assigned_by_fkey" on table "mentorships"
--
-- Fix: FKs auf ON DELETE SET NULL umstellen, damit Referenzen erhalten bleiben,
-- aber den User-Delete nicht blockieren.

ALTER TABLE mentorships
  DROP CONSTRAINT IF EXISTS mentorships_assigned_by_fkey;
ALTER TABLE mentorships
  ADD CONSTRAINT mentorships_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE mentor_applications
  DROP CONSTRAINT IF EXISTS mentor_applications_reviewed_by_fkey;
ALTER TABLE mentor_applications
  ADD CONSTRAINT mentor_applications_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE qa_entries
  DROP CONSTRAINT IF EXISTS qa_entries_created_by_fkey;
ALTER TABLE qa_entries
  ADD CONSTRAINT qa_entries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
