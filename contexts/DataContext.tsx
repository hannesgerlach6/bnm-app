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
import { useAuth } from "./AuthContext";

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

  // Mentor des Monats Sichtbarkeit
  mentorOfMonthVisible: boolean;
  toggleMentorOfMonth: () => Promise<void>;

  // User registration (Mentee via Admin-Aufruf, nicht mehr nötig für Supabase)
  addUser: (user: Omit<User, "id" | "created_at">) => Promise<void>;

  // Mentorship actions
  assignMentorship: (menteeId: string, mentorId: string, adminId: string) => Promise<void>;
  updateMentorshipStatus: (mentorshipId: string, status: MentorshipStatus) => Promise<void>;

  // Session actions
  addSession: (session: Omit<Session, "id" | "session_type">) => Promise<void>;

  // SessionType actions
  addSessionType: (sessionType: Omit<SessionType, "id">) => Promise<void>;
  updateSessionTypeOrder: (sessionTypes: SessionType[]) => Promise<void>;
  deleteSessionType: (id: string) => Promise<void>;

  // Feedback actions
  addFeedback: (feedback: Omit<Feedback, "id" | "created_at">) => Promise<void>;
  getFeedbacks: () => Feedback[];

  // Message actions
  sendMessage: (mentorshipId: string, senderId: string, content: string) => Promise<void>;

  // Notification actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  getUnreadCount: () => number;

  // Application actions
  approveApplication: (applicationId: string) => Promise<void>;
  rejectApplication: (applicationId: string) => Promise<void>;
  submitApplication: (data: Omit<MentorApplication, "id" | "status" | "submitted_at">) => Promise<void>;

  // User actions
  updateUser: (userId: string, data: Partial<Pick<User, "name" | "city" | "age" | "phone" | "contact_preference">>) => Promise<void>;

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
    age: (row.age as number) ?? 0,
    contact_preference: (row.contact_preference as User["contact_preference"]) ?? "whatsapp",
    avatar_url: (row.avatar_url as string) ?? undefined,
    created_at: row.created_at as string,
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
  const [isLoading, setIsLoading] = useState(true);

  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
    const cleanup = subscribeToMessages();
    return () => {
      cleanup();
    };
  }, [authUser?.id]);

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
          mentor: profileMap[row.mentor_id as string],
          mentee: profileMap[row.mentee_id as string],
        }));
        setMentorships(ms);
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

      // App Settings: mentor_of_month_visible
      if (settingsRes.data) {
        const setting = settingsRes.data.find((s) => s.key === "mentor_of_month_visible");
        if (setting) {
          setMentorOfMonthVisible(setting.value === "true");
        }
      }

      // Messages
      if (messagesRes.data) {
        const profileMap: Record<string, User> = {};
        if (profilesRes.data) {
          profilesRes.data.map(mapProfile).forEach((u) => (profileMap[u.id] = u));
        }
        const msgs: Message[] = messagesRes.data.map((row) => ({
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
    } catch (err) {
      console.error("DataContext loadAllData Fehler:", err);
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
            mentorship_id: row.mentorship_id as string,
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
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ─── Mentorship Actions ───────────────────────────────────────────────────────

  const assignMentorship = useCallback(
    async (menteeId: string, mentorId: string, adminId: string) => {
      const { data, error } = await supabase
        .from("mentorships")
        .insert({
          mentor_id: mentorId,
          mentee_id: menteeId,
          assigned_by: adminId,
          status: "active",
        })
        .select()
        .single();

      if (error || !data) {
        console.error("assignMentorship Fehler:", error);
        return;
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

      // Automatische Registrierungs- und Zuweisungs-Sessions
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
    [users, sessionTypes]
  );

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
        console.error("updateMentorshipStatus Fehler:", error);
        return;
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
    },
    []
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
        console.error("addSession Fehler:", error);
        return;
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
    },
    [sessionTypes]
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
        console.error("addSessionType Fehler:", error);
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
      console.error("deleteSessionType Fehler:", error);
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
        console.error("addFeedback Fehler:", error);
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
    },
    []
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

    const { error } = await supabase
      .from("app_settings")
      .update({ value: newValue ? "true" : "false" })
      .eq("key", "mentor_of_month_visible");

    if (error) {
      console.error("toggleMentorOfMonth Fehler:", error);
      setMentorOfMonthVisible(!newValue); // Rollback
    }
  }, [mentorOfMonthVisible]);

  // ─── addUser (für Admin: neuen Mentee ohne Auth anlegen) ──────────────────────

  const addUser = useCallback(
    async (userData: Omit<User, "id" | "created_at">) => {
      // Hinweis: Einen User ohne Auth.signUp anzulegen ist nur mit dem Service Key möglich.
      // Mit dem Anon Key kann man nur die eigene profiles-Row anlegen.
      // Diese Funktion ist daher nur funktional wenn der aufrufende User Admin-Rechte hat
      // und via Admin API (Server-Side) aufgerufen wird.
      // Für den Client-Flow: approveApplication() legt den User via signUp an.
      console.warn("addUser: Direktes Profil-Insert ohne Auth-User nicht möglich mit Anon Key.");
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
        console.error("sendMessage Fehler:", error);
        return;
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

  // ─── Notification Actions ─────────────────────────────────────────────────────

  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) {
      console.error("markAsRead Fehler:", error);
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
      console.error("markAllAsRead Fehler:", error);
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

      const { error } = await supabase
        .from("mentor_applications")
        .update({
          status: "approved",
          reviewed_by: authUser?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      if (error) {
        console.error("approveApplication Fehler:", error);
        return;
      }

      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: "approved" as ApplicationStatus } : a
        )
      );

      // Neuen Mentor-User via Supabase Auth signUp anlegen
      // Da wir nur den Anon Key haben, geht das nur mit Email-Einladung oder signUp.
      // Wir verwenden signUp mit einem temporären Passwort.
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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

      if (signUpError) {
        console.error("approveApplication signUp Fehler:", signUpError);
        // Application bleibt approved, aber User-Erstellung fehlgeschlagen
        return;
      }

      // Profil nachladen falls Trigger den Eintrag erstellt hat
      if (signUpData.user) {
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
    },
    [applications, authUser]
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
        console.error("rejectApplication Fehler:", error);
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
        console.error("submitApplication Fehler:", error);
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
      data: Partial<Pick<User, "name" | "city" | "age" | "phone" | "contact_preference">>
    ) => {
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", userId);

      if (error) {
        console.error("updateUser Fehler:", error);
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...data } : u))
      );
    },
    []
  );

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
        mentorOfMonthVisible,
        toggleMentorOfMonth,
        addUser,
        assignMentorship,
        updateMentorshipStatus,
        addSession,
        addSessionType,
        updateSessionTypeOrder,
        deleteSessionType,
        addFeedback,
        getFeedbacks,
        sendMessage,
        markAsRead,
        markAllAsRead,
        getUnreadCount,
        approveApplication,
        rejectApplication,
        submitApplication,
        updateUser,
        getMentorshipsByMentorId,
        getMentorshipByMenteeId,
        getMentorshipById,
        getSessionsByMentorshipId,
        getCompletedStepIds,
        getMessagesByMentorshipId,
        getUserById,
        getUnassignedMentees,
        getPendingApplicationsCount,
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
