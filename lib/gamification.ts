// ============================================================
// GAMIFICATION: XP, Levels, Achievements, Streaks
// ============================================================

// XP-Werte
export const XP_VALUES = {
  SESSION_DOCUMENTED: 10,
  MENTORSHIP_COMPLETED: 100,
  FEEDBACK_5STAR: 25,
  FEEDBACK_4STAR: 15,
  STREAK_DAY: 5,
  THANK_RECEIVED: 10,
};

// Level-Definitionen
export const LEVELS = [
  { key: "bronze", label: "Bronze-Mentor", minXP: 0, color: "#CD7F32" },
  { key: "silver", label: "Silber-Mentor", minXP: 50, color: "#C0C0C0" },
  { key: "gold", label: "Gold-Mentor", minXP: 150, color: "#FFD700" },
  { key: "platinum", label: "Platin-Mentor", minXP: 300, color: "#E5E4E2" },
];

export function getLevelForXP(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(xp: number) {
  const current = getLevelForXP(xp);
  const idx = LEVELS.findIndex((l) => l.key === current.key);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function getLevelProgress(xp: number): number {
  const current = getLevelForXP(xp);
  const next = getNextLevel(xp);
  if (!next) return 100;
  return Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100);
}

// Achievement-Definitionen
export const ACHIEVEMENTS = [
  {
    key: "first_completion",
    icon: "🏆",
    label: "Erster Abschluss",
    desc: "Erste Betreuung erfolgreich beendet",
  },
  {
    key: "marathon",
    icon: "🏃",
    label: "Marathonläufer",
    desc: "5 Betreuungen gleichzeitig",
  },
  {
    key: "punctual_30",
    icon: "⏰",
    label: "Pünktlich",
    desc: "30 Tage Streak ohne Unterbrechung",
  },
  {
    key: "five_star",
    icon: "⭐",
    label: "5-Sterne-Mentor",
    desc: "Durchschnittsbewertung ≥ 4.5",
  },
  {
    key: "bridge_builder",
    icon: "🌉",
    label: "Brückenbauer",
    desc: "10 Erstkontakte hergestellt",
  },
  {
    key: "quran_teacher",
    icon: "📖",
    label: "Quran-Lehrer",
    desc: "10 Koran-Sessions durchgeführt",
  },
  {
    key: "community_hero",
    icon: "🤝",
    label: "Community-Held",
    desc: "5 Mentees in die Community integriert",
  },
  {
    key: "ten_completions",
    icon: "🎓",
    label: "Veteran",
    desc: "10 Betreuungen abgeschlossen",
  },
  {
    key: "loyal_companion",
    icon: "💪",
    label: "Treuer Begleiter",
    desc: "50 Sessions insgesamt dokumentiert",
  },
  {
    key: "inspired",
    icon: "🌟",
    label: "Inspirator",
    desc: "3-mal Dankbarkeit von Mentees erhalten",
  },
  {
    key: "early_bird",
    icon: "🌅",
    label: "Frühaufsteher",
    desc: "7 Tage Streak – jeden Tag aktiv",
  },
  {
    key: "silver_tongue",
    icon: "🗣️",
    label: "Wegweiser",
    desc: "20 Sessions über Glaubensfragen geführt",
  },
  {
    key: "half_century",
    icon: "🎯",
    label: "Halbzeit-Held",
    desc: "5 Betreuungen erfolgreich abgeschlossen",
  },
  {
    key: "ramadan_mentor",
    icon: "🌙",
    label: "Ramadan-Mentor",
    desc: "Eine Session im Ramadan-Monat gehalten",
  },
  {
    key: "milestone_15",
    icon: "🥇",
    label: "Meister",
    desc: "15 Betreuungen abgeschlossen",
  },
  {
    key: "dedication",
    icon: "🔥",
    label: "Hingabe",
    desc: "100 Sessions insgesamt dokumentiert",
  },
  {
    key: "platinum_heart",
    icon: "💎",
    label: "Platin-Herz",
    desc: "Platin-Rang erreicht",
  },
  {
    key: "mentor_of_year",
    icon: "👑",
    label: "Mentor des Jahres",
    desc: "Besondere Auszeichnung vom BNM-Team",
  },
  {
    key: "twenty_completions",
    icon: "🚀",
    label: "Legende",
    desc: "20 Betreuungen erfolgreich abgeschlossen",
  },
  {
    key: "mystery",
    icon: "❓",
    label: "???",
    desc: "Dieses Geheimnis wartet noch auf dich...",
    mystery: true,
  },
];
