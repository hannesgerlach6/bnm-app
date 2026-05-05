import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
  MutableRefObject,
} from "react";
import { Platform } from "react-native";
import type {
  User,
  Mentorship,
  Session,
  SessionType,
  Feedback,
  Message,
  MentorshipStatus,
  MentorApplication,
  ApplicationStatus,
  Notification,
  MessageTemplate,
  Resource,
  EventParticipation,
  EventParticipationStatus,
  ResourceCompletion,
  CalendarEvent,
  CalendarEventType,
  EventAttendee,
  EventAttendeeStatus,
  ResourceVisibility,
} from "../types";
import { XP_VALUES } from "../lib/gamification";

// ─── Gamification Ref Type (für GamificationContext-Kommunikation) ──────────
export interface GamificationCallbacks {
  awardXP: (userId: string, amount: number, reason: string, relatedId?: string) => void;
  checkAndUnlockAchievements: (userId: string) => Promise<void>;
  updateStreak: (userId: string) => Promise<void>;
}
import { supabase } from "../lib/supabase";
import { supabaseAnon } from "../lib/supabaseAnon";
import { useAuth } from "./AuthContext";
import { checkReminders, checkMenteeReminders, checkEventReminders } from "../lib/reminders";
import { geocodePLZ } from "../lib/geocoding";
import { showError, showSuccess } from "../lib/errorHandler";
import {
  sendMentorshipStatusChangeNotification,
  sendCredentialsEmail,
  sendMenteeAssignedNotification,
  sendFeedbackRequestEmail,
  sendMentorshipCancelledToMenteeEmail,
  sendFeedbackCopyToMentorEmail,
} from "../lib/emailService";
import { sendLocalNotification, notifyNewMessage, notifyMentorAssigned, notifyMenteeAssigned, notifyMentorshipCompleted, notifyFeedbackRequested } from "../lib/notificationService";

export interface Hadith {
  id: string;
  text_de: string;
  text_ar?: string;
  source?: string;
  sort_order?: number;
}

export interface AdminMessage {
  id: string;
  admin_id: string;
  user_id: string;
  sender_id: string;
  content: string;
  read_at?: string;
  created_at: string;
  sender?: User;
}

export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  is_published: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DataContextValue {
  // Data
  users: User[];
  mentorships: Mentorship[];
  sessions: Session[];
  sessionTypes: SessionType[];
  feedback: Feedback[];
  messages: Message[];
  applications: MentorApplication[];
  notifications: Notification[];
  hadithe: Hadith[];
  qaEntries: QAEntry[];
  messageTemplates: MessageTemplate[];
  resources: Resource[];
  eventParticipations: EventParticipation[];
  resourceCompletions: ResourceCompletion[];
  calendarEvents: CalendarEvent[];
  eventAttendees: EventAttendee[];

  // Internal: Gamification callbacks ref (used by GamificationContext)
  _gamificationRef: MutableRefObject<GamificationCallbacks | null>;
  _updateUserXP: (userId: string, newXP: number, newLevel: string) => void;

  // App Settings
  getSetting: (key: string) => string | undefined;

  // Mentor des Monats Sichtbarkeit
  mentorOfMonthVisible: boolean;
  toggleMentorOfMonth: () => Promise<void>;

  // Push-Benachrichtigungs-Einstellungen (Admin-global)
  getPushSetting: (key: string) => boolean;
  togglePushSetting: (key: string) => Promise<void>;

  // User registration (Mentee via Admin-Aufruf, nicht mehr nötig für Supabase)
  addUser: (user: Omit<User, "id" | "created_at"> & { password: string }) => Promise<{ userId: string } | null>;

  // Mentorship actions
  assignMentorship: (menteeId: string, mentorId: string, adminId: string, status?: MentorshipStatus) => Promise<void>;
  updateMentorshipStatus: (mentorshipId: string, status: MentorshipStatus) => Promise<void>;
  approveMentorship: (mentorshipId: string) => Promise<void>;
  rejectMentorship: (mentorshipId: string, reason: string) => Promise<void>;
  getPendingApprovalsCount: () => number;

  // Session actions
  addSession: (session: Omit<Session, "id" | "session_type">) => Promise<void>;
  updateSession: (sessionId: string, data: Partial<Pick<Session, "date" | "is_online" | "details" | "attempt_number" | "duration_minutes">>) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  cancelMentorship: (mentorshipId: string, reason: string) => Promise<void>;

  // SessionType actions
  addSessionType: (sessionType: Omit<SessionType, "id">) => Promise<void>;
  updateSessionTypeOrder: (sessionTypes: SessionType[]) => Promise<void>;
  updateSessionType: (id: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteSessionType: (id: string) => Promise<void>;

  // Feedback actions
  addFeedback: (feedback: Omit<Feedback, "id" | "created_at">) => Promise<void>;
  getFeedbacks: () => Feedback[];

  // Message actions
  sendMessage: (mentorshipId: string, senderId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;

  // Notification actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  getUnreadCount: () => number;
  sendAdminDirectMessage: (recipientId: string, message: string) => Promise<void>;

  // Admin-DM actions
  adminMessages: AdminMessage[];
  sendAdminMessage: (userId: string, content: string) => Promise<void>;
  replyToAdmin: (adminId: string, content: string) => Promise<void>;
  getAdminMessagesByUserId: (userId: string) => AdminMessage[];
  getAdminChatPartners: () => string[];

  // Application actions
  approveApplication: (applicationId: string) => Promise<void>;
  rejectApplication: (applicationId: string, rejectionReason?: string) => Promise<void>;
  deleteApplication: (applicationId: string) => Promise<void>;
  submitApplication: (data: Omit<MentorApplication, "id" | "status" | "submitted_at">) => Promise<void>;

  // User actions
  updateUser: (userId: string, data: Partial<Pick<User, "name" | "email" | "city" | "plz" | "age" | "phone" | "contact_preference" | "avatar_url" | "role" | "gender" | "lat" | "lng" | "admin_notes">>) => Promise<void>;
  setUserActive: (userId: string, isActive: boolean) => Promise<void>;
  deleteUser: (userId: string) => Promise<boolean>;
  bulkDeleteUsers: (userIds: string[]) => Promise<{ success: number; failed: number }>;

  // Mentorship Notes
  updateMentorshipNotes: (mentorshipId: string, notes: string) => Promise<void>;
  updateMenteeNotes: (mentorshipId: string, mentee_notes: string) => Promise<void>;

  // Mentee step confirmation
  confirmStepAsMentee: (mentorshipId: string, sessionTypeId: string) => Promise<void>;
  unconfirmStepAsMentee: (mentorshipId: string, sessionTypeId: string) => Promise<void>;

  // Hadith actions
  addHadith: (text_ar: string, text_de: string, source: string) => Promise<void>;
  updateHadith: (id: string, updates: Partial<Hadith>) => Promise<void>;
  deleteHadith: (id: string) => Promise<void>;
  reorderHadithe: (id: string, direction: "up" | "down") => Promise<void>;
  bulkInsertHadithe: (items: Array<{ text_ar: string; text_de: string; source: string }>) => Promise<number>;

  // Q&A actions
  loadQAEntries: () => Promise<void>;
  addQAEntry: (entry: Omit<QAEntry, "id" | "created_at" | "updated_at">) => Promise<void>;
  updateQAEntry: (id: string, data: Partial<Omit<QAEntry, "id" | "created_at" | "updated_at">>) => Promise<void>;
  deleteQAEntry: (id: string) => Promise<void>;

  // Resource actions
  addResource: (resource: Omit<Resource, "id" | "created_at">) => Promise<void>;
  updateResource: (id: string, data: Partial<Omit<Resource, "id" | "created_at">>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;

  // Event Participation actions
  toggleEventParticipation: (resourceId: string, status: EventParticipationStatus) => Promise<void>;
  getEventParticipationsByResourceId: (resourceId: string) => EventParticipation[];
  getMyEventParticipation: (resourceId: string) => EventParticipation | undefined;

  // Resource Completion actions
  toggleResourceCompletion: (resourceId: string) => Promise<void>;
  isResourceCompleted: (resourceId: string) => boolean;
  getResourceCompletionCount: (resourceId: string) => number;

  // Calendar actions
  addCalendarEvent: (event: Omit<CalendarEvent, "id" | "created_at">) => Promise<string | null>;
  updateCalendarEvent: (id: string, data: Partial<Omit<CalendarEvent, "id" | "created_at">>) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  respondToEvent: (eventId: string, status: EventAttendeeStatus) => Promise<void>;
  inviteToEvent: (eventId: string, userIds: string[]) => Promise<void>;
  getEventsByDate: (dateStr: string) => CalendarEvent[];

  // Computed helpers
  getMentorshipsByMentorId: (mentorId: string) => Mentorship[];
  getMentorshipByMenteeId: (menteeId: string) => Mentorship | undefined;
  getMentorshipById: (id: string) => Mentorship | undefined;
  getSessionsByMentorshipId: (mentorshipId: string) => Session[];
  getCompletedStepIds: (mentorshipId: string) => string[];
  getMessagesByMentorshipId: (mentorshipId: string) => Message[];
  getUserById: (id: string) => User | undefined;
  getUnassignedMentees: () => User[];
  getPendingApplicationsCount: () => number;
  getUnreadMessagesCount: (mentorshipId: string) => number;
  getTotalUnreadMessages: () => number;
  getTotalUnreadAdminMessages: () => number;
  markChatAsRead: (mentorshipId: string) => Promise<void>;
  markAdminChatAsRead: (userId: string) => Promise<void>;

  // Refresh
  refreshData: () => Promise<void>;

  // Loading
  isLoading: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

// Hilfsfunktion: DB-Row auf User mappen
function mapProfile(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    role: row.role as User["role"],
    gender: row.gender as User["gender"],
    name: row.name as string,
    phone: (row.phone as string) ?? undefined,
    city: (row.city as string) ?? "",
    plz: (row.plz as string) ?? "",
    age: (row.age as number) ?? 0,
    contact_preference: (row.contact_preference as User["contact_preference"]) ?? "whatsapp",
    avatar_url: (row.avatar_url as string) ?? undefined,
    created_at: row.created_at as string,
    is_active: (row.is_active as boolean) ?? true,
    total_xp: (row.total_xp as number) ?? 0,
    mentor_level: (row.mentor_level as string) ?? "bronze",
    lat: (row.lat as number) ?? undefined,
    lng: (row.lng as number) ?? undefined,
    force_password_change: (row.force_password_change as boolean) ?? false,
    admin_notes: (row.admin_notes as string) ?? "",
  };
}

// Hilfsfunktion: DB-Row auf SessionType mappen
function mapSessionType(row: Record<string, unknown>): SessionType {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    sort_order: row.sort_order as number,
    is_default: row.is_default as boolean,
    allows_multiple: (row.allows_multiple as boolean) ?? false,
  };
}

// Hilfsfunktion: DB-Row auf Notification mappen
function mapNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    type: row.type as Notification["type"],
    title: row.title as string,
    body: (row.body as string) ?? "",
    created_at: row.created_at as string,
    read: row.read_at !== null && row.read_at !== undefined,
    related_id: (row.related_id as string) ?? undefined,
  };
}

// Hilfsfunktion: DB-Row auf MessageTemplate mappen
function mapMessageTemplate(row: Record<string, unknown>): MessageTemplate {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    category: (row.category as string) ?? "general",
    body: (row.body as string) ?? "",
    sort_order: (row.sort_order as number) ?? 0,
    is_active: (row.is_active as boolean) ?? true,
    template_key: (row.template_key as string) ?? undefined,
  };
}

// Hilfsfunktion: DB-Row auf Resource mappen
function mapResource(row: Record<string, unknown>): Resource {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    url: (row.url as string) ?? "",
    description: (row.description as string) ?? "",
    icon: (row.icon as string) ?? "link-outline",
    category: (row.category as string) ?? "general",
    sort_order: (row.sort_order as number) ?? 0,
    is_active: (row.is_active as boolean) ?? true,
    visible_to: (row.visible_to as ResourceVisibility) ?? "all",
    visible_until: (row.visible_until as string) ?? null,
    visible_after_session_type_id: (row.visible_after_session_type_id as string) ?? null,
    created_at: row.created_at as string,
  };
}

// Hilfsfunktion: DB-Row auf EventParticipation mappen
function mapEventParticipation(row: Record<string, unknown>): EventParticipation {
  return {
    id: row.id as string,
    resource_id: row.resource_id as string,
    user_id: row.user_id as string,
    status: (row.status as EventParticipationStatus) ?? "interested",
    created_at: row.created_at as string,
  };
}

// Hilfsfunktion: DB-Row auf ResourceCompletion mappen
function mapResourceCompletion(row: Record<string, unknown>): ResourceCompletion {
  return {
    id: row.id as string,
    resource_id: row.resource_id as string,
    user_id: row.user_id as string,
    completed_at: row.completed_at as string,
  };
}

// Hilfsfunktion: DB-Row auf CalendarEvent mappen
function mapCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    start_at: row.start_at as string,
    end_at: (row.end_at as string) ?? null,
    type: (row.type as CalendarEventType) ?? "custom",
    location: (row.location as string) ?? "",
    created_by: (row.created_by as string) ?? null,
    recurrence: (row.recurrence as CalendarEvent["recurrence"]) ?? null,
    visible_to: (row.visible_to as ResourceVisibility) ?? "all",
    is_active: (row.is_active as boolean) ?? true,
    google_calendar_event_id: (row.google_calendar_event_id as string) ?? null,
    created_at: row.created_at as string,
  };
}

// Hilfsfunktion: DB-Row auf EventAttendee mappen
function mapEventAttendee(row: Record<string, unknown>): EventAttendee {
  return {
    id: row.id as string,
    event_id: row.event_id as string,
    user_id: row.user_id as string,
    status: (row.status as EventAttendeeStatus) ?? "invited",
    reminder_minutes: (row.reminder_minutes as number) ?? 60,
    google_synced: (row.google_synced as boolean) ?? false,
    created_at: row.created_at as string,
  };
}

// ─── Cache-Konstanten ────────────────────────────────────────────────────────

const CACHE_KEY = "bnm-data-cache";
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 Minuten
const CACHE_FRESH_MS = 5 * 60 * 1000;    // < 5 Minuten → kein Background-Refresh

interface CachePayload {
  users: User[];
  mentorships: Omit<Mentorship, "mentor" | "mentee">[];
  sessions: Session[];
  sessionTypes: SessionType[];
  feedback: Feedback[];
  hadithe: Hadith[];
  qaEntries: QAEntry[];
  messageTemplates: MessageTemplate[];
  appSettings: Record<string, string>;
  mentorOfMonthVisible: boolean;
  timestamp: number;
}

async function readCache(): Promise<CachePayload | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === "web") {
      raw = localStorage.getItem(CACHE_KEY);
    } else {
      // @ts-ignore — optionale Abhängigkeit
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      raw = await AsyncStorage.getItem(CACHE_KEY);
    }
    if (!raw) return null;
    const parsed: CachePayload = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(payload: CachePayload): Promise<void> {
  try {
    const raw = JSON.stringify(payload);
    if (Platform.OS === "web") {
      localStorage.setItem(CACHE_KEY, raw);
    } else {
      // @ts-ignore — optionale Abhängigkeit
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(CACHE_KEY, raw);
    }
  } catch {
    // Cache-Fehler sind nicht kritisch
  }
}

// ─── Messages-Cache ───────────────────────────────────────────────────────────

const MESSAGES_CACHE_KEY_PREFIX = "bnm-messages-";
const MESSAGES_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 Stunde

interface MessagesCacheEntry {
  messages: Message[];
  timestamp: number;
}

async function readMessagesCache(mentorshipId: string): Promise<Message[] | null> {
  try {
    const key = `${MESSAGES_CACHE_KEY_PREFIX}${mentorshipId}`;
    let raw: string | null = null;
    if (Platform.OS === "web") {
      raw = localStorage.getItem(key);
    } else {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      raw = await AsyncStorage.getItem(key);
    }
    if (!raw) return null;
    const parsed: MessagesCacheEntry = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > MESSAGES_CACHE_MAX_AGE_MS) return null;
    return parsed.messages;
  } catch {
    return null;
  }
}

async function writeMessagesCache(mentorshipId: string, messages: Message[]): Promise<void> {
  try {
    const key = `${MESSAGES_CACHE_KEY_PREFIX}${mentorshipId}`;
    const entry: MessagesCacheEntry = { messages, timestamp: Date.now() };
    const raw = JSON.stringify(entry);
    if (Platform.OS === "web") {
      localStorage.setItem(key, raw);
    } else {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(key, raw);
    }
  } catch {}
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [mentorships, setMentorships] = useState<Mentorship[]>([]);
  const [assignedMenteeIds, setAssignedMenteeIds] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [applications, setApplications] = useState<MentorApplication[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [eventParticipations, setEventParticipations] = useState<EventParticipation[]>([]);
  const [resourceCompletions, setResourceCompletions] = useState<ResourceCompletion[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [eventAttendees, setEventAttendees] = useState<EventAttendee[]>([]);
  const [mentorOfMonthVisible, setMentorOfMonthVisible] = useState<boolean>(true);
  const [hadithe, setHadithe] = useState<Hadith[]>([]);
  const [qaEntries, setQAEntries] = useState<QAEntry[]>([]);
  const [appSettings, setAppSettings] = useState<Record<string, string>>({});
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ref for GamificationContext to register its functions (avoids circular dependency)
  const gamificationRef = useRef<GamificationCallbacks | null>(null);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Refs — immer aktuell, auch in Realtime-Callbacks (Closure-Problem vermeiden)
  const mentorshipsRef = useRef<Mentorship[]>([]);
  const usersRef = useRef<User[]>([]);
  const hasLoadedOnceRef = useRef(false);
  // Guard: verhindert parallele foreground-Loads (würden State inkonsistent machen)
  const isActiveLoadRef = useRef(false);
  const loadStartTimeRef = useRef(0);
  const retryDoneRef = useRef(false);

  // ─── Initial Load ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authUser) {
      // User ausgeloggt: State leeren
      setUsers([]);
      setMentorships([]);
      setSessions([]);
      setFeedback([]);
      setMessages([]);
      setAdminMessages([]);
      setApplications([]);
      setNotifications([]);
      setIsLoading(false);
      hasLoadedOnceRef.current = false;
      isActiveLoadRef.current = false;
      retryDoneRef.current = false;
      return;
    }

    // Cache-first: Zuerst gecachte Daten anzeigen, dann im Hintergrund frisch laden
    (async () => {
      const cached = await readCache();

      // Cache gilt als nutzbar, wenn mindestens 1 User vorhanden
      // (>= 2 würde bei neuen Usern die nur sich selbst sehen immer fehlschlagen)
      const cacheUsable = cached !== null && cached.users.length >= 1;

      if (cacheUsable && cached) {
        // Cache sofort anzeigen → kein leerer Screen während des Ladens
        setUsers(cached.users);
        // Mentorships aus Cache: mentor/mentee-Objekte sofort auflösen
        const userMap: Record<string, User> = {};
        cached.users.forEach((u) => (userMap[u.id] = u));
        setMentorships(cached.mentorships.map((ms) => ({
          ...ms,
          mentor: userMap[(ms as any).mentor_id],
          mentee: userMap[(ms as any).mentee_id],
        })) as Mentorship[]);
        setSessions(cached.sessions);
        setSessionTypes(cached.sessionTypes);
        setFeedback(cached.feedback);
        setHadithe(cached.hadithe);
        setQAEntries(cached.qaEntries);
        if (cached.messageTemplates) setMessageTemplates(cached.messageTemplates);
        setAppSettings(cached.appSettings);
        setMentorOfMonthVisible(cached.mentorOfMonthVisible);
        setIsLoading(false);
        hasLoadedOnceRef.current = true;

        // IMMER im Hintergrund frisch laden — Messages, Notifications,
        // Applications werden nicht gecacht und müssen immer geholt werden
        loadAllData(/* background */ true).catch((err) =>
          console.warn("[DataContext] background refresh error:", err)
        );
      } else {
        // Kein Cache oder Cache leer/veraltet: normal laden mit Loading-Indikator
        loadAllData(false);
      }
    })();

    // Subscriptions erst starten nachdem initiale Daten geladen sind
    let cleanups: (() => void)[] = [];
    const startSubscriptions = () => {
      cleanups = [
        subscribeToMessages(),
        subscribeToProfiles(),
        subscribeToMentorships(),
        subscribeToAdminMessages(),
      ];
    };
    // Kurze Verzögerung damit loadAllData den State füllen kann
    const subTimer = setTimeout(startSubscriptions, 2000);
    return () => {
      clearTimeout(subTimer);
      cleanups.forEach((fn) => fn());
    };
  }, [authUser?.id]);

  // Refs immer aktuell halten — wird in Realtime-Callbacks genutzt
  useEffect(() => {
    mentorshipsRef.current = mentorships;
  }, [mentorships]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // ─── Visibility Change: Auto-Reload wenn Tab wieder aktiv wird ───────────
  // Löst das Problem: Supabase Realtime kann bei längerem Inaktiv-Tab die WebSocket-
  // Verbindung verlieren → Daten werden erst nach Hard-Refresh (Strg+F5) aktualisiert.
  useEffect(() => {
    if (Platform.OS !== "web" || !authUser) return;

    let lastHidden = Date.now();
    // Shared ref: verhindert Doppel-Load wenn visibility + focus gleichzeitig feuern
    let lastTriggered = 0;

    const triggerRefresh = () => {
      const now = Date.now();
      const elapsed = now - lastHidden;
      // Nur laden wenn >30s inaktiv UND kein anderer Trigger in den letzten 5s
      if (elapsed > 30_000 && now - lastTriggered > 5_000) {
        lastTriggered = now;
        loadAllData(true).catch((err) =>
          console.warn("[DataContext] visibility refresh error:", err)
        );
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerRefresh();
      } else {
        lastHidden = Date.now();
      }
    };

    const handleFocus = () => triggerRefresh();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [authUser?.id]);

  async function loadAllData(background = false) {
    if (!background) {
      isActiveLoadRef.current = true;
      loadStartTimeRef.current = Date.now();
      setIsLoading(true);
    }
    try {
      // Session-Check — bei fehlender Session sauber abbrechen
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        console.warn("[DataContext] No session, skipping load");
        setIsLoading(false);
        isActiveLoadRef.current = false;
        return;
      }

      const isAdminOrOffice = authUser?.role === "admin" || authUser?.role === "office";

      // Timeout: 5s — verhindert dauerhaftes isLoading bei hängender Verbindung
      const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Supabase query timeout (5s)")), 5_000)
          ),
        ]);

      // Jede Query einzeln mit Timeout wrappen — eine hängende Query blockiert nicht alle anderen
      const safe = <T,>(p: PromiseLike<T>): Promise<T> =>
        withTimeout(Promise.resolve(p)).catch((err) => {
          console.warn("[DataContext] Query failed:", err?.message);
          return { data: null, error: err } as unknown as T;
        });

      const [
        profilesRes,
        mentorshipsRes,
        sessionsRes,
        sessionTypesRes,
        feedbackRes,
        notificationsRes,
        applicationsRes,
        settingsRes,
        messagesRes,
        haditheRes,
        qaEntriesRes,
        messageTemplatesRes,
        resourcesRes,
        eventParticipationsRes,
        resourceCompletionsRes,
        calendarEventsRes,
        eventAttendeesRes,
        adminMsgsRes,
      ] = await Promise.all([
        safe(supabase.from("profiles").select("*")),
        safe(supabase.from("mentorships").select("*")),
        safe(supabase.from("sessions").select("*")),
        safe(supabase.from("session_types").select("*").order("sort_order")),
        safe(supabase.from("feedback").select("*")),
        safe(supabase.from("notifications").select("*").eq("user_id", authUser!.id)),
        safe(supabase.from("mentor_applications").select("*")),
        safe(supabase.from("app_settings").select("*")),
        safe(supabase.from("messages").select("*")),
        safe(supabase.from("hadithe").select("*").order("sort_order", { ascending: true })),
        safe(supabase.from("qa_entries").select("*").order("created_at", { ascending: true })),
        safe(supabase.from("message_templates").select("*").eq("is_active", true).order("sort_order", { ascending: true })),
        safe(supabase.from("resources").select("*").order("sort_order", { ascending: true })),
        safe(supabase.from("event_participations").select("*")),
        safe(supabase.from("resource_completions").select("*")),
        safe(supabase.from("calendar_events").select("*").order("start_at", { ascending: true })),
        safe(supabase.from("event_attendees").select("*")),
        safe(isAdminOrOffice
          ? supabase.from("admin_messages").select("*").order("created_at", { ascending: true })
          : supabase.from("admin_messages").select("*").eq("user_id", authUser!.id).order("created_at", { ascending: true })),
      ] as const);

      // Error-Logging: Supabase-Fehler sichtbar machen
      if (profilesRes.error) console.warn("[DataContext] profiles error:", profilesRes.error.message);
      if (mentorshipsRes.error) console.warn("[DataContext] mentorships error:", mentorshipsRes.error.message);
      if (sessionsRes.error) console.warn("[DataContext] sessions error:", sessionsRes.error.message);
      if (sessionTypesRes.error) console.warn("[DataContext] session_types error:", sessionTypesRes.error.message);
      if (feedbackRes.error) console.warn("[DataContext] feedback error:", feedbackRes.error.message);
      if (notificationsRes.error) console.warn("[DataContext] notifications error:", notificationsRes.error.message);
      if (applicationsRes.error) console.warn("[DataContext] applications error:", applicationsRes.error.message);
      if (settingsRes.error) console.warn("[DataContext] app_settings error:", settingsRes.error.message);
      if (messagesRes.error) console.warn("[DataContext] messages error:", messagesRes.error.message);
      if (haditheRes.error) console.warn("[DataContext] hadithe error:", haditheRes.error.message);
      if (qaEntriesRes.error) console.warn("[DataContext] qa_entries error:", qaEntriesRes.error.message);

      // Profiles
      if (profilesRes.data) {
        setUsers(profilesRes.data.map(mapProfile));
      }

      // SessionTypes (für Join in Sessions benötigt)
      const stMap: Record<string, SessionType> = {};
      if (sessionTypesRes.data) {
        const types = sessionTypesRes.data.map(mapSessionType);
        setSessionTypes(types);
        types.forEach((st) => (stMap[st.id] = st));
      }

      // Mentorships (Mentor/Mentee werden aus users-State aufgelöst, daher später via Computed)
      if (mentorshipsRes.data) {
        const profileMap: Record<string, User> = {};
        if (profilesRes.data) {
          profilesRes.data.map(mapProfile).forEach((u) => (profileMap[u.id] = u));
        }
        const ms: Mentorship[] = mentorshipsRes.data.map((row) => ({
          id: row.id as string,
          mentor_id: row.mentor_id as string,
          mentee_id: row.mentee_id as string,
          status: row.status as MentorshipStatus,
          assigned_by: row.assigned_by as string,
          assigned_at: row.assigned_at as string,
          completed_at: (row.completed_at as string) ?? undefined,
          notes: (row.notes as string) ?? "",
          mentee_notes: (row.mentee_notes as string) ?? "",
          mentor: profileMap[row.mentor_id as string],
          mentee: profileMap[row.mentee_id as string],
          mentee_confirmed_steps: (row.mentee_confirmed_steps as string[]) ?? [],
        }));
        setMentorships(ms);
      }

      // Zugewiesene Mentee-IDs laden (RPC umgeht RLS — auch Mentoren sehen alle)
      const { data: assignedIds } = await supabase.rpc("get_assigned_mentee_ids");
      if (assignedIds) {
        setAssignedMenteeIds(new Set(assignedIds as string[]));
      }

      // Eigene Mentorship-IDs ermitteln (für Message-Filter)
      const ownMentorshipIds: Set<string> = new Set();
      if (mentorshipsRes.data && authUser) {
        const role = authUser.role;
        for (const row of mentorshipsRes.data) {
          if (role === "admin" || role === "office") {
            ownMentorshipIds.add(row.id as string);
          } else if (role === "mentor" && row.mentor_id === authUser.id) {
            ownMentorshipIds.add(row.id as string);
          } else if (role === "mentee" && row.mentee_id === authUser.id) {
            ownMentorshipIds.add(row.id as string);
          }
        }
      }

      // Sessions
      if (sessionsRes.data) {
        const ss: Session[] = sessionsRes.data.map((row) => ({
          id: row.id as string,
          mentorship_id: row.mentorship_id as string,
          session_type_id: row.session_type_id as string,
          date: row.date as string,
          is_online: row.is_online as boolean,
          details: (row.details as string) ?? undefined,
          documented_by: row.documented_by as string,
          attempt_number: (row.attempt_number as number) ?? undefined,
          duration_minutes: (row.duration_minutes as number) ?? undefined,
          session_type: stMap[row.session_type_id as string],
        }));
        setSessions(ss);
      }

      // Feedback
      if (feedbackRes.data) {
        const fb: Feedback[] = feedbackRes.data.map((row) => ({
          id: row.id as string,
          mentorship_id: row.mentorship_id as string,
          submitted_by: row.submitted_by as string,
          rating: row.rating as number,
          comments: (row.comments as string) ?? undefined,
          answers: (row as any).answers ?? undefined,
          created_at: row.created_at as string,
        }));
        setFeedback(fb);
      }

      // Notifications
      if (notificationsRes.data) {
        setNotifications(notificationsRes.data.map(mapNotification));
      }

      // Applications (nur für Admin/Office sichtbar laut RLS)
      if (applicationsRes.data) {
        const apps: MentorApplication[] = applicationsRes.data.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          email: row.email as string,
          city: row.city as string,
          plz: (row.plz as string) ?? undefined,
          gender: row.gender as MentorApplication["gender"],
          age: row.age as number,
          experience: (row.experience as string) ?? "",
          motivation: (row.motivation as string) ?? "",
          contact_preference: (row.contact_preference as MentorApplication["contact_preference"]) ?? "whatsapp",
          phone: (row.phone as string) ?? undefined,
          status: row.status as ApplicationStatus,
          submitted_at: row.created_at as string,
        }));
        setApplications(apps);
      }

      // App Settings: alle Settings in Map speichern
      if (settingsRes.data) {
        const settingsMap: Record<string, string> = {};
        for (const row of settingsRes.data) {
          settingsMap[row.key as string] = row.value as string;
        }
        setAppSettings(settingsMap);
      }

      // App Settings: mentor_of_month_visible
      if (settingsRes.data) {
        const setting = settingsRes.data.find((s) => s.key === "mentor_of_month_visible");
        if (setting) {
          setMentorOfMonthVisible(setting.value === "true");
        }
      }

      // Messages — nur eigene Mentorships laden (Rollenfilter)
      // Wenn ownMentorshipIds leer ist (RLS-Timing: Mentorships noch nicht zurückgekommen),
      // ALLE Messages behalten — Supabase-RLS filtert bereits serverseitig.
      // Kein versehentliches Leeren des Chats beim Reload.
      if (messagesRes.data) {
        const profileMap: Record<string, User> = {};
        if (profilesRes.data) {
          profilesRes.data.map(mapProfile).forEach((u) => (profileMap[u.id] = u));
        }
        const msgs: Message[] = messagesRes.data
          .filter((row) => ownMentorshipIds.size === 0 || ownMentorshipIds.has(row.mentorship_id as string))
          .map((row) => ({
            id: row.id as string,
            mentorship_id: row.mentorship_id as string,
            sender_id: row.sender_id as string,
            content: row.content as string,
            read_at: (row.read_at as string) || undefined,
            created_at: row.created_at as string,
            sender: profileMap[row.sender_id as string],
          }));
        // Merge statt Replace: Lokal gesendete Nachrichten die noch nicht in der
        // DB-Antwort sind (weil background-Load vor dem INSERT startete) bewahren.
        // Verhindert Race Condition: sendMessage → background-loadAllData überschreibt.
        setMessages((prev) => {
          const dbIds = new Set(msgs.map((m) => m.id));
          const localPending = prev.filter((m) => !dbIds.has(m.id));
          return localPending.length > 0 ? [...msgs, ...localPending] : msgs;
        });
      }

      // Hadithe
      if (haditheRes.data) {
        const hs: Hadith[] = haditheRes.data.map((row) => ({
          id: row.id as string,
          text_de: (row.text_de as string) ?? "",
          text_ar: (row.text_ar as string) ?? undefined,
          source: (row.source as string) ?? undefined,
          sort_order: (row.sort_order as number) ?? 0,
        }));
        setHadithe(hs);
      }

      // Q&A Einträge
      if (qaEntriesRes.data) {
        const entries: QAEntry[] = qaEntriesRes.data.map((row) => ({
          id: row.id as string,
          question: row.question as string,
          answer: row.answer as string,
          category: (row.category as string) ?? "allgemein",
          tags: (row.tags as string[]) ?? [],
          is_published: (row.is_published as boolean) ?? true,
          created_by: (row.created_by as string) ?? undefined,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
        }));
        setQAEntries(entries);
      }

      // Message Templates
      if (messageTemplatesRes.error) console.warn("[DataContext] message_templates error:", messageTemplatesRes.error.message);
      if (messageTemplatesRes.data) {
        setMessageTemplates(messageTemplatesRes.data.map(mapMessageTemplate));
      }

      // Resources
      if (resourcesRes.error) console.warn("[DataContext] resources error:", resourcesRes.error.message);
      if (resourcesRes.data) {
        setResources(resourcesRes.data.map(mapResource));
      }

      // Event Participations
      if (eventParticipationsRes.error) console.warn("[DataContext] event_participations error:", eventParticipationsRes.error.message);
      if (eventParticipationsRes.data) {
        setEventParticipations(eventParticipationsRes.data.map(mapEventParticipation));
      }

      // Resource Completions
      if (resourceCompletionsRes.error) console.warn("[DataContext] resource_completions error:", resourceCompletionsRes.error.message);
      if (resourceCompletionsRes.data) {
        setResourceCompletions(resourceCompletionsRes.data.map(mapResourceCompletion));
      }

      // Calendar Events
      if (calendarEventsRes.error) console.warn("[DataContext] calendar_events error:", calendarEventsRes.error.message);
      if (calendarEventsRes.data) {
        setCalendarEvents(calendarEventsRes.data.map(mapCalendarEvent));
      }

      // Event Attendees
      if (eventAttendeesRes.error) console.warn("[DataContext] event_attendees error:", eventAttendeesRes.error.message);
      if (eventAttendeesRes.data) {
        setEventAttendees(eventAttendeesRes.data.map(mapEventAttendee));
      }

      // ─── Admin-Messages verarbeiten (Query läuft parallel im Promise.all oben) ──
      {
        const profileMap2: Record<string, User> = {};
        if (profilesRes.data) {
          profilesRes.data.map(mapProfile).forEach((u) => (profileMap2[u.id] = u));
        }
        if (adminMsgsRes.data) {
          const mapped: AdminMessage[] = (adminMsgsRes.data as any[]).map((row) => ({
            id: row.id,
            admin_id: row.admin_id,
            user_id: row.user_id,
            sender_id: row.sender_id,
            content: row.content,
            read_at: row.read_at ?? undefined,
            created_at: row.created_at,
            sender: profileMap2[row.sender_id],
          }));
          setAdminMessages(mapped);
        }
      }

      // ─── Gamification-Daten verarbeiten (Queries laufen parallel im Promise.all oben) ──
      // ─── Cache schreiben (messages werden NICHT gecacht — Realtime) ─────────
      {
        const cachedUsers = profilesRes.data ? profilesRes.data.map(mapProfile) : [];
        const cachedMentorships = mentorshipsRes.data
          ? mentorshipsRes.data.map((row) => ({
              id: row.id as string,
              mentor_id: row.mentor_id as string,
              mentee_id: row.mentee_id as string,
              status: row.status as MentorshipStatus,
              assigned_by: row.assigned_by as string,
              assigned_at: row.assigned_at as string,
              completed_at: (row.completed_at as string) ?? undefined,
              notes: (row.notes as string) ?? "",
              mentee_notes: (row.mentee_notes as string) ?? "",
              mentee_confirmed_steps: (row.mentee_confirmed_steps as string[]) ?? [],
            }))
          : [];
        const cachedSessions = sessionsRes.data
          ? sessionsRes.data.map((row) => ({
              id: row.id as string,
              mentorship_id: row.mentorship_id as string,
              session_type_id: row.session_type_id as string,
              date: row.date as string,
              is_online: row.is_online as boolean,
              details: (row.details as string) ?? undefined,
              documented_by: row.documented_by as string,
              attempt_number: (row.attempt_number as number) ?? undefined,
              duration_minutes: (row.duration_minutes as number) ?? undefined,
            }))
          : [];
        const cachedSessionTypes = sessionTypesRes.data ? sessionTypesRes.data.map(mapSessionType) : [];
        const cachedFeedback = feedbackRes.data
          ? feedbackRes.data.map((row) => ({
              id: row.id as string,
              mentorship_id: row.mentorship_id as string,
              submitted_by: row.submitted_by as string,
              rating: row.rating as number,
              comments: (row.comments as string) ?? undefined,
              answers: (row as any).answers ?? undefined,
              created_at: row.created_at as string,
            }))
          : [];
        const cachedHadithe = haditheRes.data
          ? haditheRes.data.map((row) => ({
              id: row.id as string,
              text_de: (row.text_de as string) ?? "",
              text_ar: (row.text_ar as string) ?? undefined,
              source: (row.source as string) ?? undefined,
              sort_order: (row.sort_order as number) ?? 0,
            }))
          : [];
        const cachedQAEntries = qaEntriesRes.data
          ? qaEntriesRes.data.map((row) => ({
              id: row.id as string,
              question: row.question as string,
              answer: row.answer as string,
              category: (row.category as string) ?? "allgemein",
              tags: (row.tags as string[]) ?? [],
              is_published: (row.is_published as boolean) ?? true,
              created_by: (row.created_by as string) ?? undefined,
              created_at: row.created_at as string,
              updated_at: row.updated_at as string,
            }))
          : [];
        const cachedSettings: Record<string, string> = {};
        if (settingsRes.data) {
          for (const row of settingsRes.data) {
            cachedSettings[row.key as string] = row.value as string;
          }
        }
        const cachedMentorOfMonthVisible = settingsRes.data
          ? (settingsRes.data.find((s) => s.key === "mentor_of_month_visible")?.value ?? "true") === "true"
          : true;

        writeCache({
          users: cachedUsers,
          mentorships: cachedMentorships,
          sessions: cachedSessions as Session[],
          sessionTypes: cachedSessionTypes,
          feedback: cachedFeedback as Feedback[],
          hadithe: cachedHadithe,
          qaEntries: cachedQAEntries as QAEntry[],
          messageTemplates: messageTemplatesRes?.data?.map(mapMessageTemplate) ?? [],
          appSettings: cachedSettings,
          mentorOfMonthVisible: cachedMentorOfMonthVisible,
          timestamp: Date.now(),
        });
      }

      // ─── Reminder-Check (client-seitig, wird später durch Cron ersetzt) ──────
      if (authUser?.role === 'mentor' && mentorshipsRes.data && sessionsRes.data && notificationsRes.data) {
        // Daten direkt aus den frischen Responses verwenden (State noch nicht gesetzt)
        const freshMentorships: Mentorship[] = mentorshipsRes.data.map((row) => ({
          id: row.id as string,
          mentor_id: row.mentor_id as string,
          mentee_id: row.mentee_id as string,
          status: row.status as MentorshipStatus,
          assigned_by: row.assigned_by as string,
          assigned_at: row.assigned_at as string,
          completed_at: (row.completed_at as string) ?? undefined,
        }));

        const stMapLocal: Record<string, SessionType> = {};
        if (sessionTypesRes.data) {
          sessionTypesRes.data.map(mapSessionType).forEach((st) => (stMapLocal[st.id] = st));
        }

        const freshSessions: Session[] = sessionsRes.data.map((row) => ({
          id: row.id as string,
          mentorship_id: row.mentorship_id as string,
          session_type_id: row.session_type_id as string,
          date: row.date as string,
          is_online: row.is_online as boolean,
          details: (row.details as string) ?? undefined,
          documented_by: row.documented_by as string,
          attempt_number: (row.attempt_number as number) ?? undefined,
          duration_minutes: (row.duration_minutes as number) ?? undefined,
          session_type: stMapLocal[row.session_type_id as string],
        }));

        const freshNotifications: Notification[] = notificationsRes.data.map(mapNotification);

        const newReminders = checkReminders(
          freshMentorships,
          freshSessions,
          freshNotifications,
          authUser.id
        );

        if (newReminders.length > 0) {
          // fire-and-forget: Reminder-INSERT darf loadAllData nicht blockieren
          void Promise.resolve(
            supabase
              .from('notifications')
              .insert(
                newReminders.map((r) => ({
                  user_id: authUser.id,
                  type: r.type,
                  title: r.title,
                  body: r.body,
                  related_id: r.related_id ?? null,
                }))
              )
              .select()
          ).then(
            ({ data: insertedReminders }) => {
              if (insertedReminders) {
                setNotifications((prev) => [
                  ...prev,
                  ...insertedReminders.map(mapNotification),
                ]);
              }
            },
            (err) => console.warn("[DataContext] reminder insert:", err)
          );
        }
      }

      // ─── Mentee-Reminder-Check (Feedback + Session-fällig) ──────────────────
      if (authUser?.role === 'mentee' && mentorshipsRes.data && sessionsRes.data && notificationsRes.data && feedbackRes.data) {
        const freshMentorshipsMentee: Mentorship[] = mentorshipsRes.data.map((row) => ({
          id: row.id as string,
          mentor_id: row.mentor_id as string,
          mentee_id: row.mentee_id as string,
          status: row.status as MentorshipStatus,
          assigned_by: row.assigned_by as string,
          assigned_at: row.assigned_at as string,
          completed_at: (row.completed_at as string) ?? undefined,
        }));

        const freshSessionsMentee: Session[] = sessionsRes.data.map((row) => ({
          id: row.id as string,
          mentorship_id: row.mentorship_id as string,
          session_type_id: row.session_type_id as string,
          date: row.date as string,
          is_online: row.is_online as boolean,
          details: (row.details as string) ?? undefined,
          documented_by: row.documented_by as string,
        }));

        const freshNotificationsMentee: Notification[] = notificationsRes.data.map(mapNotification);

        const freshFeedbackMentee: Feedback[] = feedbackRes.data.map((row) => ({
          id: row.id as string,
          mentorship_id: row.mentorship_id as string,
          submitted_by: row.submitted_by as string,
          rating: row.rating as number,
          comments: (row.comments as string) ?? undefined,
          created_at: row.created_at as string,
        }));

        const menteeReminders = checkMenteeReminders(
          freshMentorshipsMentee,
          freshSessionsMentee,
          freshNotificationsMentee,
          freshFeedbackMentee,
          authUser.id
        );

        if (menteeReminders.length > 0) {
          void Promise.resolve(
            supabase
              .from('notifications')
              .insert(
                menteeReminders.map((r) => ({
                  user_id: authUser.id,
                  type: r.type,
                  title: r.title,
                  body: r.body,
                  related_id: r.related_id ?? null,
                }))
              )
              .select()
          ).then(
            ({ data: insertedReminders }) => {
              if (insertedReminders) {
                setNotifications((prev) => [
                  ...prev,
                  ...insertedReminders.map(mapNotification),
                ]);
              }
            },
            (err) => console.warn("[DataContext] mentee reminder insert:", err)
          );
        }
      }

      // ─── Kalender-Event-Reminder-Check (alle Rollen) ───────────────────────
      if (calendarEventsRes.data && eventAttendeesRes.data && notificationsRes.data && authUser) {
        const freshCalendarEvents = calendarEventsRes.data.map(mapCalendarEvent);
        const freshEventAttendees = eventAttendeesRes.data.map(mapEventAttendee);
        const freshNotificationsForEvents: Notification[] = notificationsRes.data.map(mapNotification);

        const eventReminders = checkEventReminders(
          freshCalendarEvents,
          freshEventAttendees,
          freshNotificationsForEvents,
          authUser.id
        );

        if (eventReminders.length > 0) {
          void Promise.resolve(
            supabase
              .from('notifications')
              .insert(
                eventReminders.map((r) => ({
                  user_id: authUser.id,
                  type: r.type,
                  title: r.title,
                  body: r.body,
                  related_id: r.related_id ?? null,
                }))
              )
              .select()
          ).then(
            ({ data: insertedReminders }) => {
              if (insertedReminders) {
                setNotifications((prev) => [
                  ...prev,
                  ...insertedReminders.map(mapNotification),
                ]);
              }
            },
            (err) => console.warn("[DataContext] event reminder insert:", err)
          );
        }
      }
    } catch (err) {
      console.warn("[DataContext] loadAllData error:", err);
      if (!background) {
        showError("Daten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung.");
      }
    } finally {
      isActiveLoadRef.current = false;
      hasLoadedOnceRef.current = true;
      // IMMER isLoading zurücksetzen — auch bei Background-Loads
      setIsLoading(false);
      if (!background) {
        // Einmaliger Retry wenn keine User geladen (RLS-Timing nach Session-Refresh)
        if (!retryDoneRef.current) {
          retryDoneRef.current = true;
          setTimeout(() => {
            setUsers((prev) => {
              if (prev.length === 0) {
                loadAllData(true);
              }
              return prev;
            });
          }, 2000);
        }
      }
    }
  }

  // ─── Realtime Messages ────────────────────────────────────────────────────────

  function subscribeToMessages(): () => void {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        async (payload) => {
          // UPDATE: read_at geändert → lokalen State aktualisieren
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Record<string, unknown>;
            const newReadAt = row.read_at ? String(row.read_at) : undefined;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== (row.id as string)) return m;
                // Nie ein vorhandenes read_at mit undefined überschreiben
                // (verhindert Race-Condition wenn lokaler State schon aktualisiert wurde)
                if (m.read_at && !newReadAt) return m;
                return { ...m, read_at: newReadAt };
              })
            );
            return;
          }
          // DELETE
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Record<string, unknown>;
            if (oldRow.id) {
              setMessages((prev) => prev.filter((m) => m.id !== (oldRow.id as string)));
            }
            return;
          }
          // INSERT
          const row = payload.new as Record<string, unknown>;
          const incomingMentorshipId = row.mentorship_id as string;

          // Rollenfilter: Nur Nachrichten aus eigenen Mentorships verarbeiten.
          // Wenn mentorshipsRef noch leer ist (Daten noch nicht geladen), Nachricht
          // trotzdem durchlassen — Supabase RLS filtert bereits serverseitig,
          // Duplikate werden durch den setMessages-Check unten verhindert.
          if (authUser && mentorshipsRef.current.length > 0) {
            const role = authUser.role;
            if (role !== "admin" && role !== "office") {
              const isOwn = mentorshipsRef.current.some((m) => {
                if (m.id !== incomingMentorshipId) return false;
                if (role === "mentor") return m.mentor_id === authUser.id;
                if (role === "mentee") return m.mentee_id === authUser.id;
                return false;
              });
              if (!isOwn) return;
            }
          }

          // Sender aus State oder aus DB laden
          let sender: User | undefined = usersRef.current.find((u) => u.id === row.sender_id);
          if (!sender) {
            const { data } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", row.sender_id)
              .single();
            if (data) sender = mapProfile(data);
          }

          const newMsg: Message = {
            id: row.id as string,
            mentorship_id: incomingMentorshipId,
            sender_id: row.sender_id as string,
            content: row.content as string,
            read_at: (row.read_at as string) || undefined,
            created_at: row.created_at as string,
            sender,
          };

          setMessages((prev) => {
            // Duplikate vermeiden
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Lokale Push Notification: nur wenn Nachricht nicht vom eigenen User stammt
          if (authUser && row.sender_id !== authUser.id) {
            const senderName = sender?.name ?? "Jemand";
            const preview =
              (row.content as string).length > 60
                ? (row.content as string).substring(0, 60) + "…"
                : (row.content as string);
            notifyNewMessage(senderName, row.content as string).catch(() => {});
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ─── Realtime: Profiles (neue User sofort sichtbar für Admin) ────────────────

  function subscribeToProfiles(): () => void {
    const channel = supabase
      .channel("profiles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newUser = mapProfile(payload.new as Record<string, unknown>);
            setUsers((prev) => {
              if (prev.some((u) => u.id === newUser.id)) return prev;
              return [...prev, newUser];
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = mapProfile(payload.new as Record<string, unknown>);
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as Record<string, unknown>).id as string;
            setUsers((prev) => prev.filter((u) => u.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ─── Realtime: Mentorships (Zuweisungen sofort sichtbar) ───────────────────

  function subscribeToMentorships(): () => void {
    const channel = supabase
      .channel("mentorships-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mentorships" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Record<string, unknown>;
            const newM: Mentorship = {
              id: row.id as string,
              mentor_id: row.mentor_id as string,
              mentee_id: row.mentee_id as string,
              status: row.status as MentorshipStatus,
              assigned_by: row.assigned_by as string,
              assigned_at: row.assigned_at as string,
              completed_at: (row.completed_at as string) ?? undefined,
              mentor: usersRef.current.find((u) => u.id === row.mentor_id),
              mentee: usersRef.current.find((u) => u.id === row.mentee_id),
              mentee_confirmed_steps: (row.mentee_confirmed_steps as string[]) ?? [],
            };
            setMentorships((prev) => {
              if (prev.some((m) => m.id === newM.id)) return prev;
              return [...prev, newM];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Record<string, unknown>;
            setMentorships((prev) =>
              prev.map((m) =>
                m.id === row.id
                  ? {
                      ...m,
                      status: row.status as MentorshipStatus,
                      completed_at: (row.completed_at as string) ?? undefined,
                      mentee_confirmed_steps: (row.mentee_confirmed_steps as string[]) ?? m.mentee_confirmed_steps ?? [],
                    }
                  : m
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ─── Realtime: Admin-Messages ──────────────────────────────────────────────

  function subscribeToAdminMessages(): () => void {
    const channel = supabase
      .channel("admin-messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as any;
            const sender = usersRef.current.find((u) => u.id === row.sender_id);
            const newMsg: AdminMessage = {
              id: row.id,
              admin_id: row.admin_id,
              user_id: row.user_id,
              sender_id: row.sender_id,
              content: row.content,
              read_at: row.read_at ?? undefined,
              created_at: row.created_at,
              sender,
            };
            setAdminMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else if (payload.eventType === "DELETE") {
            setAdminMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ─── Gamification-Helfer (delegiert an GamificationContext via Ref) ─────────

  const _updateUserXP = useCallback(
    (userId: string, newXP: number, newLevel: string) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, total_xp: newXP, mentor_level: newLevel } : u
        )
      );
    },
    []
  );

  // ─── Mentorship Actions ───────────────────────────────────────────────────────

  // ─── Hilfsfunktion: Notification in DB einfügen ────────────────────────────────
  const createNotification = useCallback(
    async (userId: string, type: Notification["type"], title: string, body: string, relatedId?: string) => {
      try {
        await supabase.auth.getSession();
        const insertPromise = supabase
          .from("notifications")
          .insert({ user_id: userId, type, title, body, related_id: relatedId ?? null })
          .select()
          .maybeSingle();
        // 8s Timeout: Notification darf NIEMALS die UI blockieren
        const { data, error } = await Promise.race([
          insertPromise,
          new Promise<{ data: null; error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: "notification timeout (8s)" } }), 8_000)
          ),
        ]);

        if (error) {
          console.warn("[createNotification]", error.message ?? error);
          return;
        }
        if (data && userId === authUser?.id) {
          setNotifications((prev) => [...prev, mapNotification(data)]);
        }
      } catch (err) {
        console.warn("[createNotification] failed:", err);
      }
    },
    [authUser]
  );

  const assignMentorship = useCallback(
    async (menteeId: string, mentorId: string, adminId: string, status: MentorshipStatus = "active") => {
      const { data, error } = await supabase
        .from("mentorships")
        .insert({
          mentor_id: mentorId,
          mentee_id: menteeId,
          assigned_by: adminId,
          status,
        })
        .select()
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message ?? "Zuweisung fehlgeschlagen");
      }

      const mentor = users.find((u) => u.id === mentorId);
      const mentee = users.find((u) => u.id === menteeId);
      const newMentorship: Mentorship = {
        id: data.id,
        mentor_id: data.mentor_id,
        mentee_id: data.mentee_id,
        status: data.status,
        assigned_by: data.assigned_by,
        assigned_at: data.assigned_at,
        completed_at: data.completed_at ?? undefined,
        mentor,
        mentee,
      };
      setMentorships((prev) => [...prev, newMentorship]);
      // assignedMenteeIds sofort aktualisieren
      if (status === "active" || status === "pending_approval") {
        setAssignedMenteeIds((prev) => new Set([...prev, menteeId]));
      }

      // Notification an Mentee: Mentor wurde zugewiesen
      if (status === "active" && mentee) {
        await createNotification(
          menteeId,
          "assignment",
          "Dir wurde ein Mentor zugewiesen!",
          `${mentor?.name ?? "Ein Mentor"} ist ab sofort dein Mentor.`,
          data.id
        );
        // Lokale Push Notification nur auf dem Gerät des Mentees selbst
        if (authUser?.id === menteeId) {
          notifyMentorAssigned(mentor?.name ?? "Ein Mentor").catch(() => {});
        }
      }

      // Notification an Mentor: Neuer Mentee zugewiesen
      if (status === "active" && mentor) {
        await createNotification(
          mentorId,
          "assignment",
          "Neuer Mentee zugewiesen",
          `${mentee?.name ?? "Ein Mentee"} wurde dir als Mentee zugewiesen.`,
          data.id
        );
        // Lokale Push Notification nur auf dem Gerät des Mentors selbst
        if (authUser?.id === mentorId) {
          notifyMenteeAssigned(mentee?.name ?? "Ein Mentee").catch(() => {});
        }
      }

      // Notification an Admin/Office: Mentor Self-Assignment wartet auf Bestätigung
      if (status === "pending_approval") {
        const admins = users.filter((u) => u.role === "admin" || u.role === "office");
        for (const admin of admins) {
          await createNotification(
            admin.id,
            "assignment",
            "Mentor-Zuweisung wartet auf Bestätigung",
            `${mentor?.name ?? "Ein Mentor"} möchte ${mentee?.name ?? "einen Mentee"} betreuen. Bitte bestätige die Zuweisung.`,
            data.id
          );
        }
      }

      // Automatische Registrierungs- und Zuweisungs-Sessions (nur bei aktiven Betreuungen)
      if (status !== "active") return;

      const registrierungType = sessionTypes.find((st) => st.sort_order === 1);
      const zuweisungType = sessionTypes.find((st) => st.sort_order === 2);
      const now = new Date().toISOString().split("T")[0]; // DATE Format

      const autoSessions = [];
      if (registrierungType) {
        autoSessions.push({
          mentorship_id: data.id,
          session_type_id: registrierungType.id,
          date: now,
          is_online: false,
          details: "Registrierung abgeschlossen",
          documented_by: adminId,
          attempt_number: 1,
        });
      }
      if (zuweisungType) {
        autoSessions.push({
          mentorship_id: data.id,
          session_type_id: zuweisungType.id,
          date: now,
          is_online: false,
          details: `Zuweisung zu ${mentor?.name ?? "Mentor"}`,
          documented_by: adminId,
          attempt_number: 1,
        });
      }

      if (autoSessions.length > 0) {
        const { data: insertedSessions, error: sessionError } = await supabase
          .from("sessions")
          .insert(autoSessions)
          .select();

        if (!sessionError && insertedSessions) {
          const newSessions: Session[] = insertedSessions.map((row) => ({
            id: row.id,
            mentorship_id: row.mentorship_id,
            session_type_id: row.session_type_id,
            date: row.date,
            is_online: row.is_online,
            details: row.details ?? undefined,
            documented_by: row.documented_by,
            attempt_number: row.attempt_number ?? undefined,
            duration_minutes: row.duration_minutes ?? undefined,
            session_type: sessionTypes.find((st) => st.id === row.session_type_id),
          }));
          setSessions((prev) => [...prev, ...newSessions]);
        }
      }
    },
    [users, sessionTypes, createNotification]
  );

  const approveMentorship = useCallback(
    async (mentorshipId: string) => {
      await supabase.auth.getSession();
      const { error } = await supabase
        .from("mentorships")
        .update({ status: "active" })
        .eq("id", mentorshipId);

      if (error) {
        throw new Error(error.message);
      }

      // State aktualisieren
      setMentorships((prev) =>
        prev.map((m) =>
          m.id === mentorshipId ? { ...m, status: "active" as MentorshipStatus } : m
        )
      );

      // assignedMenteeIds aktualisieren
      const { data: freshIds } = await supabase.rpc("get_assigned_mentee_ids");
      if (freshIds) setAssignedMenteeIds(new Set(freshIds as string[]));

      // Mentorship-Daten direkt aus DB laden (nicht aus stale Closure!)
      const { data: msRow } = await supabase
        .from("mentorships")
        .select("*")
        .eq("id", mentorshipId)
        .single();

      if (msRow) {
        // Mentor/Mentee-Profile laden
        const { data: mentorProfile } = await supabase
          .from("profiles")
          .select("id, name, email, city")
          .eq("id", msRow.mentor_id)
          .single();
        const { data: menteeProfile } = await supabase
          .from("profiles")
          .select("id, name, email, city")
          .eq("id", msRow.mentee_id)
          .single();

        const registrierungType = sessionTypes.find((st) => st.sort_order === 1);
        const zuweisungType = sessionTypes.find((st) => st.sort_order === 2);
        const now = new Date().toISOString().split("T")[0];
        const autoSessions = [];
        if (registrierungType) {
          autoSessions.push({
            mentorship_id: mentorshipId,
            session_type_id: registrierungType.id,
            date: now,
            is_online: false,
            details: "Registrierung abgeschlossen",
            documented_by: msRow.assigned_by,
            attempt_number: 1,
          });
        }
        if (zuweisungType) {
          autoSessions.push({
            mentorship_id: mentorshipId,
            session_type_id: zuweisungType.id,
            date: now,
            is_online: false,
            details: `Zuweisung zu ${mentorProfile?.name ?? "Mentor"}`,
            documented_by: msRow.assigned_by,
            attempt_number: 1,
          });
        }
        if (autoSessions.length > 0) {
          const { data: insertedSessions, error: sessionError } = await supabase
            .from("sessions")
            .insert(autoSessions)
            .select();
          if (!sessionError && insertedSessions) {
            const newSessions: Session[] = insertedSessions.map((row) => ({
              id: row.id,
              mentorship_id: row.mentorship_id,
              session_type_id: row.session_type_id,
              date: row.date,
              is_online: row.is_online,
              details: row.details ?? undefined,
              documented_by: row.documented_by,
              attempt_number: row.attempt_number ?? undefined,
              duration_minutes: row.duration_minutes ?? undefined,
              session_type: sessionTypes.find((st) => st.id === row.session_type_id),
            }));
            setSessions((prev) => [...prev, ...newSessions]);
          }
        }

        // E-Mail an Mentor senden
        if (mentorProfile?.email) {
          await sendMenteeAssignedNotification(
            mentorProfile.name,
            mentorProfile.email,
            menteeProfile?.name ?? "Mentee",
            menteeProfile?.city ?? ""
          );
        }

        // In-App Notification an Mentor: Neuer Mentee nach Approval zugewiesen
        await createNotification(
          msRow.mentor_id,
          "assignment",
          "Neuer Mentee zugewiesen",
          `${menteeProfile?.name ?? "Ein Mentee"} wurde dir als Mentee zugewiesen.`,
          mentorshipId
        );

        // In-App Notification an Mentee: Betreuung genehmigt
        await createNotification(
          msRow.mentee_id,
          "assignment",
          "Dir wurde ein Mentor zugewiesen!",
          `${mentorProfile?.name ?? "Ein Mentor"} ist ab sofort dein Mentor.`,
          mentorshipId
        );
      }
    },
    [sessionTypes, createNotification]
  );

  const rejectMentorship = useCallback(
    async (mentorshipId: string, reason: string) => {
      await supabase.auth.getSession();

      // Mentorship-Daten direkt aus DB laden (nicht aus stale Closure!)
      const { data: msRow } = await supabase
        .from("mentorships")
        .select("mentor_id, mentee_id")
        .eq("id", mentorshipId)
        .single();
      // Mentee-Name für Notification
      let menteeName = "Mentee";
      if (msRow) {
        const { data: menteeProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", msRow.mentee_id)
          .single();
        menteeName = menteeProfile?.name ?? "Mentee";
      }

      const { error } = await supabase
        .from("mentorships")
        .delete()
        .eq("id", mentorshipId);

      if (error) {
        throw new Error(error.message);
      }

      setMentorships((prev) => prev.filter((m) => m.id !== mentorshipId));

      // Notification an den Mentor senden
      if (msRow) {
        await createNotification(
          msRow.mentor_id,
          "assignment",
          "Zuweisung abgelehnt",
          `Deine Zuweisung zu ${menteeName} wurde abgelehnt. Grund: ${reason}`,
          mentorshipId
        );
      }
    },
    [createNotification]
  );

  const getPendingApprovalsCount = useCallback(() => {
    return mentorships.filter((m) => m.status === "pending_approval").length;
  }, [mentorships]);

  const updateMentorshipStatus = useCallback(
    async (mentorshipId: string, status: MentorshipStatus) => {
      await supabase.auth.getSession();
      const updateData: Record<string, unknown> = { status };
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else if (status === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
      } else if (status === "active") {
        // Reaktivierung: Abschluss-/Abbruchdatum zurücksetzen
        updateData.completed_at = null;
        updateData.cancelled_at = null;
      }

      const { error } = await supabase
        .from("mentorships")
        .update(updateData)
        .eq("id", mentorshipId);

      if (error) {
        throw new Error(error.message);
      }

      setMentorships((prev) =>
        prev.map((m) =>
          m.id === mentorshipId
            ? {
                ...m,
                status,
                completed_at:
                  status === "completed"
                    ? new Date().toISOString()
                    : status === "active"
                    ? undefined
                    : m.completed_at,
                cancelled_at:
                  status === "cancelled"
                    ? new Date().toISOString()
                    : status === "active"
                    ? undefined
                    : m.cancelled_at,
              }
            : m
        )
      );

      // assignedMenteeIds neu laden nach Status-Aenderung (auch bei Reaktivierung)
      if (status === "completed" || status === "cancelled" || status === "active") {
        supabase.rpc("get_assigned_mentee_ids").then(({ data }) => {
          if (data) setAssignedMenteeIds(new Set(data as string[]));
        });
      }

      // E-Mail an Admin bei Abschluss oder Abbruch (außerhalb des setState-Updaters)
      if (status === "completed" || status === "cancelled") {
        const m = mentorships.find((ms) => ms.id === mentorshipId);
        if (m) {
          sendMentorshipStatusChangeNotification(
            authUser?.email ?? "",
            m.mentor?.name ?? "Unbekannt",
            m.mentee?.name ?? "Unbekannt",
            status as "completed" | "cancelled"
          );
          // E-Mail an Mentee bei Abschluss mit Feedback-Aufforderung
          if (status === "completed" && m.mentee?.email) {
            sendFeedbackRequestEmail(
              m.mentee.email,
              m.mentee.name ?? "Mentee",
              m.mentor?.name ?? "Mentor",
              mentorshipId
            );
          }
          // In-App Notification an Mentee: Betreuung abgeschlossen → Feedback anfragen
          if (status === "completed") {
            await createNotification(
              m.mentee_id,
              "feedback",
              "Betreuung abgeschlossen",
              "Deine Betreuung wurde abgeschlossen. Bitte gib dein Feedback ab.",
              mentorshipId
            );
            if (authUser?.id === m.mentee_id) {
              notifyMentorshipCompleted(m.mentee?.name ?? "").catch(() => {});
              notifyFeedbackRequested(m.mentor?.name ?? "Deinem Mentor").catch(() => {});
            }

            // XP für abgeschlossene Betreuung (fire-and-forget, delegiert an GamificationContext)
            gamificationRef.current?.awardXP(m.mentor_id, XP_VALUES.MENTORSHIP_COMPLETED, "mentorship_completed", mentorshipId);
            gamificationRef.current?.checkAndUnlockAchievements(m.mentor_id);
          }
        }
      }
    },
    [authUser, mentorships, createNotification]
  );

  // ─── Session Actions ──────────────────────────────────────────────────────────

  const addSession = useCallback(
    async (sessionData: Omit<Session, "id" | "session_type">) => {
      await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          mentorship_id: sessionData.mentorship_id,
          session_type_id: sessionData.session_type_id,
          date: sessionData.date,
          is_online: sessionData.is_online,
          details: sessionData.details ?? "",
          documented_by: sessionData.documented_by,
          attempt_number: sessionData.attempt_number ?? 1,
          duration_minutes: sessionData.duration_minutes ?? null,
        })
        .select()
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message ?? "Session konnte nicht gespeichert werden");
      }

      const sessionType = sessionTypes.find((st) => st.id === data.session_type_id);
      const newSession: Session = {
        id: data.id,
        mentorship_id: data.mentorship_id,
        session_type_id: data.session_type_id,
        date: data.date,
        is_online: data.is_online,
        details: data.details ?? undefined,
        documented_by: data.documented_by,
        attempt_number: data.attempt_number ?? undefined,
        duration_minutes: data.duration_minutes ?? undefined,
        session_type: sessionType,
      };
      setSessions((prev) => [...prev, newSession]);

      // Notification an Mentee: Schritt wurde dokumentiert
      const mentorship = mentorships.find((m) => m.id === sessionData.mentorship_id);
      if (mentorship && sessionType) {
        await createNotification(
          mentorship.mentee_id,
          "progress",
          "Schritt abgeschlossen!",
          `Schritt "${sessionType.name}" wurde von deinem Mentor dokumentiert.`,
          mentorship.id
        );
      }

      // XP für Session-Dokumentation (fire-and-forget, delegiert an GamificationContext)
      if (authUser?.role === "mentor") {
        gamificationRef.current?.awardXP(sessionData.documented_by, XP_VALUES.SESSION_DOCUMENTED, "session_documented", data.id);
        gamificationRef.current?.updateStreak(sessionData.documented_by);
        gamificationRef.current?.checkAndUnlockAchievements(sessionData.documented_by);
      }
    },
    [sessionTypes, mentorships, createNotification, authUser]
  );

  const updateSession = useCallback(
    async (
      sessionId: string,
      data: Partial<Pick<Session, "date" | "is_online" | "details" | "attempt_number" | "duration_minutes">>
    ) => {
      const { error } = await supabase
        .from("sessions")
        .update({
          ...(data.date !== undefined && { date: data.date }),
          ...(data.is_online !== undefined && { is_online: data.is_online }),
          ...(data.details !== undefined && { details: data.details }),
          ...(data.attempt_number !== undefined && { attempt_number: data.attempt_number }),
          ...(data.duration_minutes !== undefined && { duration_minutes: data.duration_minutes }),
        })
        .eq("id", sessionId);

      if (error) {
        throw new Error(error.message);
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, ...data } : s
        )
      );
    },
    []
  );

  const deleteSession = useCallback(async (sessionId: string) => {
    await supabase.auth.getSession();
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      throw new Error(error.message);
    }

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  const cancelMentorship = useCallback(
    async (mentorshipId: string, reason: string) => {
      await supabase.auth.getSession();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("mentorships")
        .update({ status: "cancelled", cancelled_at: now, cancel_reason: reason })
        .eq("id", mentorshipId);

      if (error) {
        throw new Error(error.message);
      }

      // assignedMenteeIds neu laden nach Cancel
      supabase.rpc("get_assigned_mentee_ids").then(({ data }) => {
        if (data) setAssignedMenteeIds(new Set(data as string[]));
      });

      setMentorships((prev) =>
        prev.map((m) =>
          m.id === mentorshipId
            ? { ...m, status: "cancelled" as MentorshipStatus, cancelled_at: now }
            : m
        )
      );

      // Mentorship + Profile direkt aus DB laden (nicht aus stale Closure!)
      const { data: msRow } = await supabase
        .from("mentorships")
        .select("mentor_id, mentee_id")
        .eq("id", mentorshipId)
        .single();

      if (msRow) {
        const [{ data: mentorProfile }, { data: menteeProfile }, { data: adminRows }] = await Promise.all([
          supabase.from("profiles").select("id, name, email").eq("id", msRow.mentor_id).single(),
          supabase.from("profiles").select("id, name, email").eq("id", msRow.mentee_id).single(),
          supabase.from("profiles").select("id").in("role", ["admin", "office"]),
        ]);

        for (const admin of adminRows ?? []) {
          await createNotification(
            admin.id,
            "assignment",
            "Betreuung abgebrochen",
            `${mentorProfile?.name ?? "Mentor"} hat die Betreuung von ${menteeProfile?.name ?? "Mentee"} abgebrochen. Grund: ${reason}`,
            mentorshipId
          );
        }

        // E-Mail an Admin
        sendMentorshipStatusChangeNotification(
          "",
          mentorProfile?.name ?? "Unbekannt",
          menteeProfile?.name ?? "Unbekannt",
          "cancelled"
        ).catch(() => {});

        // Mentee benachrichtigen: Cancellation-E-Mail (enthält bereits Feedback-Hinweis)
        if (menteeProfile?.email) {
          sendMentorshipCancelledToMenteeEmail(
            menteeProfile.email,
            menteeProfile.name ?? "Mentee",
            mentorProfile?.name ?? "Mentor"
          ).catch(() => {});
        }

        createNotification(
          msRow.mentee_id,
          "feedback",
          "Feedback gewünscht",
          "Bitte gib uns Feedback zu deiner Betreuung.",
          mentorshipId
        ).catch(() => {});
      }
    },
    [createNotification]
  );

  // ─── SessionType Actions ──────────────────────────────────────────────────────

  const addSessionType = useCallback(
    async (sessionTypeData: Omit<SessionType, "id">) => {
      await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("session_types")
        .insert({
          name: sessionTypeData.name,
          description: sessionTypeData.description,
          sort_order: sessionTypeData.sort_order,
          is_default: sessionTypeData.is_default,
          allows_multiple: sessionTypeData.allows_multiple ?? false,
        })
        .select()
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message ?? "Session-Typ konnte nicht erstellt werden");
      }

      setSessionTypes((prev) => [...prev, mapSessionType(data)]);
    },
    []
  );

  const updateSessionTypeOrder = useCallback(async (updated: SessionType[]) => {
    // Optimistic update
    setSessionTypes(updated);

    // Alle sort_order-Updates parallel ausführen
    await Promise.all(
      updated.map((st) =>
        supabase
          .from("session_types")
          .update({ sort_order: st.sort_order })
          .eq("id", st.id)
      )
    );
  }, []);

  const updateSessionType = useCallback(async (id: string, data: { name?: string; description?: string }) => {
    const { error } = await supabase
      .from("session_types")
      .update(data)
      .eq("id", id);

    if (error) {
      throw new Error(error.message ?? "Session-Typ konnte nicht aktualisiert werden");
    }

    setSessionTypes((prev) => prev.map((st) => st.id === id ? { ...st, ...data } : st));
  }, []);

  const deleteSessionType = useCallback(async (id: string) => {
    await supabase.auth.getSession();
    const { error } = await supabase
      .from("session_types")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message ?? "Session-Typ konnte nicht gelöscht werden");
    }

    setSessionTypes((prev) => prev.filter((st) => st.id !== id));
  }, []);

  // ─── Feedback Actions ─────────────────────────────────────────────────────────

  const addFeedback = useCallback(
    async (feedbackData: Omit<Feedback, "id" | "created_at">) => {
      await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("feedback")
        .insert({
          mentorship_id: feedbackData.mentorship_id,
          submitted_by: feedbackData.submitted_by,
          rating: feedbackData.rating,
          comments: feedbackData.comments ?? "",
          answers: feedbackData.answers ?? null,
        })
        .select()
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message ?? "Feedback konnte nicht gespeichert werden");
      }

      const newFeedback: Feedback = {
        id: data.id,
        mentorship_id: data.mentorship_id,
        submitted_by: data.submitted_by,
        rating: data.rating,
        comments: data.comments ?? undefined,
        answers: data.answers ?? undefined,
        created_at: data.created_at,
      };
      setFeedback((prev) => [...prev, newFeedback]);

      // Mentorship + Submitter direkt aus DB laden (nicht aus stale Closure!)
      const { data: msRow } = await supabase
        .from("mentorships")
        .select("mentor_id")
        .eq("id", feedbackData.mentorship_id)
        .single();

      if (msRow) {
        const [{ data: submitterProfile }, { data: mentorProfile }] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", feedbackData.submitted_by).single(),
          supabase.from("profiles").select("name, email").eq("id", msRow.mentor_id).single(),
        ]);
        const submitterName = submitterProfile?.name ?? "Dein Mentee";
        const mentorName = mentorProfile?.name ?? "Mentor";
        const mentorEmail = mentorProfile?.email;

        await createNotification(
          msRow.mentor_id,
          "feedback",
          "Feedback erhalten",
          `${submitterName} hat Feedback hinterlassen (${feedbackData.rating}/5 Sterne).`,
          feedbackData.mentorship_id
        );
        // E-Mail-Kopie an den Mentor
        if (mentorEmail) {
          sendFeedbackCopyToMentorEmail(
            mentorEmail,
            mentorName,
            submitterName,
            feedbackData.rating,
            feedbackData.comments
          ).catch(() => {});
        }
        // Lokale Push Notification: zusätzlich auf dem Gerät des Mentors (wenn App offen)
        if (authUser?.id === msRow.mentor_id) {
          sendLocalNotification(
            "Neues Feedback erhalten",
            `${submitterName} hat Feedback hinterlassen (${feedbackData.rating}/5 Sterne).`,
            "feedback"
          ).catch(() => {});
        }

        // XP für gutes Feedback (fire-and-forget, delegiert an GamificationContext)
        if (feedbackData.rating === 5) {
          gamificationRef.current?.awardXP(msRow.mentor_id, XP_VALUES.FEEDBACK_5STAR, "feedback_5star", feedbackData.mentorship_id);
        } else if (feedbackData.rating >= 4) {
          gamificationRef.current?.awardXP(msRow.mentor_id, XP_VALUES.FEEDBACK_4STAR, "feedback_4star", feedbackData.mentorship_id);
        }
        gamificationRef.current?.checkAndUnlockAchievements(msRow.mentor_id);
      }
    },
    [authUser, createNotification]
  );

  const getFeedbacks = useCallback(() => {
    return [...feedback].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [feedback]);

  // ─── Mentor des Monats ────────────────────────────────────────────────────────

  const toggleMentorOfMonth = useCallback(async () => {
    const newValue = !mentorOfMonthVisible;
    setMentorOfMonthVisible(newValue); // Optimistic
    setAppSettings((prev) => ({ ...prev, mentor_of_month_visible: newValue ? "true" : "false" }));

    const { error } = await supabase
      .from("app_settings")
      .update({ value: newValue ? "true" : "false" })
      .eq("key", "mentor_of_month_visible");

    if (error) {
      setMentorOfMonthVisible(!newValue); // Rollback
      setAppSettings((prev) => ({ ...prev, mentor_of_month_visible: !newValue ? "true" : "false" }));
    }
  }, [mentorOfMonthVisible]);

  const getSetting = useCallback((key: string): string | undefined => {
    return appSettings[key];
  }, [appSettings]);

  // ─── Push-Benachrichtigungs-Einstellungen (Admin-global) ──────────────────────

  const getPushSetting = useCallback((key: string): boolean => {
    // Default: true — wenn Eintrag fehlt, ist Push aktiviert
    return appSettings[key] !== "false";
  }, [appSettings]);

  const togglePushSetting = useCallback(async (key: string) => {
    const current = appSettings[key] !== "false";
    const newValue = !current;
    // Optimistisch aktualisieren
    setAppSettings((prev) => ({ ...prev, [key]: newValue ? "true" : "false" }));

    const { error } = await supabase
      .from("app_settings")
      .update({ value: newValue ? "true" : "false" })
      .eq("key", key);

    if (error) {
      // Rollback
      setAppSettings((prev) => ({ ...prev, [key]: current ? "true" : "false" }));
    }
  }, [appSettings]);

  // ─── addUser (für Admin: neuen Mentee ohne Auth anlegen) ──────────────────────

  const addUser = useCallback(
    async (userData: Omit<User, "id" | "created_at"> & { password: string }) => {
      // Admin-Session sichern (signUp auf supabaseAnon beeinflusst die Haupt-Session nicht)
      await supabase.auth.getSession();

      const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role,
            gender: userData.gender,
            city: userData.city,
            age: userData.age,
          },
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      const newUserId = signUpData?.user?.id;
      if (!newUserId) {
        throw new Error("Account konnte nicht erstellt werden");
      }

      // Warten bis handle_new_user() Trigger das Profil erstellt hat
      await new Promise((r) => setTimeout(r, 1500));

      // handle_new_user() setzt Rolle auf 'mentee' (Security-Fix).
      // Explizit auf gewünschte Rolle + alle Daten setzen.
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          role: userData.role,
          gender: userData.gender,
          city: userData.city ?? "",
          plz: userData.plz ?? null,
          age: userData.age ?? null,
          phone: userData.phone ?? null,
          contact_preference: userData.contact_preference ?? null,
          is_active: true,
        })
        .eq("id", newUserId);

      if (updateErr) {
        throw new Error(`Profil konnte nicht aktualisiert werden: ${updateErr.message}`);
      }

      // Frisches Profil laden + in State einfügen
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", newUserId)
        .single();

      if (freshProfile) {
        setUsers((prev) => {
          if (prev.some((u) => u.id === freshProfile.id)) return prev;
          return [...prev, mapProfile(freshProfile)];
        });
      }

      // supabaseAnon session aufraeumen (fire-and-forget, darf Return nicht blockieren)
      supabaseAnon.auth.signOut().catch(() => {});

      return { userId: newUserId };
    },
    []
  );

  // ─── Message Actions ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (mentorshipId: string, senderId: string, content: string) => {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          mentorship_id: mentorshipId,
          sender_id: senderId,
          content,
        })
        .select()
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message ?? "Nachricht konnte nicht gesendet werden");
      }

      // Realtime-Insert liefert die Nachricht via onAuthStateChange zurück,
      // aber falls der eigene Insert nicht durch Realtime kommt, State direkt updaten.
      const sender = users.find((u) => u.id === senderId);
      const newMessage: Message = {
        id: data.id,
        mentorship_id: data.mentorship_id,
        sender_id: data.sender_id,
        content: data.content,
        read_at: data.read_at ?? undefined,
        created_at: data.created_at,
        sender,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev;
        const updatedMsgs = [...prev, newMessage];
        // Cache aktualisieren
        writeMessagesCache(mentorshipId, updatedMsgs.filter((m) => m.mentorship_id === mentorshipId));
        return updatedMsgs;
      });
    },
    [users]
  );

  // ─── deleteMessage ───────────────────────────────────────────────────────────

  const deleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      throw new Error(error.message);
    }

    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  // ─── Notification Actions ─────────────────────────────────────────────────────

  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) {
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!authUser) return;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", authUser.id)
      .is("read_at", null);

    if (error) {
      return;
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [authUser]);

  const getUnreadCount = useCallback(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // ─── Application Actions ──────────────────────────────────────────────────────

  const approveApplication = useCallback(
    async (applicationId: string) => {
      // Session sicherstellen (verhindert Hänger wenn Token abgelaufen)
      await supabase.auth.getSession();

      // Bewerbungsdaten direkt aus DB laden (nicht aus stale Closure!)
      const { data: appRow, error: fetchError } = await supabase
        .from("mentor_applications")
        .select("*")
        .eq("id", applicationId)
        .single();

      if (fetchError || !appRow) throw new Error("Bewerbung nicht gefunden");

      const app: MentorApplication = {
        id: appRow.id,
        name: appRow.name,
        email: appRow.email,
        city: appRow.city,
        plz: appRow.plz ?? undefined,
        gender: appRow.gender as MentorApplication["gender"],
        age: appRow.age,
        experience: appRow.experience,
        motivation: appRow.motivation,
        contact_preference: (appRow.contact_preference as MentorApplication["contact_preference"]) ?? undefined,
        phone: appRow.phone ?? undefined,
        status: appRow.status as ApplicationStatus,
        submitted_at: appRow.submitted_at,
      };

      // Erst User via Supabase Auth signUp anlegen (nur bei Mentor-Bewerbungen)
      // Bei Mentee-Anmeldungen übernimmt handleAcceptMenteeRegistration in applications.tsx den signUp
      const isMenteeRegistration = app.motivation === "Anmeldung als neuer Muslim (öffentliches Formular)";

      if (!isMenteeRegistration) {
        // Prüfen ob der User bereits einen Account hat (vermeidet 422-Fehler von signUp)
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", app.email)
          .maybeSingle();

        if (existingProfile) {
          // Account existiert bereits (Mentor hat bei Registrierung Passwort gesetzt)
          // → Rolle auf Mentor setzen + Account aktivieren
          await supabase
            .from("profiles")
            .update({
              role: "mentor",
              is_active: true,
              gender: app.gender,
              city: app.city,
              plz: app.plz ?? null,
              age: app.age,
              phone: app.phone ?? null,
              contact_preference: app.contact_preference ?? null,
            })
            .eq("id", existingProfile.id);

          // Lokalen State aktualisieren
          const { data: freshProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", existingProfile.id)
            .single();
          if (freshProfile) {
            setUsers((prev) => {
              if (prev.some((u) => u.id === freshProfile.id)) {
                return prev.map((u) => u.id === freshProfile.id ? mapProfile(freshProfile) : u);
              }
              return [...prev, mapProfile(freshProfile)];
            });
          }
        } else {
          // Admin-Session sichern BEVOR signUp aufgerufen wird
          // signUp loggt automatisch den neuen User ein → Admin-Session geht verloren
          const { data: adminSession } = await supabase.auth.getSession();

          // Mentor: Zufälliges temporäres Passwort
          const tempPassword = "BNM-" + Math.floor(100000 + Math.random() * 900000);

          const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
            email: app.email,
            password: tempPassword,
            options: {
              data: {
                name: app.name,
                role: "mentor",
                gender: app.gender,
                city: app.city,
                age: app.age,
              },
            },
          });

          // Admin-Session sofort wiederherstellen
          if (adminSession?.session) {
            await supabase.auth.setSession({
              access_token: adminSession.session.access_token,
              refresh_token: adminSession.session.refresh_token,
            });
          }

          if (signUpError) {
            throw new Error(`Account-Erstellung fehlgeschlagen: ${signUpError.message}`);
          }

          // Neuer Account: Profil anlegen lassen + Rolle setzen
          if (signUpData?.user) {
            // Warten bis DB-Trigger handle_new_user() das Profil erstellt hat (Poll statt Sleep)
            let profileCreated = false;
            for (let attempt = 0; attempt < 20; attempt++) {
              await new Promise((r) => setTimeout(r, 250));
              const { data: checkProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", signUpData.user.id)
                .maybeSingle();
              if (checkProfile) { profileCreated = true; break; }
            }
            if (!profileCreated) {
              throw new Error("Profil wurde nicht durch DB-Trigger erstellt (Timeout 5s). Bitte erneut versuchen.");
            }

            // Session nochmal refreshen (setSession oben könnte stale sein)
            await supabase.auth.getSession();

            // handle_new_user() Trigger setzt Rolle immer auf 'mentee' (Security-Fix).
            // Deshalb hier explizit auf 'mentor' + Bewerbungsdaten setzen.
            const { error: roleError } = await supabase
              .from("profiles")
              .update({
                role: "mentor",
                gender: app.gender,
                city: app.city,
                plz: app.plz ?? null,
                age: app.age,
                phone: app.phone ?? null,
                contact_preference: app.contact_preference ?? null,
              })
              .eq("id", signUpData.user.id);

            if (roleError) {
              throw new Error(`Profil konnte nicht auf Mentor gesetzt werden: ${roleError.message}`);
            }

            const { data: newProfile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", signUpData.user.id)
              .single();
            if (newProfile) {
              setUsers((prev) => {
                if (prev.some((u) => u.id === newProfile.id)) return prev;
                return [...prev, mapProfile(newProfile)];
              });
              // Auto-Geocoding: PLZ → Koordinaten (fire-and-forget)
              if (app.plz && !newProfile.lat && !newProfile.lng) {
                geocodePLZ(app.plz).then((coords) => {
                  if (coords) {
                    supabase.from("profiles").update({ lat: coords.lat, lng: coords.lng }).eq("id", newProfile.id).then(() => {
                      setUsers((prev) => prev.map((u) => u.id === newProfile.id ? { ...u, lat: coords.lat, lng: coords.lng } : u));
                    });
                  }
                }).catch(() => {});
              }
            }
          }

          // Zugangsdaten per E-Mail senden (non-blocking — darf Approval nicht aufhalten)
          sendCredentialsEmail(app.email, app.name, tempPassword).catch(() => {});

          // Notification an neuen Mentor (fire-and-forget)
          if (signUpData?.user) {
            createNotification(
              signUpData.user.id,
              "assignment",
              "Deine Bewerbung wurde angenommen!",
              "Willkommen als Mentor bei BNM. Du bist jetzt aktiv.",
            ).catch(() => {});
          }
        }
      }

      // Status auf approved setzen
      const { error } = await supabase
        .from("mentor_applications")
        .update({
          status: "approved",
          reviewed_by: authUser?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      if (error) {
        throw new Error(`Bewerbungs-Status konnte nicht aktualisiert werden: ${error.message}`);
      }

      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: "approved" as ApplicationStatus } : a
        )
      );
    },
    [authUser, createNotification]
  );

  const rejectApplication = useCallback(
    async (applicationId: string, rejectionReason?: string) => {
      await supabase.auth.getSession();
      const { error } = await supabase
        .from("mentor_applications")
        .update({
          status: "rejected",
          reviewed_by: authUser?.id ?? null,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason ?? null,
        })
        .eq("id", applicationId);

      if (error) {
        return;
      }

      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: "rejected" as ApplicationStatus } : a
        )
      );
    },
    [authUser]
  );

  const deleteApplication = useCallback(
    async (applicationId: string) => {
      await supabase.auth.getSession();
      const { error } = await supabase
        .from("mentor_applications")
        .delete()
        .eq("id", applicationId);

      if (error) {
        throw new Error(`Bewerbung konnte nicht gelöscht werden: ${error.message}`);
      }

      setApplications((prev) => prev.filter((a) => a.id !== applicationId));
    },
    []
  );

  const submitApplication = useCallback(
    async (data: Omit<MentorApplication, "id" | "status" | "submitted_at">) => {
      const { data: inserted, error } = await supabase
        .from("mentor_applications")
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone ?? "",
          gender: data.gender,
          city: data.city,
          age: data.age,
          experience: data.experience,
          motivation: data.motivation,
          contact_preference: data.contact_preference,
          status: "pending",
        })
        .select()
        .maybeSingle();

      if (error || !inserted) {
        return;
      }

      const newApp: MentorApplication = {
        id: inserted.id,
        name: inserted.name,
        email: inserted.email,
        city: inserted.city,
        gender: inserted.gender,
        age: inserted.age,
        experience: inserted.experience ?? "",
        motivation: inserted.motivation ?? "",
        contact_preference: inserted.contact_preference ?? "whatsapp",
        phone: inserted.phone ?? undefined,
        status: inserted.status,
        submitted_at: inserted.created_at,
      };
      setApplications((prev) => [...prev, newApp]);

      // Notification an Admin/Office: Neue Mentor-Bewerbung eingegangen
      const isMenteeRegistration =
        inserted.motivation === "Anmeldung als neuer Muslim (öffentliches Formular)";
      const admins = users.filter((u) => u.role === "admin" || u.role === "office");
      for (const admin of admins) {
        if (isMenteeRegistration) {
          await createNotification(
            admin.id,
            "system",
            "Neuer Mentee registriert",
            `${inserted.name} hat sich als neuer Muslim angemeldet und wartet auf Zuweisung.`,
            inserted.id
          );
        } else {
          await createNotification(
            admin.id,
            "system",
            "Neue Mentor-Bewerbung eingegangen",
            `${inserted.name} aus ${inserted.city} hat sich als Mentor beworben.`,
            inserted.id
          );
        }
      }
    },
    [users, createNotification]
  );

  const getPendingApplicationsCount = useCallback(() => {
    // Nur Mentor-Bewerbungen zählen (nicht die selbst registrierten Mentees)
    const PUBLIC_REGISTRATION_MARKER = "Anmeldung als neuer Muslim (öffentliches Formular)";
    return applications.filter(
      (a) => a.status === "pending" && a.motivation !== PUBLIC_REGISTRATION_MARKER
    ).length;
  }, [applications]);

  // ─── User Actions ─────────────────────────────────────────────────────────────

  const updateUser = useCallback(
    async (
      userId: string,
      data: Partial<Pick<User, "name" | "email" | "city" | "plz" | "age" | "phone" | "contact_preference" | "avatar_url" | "role" | "gender" | "lat" | "lng" | "admin_notes">>
    ) => {
      await supabase.auth.getSession();
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", userId);

      if (error) {
        showError("Profil konnte nicht gespeichert werden.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...data } : u))
      );
    },
    []
  );

  const setUserActive = useCallback(async (userId: string, isActive: boolean) => {
    await supabase.auth.getSession();
    // Setzt profiles.is_active UND auth.users.banned_until via SECURITY DEFINER RPC
    const { error } = await supabase.rpc("admin_set_user_banned", {
      target_user_id: userId,
      should_ban: !isActive,
    });

    if (error) {
      throw new Error(error.message);
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: isActive } : u))
    );
  }, []);

  // deleteUser: Vollständiges Löschen (Auth + Profil + Daten) via DB-Funktion
  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const userMentorshipIds = mentorships
        .filter((m) => m.mentor_id === userId || m.mentee_id === userId)
        .map((m) => m.id);

      // Session sicherstellen (verhindert Hänger wenn Token abgelaufen)
      await supabase.auth.getSession();

      // Serverseitige Funktion: löscht Auth-User + Profil + CASCADE-Daten
      const { data, error } = await supabase.rpc("delete_user_completely", {
        target_user_id: userId,
      });

      if (error) {
        showError(`Löschen fehlgeschlagen: ${error.message}`);
        return false;
      }
      if (data === false) {
        showError("Löschen fehlgeschlagen: Nur Admins dürfen User löschen.");
        return false;
      }

      // State bereinigen
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSessions((prev) => prev.filter((s) => !userMentorshipIds.includes(s.mentorship_id)));
      setMessages((prev) => prev.filter((m) => !userMentorshipIds.includes(m.mentorship_id)));
      setFeedback((prev) => prev.filter((f) => !userMentorshipIds.includes(f.mentorship_id)));
      setMentorships((prev) => prev.filter((m) => !userMentorshipIds.includes(m.id)));

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      console.warn("deleteUser error:", msg);
      showError(`Löschen fehlgeschlagen: ${msg}`);
      return false;
    }
  }, [mentorships]);

  const bulkDeleteUsers = useCallback(
    async (userIds: string[]): Promise<{ success: number; failed: number }> => {
      const results = await Promise.allSettled(userIds.map((id) => deleteUser(id)));
      let success = 0;
      let failed = 0;
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) success++;
        else failed++;
      }
      return { success, failed };
    },
    [deleteUser]
  );

  const updateMentorshipNotes = useCallback(async (mentorshipId: string, notes: string) => {
    await supabase.auth.getSession();
    const { error } = await supabase
      .from("mentorships")
      .update({ notes })
      .eq("id", mentorshipId);

    if (error) {
      throw new Error(error.message);
    }

    setMentorships((prev) =>
      prev.map((m) => (m.id === mentorshipId ? { ...m, notes } : m))
    );
  }, []);

  const updateMenteeNotes = useCallback(async (mentorshipId: string, mentee_notes: string) => {
    await supabase.auth.getSession();
    const { error } = await supabase
      .from("mentorships")
      .update({ mentee_notes })
      .eq("id", mentorshipId);

    if (error) {
      throw new Error(error.message);
    }

    setMentorships((prev) =>
      prev.map((m) => (m.id === mentorshipId ? { ...m, mentee_notes } : m))
    );
  }, []);

  const confirmStepAsMentee = useCallback(async (mentorshipId: string, sessionTypeId: string) => {
    // Mentorship direkt aus DB laden (nicht aus stale Closure!)
    const { data: msRow } = await supabase
      .from("mentorships")
      .select("mentor_id, mentee_id, mentee_confirmed_steps")
      .eq("id", mentorshipId)
      .single();
    if (!msRow) return;

    const current: string[] = (msRow.mentee_confirmed_steps as string[]) ?? [];
    if (current.includes(sessionTypeId)) return;
    const updated = [...current, sessionTypeId];

    const { error } = await supabase
      .from("mentorships")
      .update({ mentee_confirmed_steps: updated })
      .eq("id", mentorshipId);

    if (error) {
      throw new Error(error.message);
    }

    setMentorships((prev) =>
      prev.map((m) =>
        m.id === mentorshipId ? { ...m, mentee_confirmed_steps: updated } : m
      )
    );

    // Notification an Mentor: Mentee hat Schritt bestätigt
    const { data: menteeProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", msRow.mentee_id)
      .single();
    const sessionType = sessionTypes.find((st) => st.id === sessionTypeId);
    const menteeName = menteeProfile?.name ?? "Dein Mentee";
    const stepName = sessionType?.name ?? "Schritt";
    await createNotification(
      msRow.mentor_id,
      "progress",
      "Mentee hat Schritt bestätigt",
      `${menteeName} hat Schritt "${stepName}" bestätigt.`,
      mentorshipId
    );
  }, [sessionTypes, createNotification]);

  const unconfirmStepAsMentee = useCallback(async (mentorshipId: string, sessionTypeId: string) => {
    // Mentorship direkt aus DB laden (nicht aus stale Closure!)
    const { data: msRow } = await supabase
      .from("mentorships")
      .select("mentee_confirmed_steps")
      .eq("id", mentorshipId)
      .single();
    if (!msRow) return;

    const current: string[] = (msRow.mentee_confirmed_steps as string[]) ?? [];
    const updated = current.filter((id) => id !== sessionTypeId);

    const { error } = await supabase
      .from("mentorships")
      .update({ mentee_confirmed_steps: updated })
      .eq("id", mentorshipId);

    if (error) {
      throw new Error(error.message);
    }

    setMentorships((prev) =>
      prev.map((m) =>
        m.id === mentorshipId ? { ...m, mentee_confirmed_steps: updated } : m
      )
    );
  }, []);

  // ─── Admin-Direktnachricht (als Notification) ────────────────────────────────

  const sendAdminDirectMessage = useCallback(async (recipientId: string, message: string) => {
    if (!authUser) return;
    await supabase.auth.getSession();
    // Admin-DM als echte Nachricht in admin_messages speichern
    const { data, error } = await supabase
      .from("admin_messages")
      .insert({
        admin_id: authUser.id,
        user_id: recipientId,
        sender_id: authUser.id,
        content: message,
      })
      .select()
      .maybeSingle();
    if (error || !data) {
      // Fallback: Notification erstellen falls admin_messages Tabelle noch nicht existiert
      const senderName = authUser?.name ?? "Admin";
      await createNotification(
        recipientId,
        "system",
        `Nachricht von ${senderName}`,
        message
      );
      return;
    }
    // authUser direkt als Sender nutzen (nicht aus stale users-Closure suchen)
    const newMsg: AdminMessage = {
      id: data.id, admin_id: data.admin_id, user_id: data.user_id,
      sender_id: data.sender_id, content: data.content,
      read_at: data.read_at ?? undefined, created_at: data.created_at,
      sender: authUser,
    };
    setAdminMessages((prev) => [...prev, newMsg]);
  }, [authUser, createNotification]);

  // ─── Admin-DM Funktionen ───────────────────────────────────────────────────────

  const sendAdminMessage = useCallback(async (userId: string, content: string) => {
    if (!authUser) return;
    const { data, error } = await supabase
      .from("admin_messages")
      .insert({
        admin_id: authUser.id,
        user_id: userId,
        sender_id: authUser.id,
        content,
      })
      .select()
      .maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Fehler beim Senden");
    // authUser direkt als Sender nutzen (nicht aus stale users-Closure suchen)
    const newMsg: AdminMessage = {
      id: data.id, admin_id: data.admin_id, user_id: data.user_id,
      sender_id: data.sender_id, content: data.content,
      read_at: data.read_at ?? undefined, created_at: data.created_at,
      sender: authUser,
    };
    setAdminMessages((prev) => [...prev, newMsg]);
  }, [authUser]);

  const replyToAdmin = useCallback(async (adminId: string, content: string) => {
    if (!authUser) return;
    const { data, error } = await supabase
      .from("admin_messages")
      .insert({
        admin_id: adminId,
        user_id: authUser.id,
        sender_id: authUser.id,
        content,
      })
      .select()
      .maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Fehler beim Senden");
    // authUser direkt als Sender nutzen (nicht aus stale users-Closure suchen)
    const newMsg: AdminMessage = {
      id: data.id, admin_id: data.admin_id, user_id: data.user_id,
      sender_id: data.sender_id, content: data.content,
      read_at: data.read_at ?? undefined, created_at: data.created_at,
      sender: authUser,
    };
    setAdminMessages((prev) => [...prev, newMsg]);
  }, [authUser]);

  const getAdminMessagesByUserId = useCallback((userId: string) => {
    return adminMessages.filter((m) => m.user_id === userId);
  }, [adminMessages]);

  const getAdminChatPartners = useCallback(() => {
    const userIds = new Set(adminMessages.map((m) => m.user_id));
    return Array.from(userIds);
  }, [adminMessages]);

  // ─── Hadith Actions ───────────────────────────────────────────────────────────

  const addHadith = useCallback(async (text_ar: string, text_de: string, source: string) => {
    await supabase.auth.getSession();
    const maxOrder = hadithe.length > 0
      ? Math.max(...hadithe.map((h) => h.sort_order ?? 0))
      : 0;
    const { data, error } = await supabase
      .from("hadithe")
      .insert({ text_ar: text_ar || null, text_de, source: source || null, sort_order: maxOrder + 1 })
      .select()
      .maybeSingle();

    if (error || !data) {
      throw new Error(error?.message ?? "Hadith konnte nicht gespeichert werden");
    }

    const newH: Hadith = {
      id: data.id as string,
      text_de: (data.text_de as string) ?? "",
      text_ar: (data.text_ar as string) ?? undefined,
      source: (data.source as string) ?? undefined,
      sort_order: (data.sort_order as number) ?? maxOrder + 1,
    };
    setHadithe((prev) => [...prev, newH]);
  }, [hadithe]);

  const updateHadith = useCallback(async (id: string, updates: Partial<Hadith>) => {
    const { error } = await supabase
      .from("hadithe")
      .update(updates)
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    setHadithe((prev) => prev.map((h) => (h.id === id ? { ...h, ...updates } : h)));
  }, []);

  const deleteHadith = useCallback(async (id: string) => {
    await supabase.auth.getSession();
    const { error } = await supabase.from("hadithe").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    setHadithe((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const reorderHadithe = useCallback(async (id: string, direction: "up" | "down") => {
    await supabase.auth.getSession();
    const sorted = [...hadithe].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex((h) => h.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sorted.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const aOrder = sorted[idx].sort_order ?? idx;
    const bOrder = sorted[swapIdx].sort_order ?? swapIdx;

    const updated = [...sorted];
    updated[idx] = { ...updated[idx], sort_order: bOrder };
    updated[swapIdx] = { ...updated[swapIdx], sort_order: aOrder };

    // Optimistic update
    setHadithe(updated);

    await Promise.all([
      supabase.from("hadithe").update({ sort_order: bOrder }).eq("id", updated[idx].id),
      supabase.from("hadithe").update({ sort_order: aOrder }).eq("id", updated[swapIdx].id),
    ]);
  }, [hadithe]);

  const bulkInsertHadithe = useCallback(async (items: Array<{ text_ar: string; text_de: string; source: string }>) => {
    const maxOrder = hadithe.length > 0
      ? Math.max(...hadithe.map((h) => h.sort_order ?? 0))
      : 0;

    const rows = items.map((item, i) => ({
      text_ar: item.text_ar || null,
      text_de: item.text_de,
      source: item.source || null,
      sort_order: maxOrder + i + 1,
    }));

    const { data, error } = await supabase.from("hadithe").insert(rows).select();

    if (error || !data) {
      throw new Error(error?.message ?? "Import fehlgeschlagen");
    }

    const newHs: Hadith[] = data.map((row) => ({
      id: row.id as string,
      text_de: (row.text_de as string) ?? "",
      text_ar: (row.text_ar as string) ?? undefined,
      source: (row.source as string) ?? undefined,
      sort_order: (row.sort_order as number) ?? 0,
    }));
    setHadithe((prev) => [...prev, ...newHs]);
    return data.length;
  }, [hadithe]);

  // ─── Q&A Actions ──────────────────────────────────────────────────────────────

  const loadQAEntries = useCallback(async () => {
    const { data, error } = await supabase.from("qa_entries").select("*").order("created_at", { ascending: true });
    if (error || !data) return;
    const entries: QAEntry[] = data.map((row) => ({
      id: row.id as string,
      question: row.question as string,
      answer: row.answer as string,
      category: (row.category as string) ?? "allgemein",
      tags: (row.tags as string[]) ?? [],
      is_published: (row.is_published as boolean) ?? true,
      created_by: (row.created_by as string) ?? undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));
    setQAEntries(entries);
  }, []);

  const addQAEntry = useCallback(
    async (entry: Omit<QAEntry, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("qa_entries")
        .insert({
          question: entry.question,
          answer: entry.answer,
          category: entry.category,
          tags: entry.tags ?? [],
          is_published: entry.is_published,
          created_by: entry.created_by ?? null,
        })
        .select()
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message ?? "Q&A-Eintrag konnte nicht gespeichert werden");
      }

      const newEntry: QAEntry = {
        id: data.id,
        question: data.question,
        answer: data.answer,
        category: data.category ?? "allgemein",
        tags: data.tags ?? [],
        is_published: data.is_published ?? true,
        created_by: data.created_by ?? undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setQAEntries((prev) => [...prev, newEntry]);
    },
    []
  );

  const updateQAEntry = useCallback(
    async (id: string, data: Partial<Omit<QAEntry, "id" | "created_at" | "updated_at">>) => {
      const { error } = await supabase
        .from("qa_entries")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      setQAEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...data, updated_at: new Date().toISOString() } : e))
      );
    },
    []
  );

  const deleteQAEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from("qa_entries").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    setQAEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── Resource CRUD ──────────────────────────────────────────────────────────

  const addResource = useCallback(async (resource: Omit<Resource, "id" | "created_at">) => {
    await supabase.auth.getSession();
    const { data, error } = await supabase.from("resources").insert(resource).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      // Optimistic update mit dem zurückgegebenen Datensatz
      const newRes: Resource = {
        id: data.id,
        title: data.title ?? "",
        url: data.url ?? "",
        description: data.description ?? "",
        icon: data.icon ?? "link-outline",
        category: data.category ?? "general",
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
        visible_to: data.visible_to ?? "all",
        visible_until: data.visible_until ?? null,
        visible_after_session_type_id: data.visible_after_session_type_id ?? null,
        created_at: data.created_at,
      };
      setResources((prev) => {
        if (prev.some((r) => r.id === newRes.id)) return prev;
        return [...prev, newRes];
      });
    } else {
      // Fallback: alle Ressourcen neu laden
      const { data: allRes } = await supabase.from("resources").select("*").order("sort_order", { ascending: true });
      if (allRes) {
        setResources(allRes.map(mapResource));
      }
    }
  }, []);

  const updateResource = useCallback(async (id: string, data: Partial<Omit<Resource, "id" | "created_at">>) => {
    await supabase.auth.getSession();
    const { error } = await supabase.from("resources").update(data).eq("id", id);
    if (error) throw new Error(error.message);
    setResources((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r));
  }, []);

  const deleteResource = useCallback(async (id: string) => {
    await supabase.auth.getSession();
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setResources((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ─── Event Participation ─────────────────────────────────────────────────────

  const toggleEventParticipation = useCallback(async (resourceId: string, status: EventParticipationStatus) => {
    await supabase.auth.getSession();
    if (!authUser) return;

    // Aktuellen Status direkt aus DB laden (nicht aus stale Closure!)
    const { data: existing } = await supabase
      .from("event_participations")
      .select("id, status")
      .eq("resource_id", resourceId)
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === status) {
        // Same status → remove participation
        const { error } = await supabase.from("event_participations").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
        setEventParticipations((prev) => prev.filter((ep) => ep.id !== existing.id));
      } else {
        // Different status → update
        const { error } = await supabase.from("event_participations").update({ status }).eq("id", existing.id);
        if (error) throw new Error(error.message);
        setEventParticipations((prev) => prev.map((ep) => ep.id === existing.id ? { ...ep, status } : ep));
      }
    } else {
      // New participation
      const { data, error } = await supabase
        .from("event_participations")
        .insert({ resource_id: resourceId, user_id: authUser.id, status })
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        setEventParticipations((prev) => [...prev, {
          id: data.id,
          resource_id: data.resource_id,
          user_id: data.user_id,
          status: data.status,
          created_at: data.created_at,
        }]);
      }
    }
  }, [authUser]);

  const getEventParticipationsByResourceId = useCallback(
    (resourceId: string) => eventParticipations.filter((ep) => ep.resource_id === resourceId),
    [eventParticipations]
  );

  const getMyEventParticipation = useCallback(
    (resourceId: string) => {
      if (!authUser) return undefined;
      return eventParticipations.find((ep) => ep.resource_id === resourceId && ep.user_id === authUser.id);
    },
    [authUser, eventParticipations]
  );

  // ─── Resource Completion Actions ───────────────────────────────────────────────

  const toggleResourceCompletion = useCallback(async (resourceId: string) => {
    await supabase.auth.getSession();
    if (!authUser) return;

    // Aktuellen Status direkt aus DB laden (nicht aus stale Closure!)
    const { data: existing } = await supabase
      .from("resource_completions")
      .select("id")
      .eq("resource_id", resourceId)
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (existing) {
      // Bereits abgehakt → entfernen
      const { error } = await supabase.from("resource_completions").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      setResourceCompletions((prev) => prev.filter((rc) => rc.id !== existing.id));
    } else {
      // Noch nicht abgehakt → hinzufügen
      const { data, error } = await supabase
        .from("resource_completions")
        .insert({ resource_id: resourceId, user_id: authUser.id })
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        setResourceCompletions((prev) => [...prev, {
          id: data.id,
          resource_id: data.resource_id,
          user_id: data.user_id,
          completed_at: data.completed_at,
        }]);
      }
    }
  }, [authUser]);

  const isResourceCompleted = useCallback(
    (resourceId: string) => {
      if (!authUser) return false;
      return resourceCompletions.some((rc) => rc.resource_id === resourceId && rc.user_id === authUser.id);
    },
    [authUser, resourceCompletions]
  );

  const getResourceCompletionCount = useCallback(
    (resourceId: string) => resourceCompletions.filter((rc) => rc.resource_id === resourceId).length,
    [resourceCompletions]
  );

  // ─── Calendar Event Actions ────────────────────────────────────────────────────

  const addCalendarEvent = useCallback(async (event: Omit<CalendarEvent, "id" | "created_at">): Promise<string | null> => {
    await supabase.auth.getSession();
    const { data, error } = await supabase.from("calendar_events").insert(event).select().maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      setCalendarEvents((prev) => [...prev, {
        id: data.id, title: data.title ?? "", description: data.description ?? "",
        start_at: data.start_at, end_at: data.end_at ?? null, type: data.type ?? "custom",
        location: data.location ?? "", created_by: data.created_by ?? null,
        recurrence: data.recurrence ?? null, visible_to: data.visible_to ?? "all",
        is_active: data.is_active ?? true, google_calendar_event_id: data.google_calendar_event_id ?? null,
        created_at: data.created_at,
      }]);
      return data.id as string;
    }
    return null;
  }, []);

  const updateCalendarEvent = useCallback(async (id: string, data: Partial<Omit<CalendarEvent, "id" | "created_at">>) => {
    await supabase.auth.getSession();
    const { error } = await supabase.from("calendar_events").update(data).eq("id", id);
    if (error) throw new Error(error.message);
    setCalendarEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...data } as CalendarEvent : e));
  }, []);

  const deleteCalendarEvent = useCallback(async (id: string) => {
    await supabase.auth.getSession();
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) throw new Error(error.message);
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
    setEventAttendees((prev) => prev.filter((a) => a.event_id !== id));
  }, []);

  const respondToEvent = useCallback(async (eventId: string, status: EventAttendeeStatus) => {
    await supabase.auth.getSession();
    if (!authUser) return;
    const existing = eventAttendees.find((a) => a.event_id === eventId && a.user_id === authUser.id);
    if (existing) {
      if (existing.status === status) return;
      const { error } = await supabase.from("event_attendees").update({ status }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      setEventAttendees((prev) => prev.map((a) => a.id === existing.id ? { ...a, status } : a));
    } else {
      const { data, error } = await supabase.from("event_attendees")
        .insert({ event_id: eventId, user_id: authUser.id, status })
        .select().maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        setEventAttendees((prev) => [...prev, {
          id: data.id, event_id: data.event_id, user_id: data.user_id,
          status: data.status, reminder_minutes: data.reminder_minutes ?? 60,
          google_synced: data.google_synced ?? false, created_at: data.created_at,
        }]);
      }
    }

    // Bei Absage: Admin + Office in-app benachrichtigen
    if (status === "declined") {
      const event = calendarEvents.find((e) => e.id === eventId);
      const decliner = users.find((u) => u.id === authUser.id);
      const adminOffice = users.filter((u) => u.role === "admin" || u.role === "office");
      if (event && adminOffice.length > 0) {
        await Promise.all(
          adminOffice.map((admin) =>
            createNotification(
              admin.id,
              "system",
              `Absage: ${event.title}`,
              `${decliner?.name ?? "Jemand"} hat den Termin "${event.title}" abgesagt.`,
              eventId
            )
          )
        );
      }
    }
  }, [authUser, eventAttendees, calendarEvents, users, createNotification]);

  const inviteToEvent = useCallback(async (eventId: string, userIds: string[]) => {
    await supabase.auth.getSession();
    const existing = eventAttendees.filter((a) => a.event_id === eventId).map((a) => a.user_id);
    const newIds = userIds.filter((id) => !existing.includes(id));
    if (newIds.length === 0) return;
    const rows = newIds.map((userId) => ({ event_id: eventId, user_id: userId, status: "invited" as const }));
    const { data, error } = await supabase.from("event_attendees").insert(rows).select();
    if (error) throw new Error(error.message);
    if (data) {
      setEventAttendees((prev) => [...prev, ...data.map(mapEventAttendee)]);
    }
  }, [eventAttendees]);

  const getEventsByDate = useCallback((dateStr: string) => {
    return calendarEvents.filter((e) => {
      if (!e.is_active) return false;
      const eventDate = e.start_at.slice(0, 10);
      return eventDate === dateStr;
    });
  }, [calendarEvents]);

  // ─── refreshData ──────────────────────────────────────────────────────────────

  // Throttled refresh: nur wenn letzte Ladung > 10s her ist
  const lastLoadRef = React.useRef<number>(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshData = useCallback(async () => {
    if (!authUser) return;
    // Kein Throttle — jeder Aufruf laedt sofort. Doppel-Aufrufe werden
    // durch isActiveLoadRef in loadAllData abgefangen.
    await loadAllData(hasLoadedOnceRef.current);
  }, [authUser?.id]); // intentionally only depends on authUser to avoid infinite re-creation

  // ─── Computed Helpers ─────────────────────────────────────────────────────────

  const getMentorshipsByMentorId = useCallback(
    (mentorId: string) => mentorships.filter((m) => m.mentor_id === mentorId),
    [mentorships]
  );

  const getMentorshipByMenteeId = useCallback(
    (menteeId: string) => mentorships.find((m) => m.mentee_id === menteeId),
    [mentorships]
  );

  const getMentorshipById = useCallback(
    (id: string) => mentorships.find((m) => m.id === id),
    [mentorships]
  );

  const getSessionsByMentorshipId = useCallback(
    (mentorshipId: string) =>
      sessions
        .filter((s) => s.mentorship_id === mentorshipId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [sessions]
  );

  const getCompletedStepIds = useCallback(
    (mentorshipId: string) => {
      const msessions = sessions.filter((s) => s.mentorship_id === mentorshipId);
      return [...new Set(msessions.map((s) => s.session_type_id))];
    },
    [sessions]
  );

  const getMessagesByMentorshipId = useCallback(
    (mentorshipId: string) =>
      messages
        .filter((m) => m.mentorship_id === mentorshipId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  );

  const getUserById = useCallback(
    (id: string) => users.find((u) => u.id === id),
    [users]
  );

  const getUnassignedMentees = useCallback(() => {
    // assignedMenteeIds kommt via RPC (SECURITY DEFINER) und umgeht RLS.
    // Damit sehen auch Mentoren korrekt, welche Mentees schon vergeben sind.
    return users.filter(
      (u) =>
        u.role === "mentee" &&
        u.is_active !== false &&
        !assignedMenteeIds.has(u.id)
    );
  }, [users, assignedMenteeIds]);

  const getUnreadMessagesCount = useCallback(
    (mentorshipId: string) => {
      if (!authUser) return 0;
      return messages.filter(
        (m) =>
          m.mentorship_id === mentorshipId &&
          m.sender_id !== authUser.id &&
          !m.read_at
      ).length;
    },
    [messages, authUser]
  );

  const getTotalUnreadMessages = useCallback(() => {
    if (!authUser) return 0;
    // Admin/Office sehen alle Chats zur Überwachung — Badge wäre irreführend,
    // da niemand direkt den Admin in Mentorship-Chats anschreibt.
    if (authUser.role === "admin" || authUser.role === "office") return 0;
    return messages.filter(
      (m) => m.sender_id !== authUser.id && !m.read_at
    ).length;
  }, [messages, authUser]);

  // Ungelesene Admin-DMs zählen (für Mentor/Mentee Badge im Chat-Tab)
  const getTotalUnreadAdminMessages = useCallback(() => {
    if (!authUser) return 0;
    if (authUser.role === "admin" || authUser.role === "office") return 0;
    return adminMessages.filter(
      (m) => m.user_id === authUser.id && m.sender_id !== authUser.id && !m.read_at
    ).length;
  }, [adminMessages, authUser]);

  // Admin-DMs als gelesen markieren (für Mentor/Mentee wenn sie den Admin-Chat öffnen)
  const markAdminChatAsRead = useCallback(
    async (userId: string) => {
      if (!authUser) return;
      const now = new Date().toISOString();

      // Optimistisch: Lokalen State SOFORT aktualisieren (Badge verschwindet instant)
      setAdminMessages((prev) =>
        prev.map((m) =>
          m.user_id === userId && m.sender_id !== authUser.id && !m.read_at
            ? { ...m, read_at: now }
            : m
        )
      );

      const { error } = await supabase
        .from("admin_messages")
        .update({ read_at: now })
        .eq("user_id", userId)
        .neq("sender_id", authUser.id)
        .is("read_at", null);

      if (error) {
        console.error("markAdminChatAsRead DB-UPDATE failed:", error.message);
      }
    },
    [authUser?.id]
  );

  const markChatAsRead = useCallback(
    async (mentorshipId: string) => {
      if (!authUser) return;

      const now = new Date().toISOString();

      // Optimistisch: Lokalen State SOFORT aktualisieren (Badge verschwindet instant)
      setMessages((prev) =>
        prev.map((m) =>
          m.mentorship_id === mentorshipId &&
          m.sender_id !== authUser.id &&
          !m.read_at
            ? { ...m, read_at: now }
            : m
        )
      );

      // DB Update (idempotent — auch ohne lokalen Check sicher)
      const { error } = await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("mentorship_id", mentorshipId)
        .neq("sender_id", authUser.id)
        .is("read_at", null);

      if (error) {
        console.error("markChatAsRead DB-UPDATE failed:", error.message, "— Bitte supabase/fix-messages-update.sql ausführen!");
      }
    },
    [authUser?.id] // Stabile Dependency — kein messages-Array mehr
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  const contextValue = useMemo(() => ({
    users,
    mentorships,
    sessions,
    sessionTypes,
    feedback,
    messages,
    applications,
    notifications,
    hadithe,
    _gamificationRef: gamificationRef,
    _updateUserXP,
    addHadith,
    updateHadith,
    deleteHadith,
    reorderHadithe,
    bulkInsertHadithe,
    qaEntries,
    messageTemplates,
    resources,
    eventParticipations,
    addResource,
    updateResource,
    deleteResource,
    toggleEventParticipation,
    getEventParticipationsByResourceId,
    getMyEventParticipation,
    resourceCompletions,
    toggleResourceCompletion,
    isResourceCompleted,
    getResourceCompletionCount,
    calendarEvents,
    eventAttendees,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    respondToEvent,
    inviteToEvent,
    getEventsByDate,
    loadQAEntries,
    addQAEntry,
    updateQAEntry,
    deleteQAEntry,
    getSetting,
    mentorOfMonthVisible,
    toggleMentorOfMonth,
    getPushSetting,
    togglePushSetting,
    addUser,
    assignMentorship,
    updateMentorshipStatus,
    approveMentorship,
    rejectMentorship,
    getPendingApprovalsCount,
    addSession,
    updateSession,
    deleteSession,
    cancelMentorship,
    addSessionType,
    updateSessionTypeOrder,
    updateSessionType,
    deleteSessionType,
    addFeedback,
    getFeedbacks,
    sendMessage,
    deleteMessage,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    sendAdminDirectMessage,
    adminMessages,
    sendAdminMessage,
    replyToAdmin,
    getAdminMessagesByUserId,
    getAdminChatPartners,
    approveApplication,
    rejectApplication,
    deleteApplication,
    submitApplication,
    updateUser,
    setUserActive,
    deleteUser,
    bulkDeleteUsers,
    updateMentorshipNotes,
    updateMenteeNotes,
    confirmStepAsMentee,
    unconfirmStepAsMentee,
    getMentorshipsByMentorId,
    getMentorshipByMenteeId,
    getMentorshipById,
    getSessionsByMentorshipId,
    getCompletedStepIds,
    getMessagesByMentorshipId,
    getUserById,
    getUnassignedMentees,
    getPendingApplicationsCount,
    getUnreadMessagesCount,
    getTotalUnreadMessages,
    getTotalUnreadAdminMessages,
    markChatAsRead,
    markAdminChatAsRead,
    refreshData,
    isLoading,
  }), [
    users, mentorships, sessions, sessionTypes, feedback, messages, applications,
    notifications, hadithe, qaEntries,
    messageTemplates, resources, eventParticipations, adminMessages, mentorOfMonthVisible, appSettings, isLoading, _updateUserXP,
    addResource, updateResource, deleteResource,
    toggleEventParticipation, getEventParticipationsByResourceId, getMyEventParticipation,
    resourceCompletions, toggleResourceCompletion, isResourceCompleted, getResourceCompletionCount,
    calendarEvents, eventAttendees, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
    respondToEvent, inviteToEvent, getEventsByDate,
    addHadith, updateHadith, deleteHadith, reorderHadithe, bulkInsertHadithe,
    loadQAEntries, addQAEntry, updateQAEntry, deleteQAEntry,
    getSetting, toggleMentorOfMonth, getPushSetting, togglePushSetting, addUser, assignMentorship,
    updateMentorshipStatus, approveMentorship, rejectMentorship, getPendingApprovalsCount,
    addSession, updateSession, deleteSession, cancelMentorship,
    addSessionType, updateSessionTypeOrder, updateSessionType, deleteSessionType, addFeedback, getFeedbacks,
    sendMessage, deleteMessage, markAsRead, markAllAsRead, getUnreadCount,
    sendAdminDirectMessage, sendAdminMessage, replyToAdmin,
    getAdminMessagesByUserId, getAdminChatPartners,
    approveApplication, rejectApplication, deleteApplication, submitApplication,
    updateUser, setUserActive, deleteUser, bulkDeleteUsers,
    updateMentorshipNotes, updateMenteeNotes, confirmStepAsMentee, unconfirmStepAsMentee,
    getMentorshipsByMentorId, getMentorshipByMenteeId, getMentorshipById,
    getSessionsByMentorshipId, getCompletedStepIds, getMessagesByMentorshipId,
    getUserById, getUnassignedMentees, getPendingApplicationsCount,
    getUnreadMessagesCount, getTotalUnreadMessages, getTotalUnreadAdminMessages,
    markChatAsRead, markAdminChatAsRead, refreshData,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData muss innerhalb eines DataProviders verwendet werden");
  }
  return context;
}
