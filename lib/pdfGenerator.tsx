import { Platform } from "react-native";

let _pdfLib: any = null;
async function getPdfLib(): Promise<{ PDFDocument: any; StandardFonts: any; rgb: any }> {
  if (_pdfLib) return _pdfLib;
  if (typeof window === "undefined") throw new Error("PDF nur auf Web verfügbar");
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
// BNM PDF-Reports — Minimalistisches professionelles Design
// ============================================================

// --- Interfaces (100% abwaertskompatibel) --------------------

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
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// =====================================================================
// FARBEN — Reduziert auf Navy + Gold + 2 Akzente
// =====================================================================

type C3 = [number, number, number];
function hx(hex: string): C3 {
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}

const C = {
  navy:     hx("#0A3A5A"),
  navyMid:  hx("#14506F"),
  gold:     hx("#D4960F"),
  goldBright: hx("#EEA71B"),
  accent1:  hx("#2B7A78"),  // Teal — positiv
  accent2:  hx("#3182CE"),  // Blau — neutral
  red:      hx("#C53030"),
  // Graustufen
  white:    [1, 1, 1] as C3,
  bg:       hx("#FBFBF9"),
  card:     [1, 1, 1] as C3,
  gray50:   hx("#FAFAF9"),
  gray100:  hx("#F5F5F4"),
  gray200:  hx("#E7E5E4"),
  gray300:  hx("#D6D3D1"),
  gray400:  hx("#A8A29E"),
  gray500:  hx("#78716C"),
  gray600:  hx("#57534E"),
  gray700:  hx("#44403C"),
  gray800:  hx("#292524"),
  gray900:  hx("#1C1917"),
};

function fmtPct(n: number): string { return Math.round(n * 100) + "%"; }
function fmtDe(n: number, d: number = 1): string { return n.toFixed(d).replace(".", ","); }

// =====================================================================
// GRUNDLEGENDE HELFER
// =====================================================================

const M = 50; // Seitenrand

function drawPageBg(page: any, rgb: any, W: number, H: number) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...C.white) });
}

async function loadLogoPng(doc: any): Promise<any | null> {
  try {
    // Expo Web: require() gibt entweder eine URL-String oder ein Asset-Objekt zurueck
    const asset = require("../assets/images/bnm-logo.png");
    const uri = typeof asset === "string" ? asset : (asset?.uri ?? asset?.default ?? asset);
    if (!uri) return null;
    const resp = await fetch(uri);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // PNG-Magic-Bytes pruefen (89 50 4E 47)
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return await doc.embedPng(bytes);
    }
    // Falls JPEG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return await doc.embedJpg(bytes);
    }
    return null;
  } catch { return null; }
}

// --- Leerer Zustand ---
function drawEmptyState(
  page: any, rgb: any, _bold: any, font: any,
  x: number, y: number, w: number, h: number,
  msg: string = "Keine Daten vorhanden"
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.gray100), borderColor: rgb(...C.gray200), borderWidth: 0.5 });
  const tw = font.widthOfTextAtSize(msg, 9);
  page.drawText(msg, { x: x + w / 2 - tw / 2, y: y + h / 2 - 3, size: 9, font, color: rgb(...C.gray400) });
}

// =====================================================================
// SEITEN-HEADER (sauber, minimal)
// =====================================================================

function drawPageHeader(
  page: any, rgb: any, bold: any, font: any,
  W: number, H: number, title: string, periodLabel: string, today: string,
  logoImage?: any
) {
  // Duenne Navy-Linie oben
  page.drawRectangle({ x: 0, y: H - 2, width: W, height: 2, color: rgb(...C.navy) });
  // Logo / BNM links
  if (logoImage) {
    page.drawImage(logoImage, { x: M - 4, y: H - 46, width: 40, height: 40 });
  } else {
    page.drawText("BNM", { x: M, y: H - 30, size: 14, font: bold, color: rgb(...C.navy) });
  }
  // Titel rechts
  const tw = bold.widthOfTextAtSize(title, 11);
  page.drawText(title, { x: W - M - tw, y: H - 22, size: 11, font: bold, color: rgb(...C.navy) });
  // Zeitraum + Datum
  const pW = font.widthOfTextAtSize(periodLabel, 8);
  page.drawText(periodLabel, { x: W - M - pW, y: H - 34, size: 8, font, color: rgb(...C.gold) });
  const eT = today;
  page.drawText(eT, { x: W - M - font.widthOfTextAtSize(eT, 7), y: H - 44, size: 7, font, color: rgb(...C.gray400) });
  // Trennlinie
  page.drawLine({ start: { x: M, y: H - 50 }, end: { x: W - M, y: H - 50 }, thickness: 0.5, color: rgb(...C.gray200) });
}

// --- Section-Titel (einfach, klar) ---
function drawSection(page: any, rgb: any, bold: any, text: string, x: number, y: number, W: number) {
  page.drawText(text, { x, y, size: 12, font: bold, color: rgb(...C.navy) });
  page.drawLine({ start: { x, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.8, color: rgb(...C.gray200) });
}

// --- Footer ---
function drawFooter(page: any, rgb: any, bold: any, font: any, W: number, cur: number, total: number) {
  page.drawLine({ start: { x: M, y: 38 }, end: { x: W - M, y: 38 }, thickness: 0.5, color: rgb(...C.gray200) });
  page.drawText("Vertraulich — BNM", { x: M, y: 24, size: 6.5, font, color: rgb(...C.gray400) });
  const mid = "neuemuslime.com";
  page.drawText(mid, { x: W / 2 - font.widthOfTextAtSize(mid, 7) / 2, y: 24, size: 7, font, color: rgb(...C.gray400) });
  const rt = `${cur} / ${total}`;
  page.drawText(rt, { x: W - M - font.widthOfTextAtSize(rt, 7), y: 24, size: 7, font, color: rgb(...C.gray400) });
}

// =====================================================================
// COVER-SEITE — Weiss, elegant, Logo-zentriert
// =====================================================================

function drawCoverPage(
  page: any, rgb: any, bold: any, font: any,
  W: number, H: number,
  reportTitle: string, subtitle: string,
  periodLabel: string, today: string,
  logoImage?: any
): number {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...C.white) });

  // Feiner Rahmen
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: rgb(...C.gray200), borderWidth: 0.8, color: rgb(...C.white) });

  // Gold-Akzent oben (schmaler Streifen am oberen Rand)
  page.drawRectangle({ x: 24, y: H - 26, width: W - 48, height: 2, color: rgb(...C.goldBright) });

  // Logo gross zentriert im oberen Drittel
  const logoCY = H - 220;
  if (logoImage) {
    page.drawImage(logoImage, { x: W / 2 - 50, y: logoCY - 50, width: 100, height: 100 });
  }

  // Gold-Linie unter Logo
  page.drawRectangle({ x: W / 2 - 50, y: logoCY - 70, width: 100, height: 1.5, color: rgb(...C.goldBright) });

  // Report-Titel
  const tSz = 28;
  const tw = bold.widthOfTextAtSize(reportTitle, tSz);
  page.drawText(reportTitle, { x: W / 2 - tw / 2, y: logoCY - 110, size: tSz, font: bold, color: rgb(...C.navy) });

  // Optionaler Subtitle
  if (subtitle) {
    const sw = font.widthOfTextAtSize(subtitle, 10);
    page.drawText(subtitle, { x: W / 2 - sw / 2, y: logoCY - 130, size: 10, font, color: rgb(...C.gray500) });
  }

  // Zeitraum
  const pSz = 16;
  const pW = bold.widthOfTextAtSize(periodLabel, pSz);
  page.drawText(periodLabel, { x: W / 2 - pW / 2, y: logoCY - 165, size: pSz, font: bold, color: rgb(...C.gold) });

  // Erstellungsdatum
  const dW = font.widthOfTextAtSize(today, 9);
  page.drawText(today, { x: W / 2 - dW / 2, y: logoCY - 185, size: 9, font, color: rgb(...C.gray400) });

  // Gold-Akzent unten
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: 2, color: rgb(...C.goldBright) });

  // Organisation unten zentriert
  const orgText = "BNM — Betreuung neuer Muslime";
  const orgW = font.widthOfTextAtSize(orgText, 8);
  page.drawText(orgText, { x: W / 2 - orgW / 2, y: 46, size: 8, font, color: rgb(...C.gray400) });
  const imanText = "neuemuslime.com";
  const imanW = font.widthOfTextAtSize(imanText, 8);
  page.drawText(imanText, { x: W / 2 - imanW / 2, y: 34, size: 8, font, color: rgb(...C.gold) });

  return logoCY - 210;
}

// =====================================================================
// KPI-KARTE (clean, minimal)
// =====================================================================

function drawKpi(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string,
  x: number, y: number, w: number, h: number
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.white), borderColor: rgb(...C.gray200), borderWidth: 0.8 });
  // Wert
  const vSz = value.length > 4 ? 18 : 22;
  const vw = bold.widthOfTextAtSize(value, vSz);
  page.drawText(value, { x: x + w / 2 - vw / 2, y: y + h / 2 + 2, size: vSz, font: bold, color: rgb(...C.navy) });
  // Label
  const lw = font.widthOfTextAtSize(label, 7.5);
  page.drawText(label, { x: x + w / 2 - lw / 2, y: y + 8, size: 7.5, font, color: rgb(...C.gray500) });
}

// --- Hero-KPI (groesser, mit Navy-Linke am linken Rand) ---
function drawHeroKpi(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string,
  x: number, y: number, w: number, h: number
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.white), borderColor: rgb(...C.gray200), borderWidth: 0.8 });
  // Navy Akzent links
  page.drawRectangle({ x, y, width: 3, height: h, color: rgb(...C.navy) });
  // Wert
  const vSz = value.length > 4 ? 24 : 30;
  const vw = bold.widthOfTextAtSize(value, vSz);
  page.drawText(value, { x: x + w / 2 - vw / 2 + 2, y: y + h / 2 + 4, size: vSz, font: bold, color: rgb(...C.navy) });
  // Label
  const lw = font.widthOfTextAtSize(label, 8);
  page.drawText(label, { x: x + w / 2 - lw / 2 + 2, y: y + 10, size: 8, font, color: rgb(...C.gray500) });
}

// =====================================================================
// DONUT-CHART
// =====================================================================

function buildDonutPath(oR: number, iR: number, sa: number, sw: number): string {
  const N = Math.max(Math.ceil(Math.abs(sw) * 30 / Math.PI), 6);
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const a = sa + sw * i / N;
    pts.push(i === 0 ? `M ${(oR * Math.cos(a)).toFixed(3)} ${(oR * Math.sin(a)).toFixed(3)}` : `L ${(oR * Math.cos(a)).toFixed(3)} ${(oR * Math.sin(a)).toFixed(3)}`);
  }
  for (let i = N; i >= 0; i--) {
    const a = sa + sw * i / N;
    pts.push(`L ${(iR * Math.cos(a)).toFixed(3)} ${(iR * Math.sin(a)).toFixed(3)}`);
  }
  pts.push("Z");
  return pts.join(" ");
}

function drawDonut(
  page: any, rgb: any, bold: any, font: any,
  segments: { label: string; value: number; color: C3 }[],
  cx: number, cy: number, outerR: number, innerR: number
) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  page.drawCircle({ x: cx, y: cy, size: outerR + 1, color: rgb(...C.gray100) });

  if (total === 0) {
    page.drawCircle({ x: cx, y: cy, size: innerR, color: rgb(...C.white) });
    const d = "\u2014";
    page.drawText(d, { x: cx - bold.widthOfTextAtSize(d, 16) / 2, y: cy - 4, size: 16, font: bold, color: rgb(...C.gray300) });
    return;
  }

  const GAP = segments.filter(s => s.value > 0).length > 1 ? 0.04 : 0;
  let ok = true;
  try {
    let ang = -Math.PI / 2;
    segments.forEach((seg) => {
      if (seg.value <= 0) return;
      const sw = (seg.value / total) * 2 * Math.PI;
      const path = buildDonutPath(outerR, innerR + 1, ang + GAP / 2, Math.max(sw - GAP, 0.02));
      page.drawSvgPath(path, { x: cx, y: cy, color: rgb(...seg.color) });
      ang += sw;
    });
  } catch { ok = false; }
  if (!ok) {
    const sorted = [...segments].filter(s => s.value > 0).sort((a, b) => b.value - a.value);
    let rem = total;
    sorted.forEach((seg) => { page.drawCircle({ x: cx, y: cy, size: outerR * Math.sqrt(rem / total), color: rgb(...seg.color) }); rem -= seg.value; });
  }
  page.drawCircle({ x: cx, y: cy, size: innerR, color: rgb(...C.white) });

  const ts = String(total);
  page.drawText(ts, { x: cx - bold.widthOfTextAtSize(ts, 14) / 2, y: cy + 1, size: 14, font: bold, color: rgb(...C.navy) });

  // Legende rechts
  const lx = cx + outerR + 20;
  segments.forEach((seg, i) => {
    const ly = cy + outerR - 6 - i * 16;
    page.drawRectangle({ x: lx, y: ly - 1, width: 8, height: 8, color: rgb(...seg.color) });
    const pct = total > 0 ? ` (${Math.round((seg.value / total) * 100)}%)` : "";
    page.drawText(`${seg.label}: ${seg.value}${pct}`, { x: lx + 13, y: ly, size: 7.5, font, color: rgb(...C.gray700) });
  });
}

// =====================================================================
// BALKENDIAGRAMME
// =====================================================================

function drawHBars(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: C3 }[],
  x: number, y: number, w: number, barH: number, gap: number
) {
  const totalV = items.reduce((s, i) => s + i.value, 0);
  if (totalV === 0) { drawEmptyState(page, rgb, bold, font, x, y - items.length * (barH + gap), w, items.length * (barH + gap) + barH); return; }
  const maxV = Math.max(...items.map(i => i.value), 1);
  const labelW = 75, barX = x + labelW, barW = w - labelW - 45;
  items.forEach((item, i) => {
    const iy = y - i * (barH + gap);
    page.drawText(item.label, { x, y: iy + 1, size: 8, font, color: rgb(...C.gray700) });
    page.drawRectangle({ x: barX, y: iy, width: barW, height: barH, color: rgb(...C.gray100) });
    if (item.value > 0) {
      const fw = Math.max(3, barW * (item.value / maxV));
      page.drawRectangle({ x: barX, y: iy, width: fw, height: barH, color: rgb(...item.color) });
    }
    page.drawText(String(item.value), { x: barX + barW + 8, y: iy + 1, size: 8, font: bold, color: rgb(...C.navy) });
  });
}

function drawVBars(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: C3 }[],
  x: number, y: number, w: number, h: number
) {
  const n = items.length;
  if (n === 0) return;
  const totalV = items.reduce((s, i) => s + i.value, 0);
  if (totalV === 0) { drawEmptyState(page, rgb, bold, font, x, y, w, h, "Noch keine Sessions erfasst"); return; }
  const maxV = Math.max(...items.map(i => i.value), 1) * 1.15;
  const gap = Math.max(16, w / (n * 2.5));
  const barW = (w - gap * (n + 1)) / n;

  // Basislinie + Gitternetz
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.5, color: rgb(...C.gray300) });
  for (let i = 1; i <= 4; i++) {
    const gy = y + (h * i) / 4;
    page.drawLine({ start: { x, y: gy }, end: { x: x + w, y: gy }, thickness: 0.3, color: rgb(...C.gray200) });
    const gv = String(Math.round((maxV * i) / 4));
    page.drawText(gv, { x: x - 5 - font.widthOfTextAtSize(gv, 6), y: gy - 3, size: 6, font, color: rgb(...C.gray400) });
  }

  items.forEach((item, i) => {
    const bx = x + gap + i * (barW + gap);
    const bh = Math.max(1, (item.value / maxV) * h);
    page.drawRectangle({ x: bx, y, width: barW, height: bh, color: rgb(...item.color) });
    const vs = String(item.value);
    page.drawText(vs, { x: bx + barW / 2 - bold.widthOfTextAtSize(vs, 9) / 2, y: y + bh + 5, size: 9, font: bold, color: rgb(...C.navy) });
    page.drawText(item.label, { x: bx + barW / 2 - font.widthOfTextAtSize(item.label, 7) / 2, y: y - 13, size: 7, font, color: rgb(...C.gray500) });
  });
}

// =====================================================================
// ABSCHLUSSQUOTE
// =====================================================================

function drawGauge(
  page: any, rgb: any, bold: any, font: any,
  completed: number, total: number,
  x: number, y: number, w: number
) {
  const pct = total > 0 ? completed / total : 0;
  const pctStr = total > 0 ? fmtPct(pct) : "\u2014";

  page.drawRectangle({ x, y, width: w, height: 80, color: rgb(...C.white), borderColor: rgb(...C.gray200), borderWidth: 0.8 });

  // Grosse Zahl zentriert
  const col = total === 0 ? C.gray300 : pct >= 0.6 ? C.accent1 : pct >= 0.3 ? C.gold : C.red;
  const pw = bold.widthOfTextAtSize(pctStr, 28);
  page.drawText(pctStr, { x: x + w / 2 - pw / 2, y: y + 46, size: 28, font: bold, color: rgb(...col) });

  // Fortschrittsbalken
  const barX = x + 20, barW = w - 40, barY = y + 22, barH = 10;
  page.drawRectangle({ x: barX, y: barY, width: barW, height: barH, color: rgb(...C.gray100) });
  if (total > 0) {
    const fill = Math.max(2, barW * Math.min(pct, 1));
    page.drawRectangle({ x: barX, y: barY, width: fill, height: barH, color: rgb(...col) });
  }

  // Labels
  page.drawText("0%", { x: barX, y: barY - 10, size: 6, font, color: rgb(...C.gray400) });
  const m100 = "100%";
  page.drawText(m100, { x: barX + barW - font.widthOfTextAtSize(m100, 6), y: barY - 10, size: 6, font, color: rgb(...C.gray400) });

  const detail = total > 0 ? `${completed} von ${total} abgeschlossen` : "Keine Betreuungen im Zeitraum";
  page.drawText(detail, { x: x + 20, y: y + 6, size: 7.5, font, color: rgb(...C.gray500) });
}

// =====================================================================
// ZUSAMMENFASSUNGS-BOX
// =====================================================================

function drawSummary(
  page: any, rgb: any, bold: any, font: any,
  text: string, y: number, W: number
): number {
  const maxW = W - 2 * M - 30;
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, 9) > maxW) { lines.push(line); line = w; }
    else { line = test; }
  }
  if (line) lines.push(line);

  const boxH = lines.length * 13 + 30;
  const boxY = y;
  // Hintergrund
  page.drawRectangle({ x: M, y: boxY - boxH, width: W - 2 * M, height: boxH, color: rgb(...C.gray50), borderColor: rgb(...C.gray200), borderWidth: 0.5 });
  // Navy-Akzent links
  page.drawRectangle({ x: M, y: boxY - boxH, width: 3, height: boxH, color: rgb(...C.navy) });

  let sy = boxY - 16;
  for (const l of lines) {
    if (sy > 50) { page.drawText(l, { x: M + 14, y: sy, size: 9, font, color: rgb(...C.gray700) }); sy -= 13; }
  }
  return sy;
}

// =====================================================================
// IMPACT-KARTE
// =====================================================================

function drawImpactCard(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string, _icon: string,
  x: number, y: number, w: number, h: number,
  accent: C3
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.white), borderColor: rgb(...C.gray200), borderWidth: 0.8 });
  page.drawRectangle({ x, y, width: 3, height: h, color: rgb(...accent) });
  const vw = bold.widthOfTextAtSize(value, 22);
  page.drawText(value, { x: x + w / 2 - vw / 2 + 2, y: y + h / 2 + 4, size: 22, font: bold, color: rgb(...C.navy) });
  const lw = font.widthOfTextAtSize(label, 8);
  page.drawText(label, { x: x + w / 2 - lw / 2 + 2, y: y + 10, size: 8, font, color: rgb(...C.gray500) });
}

// =====================================================================
// METRIK-ZEILE
// =====================================================================

function drawMetrics(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: string }[],
  x: number, y: number, w: number
) {
  const iw = w / items.length;
  page.drawRectangle({ x, y, width: w, height: 40, color: rgb(...C.gray50), borderColor: rgb(...C.gray200), borderWidth: 0.5 });
  items.forEach((item, i) => {
    const ix = x + i * iw;
    if (i > 0) page.drawLine({ start: { x: ix, y: y + 6 }, end: { x: ix, y: y + 34 }, thickness: 0.5, color: rgb(...C.gray200) });
    page.drawText(item.value, { x: ix + iw / 2 - bold.widthOfTextAtSize(item.value, 14) / 2, y: y + 18, size: 14, font: bold, color: rgb(...C.navy) });
    page.drawText(item.label, { x: ix + iw / 2 - font.widthOfTextAtSize(item.label, 6.5) / 2, y: y + 6, size: 6.5, font, color: rgb(...C.gray500) });
  });
}


// ======================================================================
// MONATSBERICHT — 4 Seiten
// ======================================================================

export async function downloadMonthlyReportPDF(data: ReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595, H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const TP = 4;
    const logo = await loadLogoPng(doc);

    const totalB = data.kpis.activeBetreuungen + data.kpis.abgeschlossen + data.kpis.neueBetreuungen;
    const totalSTyped = data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions;
    // sessions-Feld nutzen falls Typ-Aufschluesselung 0 ist (nicht alle Sessions sind kategorisiert)
    const totalSAll = Math.max(data.kpis.sessions, totalSTyped + data.kpis.nachbetreuung);
    const abschlQ = totalB > 0 ? data.kpis.abgeschlossen / totalB : 0;
    const sessPerMentee = data.kpis.mentees > 0 ? totalSAll / data.kpis.mentees : 0;
    const sessPerMentor = data.kpis.mentoren > 0 ? totalSAll / data.kpis.mentoren : 0;
    const nachbetrRate = totalSAll > 0 ? data.kpis.nachbetreuung / totalSAll : 0;

    // ===== SEITE 1: COVER =====
    const p1 = doc.addPage([W, H]);
    const belowBanner = drawCoverPage(p1, rgb, bold, font, W, H, "MONATSBERICHT", "", data.periodLabel, today, logo);

    // 4 Hero-KPIs
    let y1 = belowBanner - 10;
    const hW = 115, hH = 70, hG = 10;
    const htw = 4 * hW + 3 * hG;
    const hsx = (W - htw) / 2;
    const heroes: [string, string][] = [
      [String(totalB), "Betreuungen gesamt"],
      [String(totalSAll), "Sessions gesamt"],
      [String(data.kpis.mentoren), "Aktive Mentoren"],
      [totalB > 0 ? fmtPct(abschlQ) : "\u2014", "Abschlussquote"],
    ];
    heroes.forEach(([v, l], i) => {
      drawHeroKpi(p1, rgb, bold, font, v, l, hsx + i * (hW + hG), y1 - hH, hW, hH);
    });

    // Zusammenfassung
    const sumTop = y1 - hH - 28;
    drawSection(p1, rgb, bold, "Zusammenfassung", M, sumTop, W);
    drawSummary(p1, rgb, bold, font, data.summaryText, sumTop - 14, W);

    // Kein drawFooter — Cover hat eigenen Footer (Rahmen + Org-Text)

    // ===== SEITE 2: KPI-DASHBOARD =====
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today, logo);

    let y2 = H - 66;
    drawSection(p2, rgb, bold, "Kennzahlen", M, y2, W);

    const kpis: [string, string][] = [
      [String(totalB), "Betreuungen gesamt"], [String(data.kpis.activeBetreuungen), "Aktive Betreuungen"],
      [String(data.kpis.abgeschlossen), "Abgeschlossen"], [String(data.kpis.neueBetreuungen), "Neue Betreuungen"],
      [String(data.kpis.mentoren), "Mentoren"], [String(data.kpis.mentees), "Mentees"],
      [String(totalSAll), "Sessions gesamt"], [String(data.kpis.nachbetreuung), "Nachbetreuung"],
    ];
    const KW = 117, KH = 48, KG = 8;
    const ktw = 4 * KW + 3 * KG, ksx = (W - ktw) / 2;
    kpis.forEach(([v, l], i) => {
      const c = i % 4, r = Math.floor(i / 4);
      drawKpi(p2, rgb, bold, font, v, l, ksx + c * (KW + KG), y2 - 16 - (r + 1) * (KH + KG) + KG, KW, KH);
    });

    const afterKpi = y2 - 16 - 2 * (KH + KG) - 12;

    // Betreuungs-Status + Session-Verteilung nebeneinander
    drawSection(p2, rgb, bold, "Betreuungs-Status", M, afterKpi, W / 2 + 20);
    drawDonut(p2, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeBetreuungen, color: C.accent1 },
      { label: "Abgeschlossen", value: data.kpis.abgeschlossen, color: C.navy },
      { label: "Neu", value: data.kpis.neueBetreuungen, color: C.gold },
    ], M + 60, afterKpi - 82, 44, 24);

    drawSection(p2, rgb, bold, "Session-Verteilung", 300, afterKpi, W);
    drawHBars(p2, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.accent2 },
      { label: "Salah", value: data.kpis.salahSessions, color: C.accent1 },
      { label: "Koran", value: data.kpis.koranSessions, color: C.navy },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.gold },
    ], 300, afterKpi - 30, W - M - 300, 10, 24);

    const afterCharts = afterKpi - 146;

    // Mentor des Monats
    if (data.mentorOfMonth) {
      drawSection(p2, rgb, bold, "Mentor des Monats", M, afterCharts, W);
      const mcY = afterCharts - 14;
      page_drawMentor(p2, rgb, bold, font, data.mentorOfMonth, M, mcY - 40, W - 2 * M, 40);
    }

    // Analyse-Metriken
    const amY = data.mentorOfMonth ? afterCharts - 72 : afterCharts - 10;
    drawSection(p2, rgb, bold, "Analyse", M, amY, W);
    drawMetrics(p2, rgb, bold, font, [
      { label: "Sessions / Mentee", value: fmtDe(sessPerMentee) },
      { label: "Sessions / Mentor", value: fmtDe(sessPerMentor) },
      { label: "Nachbetreuungs-Rate", value: fmtPct(nachbetrRate) },
    ], M, amY - 52, W - 2 * M);

    drawFooter(p2, rgb, bold, font, W, 2, TP);

    // ===== SEITE 3: SESSION-ANALYSE =====
    const p3 = doc.addPage([W, H]);
    drawPageBg(p3, rgb, W, H);
    drawPageHeader(p3, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today, logo);

    let y3 = H - 66;
    drawSection(p3, rgb, bold, "Sessions nach Typ", M, y3, W);
    drawVBars(p3, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.accent2 },
      { label: "Salah", value: data.kpis.salahSessions, color: C.accent1 },
      { label: "Koran", value: data.kpis.koranSessions, color: C.navy },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.gold },
    ], M + 30, y3 - 175, W - 2 * M - 30, 130);

    const afterBars = y3 - 200;

    // Top 5 Mentoren
    drawSection(p3, rgb, bold, "Top 5 Mentoren", M, afterBars, W);
    const top5 = data.rankings.slice(0, 5);
    if (top5.length === 0) {
      drawEmptyState(p3, rgb, bold, font, M, afterBars - 60, W - 2 * M, 44, "Keine Mentor-Daten vorhanden");
    } else {
      const maxSc = Math.max(...top5.map(m => m.score), 1);
      top5.forEach((m, i) => {
        const my = afterBars - 20 - i * 30;
        // Rang
        const rankStr = String(m.rank);
        p3.drawText(rankStr, { x: M + 8 - bold.widthOfTextAtSize(rankStr, 9) / 2, y: my + 2, size: 9, font: bold, color: i < 3 ? rgb(...C.navy) : rgb(...C.gray500) });
        // Name
        p3.drawText(m.name, { x: M + 22, y: my + 8, size: 8.5, font: bold, color: rgb(...C.gray800) });
        // Fortschrittsbalken
        const bx = M + 22, bw = W - 2 * M - 70;
        p3.drawRectangle({ x: bx, y: my - 2, width: bw, height: 7, color: rgb(...C.gray100) });
        const fw = Math.max(3, bw * (m.score / maxSc));
        p3.drawRectangle({ x: bx, y: my - 2, width: fw, height: 7, color: i === 0 ? rgb(...C.navy) : rgb(...C.accent1) });
        // Score
        const st = `${m.score}`;
        p3.drawText(st, { x: W - M - bold.widthOfTextAtSize(st, 8), y: my, size: 8, font: bold, color: rgb(...C.navy) });
      });
    }

    // Abschlussquote
    const gaugeY = top5.length > 0 ? afterBars - 20 - Math.max(top5.length, 1) * 30 - 20 : afterBars - 80;
    drawSection(p3, rgb, bold, "Abschlussquote", M, gaugeY, W);
    drawGauge(p3, rgb, bold, font, data.kpis.abgeschlossen, totalB, M, gaugeY - 94, W - 2 * M);

    drawFooter(p3, rgb, bold, font, W, 3, TP);

    // ===== SEITE 4: RANGLISTE =====
    const p4 = doc.addPage([W, H]);
    drawPageBg(p4, rgb, W, H);
    drawPageHeader(p4, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today, logo);

    let y4 = H - 66;
    drawSection(p4, rgb, bold, "Mentor-Rangliste", M, y4, W);

    const maxRows = Math.min(data.rankings.length, 15);
    if (maxRows === 0) {
      drawEmptyState(p4, rgb, bold, font, M, y4 - 60, W - 2 * M, 44, "Keine Mentor-Daten vorhanden");
    } else {
      // Tabellenkopf (genug Abstand zur Section-Linie)
      let ty = y4 - 22;
      p4.drawRectangle({ x: M, y: ty, width: W - 2 * M, height: 18, color: rgb(...C.navy) });
      const cols = [M + 8, M + 30, M + 210, M + 285, M + 355, M + 420];
      ["#", "Name", "Score", "Sessions", "Abschl.", "Bewertung"].forEach((h, i) => {
        p4.drawText(h, { x: cols[i], y: ty + 5, size: 7, font: bold, color: rgb(...C.white) });
      });
      ty -= 18;

      data.rankings.slice(0, maxRows).forEach((m, i) => {
        const rowBg = i % 2 === 0 ? rgb(...C.white) : rgb(...C.gray50);
        p4.drawRectangle({ x: M, y: ty, width: W - 2 * M, height: 17, color: rowBg });
        const isTop = m.rank <= 3;
        const fn = isTop ? bold : font;
        const tc = isTop ? rgb(...C.navy) : rgb(...C.gray700);
        p4.drawText(String(m.rank), { x: cols[0], y: ty + 5, size: 7.5, font: fn, color: tc });
        const name = m.name.length > 22 ? m.name.slice(0, 20) + "..." : m.name;
        p4.drawText(name, { x: cols[1], y: ty + 5, size: 7.5, font: fn, color: tc });
        [String(m.score), String(m.sessions), String(m.completed)].forEach((v, vi) => {
          p4.drawText(v, { x: cols[vi + 2] + 30 - font.widthOfTextAtSize(v, 7.5), y: ty + 5, size: 7.5, font, color: rgb(...C.gray700) });
        });
        const rStr = m.rating !== null ? m.rating.toFixed(1) : "\u2014";
        p4.drawText(rStr, { x: cols[5] + 30 - font.widthOfTextAtSize(rStr, 7.5), y: ty + 5, size: 7.5, font, color: rgb(...C.gray700) });
        ty -= 17;
      });
      p4.drawLine({ start: { x: M, y: ty }, end: { x: W - M, y: ty }, thickness: 0.8, color: rgb(...C.navy) });
    }

    // Zusammenfassung
    const sumY4 = maxRows > 0 ? y4 - 22 - 18 - maxRows * 17 - 24 : y4 - 120;
    drawSection(p4, rgb, bold, "Zusammenfassung", M, sumY4, W);
    drawSummary(p4, rgb, bold, font, data.summaryText, sumY4 - 14, W);

    drawFooter(p4, rgb, bold, font, W, 4, TP);

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Monatsbericht-" + data.period + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}

// --- Mentor des Monats Karte (intern) ---
function page_drawMentor(
  page: any, rgb: any, bold: any, font: any,
  mom: { name: string; score: number; sessions: number; completed: number },
  x: number, y: number, w: number, h: number
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.white), borderColor: rgb(...C.gray200), borderWidth: 0.8 });
  page.drawRectangle({ x, y, width: 3, height: h, color: rgb(...C.goldBright) });
  page.drawText(mom.name, { x: x + 14, y: y + h / 2 + 4, size: 13, font: bold, color: rgb(...C.navy) });
  const stats = `${mom.score} Punkte  \u00B7  ${mom.completed} Abschluesse  \u00B7  ${mom.sessions} Sessions`;
  page.drawText(stats, { x: x + 14, y: y + h / 2 - 12, size: 8, font, color: rgb(...C.gray500) });
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
    const AW = 595, AH = 842, acx = AW / 2;

    const aPage = aDoc.addPage([AW, AH]);
    aPage.drawRectangle({ x: 30, y: 30, width: AW - 60, height: AH - 60, borderColor: rgb(...C.goldBright), borderWidth: 3 });
    aPage.drawText("BNM", { x: acx - aBold.widthOfTextAtSize("BNM", 36) / 2, y: AH - 120, size: 36, font: aBold, color: rgb(...C.goldBright) });
    aPage.drawText("BETREUUNG NEUER MUSLIME", { x: acx - aFont.widthOfTextAtSize("BETREUUNG NEUER MUSLIME", 8) / 2, y: AH - 140, size: 8, font: aFont, color: rgb(...C.gray500) });
    aPage.drawRectangle({ x: acx - 30, y: AH - 170, width: 60, height: 3, color: rgb(...C.goldBright) });
    aPage.drawText("AUSZEICHNUNG", { x: acx - aFont.widthOfTextAtSize("AUSZEICHNUNG", 10) / 2, y: AH - 200, size: 10, font: aFont, color: rgb(...C.gray500) });
    aPage.drawText("Mentor des Monats", { x: acx - aBold.widthOfTextAtSize("Mentor des Monats", 24) / 2, y: AH - 240, size: 24, font: aBold, color: rgb(...C.navy) });
    aPage.drawText(data.period, { x: acx - aFont.widthOfTextAtSize(data.period, 12) / 2, y: AH - 265, size: 12, font: aFont, color: rgb(...C.gray500) });
    aPage.drawRectangle({ x: acx - 30, y: AH - 290, width: 60, height: 3, color: rgb(...C.goldBright) });
    aPage.drawText(data.mentorName, { x: acx - aBold.widthOfTextAtSize(data.mentorName, 28) / 2, y: AH - 340, size: 28, font: aBold, color: rgb(...C.goldBright) });

    [[String(data.score), "Punkte"], [String(data.completed), "Abschluesse"], [String(data.sessions), "Sessions"]].forEach((pair, i) => {
      const asx = 120 + i * 140;
      aPage.drawRectangle({ x: asx, y: AH - 430, width: 110, height: 50, borderColor: rgb(...C.gray200), borderWidth: 1 });
      aPage.drawText(pair[0], { x: asx + 55 - aBold.widthOfTextAtSize(pair[0], 20) / 2, y: AH - 410, size: 20, font: aBold, color: rgb(...C.navy) });
      aPage.drawText(pair[1], { x: asx + 55 - aFont.widthOfTextAtSize(pair[1], 8) / 2, y: AH - 425, size: 8, font: aFont, color: rgb(...C.gray500) });
    });

    aPage.drawRectangle({ x: acx - 30, y: AH - 470, width: 60, height: 3, color: rgb(...C.goldBright) });
    aPage.drawText("BNM - Betreuung neuer Muslime - neuemuslime.com", { x: acx - aFont.widthOfTextAtSize("BNM - Betreuung neuer Muslime - neuemuslime.com", 8) / 2, y: AH - 500, size: 8, font: aFont, color: rgb(...C.gray400) });

    return await aDoc.save();
  } catch { return null; }
}

export async function downloadMentorAwardPDF(data: AwardData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const bytes = await generateMentorAwardPDFBytes(data);
    if (!bytes) return false;
    triggerDownload(bytes, "BNM-Mentor-des-Monats-" + data.period + ".pdf");
    return true;
  } catch (err) { if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err)); return false; }
}

export async function downloadMentorAwardPNG(data: AwardData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const SCALE = 2, W = 595, H = 842, cx = W / 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#FFFDF5"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#EEA71B"; ctx.lineWidth = 3; ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.lineWidth = 1; ctx.strokeRect(38, 38, W - 76, H - 76);
    ctx.fillStyle = "#EEA71B";
    [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]].forEach(c => ctx.fillRect(c[0] - 5, c[1] - 5, 10, 10));
    ctx.fillStyle = "#101828"; ctx.fillRect(30, 30, W - 60, 110);
    ctx.fillStyle = "#EEA71B"; ctx.font = "bold 34px Georgia, serif"; ctx.textAlign = "center"; ctx.fillText("BNM", cx, 90);
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "9px Arial, sans-serif"; ctx.fillText("BETREUUNG NEUER MUSLIME", cx, 112);
    ctx.fillStyle = "#EEA71B"; ctx.fillRect(30, 140, W - 60, 3);
    ctx.fillStyle = "#EEA71B"; ctx.font = "22px Arial"; ctx.fillText("*  *  *  *  *", cx, 182);
    ctx.fillStyle = "#9CA3AF"; ctx.font = "bold 9px Arial, sans-serif"; ctx.fillText("A U S Z E I C H N U N G", cx, 208);
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
    stats.forEach((pair, i) => {
      const sx = cx - 140 + i * 140;
      if (i > 0) { ctx.strokeStyle = "#E5E7EB"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 20, 355); ctx.lineTo(sx - 20, 415); ctx.stroke(); }
      ctx.fillStyle = "#101828"; ctx.font = "bold 28px Arial, sans-serif"; ctx.textAlign = "center"; ctx.fillText(pair[0], sx, 392);
      ctx.fillStyle = "#9CA3AF"; ctx.font = "bold 8px Arial, sans-serif"; ctx.fillText(pair[1], sx, 412);
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
// SPENDERBERICHT — 3 Seiten
// ======================================================================

export async function downloadDonorReportPDF(data: DonorReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595, H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const TP = 3;
    const logo = await loadLogoPng(doc);

    const totalSess = data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions + (data.kpis.nachbetreuungSessions || 0);
    const totalMentees = data.kpis.activeMentorships + data.kpis.completedInPeriod;

    // ===== SEITE 1: COVER =====
    const p1 = doc.addPage([W, H]);
    const below = drawCoverPage(p1, rgb, bold, font, W, H, "SPENDERBERICHT", "Wirkungsbericht für Förderer", data.periodLabel, today, logo);

    let y1 = below - 10;
    const hW = 115, hH = 70, hG = 10;
    const htw = 4 * hW + 3 * hG, hsx = (W - htw) / 2;
    const dHeroes: [string, string][] = [
      [String(totalMentees), "Mentees betreut"],
      [String(totalSess), "Sessions gesamt"],
      [String(data.kpis.bnmBoxes), "BNM-Boxen verteilt"],
      [String(data.kpis.activeMentors), "Aktive Mentoren"],
    ];
    dHeroes.forEach(([v, l], i) => {
      drawHeroKpi(p1, rgb, bold, font, v, l, hsx + i * (hW + hG), y1 - hH, hW, hH);
    });

    const dSumTop = y1 - hH - 28;
    drawSection(p1, rgb, bold, "Zusammenfassung", M, dSumTop, W);
    drawSummary(p1, rgb, bold, font, data.summaryText, dSumTop - 14, W);

    // Kein drawFooter — Cover hat eigenen Footer

    // ===== SEITE 2: KENNZAHLEN =====
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today, logo);

    let y2 = H - 66;
    drawSection(p2, rgb, bold, "Kennzahlen", M, y2, W);

    const dk: [string, string][] = [
      [String(data.kpis.activeMentorships), "Aktive Betreuungen"], [String(data.kpis.newRegistrations), "Neue Registrierungen"],
      [String(data.kpis.completedInPeriod), "Abgeschlossen"], [String(data.kpis.bnmBoxes), "BNM-Boxen"],
      [String(data.kpis.activeMentors), "Aktive Mentoren"], [String(data.kpis.wuduSessions), "Wudu Sessions"],
      [String(data.kpis.salahSessions), "Salah Sessions"], [String(data.kpis.koranSessions), "Koran Sessions"],
    ];
    const dkW = 117, dkH = 48, dkG = 8;
    const dktw = 4 * dkW + 3 * dkG, dksx = (W - dktw) / 2;
    dk.forEach(([v, l], i) => {
      const c = i % 4, r = Math.floor(i / 4);
      drawKpi(p2, rgb, bold, font, v, l, dksx + c * (dkW + dkG), y2 - 16 - (r + 1) * (dkH + dkG) + dkG, dkW, dkH);
    });

    const dAfterKpi = y2 - 16 - 2 * (dkH + dkG) - 12;

    // Session-Verteilung
    drawSection(p2, rgb, bold, "Session-Verteilung", M, dAfterKpi, W);
    const sessItems = data.sessionDistribution?.items ?? [];
    const displayItems = sessItems.length > 0 ? sessItems : [
      { label: "Wudu", value: data.kpis.wuduSessions },
      { label: "Salah", value: data.kpis.salahSessions },
      { label: "Koran", value: data.kpis.koranSessions },
    ];
    const barCols: C3[] = [C.accent2, C.accent1, C.navy, C.gold];
    drawVBars(p2, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value, color: barCols[i % barCols.length],
      })),
      M + 30, dAfterKpi - 170, W - 2 * M - 30, 130
    );

    // Donut
    const doY = dAfterKpi - 200;
    drawSection(p2, rgb, bold, "Betreuungs-Status", M, doY, W);
    drawDonut(p2, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeMentorships, color: C.accent1 },
      { label: "Abgeschlossen", value: data.kpis.completedInPeriod, color: C.navy },
      { label: "BNM-Boxen", value: data.kpis.bnmBoxes, color: C.gold },
    ], M + 60, doY - 55, 32, 17);

    drawFooter(p2, rgb, bold, font, W, 2, TP);

    // ===== SEITE 3: IMPACT =====
    const p3 = doc.addPage([W, H]);
    drawPageBg(p3, rgb, W, H);
    drawPageHeader(p3, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today, logo);

    let y3 = H - 66;
    drawSection(p3, rgb, bold, "Wirkung & Impact", M, y3, W);

    const ICW = (W - 2 * M - 12) / 2, ICH = 60;
    drawImpactCard(p3, rgb, bold, font, String(totalMentees), "Mentees betreut", "M", M, y3 - 16 - ICH, ICW, ICH, C.accent1);
    drawImpactCard(p3, rgb, bold, font, String(totalSess), "Sessions durchgefuehrt", "S", M + ICW + 12, y3 - 16 - ICH, ICW, ICH, C.accent2);
    drawImpactCard(p3, rgb, bold, font, String(data.kpis.bnmBoxes), "BNM-Boxen verteilt", "B", M, y3 - 16 - 2 * ICH - 12, ICW, ICH, C.gold);
    drawImpactCard(p3, rgb, bold, font, String(data.kpis.activeMentors), "Aktive Mentoren", "A", M + ICW + 12, y3 - 16 - 2 * ICH - 12, ICW, ICH, C.navy);

    const iAfter = y3 - 16 - 2 * ICH - 30;

    // Session-Details
    drawSection(p3, rgb, bold, "Session-Details", M, iAfter, W);
    drawHBars(p3, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value, color: barCols[i % barCols.length],
      })),
      M, iAfter - 26, W - 2 * M, 10, 22
    );

    // Zusammenfassung
    const sAfter = iAfter - 26 - displayItems.length * 32 - 16;
    drawSection(p3, rgb, bold, "Zusammenfassung", M, sAfter, W);
    drawSummary(p3, rgb, bold, font, data.summaryText, sAfter - 14, W);

    drawFooter(p3, rgb, bold, font, W, 3, TP);

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Spenderbericht-" + data.periodLabel + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}
