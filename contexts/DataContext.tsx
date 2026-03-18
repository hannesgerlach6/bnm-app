import React, {
  createContext,
  useContext,
  useState,
  useCallback,
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
import {
  MOCK_USERS,
  MOCK_MENTORSHIPS,
  MOCK_SESSIONS,
  SESSION_TYPES,
  MOCK_FEEDBACK,
  MOCK_APPLICATIONS,
} from "../data/mockData";

// Extended mock messages for chat
const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-1",
    mentorship_id: "mentorship-1",
    sender_id: "user-mentor-1",
    content: "Salam Aleikum Michael! Wie geht es dir?",
    created_at: "2024-02-07T17:50:00Z",
  },
  {
    id: "msg-2",
    mentorship_id: "mentorship-1",
    sender_id: "user-mentee-1",
    content: "Wa Aleikum Salam Yusuf! Alhamdulillah, sehr gut. Danke der Nachfrage!",
    created_at: "2024-02-07T17:52:00Z",
  },
  {
    id: "msg-3",
    mentorship_id: "mentorship-1",
    sender_id: "user-mentor-1",
    content: "Ich freue mich auf unser nächstes Treffen. Hast du noch Fragen zur letzten Session?",
    created_at: "2024-02-07T17:55:00Z",
  },
  {
    id: "msg-4",
    mentorship_id: "mentorship-2",
    sender_id: "user-mentor-2",
    content: "Hallo Sarah, ich wollte mal kurz nachfragen wie du dich fühlst.",
    created_at: "2024-02-18T18:00:00Z",
  },
  {
    id: "msg-5",
    mentorship_id: "mentorship-2",
    sender_id: "user-mentee-2",
    content: "Alhamdulillah, sehr gut! Ich übe jeden Tag.",
    created_at: "2024-02-18T18:05:00Z",
  },
];

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    type: "assignment",
    title: "Neuer Mentee zugewiesen",
    body: "Dir wurde Michael Bauer als neuer Mentee zugewiesen.",
    created_at: "2024-02-05T10:00:00Z",
    read: false,
    related_id: "mentorship-1",
  },
  {
    id: "notif-2",
    type: "reminder",
    title: "Session dokumentieren",
    body: "Bitte dokumentiere deine letzte Session mit Michael Bauer.",
    created_at: "2024-02-20T09:00:00Z",
    read: false,
    related_id: "mentorship-1",
  },
  {
    id: "notif-3",
    type: "progress",
    title: "Schritt abgeschlossen",
    body: "Dein Mentee Michael Bauer hat Schritt 3 (Erstkontakt) abgeschlossen.",
    created_at: "2024-02-07T19:00:00Z",
    read: true,
    related_id: "mentorship-1",
  },
  {
    id: "notif-4",
    type: "message",
    title: "Neue Nachricht",
    body: "Michael Bauer hat dir eine Nachricht geschrieben.",
    created_at: "2024-02-07T18:00:00Z",
    read: true,
    related_id: "mentorship-1",
  },
];

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

  // Mentor des Monats Sichtbarkeit (FIX 7)
  mentorOfMonthVisible: boolean;
  toggleMentorOfMonth: () => void;

  // User registration (FIX 2)
  addUser: (user: Omit<User, "id" | "created_at">) => void;

  // Mentorship actions
  assignMentorship: (menteeId: string, mentorId: string, adminId: string) => void;
  updateMentorshipStatus: (mentorshipId: string, status: MentorshipStatus) => void;

  // Session actions
  addSession: (session: Omit<Session, "id" | "session_type">) => void;

  // SessionType actions
  addSessionType: (sessionType: Omit<SessionType, "id">) => void;
  updateSessionTypeOrder: (sessionTypes: SessionType[]) => void;
  deleteSessionType: (id: string) => void;

  // Feedback actions
  addFeedback: (feedback: Omit<Feedback, "id" | "created_at">) => void;
  getFeedbacks: () => Feedback[];

  // Message actions
  sendMessage: (mentorshipId: string, senderId: string, content: string) => void;

  // Notification actions
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  getUnreadCount: () => number;

  // Application actions
  approveApplication: (applicationId: string) => void;
  rejectApplication: (applicationId: string) => void;
  submitApplication: (data: Omit<MentorApplication, "id" | "status" | "submitted_at">) => void;

  // User actions
  updateUser: (userId: string, data: Partial<Pick<User, "name" | "city" | "age" | "phone" | "contact_preference">>) => void;

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
}

const DataContext = createContext<DataContextValue | null>(null);

let nextId = 1000;
function generateId(prefix: string): string {
  return `${prefix}-${++nextId}`;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [mentorships, setMentorships] = useState<Mentorship[]>(MOCK_MENTORSHIPS);
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>(SESSION_TYPES);
  const [feedback, setFeedback] = useState<Feedback[]>(MOCK_FEEDBACK);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [applications, setApplications] = useState<MentorApplication[]>(MOCK_APPLICATIONS);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [mentorOfMonthVisible, setMentorOfMonthVisible] = useState<boolean>(true);

  // Mentorship actions
  const assignMentorship = useCallback(
    (menteeId: string, mentorId: string, adminId: string) => {
      const mentor = users.find((u) => u.id === mentorId);
      const mentee = users.find((u) => u.id === menteeId);
      const newMentorship: Mentorship = {
        id: generateId("mentorship"),
        mentor_id: mentorId,
        mentee_id: menteeId,
        status: "active",
        assigned_by: adminId,
        assigned_at: new Date().toISOString(),
        mentor,
        mentee,
      };
      setMentorships((prev) => [...prev, newMentorship]);

      // Auto-add registration and assignment sessions
      const now = new Date().toISOString();
      setSessions((prev) => [
        ...prev,
        {
          id: generateId("session"),
          mentorship_id: newMentorship.id,
          session_type_id: "st-1",
          date: now,
          is_online: false,
          details: "Registrierung abgeschlossen",
          documented_by: adminId,
          session_type: sessionTypes.find((st) => st.id === "st-1"),
        },
        {
          id: generateId("session"),
          mentorship_id: newMentorship.id,
          session_type_id: "st-2",
          date: now,
          is_online: false,
          details: `Zuweisung zu ${mentor?.name ?? "Mentor"}`,
          documented_by: adminId,
          session_type: sessionTypes.find((st) => st.id === "st-2"),
        },
      ]);
    },
    [users, sessionTypes]
  );

  const updateMentorshipStatus = useCallback(
    (mentorshipId: string, status: MentorshipStatus) => {
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

  // Session actions
  const addSession = useCallback(
    (sessionData: Omit<Session, "id" | "session_type">) => {
      const sessionType = sessionTypes.find(
        (st) => st.id === sessionData.session_type_id
      );
      const newSession: Session = {
        ...sessionData,
        id: generateId("session"),
        session_type: sessionType,
      };
      setSessions((prev) => [...prev, newSession]);
    },
    [sessionTypes]
  );

  // SessionType actions
  const addSessionType = useCallback(
    (sessionTypeData: Omit<SessionType, "id">) => {
      const newSessionType: SessionType = {
        ...sessionTypeData,
        id: generateId("st"),
      };
      setSessionTypes((prev) => [...prev, newSessionType]);
    },
    []
  );

  const updateSessionTypeOrder = useCallback((updated: SessionType[]) => {
    setSessionTypes(updated);
  }, []);

  const deleteSessionType = useCallback((id: string) => {
    setSessionTypes((prev) => prev.filter((st) => st.id !== id));
  }, []);

  // Feedback actions
  const addFeedback = useCallback(
    (feedbackData: Omit<Feedback, "id" | "created_at">) => {
      const newFeedback: Feedback = {
        ...feedbackData,
        id: generateId("feedback"),
        created_at: new Date().toISOString(),
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

  // Mentor des Monats Toggle (FIX 7)
  const toggleMentorOfMonth = useCallback(() => {
    setMentorOfMonthVisible((prev) => !prev);
  }, []);

  // User Registration (FIX 2)
  const addUser = useCallback(
    (userData: Omit<User, "id" | "created_at">) => {
      const newUser: User = {
        ...userData,
        id: generateId("user"),
        created_at: new Date().toISOString(),
      };
      setUsers((prev) => [...prev, newUser]);
    },
    []
  );

  // Message actions
  const sendMessage = useCallback(
    (mentorshipId: string, senderId: string, content: string) => {
      const sender = users.find((u) => u.id === senderId);
      const newMessage: Message = {
        id: generateId("msg"),
        mentorship_id: mentorshipId,
        sender_id: senderId,
        content,
        created_at: new Date().toISOString(),
        sender,
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    [users]
  );

  // Computed helpers
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
      // Eindeutige Step-IDs: ein Step gilt als abgeschlossen sobald mind. 1 Session existiert
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

  // Application actions
  const approveApplication = useCallback(
    (applicationId: string) => {
      const app = applications.find((a) => a.id === applicationId);
      if (!app) return;

      // Status auf approved setzen
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, status: "approved" as ApplicationStatus } : a
        )
      );

      // Neuen Mentor-User anlegen
      const newUser: User = {
        id: generateId("user-mentor"),
        email: app.email,
        role: "mentor",
        gender: app.gender,
        name: app.name,
        phone: app.phone,
        city: app.city,
        age: app.age,
        contact_preference: app.contact_preference,
        created_at: new Date().toISOString(),
      };
      setUsers((prev) => [...prev, newUser]);
    },
    [applications]
  );

  const rejectApplication = useCallback((applicationId: string) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === applicationId ? { ...a, status: "rejected" as ApplicationStatus } : a
      )
    );
  }, []);

  const submitApplication = useCallback(
    (data: Omit<MentorApplication, "id" | "status" | "submitted_at">) => {
      const newApp: MentorApplication = {
        ...data,
        id: generateId("app"),
        status: "pending",
        submitted_at: new Date().toISOString(),
      };
      setApplications((prev) => [...prev, newApp]);
    },
    []
  );

  const getPendingApplicationsCount = useCallback(() => {
    return applications.filter((a) => a.status === "pending").length;
  }, [applications]);

  // Notification actions
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const getUnreadCount = useCallback(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // User actions
  const updateUser = useCallback(
    (userId: string, data: Partial<Pick<User, "name" | "city" | "age" | "phone" | "contact_preference">>) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...data } : u))
      );
    },
    []
  );

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
