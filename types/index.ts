export type UserRole = "admin" | "office" | "mentor" | "mentee";
export type Gender = "male" | "female";
export type MentorshipStatus = "active" | "completed" | "cancelled" | "pending_approval";
export type ContactPreference = "phone" | "whatsapp" | "telegram" | "email";
export type SessionMode = "online" | "offline";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  gender: Gender;
  name: string;
  phone?: string;
  city: string;
  plz: string;
  age: number;
  contact_preference: ContactPreference;
  avatar_url?: string;
  created_at: string;
  is_active?: boolean;
  total_xp?: number;
  mentor_level?: string;
  lat?: number;
  lng?: number;
  force_password_change?: boolean;
  admin_notes?: string;
}

export interface Mentorship {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: MentorshipStatus;
  assigned_by: string;
  assigned_at: string;
  completed_at?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  notes?: string;
  mentee_notes?: string;
  mentor?: User;
  mentee?: User;
  mentee_confirmed_steps?: string[];
}

export interface SessionType {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  description: string;
  allows_multiple?: boolean;
}

export interface Session {
  id: string;
  mentorship_id: string;
  session_type_id: string;
  date: string;
  is_online: boolean;
  details?: string;
  documented_by: string;
  attempt_number?: number;
  duration_minutes?: number;
  session_type?: SessionType;
  mentorship?: Mentorship;
}

export interface QuestionnaireAnswers {
  q1_1: number;       // Rating 1-5: Gesamtzufriedenheit
  q1_2: string;       // Text: Wichtigster Grund
  q1_3: number;       // Rating 1-5: Mentor-Unterstützung
  q2_1: number;       // Rating 1-5: Fragen ernst genommen
  q2_2: string[];     // Multi-Select: Mehr Unterstützung gewünscht
  q2_2b?: string;     // Text: Erläuterung "Andere"
  q3_1: number;       // Rating 1-5: Persönliche Beziehung
  q3_2: string;       // Text: Was gefallen/schwierig
  q3_3: number;       // Rating 1-5: Ermutigt/gestärkt
  q4_1: string;       // Text: Besonders gut gefallen
  q4_2: string[];     // Multi-Select: Besser machen
  q4_2b?: string;     // Text: Erläuterung "Andere"
  q4_3: string;       // Single-Select: Kontakt halten
  q4_4: string;       // Single-Select: Aktueller Stand
  q4_5?: string;      // Text: Warum vorzeitig beendet
  q5_1?: string;      // Text: Weitere Anmerkungen
}

export interface Feedback {
  id: string;
  mentorship_id: string;
  submitted_by: string;
  rating: number;
  comments?: string;
  answers?: QuestionnaireAnswers;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  title: string;
  category: string;
  body: string;
  subject?: string;
  sort_order: number;
  is_active: boolean;
  template_key?: string;
}

export type ResourceVisibility = "all" | "mentors" | "mentees" | "male" | "female";

export interface Resource {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  visible_to: ResourceVisibility;
  visible_until: string | null;
  visible_after_session_type_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  mentorship_id: string;
  sender_id: string;
  content: string;
  read_at?: string;
  created_at: string;
  sender?: User;
}

export type EventParticipationStatus = "interested" | "confirmed" | "declined";

export interface EventParticipation {
  id: string;
  resource_id: string;
  user_id: string;
  status: EventParticipationStatus;
  created_at: string;
}

export interface ResourceCompletion {
  id: string;
  resource_id: string;
  user_id: string;
  completed_at: string;
}

// Calendar
export type CalendarEventType = "webinar" | "retreat" | "kurs" | "meeting" | "custom";
export type EventAttendeeStatus = "invited" | "accepted" | "declined";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  type: CalendarEventType;
  location: string;
  created_by: string | null;
  recurrence: "weekly" | "biweekly" | "monthly" | null;
  visible_to: ResourceVisibility;
  is_active: boolean;
  google_calendar_event_id: string | null;
  created_at: string;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: EventAttendeeStatus;
  reminder_minutes: number;
  google_synced: boolean;
  created_at: string;
}

export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface MentorApplication {
  id: string;
  name: string;
  email: string;
  city: string;
  plz?: string;
  gender: Gender;
  age: number;
  experience: string;
  motivation: string;
  contact_preference: ContactPreference;
  phone?: string;
  status: ApplicationStatus;
  submitted_at: string;
  application_type?: "mentor" | "mentee";
}

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<"ok" | "banned" | "invalid">;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export type NotificationType = "assignment" | "reminder" | "progress" | "message" | "feedback" | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  related_id?: string;
}

export interface XPEntry {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  related_id?: string;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_key: string;
  unlocked_at: string;
}

export interface ThankEntry {
  id: string;
  mentorship_id: string;
  mentee_id: string;
  mentor_id: string;
  session_type_id?: string;
  message: string;
  created_at: string;
}

export interface StreakData {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string;
}

export type SurveyVisibility = "all" | "male" | "female";
export type SurveyResponse = "yes" | "maybe" | "no";

export interface ParticipationSurvey {
  id: string;
  title: string;
  description?: string;
  survey_date?: string;
  visible_to: SurveyVisibility;
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface ParticipationSurveyResponse {
  id: string;
  survey_id: string;
  user_id: string;
  response: SurveyResponse;
  created_at: string;
}
