import { Platform } from "react-native";

// pdf-lib wird zur Laufzeit ueber CDN geladen (Metro/Expo Web kann es nicht statisch bundlen).
// Cached nach erstem Load.
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
// PDF-Generator fuer BNM-Berichte (Professionelle Version)
// Laed pdf-lib ueber CDN zur Laufzeit.
// Erzeugt .pdf Dateien als direkten Download.
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

// --- Farben (BNM Design System) ---------------------------------------

const C = {
  navy: [10 / 255, 58 / 255, 90 / 255] as [number, number, number],
  navyDark: [7 / 255, 20 / 255, 40 / 255] as [number, number, number],
  navyCard: [15 / 255, 68 / 255, 105 / 255] as [number, number, number],
  navyTable: [20 / 255, 78 / 255, 115 / 255] as [number, number, number],
  lightBlue: [91 / 255, 181 / 255, 232 / 255] as [number, number, number],
  gold: [238 / 255, 167 / 255, 27 / 255] as [number, number, number],
  goldDark: [180 / 255, 130 / 255, 20 / 255] as [number, number, number],
  green: [13 / 255, 156 / 255, 110 / 255] as [number, number, number],
  greenLight: [200 / 255, 240 / 255, 220 / 255] as [number, number, number],
  red: [220 / 255, 38 / 255, 38 / 255] as [number, number, number],
  gray: [71 / 255, 84 / 255, 103 / 255] as [number, number, number],
  grayLight: [160 / 255, 174 / 255, 192 / 255] as [number, number, number],
  lgray: [0.78, 0.85, 0.9] as [number, number, number],
  white: [1, 1, 1] as [number, number, number],
  border: [0.15, 0.30, 0.45] as [number, number, number],
  summaryBg: [0.98, 0.97, 0.94] as [number, number, number],
  warmWhite: [248 / 255, 247 / 255, 244 / 255] as [number, number, number],
  accentPurple: [139 / 255, 92 / 255, 246 / 255] as [number, number, number],
};

// --- Hilfsfunktionen --------------------------------------------------

function drawPageBg(page: any, rgb: any, W: number, H: number) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...C.navy) });
}

function drawPageHeader(
  page: any, rgb: any, bold: any, font: any,
  W: number, H: number, title: string, periodLabel: string, today: string
) {
  // Dunkler Header-Streifen
  page.drawRectangle({ x: 0, y: H - 65, width: W, height: 65, color: rgb(...C.navyDark) });
  // Gold-Akzentlinie
  page.drawRectangle({ x: 0, y: H - 67, width: W, height: 2, color: rgb(...C.gold) });
  // BNM links
  page.drawText("BNM", { x: 40, y: H - 32, size: 22, font: bold, color: rgb(...C.gold) });
  page.drawText("Betreuung neuer Muslime", { x: 40, y: H - 48, size: 7, font, color: rgb(...C.lgray) });
  // Titel zentriert
  const titleW = bold.widthOfTextAtSize(title, 16);
  page.drawText(title, { x: W / 2 - titleW / 2, y: H - 35, size: 16, font: bold, color: rgb(...C.lightBlue) });
  // Zeitraum + Datum rechts
  const pW = font.widthOfTextAtSize(periodLabel, 10);
  page.drawText(periodLabel, { x: W - 40 - pW, y: H - 30, size: 10, font, color: rgb(...C.gold) });
  const erstelltText = "Erstellt: " + today;
  const eW = font.widthOfTextAtSize(erstelltText, 7);
  page.drawText(erstelltText, { x: W - 40 - eW, y: H - 48, size: 7, font, color: rgb(...C.lgray) });
}

function drawSectionHeader(
  page: any, rgb: any, bold: any, font: any,
  text: string, x: number, y: number, letter: string, circleColor: [number, number, number]
) {
  page.drawCircle({ x: x + 7, y: y + 4, size: 7, color: rgb(...circleColor) });
  page.drawText(letter, { x: x + 4, y: y + 1, size: 7, font: bold, color: rgb(1, 1, 1) });
  page.drawText(text, { x: x + 20, y, size: 12, font: bold, color: rgb(...C.white) });
  const textWidth = bold.widthOfTextAtSize(text, 12);
  page.drawRectangle({ x: x + 20, y: y - 5, width: textWidth * 0.6, height: 2, color: rgb(...C.gold) });
}

function drawFooter(page: any, rgb: any, font: any, W: number, currentPage: number, totalPages: number) {
  page.drawLine({ start: { x: 40, y: 42 }, end: { x: W - 40, y: 42 }, thickness: 0.5, color: rgb(...C.border) });
  page.drawText("BNM | Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.lgray) });
  page.drawText("iman.ngo", { x: W / 2 - font.widthOfTextAtSize("iman.ngo", 7) / 2, y: 30, size: 7, font, color: rgb(...C.gold) });
  const rt = `Seite ${currentPage} von ${totalPages}`;
  page.drawText(rt, { x: W - 40 - font.widthOfTextAtSize(rt, 7), y: 30, size: 7, font, color: rgb(...C.lgray) });
}

// --- Professionelle KPI-Card mit Akzentstreifen -----------------------

function drawKpiCardPro(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string, bx: number, by: number, w: number, h: number,
  accentColor: [number, number, number]
) {
  // Card-Hintergrund
  page.drawRectangle({ x: bx, y: by - h, width: w, height: h, color: rgb(...C.navyCard) });
  // Gold-Border
  page.drawRectangle({ x: bx, y: by - h, width: w, height: h, borderColor: rgb(...C.border), borderWidth: 0.5 });
  // Farbiger Akzentstreifen oben (3px)
  page.drawRectangle({ x: bx, y: by - 3, width: w, height: 3, color: rgb(...accentColor) });
  // Wert - gross und prominent
  page.drawText(value, { x: bx + 10, y: by - 24, size: 20, font: bold, color: rgb(...C.lightBlue) });
  // Label
  page.drawText(label, { x: bx + 10, y: by - 38, size: 7, font, color: rgb(...C.lgray) });
}

// --- Horizontale Balken (Session-Verteilung etc.) ---------------------

function drawHorizontalBars(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: [number, number, number] }[],
  x: number, y: number, w: number, barH: number, gap: number
) {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  items.forEach((item, i) => {
    const iy = y - i * (barH + gap);
    // Label links
    page.drawText(item.label, { x, y: iy + 2, size: 7.5, font, color: rgb(...C.lgray) });
    // Bar-Hintergrund
    const barX = x + 110;
    const barW = w - 170;
    page.drawRectangle({ x: barX, y: iy - 2, width: barW, height: barH, color: rgb(...C.navyTable) });
    // Bar-Fuellung
    const fillW = Math.max(4, barW * (item.value / maxVal));
    page.drawRectangle({ x: barX, y: iy - 2, width: fillW, height: barH, color: rgb(...item.color) });
    // Wert rechts
    const valStr = String(item.value);
    page.drawText(valStr, { x: x + w - 40, y: iy + 1, size: 8, font: bold, color: rgb(...C.lightBlue) });
  });
}

// --- Vertikale Balken -------------------------------------------------

function drawVerticalBarChart(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: [number, number, number] }[],
  x: number, y: number, w: number, h: number
) {
  const n = items.length;
  if (n === 0) return;
  const maxVal = Math.max(...items.map(i => i.value), 1) * 1.15;
  const gap = 14;
  const barW = (w - gap * (n + 1)) / n;

  // Baseline
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.5, color: rgb(...C.border) });

  // Grid-Linien
  for (let i = 1; i <= 4; i++) {
    const gy = y + (h * i) / 4;
    page.drawLine({ start: { x, y: gy }, end: { x: x + w, y: gy }, thickness: 0.3, color: rgb(...C.border) });
  }

  items.forEach((item, i) => {
    const bx = x + gap + i * (barW + gap);
    const bh = (item.value / maxVal) * h;

    // Balken
    page.drawRectangle({ x: bx, y, width: barW, height: bh, color: rgb(...item.color) });

    // Wert oben
    const valStr = String(item.value);
    const valW = bold.widthOfTextAtSize(valStr, 8);
    page.drawText(valStr, { x: bx + barW / 2 - valW / 2, y: y + bh + 4, size: 8, font: bold, color: rgb(...C.lightBlue) });

    // Label unten
    const labW = font.widthOfTextAtSize(item.label, 6.5);
    page.drawText(item.label, { x: bx + barW / 2 - labW / 2, y: y - 12, size: 6.5, font, color: rgb(...C.lgray) });
  });
}

// --- Donut-Chart (Kreissegmente) --------------------------------------

function drawDonutChart(
  page: any, rgb: any, bold: any, font: any,
  segments: { label: string; value: number; color: [number, number, number] }[],
  cx: number, cy: number, outerR: number, innerR: number
) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return;

  // Aeusserer Kreis als Summe der Segmente (vereinfacht: gestapelte Kreise)
  // pdf-lib hat kein arc/pie — wir simulieren mit uebereinander gelegten Kreisen
  // Stattdessen: Farbige Segmente als vertikale Leiste neben der Legende

  // Hauptkreis (Hintergrund)
  page.drawCircle({ x: cx, y: cy, size: outerR, color: rgb(...C.navyTable) });

  // Segmente als proportionale Kreisabschnitte (Annaeherung)
  let accumulatedPct = 0;
  segments.forEach((seg) => {
    const pct = seg.value / total;
    const segSize = outerR * Math.sqrt(accumulatedPct + pct);
    // Von aussen nach innen zeichnen (groesstes Segment zuerst)
    accumulatedPct += pct;
  });

  // Da pdf-lib keine echten Arcs kann, zeichnen wir stattdessen:
  // 1. Gestapelte Kreise (groesster zuerst, dann kleiner drauf)
  // Sortiere absteigend nach value
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  let remaining = total;
  sorted.forEach((seg) => {
    const ratio = remaining / total;
    const r = outerR * Math.sqrt(ratio);
    page.drawCircle({ x: cx, y: cy, size: r, color: rgb(...seg.color) });
    remaining -= seg.value;
  });

  // Innerer Kreis (Donut-Loch)
  page.drawCircle({ x: cx, y: cy, size: innerR, color: rgb(...C.navy) });

  // Gesamtzahl in der Mitte
  const totalStr = String(total);
  const tw = bold.widthOfTextAtSize(totalStr, 16);
  page.drawText(totalStr, { x: cx - tw / 2, y: cy - 3, size: 16, font: bold, color: rgb(...C.lightBlue) });
  const gesStr = "Gesamt";
  const gw = font.widthOfTextAtSize(gesStr, 6);
  page.drawText(gesStr, { x: cx - gw / 2, y: cy - 13, size: 6, font, color: rgb(...C.lgray) });

  // Legende rechts
  segments.forEach((seg, i) => {
    const ly = cy + outerR - 5 - i * 16;
    const lx = cx + outerR + 14;
    // Farbpunkt
    page.drawCircle({ x: lx, y: ly + 3, size: 4, color: rgb(...seg.color) });
    // Label + Wert
    page.drawText(`${seg.label}: ${seg.value}`, { x: lx + 8, y: ly, size: 7, font, color: rgb(...C.lgray) });
    // Prozent
    const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
    page.drawText(`${pct}%`, { x: lx + 8, y: ly - 9, size: 6, font: bold, color: rgb(...seg.color) });
  });
}

// --- Fortschrittsbalken -----------------------------------------------

function drawProgressBar(
  page: any, rgb: any, bold: any, font: any,
  label: string, value: number, maxValue: number,
  x: number, y: number, w: number, h: number,
  barColor: [number, number, number], showPct: boolean = true
) {
  // Label
  page.drawText(label, { x, y: y + h + 4, size: 7.5, font, color: rgb(...C.lgray) });
  // Hintergrund
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.navyTable) });
  // Fuellung
  const pct = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const fillW = Math.max(2, w * pct);
  page.drawRectangle({ x, y, width: fillW, height: h, color: rgb(...barColor) });
  // Prozent rechts
  if (showPct) {
    const pctStr = `${Math.round(pct * 100)}%`;
    const pw = bold.widthOfTextAtSize(pctStr, 8);
    page.drawText(pctStr, { x: x + w + 6, y: y + 1, size: 8, font: bold, color: rgb(...barColor) });
  }
  // Wert
  const valStr = String(value);
  const vw = bold.widthOfTextAtSize(valStr, 7);
  page.drawText(valStr, { x: x + w - vw - 4, y: y + 1, size: 7, font: bold, color: rgb(...C.white) });
}

// --- Completion-Rate Gauge (Balken-basiert) ----------------------------

function drawCompletionGauge(
  page: any, rgb: any, bold: any, font: any,
  completed: number, total: number,
  x: number, y: number, w: number
) {
  const pct = total > 0 ? completed / total : 0;
  const pctStr = `${Math.round(pct * 100)}%`;

  // Titel
  page.drawText("Abschlussquote", { x, y: y + 40, size: 9, font: bold, color: rgb(...C.white) });

  // Grosser Prozentwert
  page.drawText(pctStr, { x: x + w / 2 - bold.widthOfTextAtSize(pctStr, 28) / 2, y: y + 8, size: 28, font: bold, color: rgb(...C.gold) });

  // Gauge-Balken mit Farbzonen
  const barY = y - 8;
  const barH = 10;
  const third = w / 3;
  // Rot-Zone
  page.drawRectangle({ x, y: barY, width: third, height: barH, color: rgb(...C.red) });
  // Gold-Zone
  page.drawRectangle({ x: x + third, y: barY, width: third, height: barH, color: rgb(...C.gold) });
  // Gruen-Zone
  page.drawRectangle({ x: x + 2 * third, y: barY, width: third, height: barH, color: rgb(...C.green) });

  // Marker (Dreieck-Indikator als kleines Quadrat)
  const markerX = x + w * Math.min(pct, 1);
  page.drawRectangle({ x: markerX - 3, y: barY + barH + 2, width: 6, height: 6, color: rgb(...C.white) });

  // Labels
  page.drawText("0%", { x, y: barY - 10, size: 6, font, color: rgb(...C.lgray) });
  page.drawText("50%", { x: x + w / 2 - 6, y: barY - 10, size: 6, font, color: rgb(...C.lgray) });
  page.drawText("100%", { x: x + w - 16, y: barY - 10, size: 6, font, color: rgb(...C.lgray) });

  // Werte
  page.drawText(`${completed} von ${total} abgeschlossen`, { x, y: barY - 24, size: 7, font, color: rgb(...C.lgray) });
}

// --- Zusammenfassung-Box ----------------------------------------------

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
    if (sy > 50) { page.drawText(l, { x: 50, y: sy, size: 9, font, color: rgb(...C.navy) }); sy -= 13; }
  }
  return sy;
}

// --- Impact-Card (grosse Zahl mit Beschreibung) -----------------------

function drawImpactCard(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string, icon: string,
  x: number, y: number, w: number, h: number,
  accentColor: [number, number, number]
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.navyCard) });
  page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(...accentColor), borderWidth: 1 });
  // Akzent links
  page.drawRectangle({ x, y, width: 4, height: h, color: rgb(...accentColor) });
  // Icon-Kreis
  page.drawCircle({ x: x + 22, y: y + h / 2, size: 12, color: rgb(...accentColor) });
  page.drawText(icon, { x: x + 18, y: y + h / 2 - 4, size: 8, font: bold, color: rgb(...C.white) });
  // Wert
  page.drawText(value, { x: x + 42, y: y + h - 18, size: 18, font: bold, color: rgb(...C.lightBlue) });
  // Label
  page.drawText(label, { x: x + 42, y: y + 6, size: 7.5, font, color: rgb(...C.lgray) });
}


// ======================================================================
// MONATSBERICHT — 3 Seiten
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
    const TOTAL_PAGES = 3;

    // === SEITE 1: Dashboard + KPIs + Donut + Session-Balken ===
    const p1 = doc.addPage([W, H]);
    drawPageBg(p1, rgb, W, H);
    drawPageHeader(p1, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today);

    // KPI-Sektion
    let y = H - 90;
    drawSectionHeader(p1, rgb, bold, font, "Kennzahlen", 40, y, "K", C.lightBlue);

    // 2x4 KPI-Grid
    const kpis = [
      [String(data.kpis.activeBetreuungen + data.kpis.abgeschlossen + data.kpis.neueBetreuungen), "Betreuungen gesamt"],
      [String(data.kpis.activeBetreuungen), "Aktive Betreuungen"],
      [String(data.kpis.abgeschlossen), "Abgeschlossen"],
      [String(data.kpis.neueBetreuungen), "Neue Betreuungen"],
      [String(data.kpis.mentoren), "Mentoren"],
      [String(data.kpis.mentees), "Mentees"],
      [String(data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions), "Sessions gesamt"],
      [String(data.kpis.nachbetreuung), "Nachbetreuung"],
    ];
    const KPI_W = 122; const KPI_H = 46; const KPI_GAP = 5;
    const kpiColors: [number, number, number][] = [C.lightBlue, C.green, C.gold, C.lightBlue, C.lightBlue, C.lightBlue, C.gold, C.green];
    kpis.forEach(([v, l], i) => {
      const col = i % 4; const row = Math.floor(i / 4);
      const bx = 40 + col * (KPI_W + KPI_GAP);
      const by = y - 14 - row * (KPI_H + KPI_GAP);
      drawKpiCardPro(p1, rgb, bold, font, v, l, bx, by, KPI_W, KPI_H, kpiColors[i]);
    });

    // Gold-Divider
    const divY1 = y - 14 - 2 * (KPI_H + KPI_GAP) - 6;
    p1.drawRectangle({ x: 40, y: divY1, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Betreuungs-Status Donut (links)
    const chartY = divY1 - 20;
    drawSectionHeader(p1, rgb, bold, font, "Betreuungs-Status", 40, chartY, "B", C.green);

    const totalBetreuungen = data.kpis.activeBetreuungen + data.kpis.abgeschlossen + data.kpis.neueBetreuungen;
    drawDonutChart(p1, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeBetreuungen, color: C.green },
      { label: "Abgeschlossen", value: data.kpis.abgeschlossen, color: C.gold },
      { label: "Neu", value: data.kpis.neueBetreuungen, color: C.lightBlue },
    ], 130, chartY - 80, 50, 28);

    // Session-Verteilung (rechts) - horizontale Balken
    drawSectionHeader(p1, rgb, bold, font, "Session-Verteilung", 300, chartY, "S", C.gold);

    drawHorizontalBars(p1, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.lightBlue },
      { label: "Salah", value: data.kpis.salahSessions, color: C.green },
      { label: "Koran", value: data.kpis.koranSessions, color: C.gold },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.accentPurple },
    ], 300, chartY - 22, 250, 10, 16);

    // Mentor des Monats (unten)
    const momY = chartY - 120;
    if (data.mentorOfMonth) {
      p1.drawRectangle({ x: 40, y: momY - 55, width: W - 80, height: 55, color: rgb(...C.navyCard) });
      p1.drawRectangle({ x: 40, y: momY - 55, width: W - 80, height: 55, borderColor: rgb(...C.gold), borderWidth: 2 });
      p1.drawRectangle({ x: 40, y: momY - 55, width: 4, height: 55, color: rgb(...C.gold) });
      // Stern-Icon
      p1.drawCircle({ x: 62, y: momY - 20, size: 10, color: rgb(...C.gold) });
      p1.drawText("*", { x: 58, y: momY - 24, size: 12, font: bold, color: rgb(...C.white) });
      p1.drawText("MENTOR DES MONATS", { x: 80, y: momY - 14, size: 7, font: bold, color: rgb(...C.gold) });
      p1.drawText(data.mentorOfMonth.name, { x: 80, y: momY - 32, size: 16, font: bold, color: rgb(...C.white) });
      // Stats rechts
      const statsText = `${data.mentorOfMonth.score} Pkt  |  ${data.mentorOfMonth.completed} Abschl.  |  ${data.mentorOfMonth.sessions} Sessions`;
      const stW = font.widthOfTextAtSize(statsText, 8);
      p1.drawText(statsText, { x: W - 40 - stW - 10, y: momY - 30, size: 8, font, color: rgb(...C.lgray) });
    }

    drawFooter(p1, rgb, font, W, 1, TOTAL_PAGES);

    // === SEITE 2: Charts + Top-Mentoren + Completion ===
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today);

    // Sessions nach Typ - vertikale Balken
    let y2 = H - 90;
    drawSectionHeader(p2, rgb, bold, font, "Sessions nach Typ", 40, y2, "S", C.gold);

    drawVerticalBarChart(p2, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.lightBlue },
      { label: "Salah", value: data.kpis.salahSessions, color: C.green },
      { label: "Koran", value: data.kpis.koranSessions, color: C.gold },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.accentPurple },
    ], 60, y2 - 160, W - 120, 130);

    // Gold-Divider
    const divY2 = y2 - 180;
    p2.drawRectangle({ x: 40, y: divY2, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Top 5 Mentoren - Fortschrittsbalken
    const topY = divY2 - 18;
    drawSectionHeader(p2, rgb, bold, font, "Top-Mentoren (Score)", 40, topY, "M", C.lightBlue);

    const top5 = data.rankings.slice(0, 5);
    const maxScore = top5.length > 0 ? Math.max(...top5.map(m => m.score), 1) : 1;
    top5.forEach((m, i) => {
      const my = topY - 24 - i * 30;
      // Rang-Nummer
      const rankColor = i === 0 ? C.gold : i === 1 ? C.lgray : i === 2 ? C.goldDark : C.lgray;
      p2.drawCircle({ x: 52, y: my + 8, size: 8, color: rgb(...rankColor) });
      p2.drawText(String(m.rank), { x: 49, y: my + 5, size: 7, font: bold, color: rgb(...C.white) });
      // Name
      p2.drawText(m.name, { x: 68, y: my + 12, size: 8, font: bold, color: rgb(...C.white) });
      // Score-Balken
      const barX = 68;
      const barW = W - 160;
      p2.drawRectangle({ x: barX, y: my - 2, width: barW, height: 8, color: rgb(...C.navyTable) });
      const fillW = Math.max(4, barW * (m.score / maxScore));
      const barColor = i === 0 ? C.gold : i < 3 ? C.lightBlue : C.grayLight;
      p2.drawRectangle({ x: barX, y: my - 2, width: fillW, height: 8, color: rgb(...barColor) });
      // Score rechts
      const scoreStr = String(m.score) + " Pkt";
      const sw = bold.widthOfTextAtSize(scoreStr, 7);
      p2.drawText(scoreStr, { x: W - 48 - sw, y: my, size: 7, font: bold, color: rgb(...C.lightBlue) });
    });

    // Completion-Rate Gauge
    const gaugeY = topY - 24 - 5 * 30 - 20;
    p2.drawRectangle({ x: 40, y: gaugeY - 40, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    drawCompletionGauge(p2, rgb, bold, font,
      data.kpis.abgeschlossen,
      data.kpis.activeBetreuungen + data.kpis.abgeschlossen + data.kpis.neueBetreuungen,
      60, gaugeY - 60, W - 120
    );

    drawFooter(p2, rgb, font, W, 2, TOTAL_PAGES);

    // === SEITE 3: Rangliste + Zusammenfassung ===
    const p3 = doc.addPage([W, H]);
    drawPageBg(p3, rgb, W, H);
    drawPageHeader(p3, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today);

    // Rangliste
    let y3 = H - 90;
    drawSectionHeader(p3, rgb, bold, font, "Rangliste", 40, y3, "R", C.gold);

    // Tabellenkopf - gold
    let ty = y3 - 16;
    p3.drawRectangle({ x: 40, y: ty - 15, width: W - 80, height: 15, color: rgb(...C.gold) });
    const rankCols = [45, 70, 250, 320, 395, 465];
    ["#", "Name", "Score", "Sessions", "Abschl.", "Bewertung"].forEach((h, i) => {
      p3.drawText(h, { x: rankCols[i], y: ty - 11, size: 7, font: bold, color: rgb(...C.navy) });
    });
    ty -= 15;

    // Tabellenzeilen
    data.rankings.slice(0, 15).forEach((m, i) => {
      const rowBg = i % 2 === 0 ? rgb(...C.navy) : rgb(...C.navyTable);
      p3.drawRectangle({ x: 40, y: ty - 14, width: W - 80, height: 14, color: rowBg });
      p3.drawLine({ start: { x: 40, y: ty - 14 }, end: { x: W - 40, y: ty - 14 }, thickness: 0.3, color: rgb(...C.border) });
      const isTop = m.rank <= 3;
      const f = isTop ? bold : font;
      const c = isTop ? rgb(...C.gold) : rgb(...C.white);
      // Medaillen-Indicator fuer Top 3
      if (isTop) {
        const medalColor = m.rank === 1 ? C.gold : m.rank === 2 ? C.lgray : C.goldDark;
        p3.drawCircle({ x: 50, y: ty - 7, size: 4, color: rgb(...medalColor) });
      }
      p3.drawText(String(m.rank), { x: 45, y: ty - 10, size: 7, font: f, color: c });
      p3.drawText(m.name, { x: rankCols[1], y: ty - 10, size: 7, font: f, color: c });
      // Zahlen rechtsbuendig
      const scoreStr = String(m.score);
      p3.drawText(scoreStr, { x: rankCols[2] + 40 - font.widthOfTextAtSize(scoreStr, 7), y: ty - 10, size: 7, font, color: rgb(...C.white) });
      const sessStr = String(m.sessions);
      p3.drawText(sessStr, { x: rankCols[3] + 40 - font.widthOfTextAtSize(sessStr, 7), y: ty - 10, size: 7, font, color: rgb(...C.white) });
      const complStr = String(m.completed);
      p3.drawText(complStr, { x: rankCols[4] + 40 - font.widthOfTextAtSize(complStr, 7), y: ty - 10, size: 7, font, color: rgb(...C.white) });
      const ratingStr = m.rating !== null ? m.rating.toFixed(1) + " *" : "-";
      p3.drawText(ratingStr, { x: rankCols[5] + 40 - font.widthOfTextAtSize(ratingStr, 7), y: ty - 10, size: 7, font, color: rgb(...C.white) });
      ty -= 14;
    });

    // Gold-Divider
    p3.drawRectangle({ x: 40, y: ty - 10, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Zusammenfassung
    const sumY = ty - 28;
    drawSectionHeader(p3, rgb, bold, font, "Zusammenfassung", 40, sumY, "Z", C.green);
    drawSummaryBox(p3, rgb, bold, font, data.summaryText, sumY - 12, W);

    drawFooter(p3, rgb, font, W, 3, TOTAL_PAGES);

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
    aPage.drawText("BETREUUNG NEUER MUSLIME", { x: acx - aFont.widthOfTextAtSize("BETREUUNG NEUER MUSLIME", 8) / 2, y: AH - 140, size: 8, font: aFont, color: rgb(...C.gray) });
    aPage.drawRectangle({ x: acx - 30, y: AH - 170, width: 60, height: 3, color: rgb(...C.gold) });
    aPage.drawText("AUSZEICHNUNG", { x: acx - aFont.widthOfTextAtSize("AUSZEICHNUNG", 10) / 2, y: AH - 200, size: 10, font: aFont, color: rgb(...C.gray) });
    aPage.drawText("Mentor des Monats", { x: acx - aBold.widthOfTextAtSize("Mentor des Monats", 24) / 2, y: AH - 240, size: 24, font: aBold, color: rgb(...C.navy) });
    aPage.drawText(data.period, { x: acx - aFont.widthOfTextAtSize(data.period, 12) / 2, y: AH - 265, size: 12, font: aFont, color: rgb(...C.gray) });
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
      aPage.drawText(pair[1], { x: asx + 55 - aFont.widthOfTextAtSize(pair[1], 8) / 2, y: AH - 425, size: 8, font: aFont, color: rgb(...C.gray) });
    });

    aPage.drawRectangle({ x: acx - 30, y: AH - 470, width: 60, height: 3, color: rgb(...C.gold) });
    aPage.drawText("BNM - Betreuung neuer Muslime - iman.ngo", { x: acx - aFont.widthOfTextAtSize("BNM - Betreuung neuer Muslime - iman.ngo", 8) / 2, y: AH - 500, size: 8, font: aFont, color: rgb(...C.lgray) });

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

// --- Mentor Award als PNG (Canvas 2D, keine externe Bibliothek) -------

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

    ctx.strokeStyle = "#EEA71B";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.lineWidth = 1;
    ctx.strokeRect(38, 38, W - 76, H - 76);

    ctx.fillStyle = "#EEA71B";
    [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]].forEach(function(corner) {
      ctx.fillRect(corner[0] - 5, corner[1] - 5, 10, 10);
    });

    ctx.fillStyle = "#101828";
    ctx.fillRect(30, 30, W - 60, 110);

    ctx.fillStyle = "#EEA71B";
    ctx.font = "bold 34px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("BNM", cx, 90);

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "9px Arial, sans-serif";
    ctx.fillText("BETREUUNG NEUER MUSLIME", cx, 112);

    ctx.fillStyle = "#EEA71B";
    ctx.fillRect(30, 140, W - 60, 3);

    ctx.fillStyle = "#EEA71B";
    ctx.font = "22px Arial";
    ctx.fillText("*  *  *  *  *", cx, 182);

    ctx.fillStyle = "#9CA3AF";
    ctx.font = "bold 9px Arial, sans-serif";
    ctx.fillText("A U S Z E I C H N U N G", cx, 208);

    ctx.strokeStyle = "rgba(238,167,27,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(55, 270); ctx.lineTo(cx - 90, 270); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 90, 270); ctx.lineTo(W - 55, 270); ctx.stroke();

    ctx.fillStyle = "#101828";
    ctx.font = "bold 26px Georgia, serif";
    ctx.fillText(data.mentorName, cx, 270);

    ctx.fillStyle = "#6B7280";
    ctx.font = "italic 13px Georgia, serif";
    ctx.fillText(data.period, cx, 300);

    ctx.strokeStyle = "rgba(238,167,27,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 330); ctx.lineTo(W - 80, 330); ctx.stroke();
    ctx.strokeStyle = "rgba(238,167,27,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 336); ctx.lineTo(W - 80, 336); ctx.stroke();

    const stats: [string, string][] = [
      [String(data.score), "PUNKTE"],
      [String(data.completed), "ABSCHLUESSE"],
      [String(data.sessions), "SESSIONS"],
    ];
    stats.forEach(function(pair, i) {
      const pngSx = cx - 140 + i * 140;
      if (i > 0) {
        ctx.strokeStyle = "#E5E7EB"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pngSx - 20, 355); ctx.lineTo(pngSx - 20, 415); ctx.stroke();
      }
      ctx.fillStyle = "#101828"; ctx.font = "bold 28px Arial, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(pair[0], pngSx, 392);
      ctx.fillStyle = "#9CA3AF"; ctx.font = "bold 8px Arial, sans-serif";
      ctx.fillText(pair[1], pngSx, 412);
    });

    ctx.strokeStyle = "rgba(238,167,27,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 32, 455); ctx.lineTo(cx + 32, 455); ctx.stroke();

    ctx.fillStyle = "#9CA3AF"; ctx.font = "italic 10px Arial, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("AUSGEZEICHNET DURCH DAS BNM-TEAM", cx, 478);
    ctx.font = "9px Arial, sans-serif";
    ctx.fillText("Become a New Muslim (BNM)", cx, 496);

    return await new Promise<boolean>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(false); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `BNM-Urkunde-${data.mentorName}-${data.period}.png`;
        a.click();
        URL.revokeObjectURL(url);
        resolve(true);
      }, "image/png");
    });
  } catch {
    return false;
  }
}


// ======================================================================
// SPENDERBERICHT — 2 Seiten
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
    const TOTAL_PAGES = 2;

    // === SEITE 1: KPI-Dashboard + Charts ===
    const p1 = doc.addPage([W, H]);
    drawPageBg(p1, rgb, W, H);
    drawPageHeader(p1, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today);

    // KPI-Sektion
    let y = H - 90;
    drawSectionHeader(p1, rgb, bold, font, "Kennzahlen", 40, y, "K", C.lightBlue);

    // 2x4 KPI-Grid
    const dk = [
      [String(data.kpis.activeMentorships), "Aktive Betreuungen"],
      [String(data.kpis.newRegistrations), "Neue Registrierungen"],
      [String(data.kpis.completedInPeriod), "Abgeschlossen"],
      [String(data.kpis.bnmBoxes), "BNM-Boxen"],
      [String(data.kpis.activeMentors), "Aktive Mentoren"],
      [String(data.kpis.wuduSessions), "Wudu Sessions"],
      [String(data.kpis.salahSessions), "Salah Sessions"],
      [String(data.kpis.koranSessions), "Koran Sessions"],
    ];
    const DK_W = 122; const DK_H = 46; const DK_GAP = 5;
    const dkColors: [number, number, number][] = [C.green, C.lightBlue, C.gold, C.gold, C.lightBlue, C.lightBlue, C.green, C.gold];
    dk.forEach(([v, l], i) => {
      const col = i % 4; const row = Math.floor(i / 4);
      const bx = 40 + col * (DK_W + DK_GAP);
      const by = y - 14 - row * (DK_H + DK_GAP);
      drawKpiCardPro(p1, rgb, bold, font, v, l, bx, by, DK_W, DK_H, dkColors[i]);
    });

    // Gold-Divider
    const divY = y - 14 - 2 * (DK_H + DK_GAP) - 6;
    p1.drawRectangle({ x: 40, y: divY, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Session-Verteilung - vertikale Balken
    const chartY = divY - 18;
    drawSectionHeader(p1, rgb, bold, font, "Session-Verteilung", 40, chartY, "S", C.gold);

    const sessItems = data.sessionDistribution?.items ?? [];
    const displayItems = sessItems.length > 0 ? sessItems : [
      { label: "Wudu", value: data.kpis.wuduSessions },
      { label: "Salah", value: data.kpis.salahSessions },
      { label: "Koran", value: data.kpis.koranSessions },
    ];
    const barColors: [number, number, number][] = [C.lightBlue, C.green, C.gold, C.accentPurple, C.grayLight, C.lightBlue, C.green, C.gold];
    drawVerticalBarChart(p1, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value,
        color: barColors[i % barColors.length],
      })),
      60, chartY - 170, W - 120, 140
    );

    // Betreuungs-Uebersicht Donut (unten links)
    const donutY = chartY - 205;
    drawSectionHeader(p1, rgb, bold, font, "Betreuungs-Status", 40, donutY, "B", C.green);

    drawDonutChart(p1, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeMentorships, color: C.green },
      { label: "Abgeschl.", value: data.kpis.completedInPeriod, color: C.gold },
      { label: "BNM-Boxen", value: data.kpis.bnmBoxes, color: C.lightBlue },
    ], 130, donutY - 65, 45, 24);

    drawFooter(p1, rgb, font, W, 1, TOTAL_PAGES);

    // === SEITE 2: Impact + Zusammenfassung ===
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today);

    // Impact-Metriken
    let y2 = H - 90;
    drawSectionHeader(p2, rgb, bold, font, "Wirkung & Impact", 40, y2, "W", C.green);

    const totalSessions = data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions + (data.kpis.nachbetreuungSessions || 0);
    const totalMentees = data.kpis.activeMentorships + data.kpis.completedInPeriod;

    // 2x2 Impact-Cards
    const IC_W = (W - 100) / 2;
    const IC_H = 50;
    const icY = y2 - 20;
    drawImpactCard(p2, rgb, bold, font, String(totalMentees), "Mentees betreut", "M", 40, icY - IC_H, IC_W, IC_H, C.green);
    drawImpactCard(p2, rgb, bold, font, String(totalSessions), "Sessions durchgefuehrt", "S", 60 + IC_W, icY - IC_H, IC_W, IC_H, C.lightBlue);
    drawImpactCard(p2, rgb, bold, font, String(data.kpis.bnmBoxes), "BNM-Boxen verteilt", "B", 40, icY - 2 * IC_H - 10, IC_W, IC_H, C.gold);
    drawImpactCard(p2, rgb, bold, font, String(data.kpis.activeMentors), "Aktive Mentoren", "A", 60 + IC_W, icY - 2 * IC_H - 10, IC_W, IC_H, C.accentPurple);

    // Gold-Divider
    const impactDivY = icY - 2 * IC_H - 30;
    p2.drawRectangle({ x: 40, y: impactDivY, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Session-Verteilung als horizontale Balken (andere Darstellung als S1)
    const hbY = impactDivY - 18;
    drawSectionHeader(p2, rgb, bold, font, "Session-Details", 40, hbY, "D", C.gold);

    drawHorizontalBars(p2, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value,
        color: barColors[i % barColors.length],
      })),
      40, hbY - 22, W - 80, 10, 18
    );

    // Nachbetreuungs-Rate Fortschrittsbalken
    const nbY = hbY - 22 - displayItems.length * 18 - 30;
    if (data.kpis.nachbetreuungSessions !== undefined) {
      drawProgressBar(p2, rgb, bold, font,
        "Nachbetreuung", data.kpis.nachbetreuungSessions, totalSessions || 1,
        40, nbY, W - 140, 10, C.accentPurple, true
      );
    }

    // Gold-Divider
    const sumDivY = nbY - 30;
    p2.drawRectangle({ x: 40, y: sumDivY, width: W - 80, height: 1.5, color: rgb(...C.gold) });

    // Zusammenfassung
    const sumY = sumDivY - 18;
    drawSectionHeader(p2, rgb, bold, font, "Zusammenfassung", 40, sumY, "Z", C.green);
    drawSummaryBox(p2, rgb, bold, font, data.summaryText, sumY - 12, W);

    drawFooter(p2, rgb, font, W, 2, TOTAL_PAGES);

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Spenderbericht-" + data.periodLabel + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}
