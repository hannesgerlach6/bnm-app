import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type {
  XPEntry,
  UserAchievement,
  ThankEntry,
  StreakData,
} from "../types";
import { XP_VALUES, getLevelForXP } from "../lib/gamification";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GamificationContextValue {
  xpLog: XPEntry[];
  userAchievements: UserAchievement[];
  thanks: ThankEntry[];
  streak: StreakData | null;
  awardXP: (userId: string, amount: number, reason: string, relatedId?: string) => void;
  sendThanks: (mentorshipId: string, mentorId: string, message?: string, sessionTypeId?: string) => Promise<void>;
  checkAndUnlockAchievements: (userId: string) => Promise<void>;
  updateStreak: (userId: string) => Promise<void>;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const { mentorships, sessions, sessionTypes, feedback, _gamificationRef, _updateUserXP } = useData();

  const [xpLog, setXpLog] = useState<XPEntry[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [thanks, setThanks] = useState<ThankEntry[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);

  // ─── Load gamification data ───────────────────────────────────────────────

  useEffect(() => {
    if (!authUser) {
      setXpLog([]);
      setUserAchievements([]);
      setThanks([]);
      setStreak(null);
      return;
    }

    const isMentor = authUser.role === "mentor";
    if (!isMentor) return;

    (async () => {
      try {
        const [xpRes, achievementsRes, thanksRes, streakRes] = await Promise.all([
          supabase.from("xp_log").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false }).limit(100),
          supabase.from("achievements").select("*").eq("user_id", authUser.id),
          supabase.from("thanks").select("*").eq("mentor_id", authUser.id).order("created_at", { ascending: false }),
          supabase.from("streaks").select("*").eq("user_id", authUser.id).maybeSingle(),
        ]);

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
      } catch {
        // Gamification-Ladefehler sind nicht kritisch
      }
    })();
  }, [authUser?.id, authUser?.role]);

  // ─── awardXP: Fire-and-forget ─────────────────────────────────────────────

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

          // Update user in DataContext's users array
          if (authUser?.id === userId) {
            _updateUserXP(userId, newXP, newLevel);
          }
        } catch {
          // Fire-and-forget: Fehler still ignorieren
        }
      })();
    },
    [authUser?.id, _updateUserXP]
  );

  // ─── sendThanks: Mentee dankt Mentor ──────────────────────────────────────

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

  // ─── checkAndUnlockAchievements ───────────────────────────────────────────

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

  // ─── updateStreak: Tägliche Streak-Logik ──────────────────────────────────

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

        // UTC-konsistent: getUTCDate statt getDate (vermeidet Zeitzone-Bug 0–2 Uhr)
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
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

  // ─── Register functions in DataContext's ref (for internal calls) ──────────

  useEffect(() => {
    if (_gamificationRef) {
      _gamificationRef.current = {
        awardXP,
        checkAndUnlockAchievements,
        updateStreak,
      };
    }
  }, [_gamificationRef, awardXP, checkAndUnlockAchievements, updateStreak]);

  // ─── Context value ────────────────────────────────────────────────────────

  const contextValue = useMemo(() => ({
    xpLog,
    userAchievements,
    thanks,
    streak,
    awardXP,
    sendThanks,
    checkAndUnlockAchievements,
    updateStreak,
  }), [
    xpLog, userAchievements, thanks, streak,
    awardXP, sendThanks, checkAndUnlockAchievements, updateStreak,
  ]);

  return (
    <GamificationContext.Provider value={contextValue}>
      {children}
    </GamificationContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useGamification(): GamificationContextValue {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error("useGamification muss innerhalb eines GamificationProviders verwendet werden");
  }
  return context;
}
