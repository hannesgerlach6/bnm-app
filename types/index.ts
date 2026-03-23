export type UserRole = "admin" | "office" | "mentor" | "mentee";
export type Gender = "male" | "female";
export type MentorshipStatus = "pending_approval" | "active" | "completed" | "cancelled";
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
}

export interface Mentorship {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: MentorshipStatus;
  assigned_by: string;
  assigned_at: string;
  completed_at?: string;
  notes?: string;
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

export interface Feedback {
  id: string;
  mentorship_id: string;
  submitted_by: string;
  rating: number;
  comments?: string;
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

export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface MentorApplication {
  id: string;
  name: string;
  email: string;
  city: string;
  gender: Gender;
  age: number;
  experience: string;
  motivation: string;
  contact_preference: ContactPreference;
  phone?: string;
  status: ApplicationStatus;
  submitted_at: string;
}

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginAs: (role: UserRole) => Promise<{ success: boolean; error?: string }>;
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
