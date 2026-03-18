import type { Mentorship, Session, Notification } from '../types';

const REMINDER_THRESHOLD_DAYS = 3;
const REMINDER_COOLDOWN_DAYS = 2;

/**
 * Prüft ob Mentoren Erinnerungen bekommen sollten.
 * Wird beim App-Start client-seitig aufgerufen.
 * Ersetzt später durch Supabase Edge Function / pg_cron (siehe supabase/edge-functions.sql).
 *
 * Logik:
 * - Für jeden aktiven Mentorship des eingeloggten Mentors:
 *   - Wenn die letzte Session > 3 Tage zurückliegt → Erinnerung generieren
 *   - Aber nur wenn noch keine Erinnerung in den letzten 2 Tagen existiert
 *
 * @returns Array von Notification-Objekten (ohne id/created_at) zum Einfügen in die DB
 */
export function checkReminders(
  mentorships: Mentorship[],
  sessions: Session[],
  notifications: Notification[],
  currentUserId: string
): Array<Omit<Notification, 'id' | 'created_at' | 'read'>> {
  const now = Date.now();
  const thresholdMs = REMINDER_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const cooldownMs = REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  const result: Array<Omit<Notification, 'id' | 'created_at' | 'read'>> = [];

  // Nur aktive Mentorships bei denen der aktuelle User Mentor ist
  const myActiveMentorships = mentorships.filter(
    (m) => m.mentor_id === currentUserId && m.status === 'active'
  );

  for (const mentorship of myActiveMentorships) {
    // Letzte Session dieser Mentorship ermitteln
    const mentorshipSessions = sessions
      .filter((s) => s.mentorship_id === mentorship.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const lastSession = mentorshipSessions[0];
    const lastSessionTime = lastSession
      ? new Date(lastSession.date).getTime()
      : new Date(mentorship.assigned_at).getTime();

    const daysSinceLastSession = now - lastSessionTime;

    // Schwellwert überschritten?
    if (daysSinceLastSession <= thresholdMs) continue;

    // Bereits eine Erinnerung in den letzten 2 Tagen gesendet?
    const recentReminder = notifications.find(
      (n) =>
        n.type === 'reminder' &&
        n.related_id === mentorship.id &&
        now - new Date(n.created_at).getTime() < cooldownMs
    );
    if (recentReminder) continue;

    // Erinnerung generieren
    const menteeName = mentorship.mentee?.name ?? 'deinem Mentee';
    result.push({
      type: 'reminder',
      title: 'Erinnerung: Session dokumentieren',
      body: `Bitte dokumentiere deine letzte Session mit ${menteeName}.`,
      related_id: mentorship.id,
    });
  }

  return result;
}
