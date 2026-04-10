import { Platform } from "react-native";

// pdf-lib wird zur Laufzeit ueber CDN geladen (Metro/Expo Web kann es nicht statisch bundlen).
let _pdfLib: any = null;
async function getPdfLib(): Promise<{ PDFDocument: any; StandardFonts: any; rgb: any }> {
  if (_pdfLib) return _pdfLib;
  if (typeof window === "undefined") throw new Error("PDF nur auf Web verfuegbar");
  const script = document.createElement("script");
  script.src = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("pdf-lib CDN konnte nicht geladen werden"));
    document.head.appendChild(script);
  });
  const w = window as any;
  _pdfLib = { PDFDocument: w.PDFLib.PDFDocument, StandardFonts: w.PDFLib.StandardFonts, rgb: w.PDFLib.rgb };
  return _pdfLib;
}

// ============================================================
// PDF-Generator fuer BNM-Berichte — Helles professionelles Design
// ============================================================

// --- Interfaces -------------------------------------------------------

export interface ReportKPIs {
  activeBetreuungen: number;
  abgeschlossen: number;
  mentoren: number;
  mentees: number;
  sessions: number;
  neueBetreuungen: number;
  wuduSessions: number;
  salahSessions: number;
  koranSessions: number;
  nachbetreuung: number;
}

export interface MentorRanking {
  rank: number;
  name: string;
  score: number;
  sessions: number;
  completed: number;
  rating: number | null;
}

export interface ReportData {
  period: string;
  periodLabel: string;
  kpis: ReportKPIs;
  mentorOfMonth: { name: string; score: number; sessions: number; completed: number } | null;
  rankings: MentorRanking[];
  summaryText: string;
}

export interface AwardData {
  mentorName: string;
  period: string;
  score: number;
  sessions: number;
  completed: number;
}

export interface DonorReportKPIs {
  activeMentorships: number;
  newRegistrations: number;
  completedInPeriod: number;
  bnmBoxes: number;
  activeMentors: number;
  wuduSessions: number;
  salahSessions: number;
  koranSessions: number;
  nachbetreuungSessions: number;
}

export interface DonorReportData {
  periodLabel: string;
  kpis: DonorReportKPIs;
  regionalData: { label: string; value: number }[];
  sessionDistribution: { items: { label: string; value: number }[] };
  summaryText: string;
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Farben (HELL — Warm White + Navy Akzente) -------------------------
type C3 = [number, number, number];
const C = {
  // Primaer
  navy: [10 / 255, 58 / 255, 90 / 255] as C3,
  gold: [238 / 255, 167 / 255, 27 / 255] as C3,
  green: [13 / 255, 156 / 255, 110 / 255] as C3,
  blue: [49 / 255, 130 / 255, 206 / 255] as C3,
  purple: [139 / 255, 92 / 255, 246 / 255] as C3,
  red: [220 / 255, 38 / 255, 38 / 255] as C3,
  orange: [230 / 255, 126 / 255, 34 / 255] as C3,
  // Hintergrund
  bg: [248 / 255, 247 / 255, 244 / 255] as C3,       // #F8F7F4 warm white
  card: [1, 1, 1] as C3,                               // white
  headerBg: [248 / 255, 247 / 255, 244 / 255] as C3,  // HELL statt navy
  // Text
  textDark: [15 / 255, 25 / 255, 35 / 255] as C3,
  textMuted: [100 / 255, 116 / 255, 139 / 255] as C3,
  textLight: [148 / 255, 163 / 255, 184 / 255] as C3,
  white: [1, 1, 1] as C3,
  // Border / Divider
  border: [226 / 255, 232 / 255, 240 / 255] as C3,
  divider: [203 / 255, 213 / 255, 225 / 255] as C3,
  rowAlt: [241 / 255, 245 / 255, 249 / 255] as C3,
  barBg: [232 / 255, 236 / 255, 240 / 255] as C3,
  summaryBg: [254 / 255, 252 / 255, 243 / 255] as C3,
  // Medal
  silver: [148 / 255, 163 / 255, 184 / 255] as C3,
  bronze: [205 / 255, 127 / 255, 50 / 255] as C3,
};

// --- Seiten-Hintergrund ------------------------------------------------

function drawPageBg(page: any, rgb: any, W: number, H: number) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...C.bg) });
}

// --- HELLER Header (kein dunkles Band mehr) ----------------------------

function drawPageHeader(
  page: any, rgb: any, bold: any, font: any,
  W: number, H: number, title: string, periodLabel: string, today: string
) {
  // Weisser Header-Bereich
  page.drawRectangle({ x: 0, y: H - 55, width: W, height: 55, color: rgb(...C.card) });
  // Gold-Akzentlinie unten
  page.drawRectangle({ x: 0, y: H - 57, width: W, height: 2, color: rgb(...C.gold) });
  // Feine Border
  page.drawLine({ start: { x: 0, y: H - 55 }, end: { x: W, y: H - 55 }, thickness: 0.5, color: rgb(...C.border) });
  // BNM links — gold auf weiss
  page.drawText("BNM", { x: 40, y: H - 30, size: 18, font: bold, color: rgb(...C.gold) });
  page.drawText("Betreuung neuer Muslime", { x: 40, y: H - 42, size: 7, font, color: rgb(...C.textMuted) });
  // Titel zentriert — navy
  const titleW = bold.widthOfTextAtSize(title, 14);
  page.drawText(title, { x: W / 2 - titleW / 2, y: H - 33, size: 14, font: bold, color: rgb(...C.navy) });
  // Zeitraum rechts
  const pW = bold.widthOfTextAtSize(periodLabel, 9);
  page.drawText(periodLabel, { x: W - 40 - pW, y: H - 28, size: 9, font: bold, color: rgb(...C.gold) });
  const eText = "Erstellt: " + today;
  const eW = font.widthOfTextAtSize(eText, 7);
  page.drawText(eText, { x: W - 40 - eW, y: H - 42, size: 7, font, color: rgb(...C.textMuted) });
}

// --- Section Header ----------------------------------------------------

function drawSectionHeader(
  page: any, rgb: any, bold: any, _font: any,
  text: string, x: number, y: number, letter: string, circleColor: C3
) {
  page.drawCircle({ x: x + 7, y: y + 4, size: 7, color: rgb(...circleColor) });
  page.drawText(letter, { x: x + 4, y: y + 1, size: 7, font: bold, color: rgb(1, 1, 1) });
  page.drawText(text, { x: x + 20, y, size: 11, font: bold, color: rgb(...C.navy) });
  const textWidth = bold.widthOfTextAtSize(text, 11);
  page.drawRectangle({ x: x + 20, y: y - 4, width: Math.min(textWidth * 0.6, 80), height: 2, color: rgb(...C.gold) });
}

// --- Footer ------------------------------------------------------------

function drawFooter(page: any, rgb: any, font: any, W: number, currentPage: number, totalPages: number) {
  page.drawLine({ start: { x: 40, y: 42 }, end: { x: W - 40, y: 42 }, thickness: 0.5, color: rgb(...C.divider) });
  page.drawText("BNM | Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.textLight) });
  const mid = "iman.ngo";
  page.drawText(mid, { x: W / 2 - font.widthOfTextAtSize(mid, 7) / 2, y: 30, size: 7, font, color: rgb(...C.gold) });
  const rt = `Seite ${currentPage} von ${totalPages}`;
  page.drawText(rt, { x: W - 40 - font.widthOfTextAtSize(rt, 7), y: 30, size: 7, font, color: rgb(...C.textLight) });
}

// --- KPI Card ----------------------------------------------------------

function drawKpiCard(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string, bx: number, by: number, w: number, h: number,
  accentColor: C3
) {
  // Card bg + border
  page.drawRectangle({ x: bx, y: by - h, width: w, height: h, color: rgb(...C.card), borderColor: rgb(...C.border), borderWidth: 0.5 });
  // Accent stripe top
  page.drawRectangle({ x: bx, y: by - 3, width: w, height: 3, color: rgb(...accentColor) });
  // Value
  page.drawText(value, { x: bx + 10, y: by - 24, size: 18, font: bold, color: rgb(...C.navy) });
  // Label
  page.drawText(label, { x: bx + 10, y: by - 38, size: 7, font, color: rgb(...C.textMuted) });
}

// --- Horizontal Bars ---------------------------------------------------

function drawHorizontalBars(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: C3 }[],
  x: number, y: number, totalW: number, barH: number, gap: number
) {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const labelW = 75;
  const valueW = 35;
  const barX = x + labelW;
  const barW = totalW - labelW - valueW - 10;
  items.forEach((item, i) => {
    const iy = y - i * (barH + gap);
    page.drawText(item.label, { x, y: iy + 1, size: 7.5, font, color: rgb(...C.textDark) });
    // Bar bg
    page.drawRectangle({ x: barX, y: iy - 1, width: barW, height: barH, color: rgb(...C.barBg) });
    // Bar fill
    const fillW = maxVal > 0 ? Math.max(3, barW * (item.value / maxVal)) : 3;
    page.drawRectangle({ x: barX, y: iy - 1, width: fillW, height: barH, color: rgb(...item.color) });
    // Value
    const vs = String(item.value);
    page.drawText(vs, { x: barX + barW + 6, y: iy, size: 8, font: bold, color: rgb(...C.navy) });
  });
}

// --- Vertical Bar Chart ------------------------------------------------

function drawVerticalBarChart(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: C3 }[],
  x: number, y: number, w: number, h: number
) {
  const n = items.length;
  if (n === 0) return;
  const maxVal = Math.max(...items.map(i => i.value), 1) * 1.15;
  const gap = 16;
  const barW = (w - gap * (n + 1)) / n;

  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.5, color: rgb(...C.divider) });
  for (let i = 1; i <= 4; i++) {
    const gy = y + (h * i) / 4;
    page.drawLine({ start: { x, y: gy }, end: { x: x + w, y: gy }, thickness: 0.3, color: rgb(...C.border) });
  }

  items.forEach((item, i) => {
    const bx = x + gap + i * (barW + gap);
    const bh = maxVal > 0 ? (item.value / maxVal) * h : 0;
    page.drawRectangle({ x: bx, y, width: barW, height: bh, color: rgb(...item.color) });
    const vs = String(item.value);
    const vw = bold.widthOfTextAtSize(vs, 8);
    page.drawText(vs, { x: bx + barW / 2 - vw / 2, y: y + bh + 4, size: 8, font: bold, color: rgb(...C.navy) });
    const lw = font.widthOfTextAtSize(item.label, 6.5);
    page.drawText(item.label, { x: bx + barW / 2 - lw / 2, y: y - 12, size: 6.5, font, color: rgb(...C.textMuted) });
  });
}

// --- Donut Chart -------------------------------------------------------

function drawDonutChart(
  page: any, rgb: any, bold: any, font: any,
  segments: { label: string; value: number; color: C3 }[],
  cx: number, cy: number, outerR: number, innerR: number
) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    page.drawCircle({ x: cx, y: cy, size: outerR, color: rgb(...C.barBg) });
    page.drawCircle({ x: cx, y: cy, size: innerR, color: rgb(...C.bg) });
    const tw = bold.widthOfTextAtSize("0", 16);
    page.drawText("0", { x: cx - tw / 2, y: cy - 3, size: 16, font: bold, color: rgb(...C.navy) });
    return;
  }

  // Stacked circles (largest first)
  page.drawCircle({ x: cx, y: cy, size: outerR, color: rgb(...C.barBg) });
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  let remaining = total;
  sorted.forEach((seg) => {
    const ratio = remaining / total;
    const r = outerR * Math.sqrt(ratio);
    page.drawCircle({ x: cx, y: cy, size: r, color: rgb(...seg.color) });
    remaining -= seg.value;
  });

  // Inner circle
  page.drawCircle({ x: cx, y: cy, size: innerR, color: rgb(...C.bg) });
  const ts = String(total);
  const tw = bold.widthOfTextAtSize(ts, 16);
  page.drawText(ts, { x: cx - tw / 2, y: cy - 3, size: 16, font: bold, color: rgb(...C.navy) });
  const gs = "Gesamt";
  const gw = font.widthOfTextAtSize(gs, 6);
  page.drawText(gs, { x: cx - gw / 2, y: cy - 13, size: 6, font, color: rgb(...C.textMuted) });

  // Legend to the right
  segments.forEach((seg, i) => {
    const ly = cy + outerR - 5 - i * 18;
    const lx = cx + outerR + 16;
    page.drawCircle({ x: lx, y: ly + 3, size: 4, color: rgb(...seg.color) });
    page.drawText(`${seg.label}: ${seg.value}`, { x: lx + 8, y: ly, size: 7.5, font, color: rgb(...C.textDark) });
    const pct = Math.round((seg.value / total) * 100);
    page.drawText(`${pct}%`, { x: lx + 8, y: ly - 10, size: 6.5, font: bold, color: rgb(...seg.color) });
  });
}

// --- Completion Gauge --------------------------------------------------

function drawCompletionGauge(
  page: any, rgb: any, bold: any, font: any,
  completed: number, total: number,
  x: number, y: number, w: number
) {
  const pct = total > 0 ? completed / total : 0;
  const pctStr = `${Math.round(pct * 100)}%`;

  // Card box
  page.drawRectangle({ x, y: y - 10, width: w, height: 75, color: rgb(...C.card), borderColor: rgb(...C.border), borderWidth: 0.5 });

  // Title
  page.drawText("Abschlussquote", { x: x + 12, y: y + 50, size: 9, font: bold, color: rgb(...C.navy) });

  // Big percentage
  const pw = bold.widthOfTextAtSize(pctStr, 26);
  page.drawText(pctStr, { x: x + w / 2 - pw / 2, y: y + 22, size: 26, font: bold, color: rgb(...C.gold) });

  // Gauge bar with color zones
  const barY = y + 4;
  const barH = 10;
  const barX = x + 20;
  const barW = w - 40;
  const third = barW / 3;
  page.drawRectangle({ x: barX, y: barY, width: third, height: barH, color: rgb(...C.red) });
  page.drawRectangle({ x: barX + third, y: barY, width: third, height: barH, color: rgb(...C.gold) });
  page.drawRectangle({ x: barX + 2 * third, y: barY, width: third, height: barH, color: rgb(...C.green) });

  // Marker triangle
  const mx = barX + barW * Math.min(pct, 1);
  page.drawRectangle({ x: mx - 3, y: barY + barH + 2, width: 6, height: 6, color: rgb(...C.navy) });

  // Labels
  page.drawText("0%", { x: barX, y: barY - 10, size: 6, font, color: rgb(...C.textMuted) });
  const m50 = "50%"; page.drawText(m50, { x: barX + barW / 2 - font.widthOfTextAtSize(m50, 6) / 2, y: barY - 10, size: 6, font, color: rgb(...C.textMuted) });
  const m100 = "100%"; page.drawText(m100, { x: barX + barW - font.widthOfTextAtSize(m100, 6), y: barY - 10, size: 6, font, color: rgb(...C.textMuted) });

  page.drawText(`${completed} von ${total} abgeschlossen`, { x: barX, y: barY - 22, size: 7, font, color: rgb(...C.textMuted) });
}

// --- Summary Box -------------------------------------------------------

function drawSummaryBox(
  page: any, rgb: any, bold: any, font: any,
  summaryText: string, startY: number, W: number
): number {
  const words = summaryText.split(" ");
  let line = ""; const lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, 9) > W - 120) { lines.push(line); line = w; }
    else { line = test; }
  }
  if (line) lines.push(line);

  const boxH = lines.length * 13 + 36;
  const boxY = startY - 8;
  page.drawRectangle({ x: 40, y: boxY - boxH, width: W - 80, height: boxH, color: rgb(...C.summaryBg), borderColor: rgb(...C.gold), borderWidth: 1 });
  let sy = boxY - 16;
  page.drawCircle({ x: 54, y: sy + 3, size: 5, color: rgb(...C.green) });
  page.drawText("Z", { x: 51.5, y: sy, size: 5, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Zusammenfassung", { x: 64, y: sy, size: 9, font: bold, color: rgb(...C.navy) });
  sy -= 16;
  for (const l of lines) {
    if (sy > 50) { page.drawText(l, { x: 50, y: sy, size: 9, font, color: rgb(...C.textDark) }); sy -= 13; }
  }
  return sy;
}

// --- Impact Card -------------------------------------------------------

function drawImpactCard(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string, icon: string,
  x: number, y: number, w: number, h: number,
  accentColor: C3
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.card), borderColor: rgb(...accentColor), borderWidth: 1 });
  page.drawRectangle({ x, y, width: 4, height: h, color: rgb(...accentColor) });
  page.drawCircle({ x: x + 22, y: y + h / 2, size: 12, color: rgb(...accentColor) });
  page.drawText(icon, { x: x + 18, y: y + h / 2 - 4, size: 8, font: bold, color: rgb(...C.white) });
  page.drawText(value, { x: x + 42, y: y + h - 18, size: 18, font: bold, color: rgb(...C.navy) });
  page.drawText(label, { x: x + 42, y: y + 6, size: 7.5, font, color: rgb(...C.textMuted) });
}


// ======================================================================
// MONATSBERICHT — 3 Seiten (HELLES Design)
// ======================================================================

export async function downloadMonthlyReportPDF(data: ReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595; const H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const TP = 3;

    // === SEITE 1: Dashboard ===
    const p1 = doc.addPage([W, H]);
    drawPageBg(p1, rgb, W, H);
    drawPageHeader(p1, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today);

    let y = H - 80;
    drawSectionHeader(p1, rgb, bold, font, "Kennzahlen", 40, y, "K", C.blue);

    // 2x4 KPI Grid
    const kpis: [string, string, C3][] = [
      [String(data.kpis.activeBetreuungen + data.kpis.abgeschlossen + data.kpis.neueBetreuungen), "Betreuungen gesamt", C.blue],
      [String(data.kpis.activeBetreuungen), "Aktive Betreuungen", C.green],
      [String(data.kpis.abgeschlossen), "Abgeschlossen", C.gold],
      [String(data.kpis.neueBetreuungen), "Neue Betreuungen", C.blue],
      [String(data.kpis.mentoren), "Mentoren", C.navy],
      [String(data.kpis.mentees), "Mentees", C.navy],
      [String(data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions), "Sessions gesamt", C.gold],
      [String(data.kpis.nachbetreuung), "Nachbetreuung", C.green],
    ];
    const KW = 122; const KH = 48; const KG = 6;
    kpis.forEach(([v, l, col], i) => {
      const c2 = i % 4; const r = Math.floor(i / 4);
      drawKpiCard(p1, rgb, bold, font, v, l, 40 + c2 * (KW + KG), y - 14 - r * (KH + KG), KW, KH, col);
    });

    // Gold divider
    const dv1 = y - 14 - 2 * (KH + KG) - 8;
    p1.drawRectangle({ x: 40, y: dv1, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // BETREUUNGS-STATUS Donut (linke Haelfte: x=40..290)
    const secY = dv1 - 18;
    drawSectionHeader(p1, rgb, bold, font, "Betreuungs-Status", 40, secY, "B", C.green);

    const totalB = data.kpis.activeBetreuungen + data.kpis.abgeschlossen + data.kpis.neueBetreuungen;
    drawDonutChart(p1, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeBetreuungen, color: C.green },
      { label: "Abgeschl.", value: data.kpis.abgeschlossen, color: C.gold },
      { label: "Neu", value: data.kpis.neueBetreuungen, color: C.blue },
    ], 120, secY - 70, 42, 22);

    // SESSION-VERTEILUNG (rechte Haelfte: x=300..555)
    const sessX = 310;
    drawSectionHeader(p1, rgb, bold, font, "Session-Verteilung", sessX, secY, "S", C.gold);

    drawHorizontalBars(p1, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.blue },
      { label: "Salah", value: data.kpis.salahSessions, color: C.green },
      { label: "Koran", value: data.kpis.koranSessions, color: C.gold },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.purple },
    ], sessX, secY - 24, W - 40 - sessX, 10, 22);

    // MENTOR DES MONATS — ganz unten mit Abstand
    const momY = secY - 135;
    if (data.mentorOfMonth) {
      p1.drawRectangle({ x: 40, y: momY, width: W - 80, height: 52, color: rgb(...C.card), borderColor: rgb(...C.gold), borderWidth: 2 });
      p1.drawRectangle({ x: 42, y: momY + 4, width: 4, height: 44, color: rgb(...C.gold) });
      p1.drawCircle({ x: 66, y: momY + 30, size: 10, color: rgb(...C.gold) });
      p1.drawText("*", { x: 62, y: momY + 26, size: 12, font: bold, color: rgb(...C.white) });
      p1.drawText("MENTOR DES MONATS", { x: 84, y: momY + 38, size: 7, font: bold, color: rgb(...C.gold) });
      p1.drawText(data.mentorOfMonth.name, { x: 84, y: momY + 16, size: 14, font: bold, color: rgb(...C.navy) });
      const statsT = `${data.mentorOfMonth.score} Pkt  |  ${data.mentorOfMonth.completed} Abschl.  |  ${data.mentorOfMonth.sessions} Sessions`;
      p1.drawText(statsT, { x: W - 40 - font.widthOfTextAtSize(statsT, 8) - 10, y: momY + 22, size: 8, font, color: rgb(...C.textMuted) });
    }

    drawFooter(p1, rgb, font, W, 1, TP);

    // === SEITE 2: Charts + Top-Mentoren + Gauge ===
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today);

    let y2 = H - 80;
    drawSectionHeader(p2, rgb, bold, font, "Sessions nach Typ", 40, y2, "S", C.gold);

    drawVerticalBarChart(p2, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.blue },
      { label: "Salah", value: data.kpis.salahSessions, color: C.green },
      { label: "Koran", value: data.kpis.koranSessions, color: C.gold },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.purple },
    ], 60, y2 - 160, W - 120, 130);

    // Divider
    const dv2 = y2 - 182;
    p2.drawRectangle({ x: 40, y: dv2, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // TOP MENTOREN
    const tmY = dv2 - 18;
    drawSectionHeader(p2, rgb, bold, font, "Top-Mentoren (Score)", 40, tmY, "M", C.blue);

    const top5 = data.rankings.slice(0, 5);
    const maxScore = Math.max(...top5.map(m => m.score), 1);
    top5.forEach((m, i) => {
      const my = tmY - 28 - i * 40;  // 40px spacing (no overlap)
      // Rank circle
      const rc = i === 0 ? C.gold : i === 1 ? C.silver : i === 2 ? C.bronze : C.textLight;
      p2.drawCircle({ x: 54, y: my + 12, size: 10, color: rgb(...rc) });
      p2.drawText(String(m.rank), { x: 51, y: my + 9, size: 8, font: bold, color: rgb(...C.white) });
      // Name
      p2.drawText(m.name, { x: 72, y: my + 16, size: 8.5, font: bold, color: rgb(...C.textDark) });
      // Score bar
      const barX = 72; const barW = W - 160;
      p2.drawRectangle({ x: barX, y: my, width: barW, height: 9, color: rgb(...C.barBg) });
      const fillW = maxScore > 0 ? Math.max(4, barW * (m.score / maxScore)) : 4;
      const bColor = i === 0 ? C.gold : i < 3 ? C.blue : C.textLight;
      p2.drawRectangle({ x: barX, y: my, width: fillW, height: 9, color: rgb(...bColor) });
      // Score text
      const st = `${m.score} Pkt`;
      p2.drawText(st, { x: W - 40 - bold.widthOfTextAtSize(st, 7) - 4, y: my + 1, size: 7, font: bold, color: rgb(...C.navy) });
    });

    // Divider
    const gDv = tmY - 28 - Math.max(top5.length, 1) * 40 - 12;
    p2.drawRectangle({ x: 40, y: gDv, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Completion Gauge
    drawSectionHeader(p2, rgb, bold, font, "Abschlussquote", 40, gDv - 14, "A", C.navy);
    drawCompletionGauge(p2, rgb, bold, font, data.kpis.abgeschlossen, totalB, 40, gDv - 40, W - 80);

    drawFooter(p2, rgb, font, W, 2, TP);

    // === SEITE 3: Rangliste + Zusammenfassung ===
    const p3 = doc.addPage([W, H]);
    drawPageBg(p3, rgb, W, H);
    drawPageHeader(p3, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today);

    let y3 = H - 80;
    drawSectionHeader(p3, rgb, bold, font, "Rangliste", 40, y3, "R", C.gold);

    // Table header
    let ty = y3 - 20;
    p3.drawRectangle({ x: 40, y: ty - 2, width: W - 80, height: 16, color: rgb(...C.navy) });
    const cols = [48, 72, 250, 320, 395, 465];
    ["#", "Name", "Score", "Sessions", "Abschl.", "Bewertung"].forEach((h, i) => {
      p3.drawText(h, { x: cols[i], y: ty + 2, size: 7, font: bold, color: rgb(...C.white) });
    });
    ty -= 16;

    // Rows
    data.rankings.slice(0, 15).forEach((m, i) => {
      const rowBg = i % 2 === 0 ? rgb(...C.card) : rgb(...C.rowAlt);
      p3.drawRectangle({ x: 40, y: ty - 2, width: W - 80, height: 16, color: rowBg });
      p3.drawLine({ start: { x: 40, y: ty - 2 }, end: { x: W - 40, y: ty - 2 }, thickness: 0.3, color: rgb(...C.border) });

      const isTop = m.rank <= 3;
      const fn = isTop ? bold : font;
      const tc = m.rank === 1 ? rgb(...C.gold) : isTop ? rgb(...C.navy) : rgb(...C.textDark);

      // Medal circle for top 3 — positioned to NOT overlap text
      if (isTop) {
        const mc = m.rank === 1 ? C.gold : m.rank === 2 ? C.silver : C.bronze;
        p3.drawCircle({ x: 54, y: ty + 5, size: 5, color: rgb(...mc) });
      }
      p3.drawText(String(m.rank), { x: 48, y: ty + 2, size: 7, font: fn, color: tc });
      p3.drawText(m.name, { x: cols[1], y: ty + 2, size: 7, font: fn, color: tc });
      // Numbers
      [String(m.score), String(m.sessions), String(m.completed)].forEach((v, vi) => {
        p3.drawText(v, { x: cols[vi + 2] + 30 - font.widthOfTextAtSize(v, 7), y: ty + 2, size: 7, font, color: rgb(...C.textDark) });
      });
      const rs = m.rating !== null ? m.rating.toFixed(1) + " *" : "-";
      p3.drawText(rs, { x: cols[5] + 30 - font.widthOfTextAtSize(rs, 7), y: ty + 2, size: 7, font, color: rgb(...C.textDark) });
      ty -= 16;
    });

    // Divider
    p3.drawRectangle({ x: 40, y: ty - 10, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Summary
    const sumY = ty - 28;
    drawSectionHeader(p3, rgb, bold, font, "Zusammenfassung", 40, sumY, "Z", C.green);
    drawSummaryBox(p3, rgb, bold, font, data.summaryText, sumY - 12, W);

    drawFooter(p3, rgb, font, W, 3, TP);

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Monatsbericht-" + data.period + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}


// ======================================================================
// MENTOR AWARD (unveraendert)
// ======================================================================

export async function generateMentorAwardPDFBytes(data: AwardData): Promise<Uint8Array | null> {
  if (Platform.OS !== "web") return null;
  try {
    const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
    const aDoc = await PDFDocument.create();
    const aFont = await aDoc.embedFont(StandardFonts.Helvetica);
    const aBold = await aDoc.embedFont(StandardFonts.HelveticaBold);
    const AW = 595; const AH = 842; const acx = AW / 2;

    const aPage = aDoc.addPage([AW, AH]);
    aPage.drawRectangle({ x: 30, y: 30, width: AW - 60, height: AH - 60, borderColor: rgb(...C.gold), borderWidth: 3 });
    aPage.drawText("BNM", { x: acx - aBold.widthOfTextAtSize("BNM", 36) / 2, y: AH - 120, size: 36, font: aBold, color: rgb(...C.gold) });
    aPage.drawText("BETREUUNG NEUER MUSLIME", { x: acx - aFont.widthOfTextAtSize("BETREUUNG NEUER MUSLIME", 8) / 2, y: AH - 140, size: 8, font: aFont, color: rgb(...C.textMuted) });
    aPage.drawRectangle({ x: acx - 30, y: AH - 170, width: 60, height: 3, color: rgb(...C.gold) });
    aPage.drawText("AUSZEICHNUNG", { x: acx - aFont.widthOfTextAtSize("AUSZEICHNUNG", 10) / 2, y: AH - 200, size: 10, font: aFont, color: rgb(...C.textMuted) });
    aPage.drawText("Mentor des Monats", { x: acx - aBold.widthOfTextAtSize("Mentor des Monats", 24) / 2, y: AH - 240, size: 24, font: aBold, color: rgb(...C.navy) });
    aPage.drawText(data.period, { x: acx - aFont.widthOfTextAtSize(data.period, 12) / 2, y: AH - 265, size: 12, font: aFont, color: rgb(...C.textMuted) });
    aPage.drawRectangle({ x: acx - 30, y: AH - 290, width: 60, height: 3, color: rgb(...C.gold) });
    aPage.drawText(data.mentorName, { x: acx - aBold.widthOfTextAtSize(data.mentorName, 28) / 2, y: AH - 340, size: 28, font: aBold, color: rgb(...C.gold) });

    const aStats: [string, string][] = [
      [String(data.score), "Punkte"],
      [String(data.completed), "Abschluesse"],
      [String(data.sessions), "Sessions"],
    ];
    aStats.forEach(function(pair, i) {
      const asx = 120 + i * 140;
      aPage.drawRectangle({ x: asx, y: AH - 430, width: 110, height: 50, borderColor: rgb(...C.border), borderWidth: 1 });
      aPage.drawText(pair[0], { x: asx + 55 - aBold.widthOfTextAtSize(pair[0], 20) / 2, y: AH - 410, size: 20, font: aBold, color: rgb(...C.navy) });
      aPage.drawText(pair[1], { x: asx + 55 - aFont.widthOfTextAtSize(pair[1], 8) / 2, y: AH - 425, size: 8, font: aFont, color: rgb(...C.textMuted) });
    });

    aPage.drawRectangle({ x: acx - 30, y: AH - 470, width: 60, height: 3, color: rgb(...C.gold) });
    aPage.drawText("BNM - Betreuung neuer Muslime - iman.ngo", { x: acx - aFont.widthOfTextAtSize("BNM - Betreuung neuer Muslime - iman.ngo", 8) / 2, y: AH - 500, size: 8, font: aFont, color: rgb(...C.textLight) });

    return await aDoc.save();
  } catch {
    return null;
  }
}

export async function downloadMentorAwardPDF(data: AwardData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const bytes = await generateMentorAwardPDFBytes(data);
    if (!bytes) return false;
    triggerDownload(bytes, "BNM-Mentor-des-Monats-" + data.period + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}

// --- Mentor Award als PNG (Canvas 2D) ---------------------------------

export async function downloadMentorAwardPNG(data: AwardData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const SCALE = 2;
    const W = 595; const H = 842; const cx = W / 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = "#FFFDF5";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#EEA71B"; ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.lineWidth = 1;
    ctx.strokeRect(38, 38, W - 76, H - 76);

    ctx.fillStyle = "#EEA71B";
    [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]].forEach(function(corner) {
      ctx.fillRect(corner[0] - 5, corner[1] - 5, 10, 10);
    });

    ctx.fillStyle = "#101828";
    ctx.fillRect(30, 30, W - 60, 110);

    ctx.fillStyle = "#EEA71B"; ctx.font = "bold 34px Georgia, serif"; ctx.textAlign = "center";
    ctx.fillText("BNM", cx, 90);
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "9px Arial, sans-serif";
    ctx.fillText("BETREUUNG NEUER MUSLIME", cx, 112);

    ctx.fillStyle = "#EEA71B"; ctx.fillRect(30, 140, W - 60, 3);
    ctx.fillStyle = "#EEA71B"; ctx.font = "22px Arial"; ctx.fillText("*  *  *  *  *", cx, 182);

    ctx.fillStyle = "#9CA3AF"; ctx.font = "bold 9px Arial, sans-serif";
    ctx.fillText("A U S Z E I C H N U N G", cx, 208);

    ctx.strokeStyle = "rgba(238,167,27,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(55, 270); ctx.lineTo(cx - 90, 270); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 90, 270); ctx.lineTo(W - 55, 270); ctx.stroke();

    ctx.fillStyle = "#101828"; ctx.font = "bold 26px Georgia, serif"; ctx.fillText(data.mentorName, cx, 270);
    ctx.fillStyle = "#6B7280"; ctx.font = "italic 13px Georgia, serif"; ctx.fillText(data.period, cx, 300);

    ctx.strokeStyle = "rgba(238,167,27,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 330); ctx.lineTo(W - 80, 330); ctx.stroke();
    ctx.strokeStyle = "rgba(238,167,27,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 336); ctx.lineTo(W - 80, 336); ctx.stroke();

    const stats: [string, string][] = [[String(data.score), "PUNKTE"], [String(data.completed), "ABSCHLUESSE"], [String(data.sessions), "SESSIONS"]];
    stats.forEach(function(pair, i) {
      const pngSx = cx - 140 + i * 140;
      if (i > 0) { ctx.strokeStyle = "#E5E7EB"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pngSx - 20, 355); ctx.lineTo(pngSx - 20, 415); ctx.stroke(); }
      ctx.fillStyle = "#101828"; ctx.font = "bold 28px Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText(pair[0], pngSx, 392);
      ctx.fillStyle = "#9CA3AF"; ctx.font = "bold 8px Arial, sans-serif"; ctx.fillText(pair[1], pngSx, 412);
    });

    ctx.strokeStyle = "rgba(238,167,27,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 32, 455); ctx.lineTo(cx + 32, 455); ctx.stroke();
    ctx.fillStyle = "#9CA3AF"; ctx.font = "italic 10px Arial, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("AUSGEZEICHNET DURCH DAS BNM-TEAM", cx, 478);
    ctx.font = "9px Arial, sans-serif"; ctx.fillText("Become a New Muslim (BNM)", cx, 496);

    return await new Promise<boolean>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(false); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = `BNM-Urkunde-${data.mentorName}-${data.period}.png`;
        a.click(); URL.revokeObjectURL(url); resolve(true);
      }, "image/png");
    });
  } catch { return false; }
}


// ======================================================================
// SPENDERBERICHT — 2 Seiten (HELLES Design)
// ======================================================================

export async function downloadDonorReportPDF(data: DonorReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595; const H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const TP = 2;

    // === SEITE 1: KPI + Charts ===
    const p1 = doc.addPage([W, H]);
    drawPageBg(p1, rgb, W, H);
    drawPageHeader(p1, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today);

    let y = H - 80;
    drawSectionHeader(p1, rgb, bold, font, "Kennzahlen", 40, y, "K", C.blue);

    const dk: [string, string, C3][] = [
      [String(data.kpis.activeMentorships), "Aktive Betreuungen", C.green],
      [String(data.kpis.newRegistrations), "Neue Registrierungen", C.blue],
      [String(data.kpis.completedInPeriod), "Abgeschlossen", C.gold],
      [String(data.kpis.bnmBoxes), "BNM-Boxen", C.gold],
      [String(data.kpis.activeMentors), "Aktive Mentoren", C.navy],
      [String(data.kpis.wuduSessions), "Wudu Sessions", C.blue],
      [String(data.kpis.salahSessions), "Salah Sessions", C.green],
      [String(data.kpis.koranSessions), "Koran Sessions", C.gold],
    ];
    dk.forEach(([v, l, col], i) => {
      const c2 = i % 4; const r = Math.floor(i / 4);
      drawKpiCard(p1, rgb, bold, font, v, l, 40 + c2 * 128, y - 14 - r * 54, 122, 48, col);
    });

    const dv = y - 14 - 2 * 54 - 8;
    p1.drawRectangle({ x: 40, y: dv, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Session-Verteilung — vertikale Balken
    const chY = dv - 18;
    drawSectionHeader(p1, rgb, bold, font, "Session-Verteilung", 40, chY, "S", C.gold);

    const sessItems = data.sessionDistribution?.items ?? [];
    const displayItems = sessItems.length > 0 ? sessItems : [
      { label: "Wudu", value: data.kpis.wuduSessions },
      { label: "Salah", value: data.kpis.salahSessions },
      { label: "Koran", value: data.kpis.koranSessions },
    ];
    const barColors: C3[] = [C.blue, C.green, C.gold, C.purple, C.orange, C.blue, C.green];
    drawVerticalBarChart(p1, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value,
        color: barColors[i % barColors.length],
      })),
      60, chY - 170, W - 120, 140
    );

    // Betreuungs-Donut unten
    const doY = chY - 210;
    drawSectionHeader(p1, rgb, bold, font, "Betreuungs-Status", 40, doY, "B", C.green);

    drawDonutChart(p1, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeMentorships, color: C.green },
      { label: "Abgeschl.", value: data.kpis.completedInPeriod, color: C.gold },
      { label: "BNM-Boxen", value: data.kpis.bnmBoxes, color: C.blue },
    ], 120, doY - 60, 40, 22);

    drawFooter(p1, rgb, font, W, 1, TP);

    // === SEITE 2: Impact + Summary ===
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today);

    let y2 = H - 80;
    drawSectionHeader(p2, rgb, bold, font, "Wirkung & Impact", 40, y2, "W", C.green);

    const totalSess = data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions + (data.kpis.nachbetreuungSessions || 0);
    const totalMentees = data.kpis.activeMentorships + data.kpis.completedInPeriod;
    const ICW = (W - 100) / 2; const ICH = 50;
    const icY = y2 - 20;
    drawImpactCard(p2, rgb, bold, font, String(totalMentees), "Mentees betreut", "M", 40, icY - ICH, ICW, ICH, C.green);
    drawImpactCard(p2, rgb, bold, font, String(totalSess), "Sessions durchgef.", "S", 60 + ICW, icY - ICH, ICW, ICH, C.blue);
    drawImpactCard(p2, rgb, bold, font, String(data.kpis.bnmBoxes), "BNM-Boxen verteilt", "B", 40, icY - 2 * ICH - 10, ICW, ICH, C.gold);
    drawImpactCard(p2, rgb, bold, font, String(data.kpis.activeMentors), "Aktive Mentoren", "A", 60 + ICW, icY - 2 * ICH - 10, ICW, ICH, C.purple);

    const idv = icY - 2 * ICH - 30;
    p2.drawRectangle({ x: 40, y: idv, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Session-Details horizontal
    const hbY = idv - 18;
    drawSectionHeader(p2, rgb, bold, font, "Session-Details", 40, hbY, "D", C.gold);
    drawHorizontalBars(p2, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value,
        color: barColors[i % barColors.length],
      })),
      40, hbY - 24, W - 80, 10, 22
    );

    // Summary
    const sdv = hbY - 24 - displayItems.length * 22 - 20;
    p2.drawRectangle({ x: 40, y: sdv, width: W - 80, height: 1.5, color: rgb(...C.gold) });
    const sY = sdv - 18;
    drawSectionHeader(p2, rgb, bold, font, "Zusammenfassung", 40, sY, "Z", C.green);
    drawSummaryBox(p2, rgb, bold, font, data.summaryText, sY - 12, W);

    drawFooter(p2, rgb, font, W, 2, TP);

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Spenderbericht-" + data.periodLabel + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}
