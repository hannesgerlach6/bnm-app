-- Migration: DELETE-Policy fuer mentor_applications
-- Admin/Office koennen Bewerbungen komplett loeschen

CREATE POLICY "applications_delete" ON mentor_applications FOR DELETE USING (
  get_user_role() IN ('admin', 'office')
);
