-- Kalender: Mentoren/Mentees dürfen eigene Termine erstellen
-- Migration #25: 2026-04-30

-- Eingeloggte User dürfen eigene Events erstellen
CREATE POLICY "Authenticated users can create events"
  ON calendar_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- User darf eigene Events bearbeiten und löschen (nur selbst erstellte)
CREATE POLICY "Users can update own events"
  ON calendar_events FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own events"
  ON calendar_events FOR DELETE
  USING (created_by = auth.uid());
