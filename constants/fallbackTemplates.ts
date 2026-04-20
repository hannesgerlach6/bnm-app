// Hardcoded Fallback-Vorlagen für den Chat, falls die DB-Tabelle leer ist
export const FALLBACK_TEMPLATES = [
  {
    id: "fb-1",
    title: "Kontaktaufnahme",
    category: "erstkontakt",
    body: "As salamu alaykum und herzliche Grüße liebe/r {{ANREDE}},\n\nich hoffe dir geht es gut und du befindest dich bei bester Gesundheit!\n\nMein Name ist {{MENTOR_NAME}} und ich freue mich dein/e Mentor/in zu sein und dich im BNM Mentoring unterstützen zu können.\n\nIch würde mich sehr freuen, wenn wir uns die Tage ganz entspannt telefonisch austauschen und uns kennenlernen.\n\nDu kannst mich dafür auch per WhatsApp oder Signal kontaktieren, wenn du das bevorzugst. Lass mich wissen, wann es dir zeitlich passt.\n\nLiebe Grüße und viel Erfolg.",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "fb-2",
    title: "Reaktivierung (nach Kontakt)",
    category: "reaktivierung",
    body: "As salamu alaykum {{NAME}},\n\nich grüße dich {{ANREDE}}. Es ist bereits einige Zeit vergangen und ich muss dir sagen, in den letzten Tagen warst du öfters in meinen Gedanken.\n\nAllah ändert unsere Situation solange nicht, bis wir uns selbst ändern. Lass mich dir dabei helfen, in sha Allah.\n\nMöge Allah dir deine Angelegenheiten erleichtern. Amin.\n\nBis bald in sha Allah, {{MENTOR_NAME}}",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "fb-3",
    title: "Reaktivierung (nicht erreichbar)",
    category: "reaktivierung",
    body: "As salamu alaykum {{NAME}},\n\nich grüße dich {{ANREDE}}. Es ist schon einige Zeit vergangen, seitdem ich dich kontaktiert habe und leider habe ich bis heute keine Rückmeldung von dir erhalten.\n\nMöge Allah dir deine Angelegenheiten erleichtern. Amin.\n\nBis bald in sha Allah, {{MENTOR_NAME}}",
    sort_order: 3,
    is_active: true,
  },
  {
    id: "fb-4",
    title: "Keine Reaktion nach Anruf",
    category: "nachfassen",
    body: "As salamu alaykum {{ANREDE}} {{NAME}},\n\nhattest du Gelegenheit, über meine Worte nachzudenken und würdest du gerne das Mentoring (wieder) aufnehmen? Leider konnte ich dich telefonisch nicht erreichen.\n\nWenn du lieber per WhatsApp kontaktiert werden möchtest, gib mir nur kurz Bescheid. Ich freue mich schon sehr auf dich.\n\n{{MENTOR_NAME}}",
    sort_order: 4,
    is_active: true,
  },
];
