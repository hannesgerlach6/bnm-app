/**
 * Fragebogen-Konfiguration für das Mentee-Feedback.
 * Source of Truth für Wizard-Rendering, Validierung und Admin-Detailansicht.
 */

export type QuestionType = "rating" | "text" | "multiselect" | "singleselect";

export interface QuestionConfig {
  id: string;
  type: QuestionType;
  required: boolean;
  translationKey: string;
  options?: { key: string; translationKey: string }[];
  /** Feld nur anzeigen wenn die Frage `questionId` den Wert `value` enthält */
  conditionalOn?: { questionId: string; value: string };
}

export interface SectionConfig {
  id: string;
  titleKey: string;
  questions: QuestionConfig[];
}

export const QUESTIONNAIRE_SECTIONS: SectionConfig[] = [
  // ─── Sektion 1: Allgemeiner Eindruck ─────────────────────────────
  {
    id: "section1",
    titleKey: "questionnaire.section1Title",
    questions: [
      { id: "q1_1", type: "rating", required: true, translationKey: "questionnaire.q1_1" },
      { id: "q1_2", type: "text", required: true, translationKey: "questionnaire.q1_2" },
      { id: "q1_3", type: "rating", required: true, translationKey: "questionnaire.q1_3" },
      { id: "q1_3b", type: "text", required: true, translationKey: "questionnaire.q1_3b" },
    ],
  },
  // ─── Sektion 2: Betreuung & Inhalte ──────────────────────────────
  {
    id: "section2",
    titleKey: "questionnaire.section2Title",
    questions: [
      { id: "q2_1", type: "rating", required: true, translationKey: "questionnaire.q2_1" },
      {
        id: "q2_2",
        type: "multiselect",
        required: true,
        translationKey: "questionnaire.q2_2",
        options: [
          { key: "gebet", translationKey: "questionnaire.q2_2_gebet" },
          { key: "koran", translationKey: "questionnaire.q2_2_koran" },
          { key: "glaubenslehre", translationKey: "questionnaire.q2_2_glaubenslehre" },
          { key: "gemeinschaft", translationKey: "questionnaire.q2_2_gemeinschaft" },
          { key: "alltagsfragen", translationKey: "questionnaire.q2_2_alltagsfragen" },
          { key: "zufrieden", translationKey: "questionnaire.q2_2_zufrieden" },
          { key: "andere", translationKey: "questionnaire.q2_2_andere" },
        ],
      },
      {
        id: "q2_2b",
        type: "text",
        required: false,
        translationKey: "questionnaire.q2_2b",
        conditionalOn: { questionId: "q2_2", value: "andere" },
      },
    ],
  },
  // ─── Sektion 3: Beziehung zum Mentor ─────────────────────────────
  {
    id: "section3",
    titleKey: "questionnaire.section3Title",
    questions: [
      { id: "q3_1", type: "rating", required: true, translationKey: "questionnaire.q3_1" },
      { id: "q3_2", type: "text", required: true, translationKey: "questionnaire.q3_2" },
      { id: "q3_3", type: "rating", required: true, translationKey: "questionnaire.q3_3" },
    ],
  },
  // ─── Sektion 4: Verbesserung & Wünsche ───────────────────────────
  {
    id: "section4",
    titleKey: "questionnaire.section4Title",
    questions: [
      { id: "q4_1", type: "text", required: true, translationKey: "questionnaire.q4_1" },
      {
        id: "q4_2",
        type: "multiselect",
        required: true,
        translationKey: "questionnaire.q4_2",
        options: [
          { key: "mehr_treffen", translationKey: "questionnaire.q4_2_mehr_treffen" },
          { key: "bessere_erreichbarkeit", translationKey: "questionnaire.q4_2_bessere_erreichbarkeit" },
          { key: "mehr_struktur", translationKey: "questionnaire.q4_2_mehr_struktur" },
          { key: "mehr_praxis", translationKey: "questionnaire.q4_2_mehr_praxis" },
          { key: "andere", translationKey: "questionnaire.q4_2_andere" },
        ],
      },
      {
        id: "q4_2b",
        type: "text",
        required: false,
        translationKey: "questionnaire.q4_2b",
        conditionalOn: { questionId: "q4_2", value: "andere" },
      },
      {
        id: "q4_3",
        type: "singleselect",
        required: true,
        translationKey: "questionnaire.q4_3",
        options: [
          { key: "ja_sehr_gerne", translationKey: "questionnaire.q4_3_ja_sehr_gerne" },
          { key: "vielleicht", translationKey: "questionnaire.q4_3_vielleicht" },
          { key: "nein_danke", translationKey: "questionnaire.q4_3_nein_danke" },
        ],
      },
      {
        id: "q4_5",
        type: "text",
        required: false,
        translationKey: "questionnaire.q4_5",
        // Kein conditionalOn mehr — Frage immer anzeigen (Kontext ist bereits klar durch den Abschluss/Abbruch)
      },
    ],
  },
  // ─── Sektion 5: Abschließendes ───────────────────────────────────
  {
    id: "section5",
    titleKey: "questionnaire.section5Title",
    questions: [
      { id: "q5_1", type: "text", required: false, translationKey: "questionnaire.q5_1" },
    ],
  },
];

/** Prüft ob ein konditionales Feld sichtbar sein soll */
export function isConditionMet(
  question: QuestionConfig,
  answers: Record<string, any>
): boolean {
  if (!question.conditionalOn) return true;
  const parentValue = answers[question.conditionalOn.questionId];
  if (Array.isArray(parentValue)) {
    return parentValue.includes(question.conditionalOn.value);
  }
  return parentValue === question.conditionalOn.value;
}

/** Validiert eine einzelne Sektion, gibt Fehler-Map zurück */
export function validateSection(
  section: SectionConfig,
  answers: Record<string, any>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of section.questions) {
    if (!q.required) continue;
    if (!isConditionMet(q, answers)) continue;

    const val = answers[q.id];
    if (q.type === "rating" && (!val || val < 1)) {
      errors[q.id] = "questionnaire.errorRequired";
    } else if (q.type === "text" && (!val || !String(val).trim())) {
      errors[q.id] = "questionnaire.errorRequired";
    } else if (q.type === "multiselect" && (!Array.isArray(val) || val.length === 0)) {
      errors[q.id] = "questionnaire.errorSelectOne";
    } else if (q.type === "singleselect" && !val) {
      errors[q.id] = "questionnaire.errorRequired";
    }
  }
  return errors;
}
