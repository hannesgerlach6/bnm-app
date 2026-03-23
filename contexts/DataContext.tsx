import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
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
} from "../types";
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
} from "../lib/emailService";
import { sendLocalNotification } from "../lib/notificationService";

export interface Hadith {
  id: string;
  text_de: string;
  text_ar?: string;
  source?: string;
  sort_order?: number;
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
  rejectMentorship: (mentorshipId: string) => Promise<void>;
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

  // Application actions
  approveApplication: (applicationId: string) => Promise<void>;
  rejectApplication: (applicationId: string) => Promise<void>;
  submitApplication: (data: Omit<MentorApplication, "id" | "status" | "submitted_at">) => Promise<void>;

  // User actions
  updateUser: (userId: string, data: Partial<Pick<User, "name" | "city" | "plz" | "age" | "phone" | "contact_preference" | "avatar_url" | "role" | "gender">>) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Ref für Mentorships — immer aktuell, auch in Realtime-Callbacks (Closure-Problem vermeiden)
  const mentorshipsRef = useRef<Mentorship[]>([]);

  // ─── Initial Load ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authUser) {
      // User ausgeloggt: State leeren
      setUsers([]);
      setMentorships([]);
      setSessions([]);
      setFeedback([]);
      setMessages([]);
      setApplications([]);
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    loadAllData();
    // Subscriptions nach loadAllData starten (mentorships-State wird gefüllt)
    const cleanupMessages = subscribeToMessages();
    const cleanupProfiles = subscribeToProfiles();
    const cleanupMentorships = subscribeToMentorships();
    return () => {
      cleanupMessages();
      cleanupProfiles();
      cleanupMentorships();
    };
  }, [authUser?.id]);

  // Ref immer aktuell halten — wird in Realtime-Callbacks genutzt
  useEffect(() => {
    mentorshipsRef.current = mentorships;
  }, [mentorships]);

  async function loadAllData() {
    setIsLoading(true);
    try {
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
      ] = await Promise.all([
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
      ]);

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
      if (messagesRes.data) {
        const profileMap: Record<string, User> = {};
        if (profilesRes.data) {
          profilesRes.data.map(mapProfile).forEach((u) => (profileMap[u.id] = u));
        }
        const msgs: Message[] = messagesRes.data
          .filter((row) => ownMentorshipIds.has(row.mentorship_id as string))
          .map((row) => ({
            id: row.id as string,
            mentorship_id: row.mentorship_id as string,
            sender_id: row.sender_id as string,
            content: row.content as string,
            read_at: (row.read_at as string) ?? undefined,
            created_at: row.created_at as string,
            sender: profileMap[row.sender_id as string],
          }));
        setMessages(msgs);
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
    } catch {
      showError("Daten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung.");
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Realtime Messages ────────────────────────────────────────────────────────

  function subscribeToMessages(): () => void {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          const incomingMentorshipId = row.mentorship_id as string;

          // Rollenfilter: Nur Nachrichten aus eigenen Mentorships verarbeiten
          if (authUser) {
            const role = authUser.role;
            if (role !== "admin" && role !== "office") {
              // mentorshipsRef.current ist immer aktuell (kein Closure-Problem)
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
            read_at: (row.read_at as string) ?? undefined,
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
            sendLocalNotification(
              `Neue Nachricht von ${senderName}`,
              preview
            ).catch(() => {});
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
          sendLocalNotification(
            "Dir wurde ein Mentor zugewiesen!",
            `${mentor?.name ?? "Ein Mentor"} ist ab sofort dein Mentor.`
          ).catch(() => {});
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
      }
    },
    [mentorships, sessionTypes]
  );

  const rejectMentorship = useCallback(
    async (mentorshipId: string) => {
      const { error } = await supabase
        .from("mentorships")
        .delete()
        .eq("id", mentorshipId);

      if (error) {
        throw new Error(error.message);
      }

      setMentorships((prev) => prev.filter((m) => m.id !== mentorshipId));
    },
    []
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
        }
      }
    },
    [authUser, mentorships]
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
    },
    [sessionTypes, mentorships, createNotification]
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

      // Lokale Push Notification: Mentor erfährt von neuem Feedback
      // (nur auf dem Gerät des Mentors sichtbar, wenn er die App gerade offen hat;
      //  für geräteübergreifende Push Notifications → Backend Supabase Edge Function nötig)
      const mentorship = mentorships.find(
        (m) => m.id === feedbackData.mentorship_id
      );
      if (mentorship && authUser?.id === mentorship.mentor_id) {
        const submitter = users.find((u) => u.id === feedbackData.submitted_by);
        sendLocalNotification(
          "Neues Feedback erhalten",
          `${submitter?.name ?? "Dein Mentee"} hat Feedback hinterlassen (${feedbackData.rating}/5 Sterne).`
        ).catch(() => {});
      }
    },
    [mentorships, users, authUser]
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
        return [...prev, newMessage];
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
        // Race-Condition-Schutz: Status auf "processing" setzen
        await supabase
          .from("mentor_applications")
          .update({ status: "processing" })
          .eq("id", applicationId);

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
          if (
            !signUpError.message.includes("already registered") &&
            !signUpError.message.includes("User already registered")
          ) {
            // Bei Fehler: Status zurück auf "pending" setzen
            await supabase
              .from("mentor_applications")
              .update({ status: "pending" })
              .eq("id", applicationId);
            showError(`Fehler beim Erstellen des Accounts: ${signUpError.message}`);
            return;
          }
        }

        // Profil nachladen (mit Verzögerung, damit der DB-Trigger Zeit hat)
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

        // Zugangsdaten per E-Mail senden statt im Alert anzeigen
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

      // Status auf approved setzen (erst nach erfolgreichem signUp)
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
    },
    [authUser]
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
    },
    []
  );

  const getPendingApplicationsCount = useCallback(() => {
    return applications.filter((a) => a.status === "pending").length;
  }, [applications]);

  // ─── User Actions ─────────────────────────────────────────────────────────────

  const updateUser = useCallback(
    async (
      userId: string,
      data: Partial<Pick<User, "name" | "city" | "plz" | "age" | "phone" | "contact_preference" | "avatar_url" | "role" | "gender">>
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

  // deleteUser: Soft-Delete — alle zugehörigen Daten löschen, Profil deaktivieren
  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // 1. Alle Sessions löschen die zu Mentorships des Users gehören
      const userMentorships = mentorships.filter(
        (m) => m.mentor_id === userId || m.mentee_id === userId
      );
      const mentorshipIds = userMentorships.map((m) => m.id);

      if (mentorshipIds.length > 0) {
        // Sessions löschen
        await supabase.from("sessions").delete().in("mentorship_id", mentorshipIds);
        // Messages löschen
        await supabase.from("messages").delete().in("mentorship_id", mentorshipIds);
        // Feedback löschen
        await supabase.from("feedback").delete().in("mentorship_id", mentorshipIds);
        // Mentorships löschen
        await supabase.from("mentorships").delete().in("id", mentorshipIds);
      }

      // 2. Notifications löschen
      await supabase.from("notifications").delete().eq("user_id", userId);

      // 3. Profil deaktivieren + E-Mail verschleiern (Auth-User bleibt, kann sich nicht mehr sinnvoll einloggen)
      const timestamp = Date.now();
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          email: `deleted_${timestamp}_${userId}@deleted.invalid`,
          name: `[gelöscht]`,
        })
        .eq("id", userId);

      if (error) {
        return false;
      }

      // State bereinigen
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSessions((prev) => prev.filter((s) => !mentorshipIds.includes(s.mentorship_id)));
      setMessages((prev) => prev.filter((m) => !mentorshipIds.includes(m.mentorship_id)));
      setFeedback((prev) => prev.filter((f) => !mentorshipIds.includes(f.mentorship_id)));
      setMentorships((prev) => prev.filter((m) => !mentorshipIds.includes(m.id)));

      return true;
    } catch {
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
  }, [mentorships]);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshData = useCallback(async () => {
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
    return messages.filter(
      (m) => m.sender_id !== authUser.id && !m.read_at
    ).length;
  }, [messages, authUser]);

  const markChatAsRead = useCallback(
    async (mentorshipId: string) => {
      if (!authUser) return;
      const now = new Date().toISOString();

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m.mentorship_id === mentorshipId &&
          m.sender_id !== authUser.id &&
          !m.read_at
            ? { ...m, read_at: now }
            : m
        )
      );

      // DB Update
      await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("mentorship_id", mentorshipId)
        .neq("sender_id", authUser.id)
        .is("read_at", null);
    },
    [authUser]
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
