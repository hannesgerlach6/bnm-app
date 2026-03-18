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
} from "../types";
import {
  MOCK_USERS,
  MOCK_MENTORSHIPS,
  MOCK_SESSIONS,
  SESSION_TYPES,
  MOCK_FEEDBACK,
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

export interface DataContextValue {
  // Data
  users: User[];
  mentorships: Mentorship[];
  sessions: Session[];
  sessionTypes: SessionType[];
  feedback: Feedback[];
  messages: Message[];

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

  // Message actions
  sendMessage: (mentorshipId: string, senderId: string, content: string) => void;

  // Computed helpers
  getMentorshipsByMentorId: (mentorId: string) => Mentorship[];
  getMentorshipByMenteeId: (menteeId: string) => Mentorship | undefined;
  getMentorshipById: (id: string) => Mentorship | undefined;
  getSessionsByMentorshipId: (mentorshipId: string) => Session[];
  getCompletedStepIds: (mentorshipId: string) => string[];
  getMessagesByMentorshipId: (mentorshipId: string) => Message[];
  getUserById: (id: string) => User | undefined;
  getUnassignedMentees: () => User[];
}

const DataContext = createContext<DataContextValue | null>(null);

let nextId = 1000;
function generateId(prefix: string): string {
  return `${prefix}-${++nextId}`;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [users] = useState<User[]>(MOCK_USERS);
  const [mentorships, setMentorships] = useState<Mentorship[]>(MOCK_MENTORSHIPS);
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>(SESSION_TYPES);
  const [feedback, setFeedback] = useState<Feedback[]>(MOCK_FEEDBACK);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);

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
      return msessions.map((s) => s.session_type_id);
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

  return (
    <DataContext.Provider
      value={{
        users,
        mentorships,
        sessions,
        sessionTypes,
        feedback,
        messages,
        assignMentorship,
        updateMentorshipStatus,
        addSession,
        addSessionType,
        updateSessionTypeOrder,
        deleteSessionType,
        addFeedback,
        sendMessage,
        getMentorshipsByMentorId,
        getMentorshipByMenteeId,
        getMentorshipById,
        getSessionsByMentorshipId,
        getCompletedStepIds,
        getMessagesByMentorshipId,
        getUserById,
        getUnassignedMentees,
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
