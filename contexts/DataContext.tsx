import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
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
  XPEntry,
  UserAchievement,
  ThankEntry,
  StreakData,
} from "../types";
import { XP_VALUES, ACHIEVEMENTS, getLevelForXP } from "../lib/gamification";
import { supabase } from "../lib/supabase";
import { supabaseAnon } from "../lib/supabaseAnon";
import { useAuth } from "./AuthContext";
import { checkReminders } from "../lib/reminders";
import { showError, showSuccess } from "../lib/errorHandler";
import {
  sendMentorshipStatusChangeNotification,
  sendCredentialsEmail,
  sendMenteeAssignedNotification,
  sendFeedbackRequestEmail,
  sendApplicationRejectionEmail,
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

  // Gamification
  xpLog: XPEntry[];
  userAchievements: UserAchievement[];
  thanks: ThankEntry[];
  streak: StreakData | null;
  awardXP: (userId: string, amount: number, reason: string, relatedId?: string) => void;
  sendThanks: (mentorshipId: string, mentorId: string, message?: string, sessionTypeId?: string) => Promise<void>;
  checkAndUnlockAchievements: (userId: string) => Promise<void>;
  updateStreak: (userId: string) => Promise<void>;

  // App Settings
  getSetting: (key: string) => string | undefined;

  // Mentor des Monats Sichtbarkeit
  mentorOfMonthVisible: boolean;
  toggleMentorOfMonth: () => Promise<void>;

  // User registration (Mentee via Admin-Aufruf, nicht mehr nötig für Supabase)
  addUser: (user: Omit<User, "id" | "created_at">) => Promise<void>;

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
  rejectApplication: (applicationId: string) => Promise<void>;
  submitApplication: (data: Omit<MentorApplication, "id" | "status" | "submitted_at">) => Promise<void>;

  // User actions
  updateUser: (userId: string, data: Partial<Pick<User, "name" | "city" | "plz" | "age" | "phone" | "contact_preference" | "avatar_url" | "role" | "gender" | "lat" | "lng">>) => Promise<void>;
  setUserActive: (userId: string, isActive: boolean) => Promise<void>;
  deleteUser: (userId: string) => Promise<boolean>;
  bulkDeleteUsers: (userIds: string[]) => Promise<{ success: number; failed: number }>;

  // Mentorship Notes
  updateMentorshipNotes: (mentorshipId: string, notes: string) => Promise<void>;

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
  markChatAsRead: (mentorshipId: string) => Promise<void>;

  // Refresh
  refreshData: (force?: boolean) => Promise<void>;

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [applications, setApplications] = useState<MentorApplication[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mentorOfMonthVisible, setMentorOfMonthVisible] = useState<boolean>(true);
  const [hadithe, setHadithe] = useState<Hadith[]>([]);
  const [qaEntries, setQAEntries] = useState<QAEntry[]>([]);
  const [appSettings, setAppSettings] = useState<Record<string, string>>({});
  const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
  const [xpLog, setXpLog] = useState<XPEntry[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [thanks, setThanks] = useState<ThankEntry[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Ref für Mentorships — immer aktuell, auch in Realtime-Callbacks (Closure-Problem vermeiden)
  const mentorshipsRef = useRef<Mentorship[]>([]);
  // Guard: verhindert parallele foreground-Loads (würden State inkonsistent machen)
  const isActiveLoadRef = useRef(false);

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
      setXpLog([]);
      setUserAchievements([]);
      setThanks([]);
      setStreak(null);
      setIsLoading(false);
      return;
    }

    // Cache-first: Zuerst gecachte Daten anzeigen, dann im Hintergrund frisch laden
    (async () => {
      const cached = await readCache();

      // Cache gilt als nutzbar, wenn users vorhanden (mind. 2 Einträge)
      const cacheUsable = cached !== null && cached.users.length >= 2;

      if (cacheUsable && cached) {
        // Cache sofort anzeigen → kein leerer Screen während des Ladens
        setUsers(cached.users);
        // Mentorships ohne mentor/mentee-Objekte (werden beim Background-Refresh aufgelöst)
        setMentorships(cached.mentorships as Mentorship[]);
        setSessions(cached.sessions);
        setSessionTypes(cached.sessionTypes);
        setFeedback(cached.feedback);
        setHadithe(cached.hadithe);
        setQAEntries(cached.qaEntries);
        setAppSettings(cached.appSettings);
        setMentorOfMonthVisible(cached.mentorOfMonthVisible);
        setIsLoading(false);

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

    // Subscriptions nach loadAllData starten (mentorships-State wird gefüllt)
    const cleanupMessages = subscribeToMessages();
    const cleanupProfiles = subscribeToProfiles();
    const cleanupMentorships = subscribeToMentorships();
    const cleanupAdminMessages = subscribeToAdminMessages();
    return () => {
      cleanupMessages();
      cleanupProfiles();
      cleanupMentorships();
      cleanupAdminMessages();
    };
  }, [authUser?.id]);

  // Ref immer aktuell halten — wird in Realtime-Callbacks genutzt
  useEffect(() => {
    mentorshipsRef.current = mentorships;
  }, [mentorships]);

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
    // Concurrent-Load-Guard: Kein paralleler foreground-Load erlaubt
    if (!background) {
      if (isActiveLoadRef.current) return;
      isActiveLoadRef.current = true;
    }
    if (!background) setIsLoading(true);
    try {
      // Session-Check: Nur laden wenn gültige Supabase-Session vorhanden
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        // Keine Session → Auth redirectet automatisch zum Login, nicht weiter laden
        if (!background) setIsLoading(false);
        return;
      }

      const isAdminOrOffice = authUser?.role === "admin" || authUser?.role === "office";
      const isMentor = authUser?.role === "mentor";
      // Platzhalter für Queries die nur für bestimmte Rollen ausgeführt werden
      const empty = Promise.resolve({ data: null, error: null });

      // Timeout: Wenn Supabase-Queries nach 12s nicht antworten → Fehler werfen
      // Verhindert dauerhaftes "isLoading=true" bei hängender Verbindung
      const withTimeout = <T>(p: Promise<T>): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Supabase query timeout (12s)")), 12_000)
          ),
        ]);

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
        adminMsgsRes,
        xpRes,
        achievementsRes,
        thanksRes,
        streakRes,
      ] = await withTimeout(Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("mentorships").select("*"),
        supabase.from("sessions").select("*"),
        supabase.from("session_types").select("*").order("sort_order"),
        supabase.from("feedback").select("*"),
        supabase.from("notifications").select("*").eq("user_id", authUser!.id),
        supabase.from("mentor_applications").select("*"),
        supabase.from("app_settings").select("*"),
        supabase.from("messages").select("*"),
        supabase.from("hadithe").select("*").order("sort_order", { ascending: true }),
        supabase.from("qa_entries").select("*").order("created_at", { ascending: true }),
        // admin_messages: jetzt parallel statt sequenziell
        isAdminOrOffice
          ? supabase.from("admin_messages").select("*").order("created_at", { ascending: true })
          : supabase.from("admin_messages").select("*").eq("user_id", authUser!.id).order("created_at", { ascending: true }),
        // Gamification (nur für Mentoren): jetzt parallel statt sequenziell
        isMentor ? supabase.from("xp_log").select("*").eq("user_id", authUser!.id).order("created_at", { ascending: false }).limit(100) : empty,
        isMentor ? supabase.from("achievements").select("*").eq("user_id", authUser!.id) : empty,
        isMentor ? supabase.from("thanks").select("*").eq("mentor_id", authUser!.id).order("created_at", { ascending: false }) : empty,
        isMentor ? supabase.from("streaks").select("*").eq("user_id", authUser!.id).maybeSingle() : empty,
      ] as const));

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
          mentor: profileMap[row.mentor_id as string],
          mentee: profileMap[row.mentee_id as string],
          mentee_confirmed_steps: (row.mentee_confirmed_steps as string[]) ?? [],
        }));
        setMentorships(ms);
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
      if (xpRes.data) {
        setXpLog(
          (xpRes.data as any[]).map((row) => ({
            id: row.id as string,
            user_id: row.user_id as string,
            amount: row.amount as number,
            reason: row.reason as string,
            related_id: (row.related_id as string) ?? undefined,
            created_at: row.created_at as string,
          }))
        );
      }

      if (achievementsRes.data) {
        setUserAchievements(
          (achievementsRes.data as any[]).map((row) => ({
            id: row.id as string,
            user_id: row.user_id as string,
            achievement_key: row.achievement_key as string,
            unlocked_at: row.unlocked_at as string,
          }))
        );
      }

      if (thanksRes.data) {
        setThanks(
          (thanksRes.data as any[]).map((row) => ({
            id: row.id as string,
            mentorship_id: row.mentorship_id as string,
            mentee_id: row.mentee_id as string,
            mentor_id: row.mentor_id as string,
            session_type_id: (row.session_type_id as string) ?? undefined,
            message: (row.message as string) ?? "",
            created_at: row.created_at as string,
          }))
        );
      }

      if (streakRes.data) {
        const row = streakRes.data as Record<string, unknown>;
        setStreak({
          user_id: row.user_id as string,
          current_streak: (row.current_streak as number) ?? 0,
          longest_streak: (row.longest_streak as number) ?? 0,
          last_activity_date: (row.last_activity_date as string) ?? undefined,
        });
      }

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
          const { data: insertedReminders } = await supabase
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
            .select();

          if (insertedReminders) {
            setNotifications((prev) => [
              ...prev,
              ...insertedReminders.map(mapNotification),
            ]);
          }
        }
      }
    } catch (err) {
      console.warn("[DataContext] loadAllData error:", err);
      if (!background) {
        showError("Daten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung.");
      }
    } finally {
      if (!background) {
        isActiveLoadRef.current = false;
        setIsLoading(false);
        // Force-Refresh: Wenn nach dem Laden keine User vorhanden, einmalig nochmal laden
        // (RLS-Timing: Session gerade erneuert → Profile noch nicht sichtbar)
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
            setMessages((prev) =>
              prev.map((m) =>
                m.id === (row.id as string)
                  ? { ...m, read_at: (row.read_at as string) || undefined }
                  : m
              )
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
          let sender: User | undefined = users.find((u) => u.id === row.sender_id);
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
              mentor: users.find((u) => u.id === row.mentor_id),
              mentee: users.find((u) => u.id === row.mentee_id),
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
            const sender = users.find((u) => u.id === row.sender_id);
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

  // ─── Gamification Funktionen ──────────────────────────────────────────────────

  // awardXP: Fire-and-forget — blockiert nie den Aufrufer
  const awardXP = useCallback(
    (userId: string, amount: number, reason: string, relatedId?: string) => {
      (async () => {
        try {
          const { data: xpData } = await supabase
            .from("xp_log")
            .insert({
              user_id: userId,
              amount,
              reason,
              related_id: relatedId ?? null,
            })
            .select()
            .single();

          if (xpData) {
            const newEntry: XPEntry = {
              id: xpData.id,
              user_id: xpData.user_id,
              amount: xpData.amount,
              reason: xpData.reason,
              related_id: xpData.related_id ?? undefined,
              created_at: xpData.created_at,
            };
            setXpLog((prev) => [newEntry, ...prev]);
          }

          // profiles.total_xp hochzählen
          const { data: profileData } = await supabase
            .from("profiles")
            .select("total_xp")
            .eq("id", userId)
            .single();

          const currentXP = (profileData?.total_xp as number) ?? 0;
          const newXP = currentXP + amount;
          const newLevel = getLevelForXP(newXP).key;

          await supabase
            .from("profiles")
            .update({ total_xp: newXP, mentor_level: newLevel })
            .eq("id", userId);

          if (authUser?.id === userId) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === userId ? { ...u, total_xp: newXP, mentor_level: newLevel } : u
              )
            );
          }
        } catch {
          // Fire-and-forget: Fehler still ignorieren
        }
      })();
    },
    [authUser?.id]
  );

  // sendThanks: Mentee dankt Mentor
  const sendThanks = useCallback(
    async (mentorshipId: string, mentorId: string, message?: string, sessionTypeId?: string) => {
      if (!authUser) return;
      const { data, error } = await supabase
        .from("thanks")
        .insert({
          mentorship_id: mentorshipId,
          mentee_id: authUser.id,
          mentor_id: mentorId,
          session_type_id: sessionTypeId ?? null,
          message: message ?? "",
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Danke konnte nicht gesendet werden");
      }

      const newThank: ThankEntry = {
        id: data.id,
        mentorship_id: data.mentorship_id,
        mentee_id: data.mentee_id,
        mentor_id: data.mentor_id,
        session_type_id: data.session_type_id ?? undefined,
        message: data.message ?? "",
        created_at: data.created_at,
      };
      setThanks((prev) => [newThank, ...prev]);

      await awardXP(mentorId, XP_VALUES.THANK_RECEIVED, "thank_received", mentorshipId);
    },
    [authUser, awardXP]
  );

  // checkAndUnlockAchievements
  const checkAndUnlockAchievements = useCallback(
    async (userId: string) => {
      try {
        const { data: existingData } = await supabase
          .from("achievements")
          .select("achievement_key")
          .eq("user_id", userId);
        const existingKeys = new Set(
          (existingData ?? []).map((r: Record<string, unknown>) => r.achievement_key as string)
        );

        const myMentorships = mentorships.filter((m) => m.mentor_id === userId);
        const completedCount = myMentorships.filter((m) => m.status === "completed").length;
        const activeCnt = myMentorships.filter((m) => m.status === "active").length;

        const myFeedbackList = feedback.filter((f) =>
          myMentorships.some((m) => m.id === f.mentorship_id)
        );
        const avgRatingVal =
          myFeedbackList.length > 0
            ? myFeedbackList.reduce((acc, f) => acc + f.rating, 0) / myFeedbackList.length
            : 0;

        const mySessions = sessions.filter((s) =>
          myMentorships.some((m) => m.id === s.mentorship_id)
        );

        const { data: streakData } = await supabase
          .from("streaks")
          .select("longest_streak")
          .eq("user_id", userId)
          .maybeSingle();
        const longestStreak = (streakData?.longest_streak as number) ?? 0;

        const quranTypeIds = sessionTypes
          .filter((st) => st.name.toLowerCase().includes("koran") || st.name.toLowerCase().includes("quran"))
          .map((st) => st.id);
        const quranSessions = mySessions.filter((s) => quranTypeIds.includes(s.session_type_id)).length;

        const toUnlock: string[] = [];
        if (completedCount >= 1 && !existingKeys.has("first_completion")) toUnlock.push("first_completion");
        if (activeCnt >= 5 && !existingKeys.has("marathon")) toUnlock.push("marathon");
        if (longestStreak >= 30 && !existingKeys.has("punctual_30")) toUnlock.push("punctual_30");
        if (avgRatingVal >= 4.5 && myFeedbackList.length >= 3 && !existingKeys.has("five_star")) toUnlock.push("five_star");
        if (completedCount >= 10 && !existingKeys.has("bridge_builder")) toUnlock.push("bridge_builder");
        if (quranSessions >= 10 && !existingKeys.has("quran_teacher")) toUnlock.push("quran_teacher");
        if (completedCount >= 5 && !existingKeys.has("community_hero")) toUnlock.push("community_hero");
        if (completedCount >= 10 && !existingKeys.has("ten_completions")) toUnlock.push("ten_completions");

        if (toUnlock.length > 0) {
          const rows = toUnlock.map((key) => ({ user_id: userId, achievement_key: key }));
          const { data: newAchievements } = await supabase
            .from("achievements")
            .insert(rows)
            .select();

          if (newAchievements) {
            const mapped: UserAchievement[] = newAchievements.map((row: Record<string, unknown>) => ({
              id: row.id as string,
              user_id: row.user_id as string,
              achievement_key: row.achievement_key as string,
              unlocked_at: row.unlocked_at as string,
            }));
            setUserAchievements((prev) => [...prev, ...mapped]);
          }
        }
      } catch {
        // still ignorieren
      }
    },
    [mentorships, sessions, sessionTypes, feedback]
  );

  // updateStreak: Tägliche Streak-Logik
  const updateStreak = useCallback(
    async (userId: string) => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data: existing } = await supabase
          .from("streaks")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existing) {
          const { data: inserted } = await supabase
            .from("streaks")
            .insert({
              user_id: userId,
              current_streak: 1,
              longest_streak: 1,
              last_activity_date: today,
            })
            .select()
            .single();
          if (inserted) {
            setStreak({ user_id: userId, current_streak: 1, longest_streak: 1, last_activity_date: today });
          }
          return;
        }

        const lastDate = existing.last_activity_date as string | null;
        if (lastDate === today) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const newStreakCount = lastDate === yesterdayStr ? (existing.current_streak as number) + 1 : 1;
        const newLongest = Math.max(newStreakCount, existing.longest_streak as number);

        await supabase
          .from("streaks")
          .update({
            current_streak: newStreakCount,
            longest_streak: newLongest,
            last_activity_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        setStreak({ user_id: userId, current_streak: newStreakCount, longest_streak: newLongest, last_activity_date: today });

        awardXP(userId, XP_VALUES.STREAK_DAY, "streak_day");
      } catch {
        // still ignorieren
      }
    },
    [awardXP]
  );

  // ─── Mentorship Actions ───────────────────────────────────────────────────────

  // ─── Hilfsfunktion: Notification in DB einfügen ────────────────────────────────
  const createNotification = useCallback(
    async (userId: string, type: Notification["type"], title: string, body: string, relatedId?: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .insert({ user_id: userId, type, title, body, related_id: relatedId ?? null })
        .select()
        .single();

      if (!error && data) {
        // Nur in State laden wenn es die eigene Notification ist
        if (userId === authUser?.id) {
          setNotifications((prev) => [...prev, mapNotification(data)]);
        }
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
        .single();

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

      // Automatische Sessions nachholen (Registrierung + Zuweisung)
      const mentorship = mentorships.find((m) => m.id === mentorshipId);
      if (mentorship) {
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
            documented_by: mentorship.assigned_by,
            attempt_number: 1,
          });
        }
        if (zuweisungType) {
          autoSessions.push({
            mentorship_id: mentorshipId,
            session_type_id: zuweisungType.id,
            date: now,
            is_online: false,
            details: `Zuweisung zu ${mentorship.mentor?.name ?? "Mentor"}`,
            documented_by: mentorship.assigned_by,
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
        if (mentorship.mentor?.email) {
          await sendMenteeAssignedNotification(
            mentorship.mentor.name,
            mentorship.mentor.email,
            mentorship.mentee?.name ?? "Mentee",
            mentorship.mentee?.city ?? ""
          );
        }

        // In-App Notification an Mentor: Neuer Mentee nach Approval zugewiesen
        await createNotification(
          mentorship.mentor_id,
          "assignment",
          "Neuer Mentee zugewiesen",
          `${mentorship.mentee?.name ?? "Ein Mentee"} wurde dir als Mentee zugewiesen.`,
          mentorshipId
        );

        // In-App Notification an Mentee: Betreuung genehmigt
        await createNotification(
          mentorship.mentee_id,
          "assignment",
          "Dir wurde ein Mentor zugewiesen!",
          `${mentorship.mentor?.name ?? "Ein Mentor"} ist ab sofort dein Mentor.`,
          mentorshipId
        );
      }
    },
    [mentorships, sessionTypes, createNotification]
  );

  const rejectMentorship = useCallback(
    async (mentorshipId: string, reason: string) => {
      // Mentorship-Daten vor dem Löschen sichern (für Notification)
      const mentorship = mentorships.find((m) => m.id === mentorshipId);

      const { error } = await supabase
        .from("mentorships")
        .delete()
        .eq("id", mentorshipId);

      if (error) {
        throw new Error(error.message);
      }

      setMentorships((prev) => prev.filter((m) => m.id !== mentorshipId));

      // Notification an den Mentor senden
      if (mentorship) {
        const menteeName = mentorship.mentee?.name ?? "Mentee";
        await createNotification(
          mentorship.mentor_id,
          "assignment",
          "Zuweisung abgelehnt",
          `Deine Zuweisung zu ${menteeName} wurde abgelehnt. Grund: ${reason}`,
          mentorshipId
        );
      }
    },
    [mentorships, createNotification]
  );

  const getPendingApprovalsCount = useCallback(() => {
    return mentorships.filter((m) => m.status === "pending_approval").length;
  }, [mentorships]);

  const updateMentorshipStatus = useCallback(
    async (mentorshipId: string, status: MentorshipStatus) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
      } else if (status === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
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
                  status === "completed" || status === "cancelled"
                    ? new Date().toISOString()
                    : m.completed_at,
              }
            : m
        )
      );

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

            // XP für abgeschlossene Betreuung (fire-and-forget)
            awardXP(m.mentor_id, XP_VALUES.MENTORSHIP_COMPLETED, "mentorship_completed", mentorshipId);
            checkAndUnlockAchievements(m.mentor_id);
          }
        }
      }
    },
    [authUser, mentorships, createNotification, awardXP, checkAndUnlockAchievements]
  );

  // ─── Session Actions ──────────────────────────────────────────────────────────

  const addSession = useCallback(
    async (sessionData: Omit<Session, "id" | "session_type">) => {
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
        .single();

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

      // XP für Session-Dokumentation (fire-and-forget)
      if (authUser?.role === "mentor") {
        awardXP(sessionData.documented_by, XP_VALUES.SESSION_DOCUMENTED, "session_documented", data.id);
        updateStreak(sessionData.documented_by);
        checkAndUnlockAchievements(sessionData.documented_by);
      }
    },
    [sessionTypes, mentorships, createNotification, authUser, awardXP, updateStreak, checkAndUnlockAchievements]
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
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("mentorships")
        .update({ status: "cancelled", cancelled_at: now, cancel_reason: reason })
        .eq("id", mentorshipId);

      if (error) {
        throw new Error(error.message);
      }

      setMentorships((prev) =>
        prev.map((m) =>
          m.id === mentorshipId
            ? { ...m, status: "cancelled" as MentorshipStatus, completed_at: now }
            : m
        )
      );

      // Admin-Notification bei Abbruch
      const admins = users.filter((u) => u.role === "admin" || u.role === "office");
      const mentorship = mentorships.find((m) => m.id === mentorshipId);
      for (const admin of admins) {
        await createNotification(
          admin.id,
          "assignment",
          "Betreuung abgebrochen",
          `${mentorship?.mentor?.name ?? "Mentor"} hat die Betreuung von ${mentorship?.mentee?.name ?? "Mentee"} abgebrochen. Grund: ${reason}`,
          mentorshipId
        );
      }

      // E-Mail an Admin
      if (mentorship) {
        sendMentorshipStatusChangeNotification(
          "",
          mentorship.mentor?.name ?? "Unbekannt",
          mentorship.mentee?.name ?? "Unbekannt",
          "cancelled"
        ).catch(() => {});
      }
    },
    [users, mentorships, createNotification]
  );

  // ─── SessionType Actions ──────────────────────────────────────────────────────

  const addSessionType = useCallback(
    async (sessionTypeData: Omit<SessionType, "id">) => {
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
        .single();

      if (error || !data) {
        return;
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

  const deleteSessionType = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("session_types")
      .delete()
      .eq("id", id);

    if (error) {
      return;
    }

    setSessionTypes((prev) => prev.filter((st) => st.id !== id));
  }, []);

  // ─── Feedback Actions ─────────────────────────────────────────────────────────

  const addFeedback = useCallback(
    async (feedbackData: Omit<Feedback, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("feedback")
        .insert({
          mentorship_id: feedbackData.mentorship_id,
          submitted_by: feedbackData.submitted_by,
          rating: feedbackData.rating,
          comments: feedbackData.comments ?? "",
        })
        .select()
        .single();

      if (error || !data) {
        return;
      }

      const newFeedback: Feedback = {
        id: data.id,
        mentorship_id: data.mentorship_id,
        submitted_by: data.submitted_by,
        rating: data.rating,
        comments: data.comments ?? undefined,
        created_at: data.created_at,
      };
      setFeedback((prev) => [...prev, newFeedback]);

      // In-App Notification an Mentor: Feedback erhalten (persistente DB-Notification)
      const mentorship = mentorships.find(
        (m) => m.id === feedbackData.mentorship_id
      );
      if (mentorship) {
        const submitter = users.find((u) => u.id === feedbackData.submitted_by);
        await createNotification(
          mentorship.mentor_id,
          "feedback",
          "Feedback erhalten",
          `${submitter?.name ?? "Dein Mentee"} hat Feedback hinterlassen (${feedbackData.rating}/5 Sterne).`,
          feedbackData.mentorship_id
        );
        // Lokale Push Notification: zusätzlich auf dem Gerät des Mentors (wenn App offen)
        if (authUser?.id === mentorship.mentor_id) {
          sendLocalNotification(
            "Neues Feedback erhalten",
            `${submitter?.name ?? "Dein Mentee"} hat Feedback hinterlassen (${feedbackData.rating}/5 Sterne).`,
            "feedback"
          ).catch(() => {});
        }

        // XP für gutes Feedback (fire-and-forget)
        if (feedbackData.rating === 5) {
          awardXP(mentorship.mentor_id, XP_VALUES.FEEDBACK_5STAR, "feedback_5star", feedbackData.mentorship_id);
        } else if (feedbackData.rating >= 4) {
          awardXP(mentorship.mentor_id, XP_VALUES.FEEDBACK_4STAR, "feedback_4star", feedbackData.mentorship_id);
        }
        checkAndUnlockAchievements(mentorship.mentor_id);
      }
    },
    [mentorships, users, authUser, createNotification, awardXP, checkAndUnlockAchievements]
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

  // ─── addUser (für Admin: neuen Mentee ohne Auth anlegen) ──────────────────────

  const addUser = useCallback(
    async (userData: Omit<User, "id" | "created_at">) => {
      // Hinweis: Einen User ohne Auth.signUp anzulegen ist nur mit dem Service Key möglich.
      // Mit dem Anon Key kann man nur die eigene profiles-Row anlegen.
      // Diese Funktion ist daher nur funktional wenn der aufrufende User Admin-Rechte hat
      // und via Admin API (Server-Side) aufgerufen wird.
      // Für den Client-Flow: approveApplication() legt den User via signUp an.
      // Direktes Profil-Insert ohne Auth-User nicht möglich mit Anon Key.
      // Account-Erstellung erfolgt über approveApplication().
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
        .single();

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
      const app = applications.find((a) => a.id === applicationId);
      if (!app) return;

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
          // Account existiert bereits → nur Status aktualisieren, kein E-Mail
          showSuccess("Bewerbung genehmigt. Account war bereits vorhanden.");
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
            showError(`Fehler beim Erstellen des Accounts: ${signUpError.message}`);
            return;
          }

          // Neuer Account: Profil nachladen (mit Verzögerung, damit der DB-Trigger Zeit hat)
          if (signUpData?.user) {
            await new Promise((r) => setTimeout(r, 1000));
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
            }
          }

          // Zugangsdaten per E-Mail senden
          await sendCredentialsEmail(app.email, app.name, tempPassword);
          showSuccess("Account erstellt. Zugangsdaten wurden per E-Mail an den Mentor gesendet.");

          // Notification an neuen Mentor: Bewerbung angenommen
          if (signUpData?.user) {
            await createNotification(
              signUpData.user.id,
              "assignment",
              "Deine Bewerbung wurde angenommen!",
              "Willkommen als Mentor bei BNM. Du bist jetzt aktiv.",
            );
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
        showError("Fehler beim Aktualisieren der Bewerbung.");
        return;
      }

      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: "approved" as ApplicationStatus } : a
        )
      );
    },
    [applications, authUser, createNotification]
  );

  const rejectApplication = useCallback(
    async (applicationId: string) => {
      const app = applications.find((a) => a.id === applicationId);

      const { error } = await supabase
        .from("mentor_applications")
        .update({
          status: "rejected",
          reviewed_by: authUser?.id ?? null,
          reviewed_at: new Date().toISOString(),
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

      // E-Mail an den Bewerber senden (kein Account → keine In-App-Notification möglich)
      if (app) {
        const isMenteeRegistration =
          app.motivation === "Anmeldung als neuer Muslim (öffentliches Formular)";
        await sendApplicationRejectionEmail(
          app.email,
          app.name,
          isMenteeRegistration ? "mentee" : "mentor"
        );
      }
    },
    [applications, authUser]
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
        .single();

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
      data: Partial<Pick<User, "name" | "city" | "plz" | "age" | "phone" | "contact_preference" | "avatar_url" | "role" | "gender" | "lat" | "lng">>
    ) => {
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
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId);

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
      let success = 0;
      let failed = 0;
      for (const id of userIds) {
        const ok = await deleteUser(id);
        if (ok) success++;
        else failed++;
      }
      return { success, failed };
    },
    [deleteUser]
  );

  const updateMentorshipNotes = useCallback(async (mentorshipId: string, notes: string) => {
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

  const confirmStepAsMentee = useCallback(async (mentorshipId: string, sessionTypeId: string) => {
    const mentorship = mentorships.find((m) => m.id === mentorshipId);
    if (!mentorship) return;
    const current = mentorship.mentee_confirmed_steps ?? [];
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
    const sessionType = sessionTypes.find((st) => st.id === sessionTypeId);
    const menteeName = mentorship.mentee?.name ?? authUser?.id ?? "Dein Mentee";
    const stepName = sessionType?.name ?? "Schritt";
    await createNotification(
      mentorship.mentor_id,
      "progress",
      "Mentee hat Schritt bestätigt",
      `${menteeName} hat Schritt "${stepName}" bestätigt.`,
      mentorshipId
    );
  }, [mentorships, sessionTypes, authUser, createNotification]);

  const unconfirmStepAsMentee = useCallback(async (mentorshipId: string, sessionTypeId: string) => {
    const mentorship = mentorships.find((m) => m.id === mentorshipId);
    if (!mentorship) return;
    const current = mentorship.mentee_confirmed_steps ?? [];
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
  }, [mentorships]);

  // ─── Admin-Direktnachricht (als Notification) ────────────────────────────────

  const sendAdminDirectMessage = useCallback(async (recipientId: string, message: string) => {
    if (!authUser) return;
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
      .single();
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
    const sender = users.find((u) => u.id === authUser.id);
    const newMsg: AdminMessage = {
      id: data.id, admin_id: data.admin_id, user_id: data.user_id,
      sender_id: data.sender_id, content: data.content,
      read_at: data.read_at ?? undefined, created_at: data.created_at,
      sender,
    };
    setAdminMessages((prev) => [...prev, newMsg]);
  }, [authUser, users, createNotification]);

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
      .single();
    if (error || !data) throw new Error(error?.message ?? "Fehler beim Senden");
    const sender = users.find((u) => u.id === authUser.id);
    const newMsg: AdminMessage = {
      id: data.id, admin_id: data.admin_id, user_id: data.user_id,
      sender_id: data.sender_id, content: data.content,
      read_at: data.read_at ?? undefined, created_at: data.created_at,
      sender,
    };
    setAdminMessages((prev) => [...prev, newMsg]);
  }, [authUser, users]);

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
      .single();
    if (error || !data) throw new Error(error?.message ?? "Fehler beim Senden");
    const sender = users.find((u) => u.id === authUser.id);
    const newMsg: AdminMessage = {
      id: data.id, admin_id: data.admin_id, user_id: data.user_id,
      sender_id: data.sender_id, content: data.content,
      read_at: data.read_at ?? undefined, created_at: data.created_at,
      sender,
    };
    setAdminMessages((prev) => [...prev, newMsg]);
  }, [authUser, users]);

  const getAdminMessagesByUserId = useCallback((userId: string) => {
    return adminMessages.filter((m) => m.user_id === userId);
  }, [adminMessages]);

  const getAdminChatPartners = useCallback(() => {
    const userIds = new Set(adminMessages.map((m) => m.user_id));
    return Array.from(userIds);
  }, [adminMessages]);

  // ─── Hadith Actions ───────────────────────────────────────────────────────────

  const addHadith = useCallback(async (text_ar: string, text_de: string, source: string) => {
    const maxOrder = hadithe.length > 0
      ? Math.max(...hadithe.map((h) => h.sort_order ?? 0))
      : 0;
    const { data, error } = await supabase
      .from("hadithe")
      .insert({ text_ar: text_ar || null, text_de, source: source || null, sort_order: maxOrder + 1 })
      .select()
      .single();

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
    const { error } = await supabase.from("hadithe").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    setHadithe((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const reorderHadithe = useCallback(async (id: string, direction: "up" | "down") => {
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
        .single();

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

  // ─── refreshData ──────────────────────────────────────────────────────────────

  // Throttled refresh: nur wenn letzte Ladung > 10s her ist
  const lastLoadRef = React.useRef<number>(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshData = useCallback(async (force?: boolean) => {
    if (!authUser) return;
    const now = Date.now();
    if (!force && now - lastLoadRef.current < 10000) return; // 10s Throttle
    lastLoadRef.current = now;
    await loadAllData();
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
    return users.filter(
      (u) => u.role === "mentee" && !mentorships.find((m) => m.mentee_id === u.id)
    );
  }, [users, mentorships]);

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

  const markChatAsRead = useCallback(
    async (mentorshipId: string) => {
      if (!authUser) return;

      const now = new Date().toISOString();

      // DB Update (idempotent — auch ohne lokalen Check sicher)
      const { error } = await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("mentorship_id", mentorshipId)
        .neq("sender_id", authUser.id)
        .is("read_at", null);

      if (error) {
        console.warn("markChatAsRead failed:", error.message);
        return;
      }

      // Lokalen State aktualisieren
      setMessages((prev) =>
        prev.map((m) =>
          m.mentorship_id === mentorshipId &&
          m.sender_id !== authUser.id &&
          !m.read_at
            ? { ...m, read_at: now }
            : m
        )
      );
    },
    [authUser?.id] // Stabile Dependency — kein messages-Array mehr
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <DataContext.Provider
      value={{
        users,
        mentorships,
        sessions,
        sessionTypes,
        feedback,
        messages,
        applications,
        notifications,
        hadithe,
        xpLog,
        userAchievements,
        thanks,
        streak,
        awardXP,
        sendThanks,
        checkAndUnlockAchievements,
        updateStreak,
        addHadith,
        updateHadith,
        deleteHadith,
        reorderHadithe,
        bulkInsertHadithe,
        qaEntries,
        loadQAEntries,
        addQAEntry,
        updateQAEntry,
        deleteQAEntry,
        getSetting,
        mentorOfMonthVisible,
        toggleMentorOfMonth,
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
        submitApplication,
        updateUser,
        setUserActive,
        deleteUser,
        bulkDeleteUsers,
        updateMentorshipNotes,
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
        markChatAsRead,
        refreshData,
        isLoading,
      }}
    >
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
