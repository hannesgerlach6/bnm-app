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
// PDF-Generator fuer BNM-Berichte — Professionelles Design
// ============================================================

// --- Interfaces (100% abwaertskompatibel) ----------------------------

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

// =====================================================================
// FARB-PALETTE — Professionelles BNM-Branding
// =====================================================================

type C3 = [number, number, number];

function hexC3(hex: string): C3 {
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}

const C = {
  // Brand
  navy:        hexC3("#0A3A5A"),
  navyLight:   hexC3("#0E4D73"),
  navyDark:    hexC3("#072B44"),
  gold:        hexC3("#EEA71B"),
  goldLight:   hexC3("#F5C254"),
  goldMuted:   hexC3("#D4960F"),
  green:       hexC3("#0D9C6E"),
  greenLight:  hexC3("#10B981"),
  // Akzent
  blue:        hexC3("#3182CE"),
  blueLight:   hexC3("#63B3ED"),
  purple:      hexC3("#8B5CF6"),
  red:         hexC3("#DC2626"),
  orange:      hexC3("#E6862A"),
  teal:        hexC3("#0D9488"),
  // Hintergrund
  bg:          hexC3("#F8F7F4"),
  card:        [1, 1, 1] as C3,
  summaryBg:   hexC3("#FEFCF3"),
  highlightBg: hexC3("#F0F7FF"),
  // Text
  textDark:    hexC3("#0F1923"),
  textBody:    hexC3("#334155"),
  textMuted:   hexC3("#64748B"),
  textLight:   hexC3("#94A3B8"),
  white:       [1, 1, 1] as C3,
  // Borders
  border:      hexC3("#E2E8F0"),
  divider:     hexC3("#CBD5E1"),
  // Tabelle
  rowAlt:      hexC3("#F1F5F9"),
  barBg:       hexC3("#E8ECF0"),
  // Shadow (simuliert)
  shadow:      hexC3("#D5DAE0"),
  // Medaillen
  silver:      hexC3("#94A3B8"),
  bronze:      hexC3("#CD7F32"),
  // Cover-Texte (auf Navy-Hintergrund)
  coverText:   hexC3("#B8CCD9"),
  coverSub:    hexC3("#7A9BB5"),
};

// --- Hilfsfunktionen --------------------------------------------------

function fmtDe(n: number, d: number = 1): string {
  return n.toFixed(d).replace(".", ",");
}
function fmtPct(n: number): string {
  return Math.round(n * 100) + "%";
}

// =====================================================================
// GRUNDLEGENDE ZEICHEN-HELFER
// =====================================================================

function drawPageBg(page: any, rgb: any, W: number, H: number) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...C.bg) });
}

async function loadLogoPng(doc: any): Promise<any | null> {
  try {
    const resp = await fetch(require("../assets/images/bnm-logo.png"));
    const buf = await resp.arrayBuffer();
    return await doc.embedPng(new Uint8Array(buf));
  } catch { return null; }
}

function drawGoldDivider(page: any, rgb: any, y: number, W: number, mx: number = 40) {
  page.drawRectangle({ x: mx, y, width: W - 2 * mx, height: 1.5, color: rgb(...C.gold) });
}

function drawCardShadow(page: any, rgb: any, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x: x + 2, y: y - 2, width: w, height: h, color: rgb(...C.shadow) });
}

// =====================================================================
// DONUT-CHART — Echte Segmente via SVG-Pfade
// =====================================================================

function buildDonutSegmentPath(
  outerR: number, innerR: number, startAngle: number, sweepAngle: number
): string {
  // Approximiere Kreisboegen mit vielen kleinen Liniensegmenten
  const N = Math.max(Math.ceil(Math.abs(sweepAngle) * 30 / Math.PI), 6);
  const pts: string[] = [];
  // Aeusserer Bogen
  for (let i = 0; i <= N; i++) {
    const a = startAngle + sweepAngle * i / N;
    const x = outerR * Math.cos(a);
    const y = outerR * Math.sin(a);
    pts.push(i === 0 ? `M ${x.toFixed(3)} ${y.toFixed(3)}` : `L ${x.toFixed(3)} ${y.toFixed(3)}`);
  }
  // Innerer Bogen (rueckwaerts)
  for (let i = N; i >= 0; i--) {
    const a = startAngle + sweepAngle * i / N;
    const x = innerR * Math.cos(a);
    const y = innerR * Math.sin(a);
    pts.push(`L ${x.toFixed(3)} ${y.toFixed(3)}`);
  }
  pts.push("Z");
  return pts.join(" ");
}

function drawProDonutChart(
  page: any, rgb: any, bold: any, font: any,
  segments: { label: string; value: number; color: C3 }[],
  cx: number, cy: number, outerR: number, innerR: number,
  opts?: { showLegend?: boolean; legendX?: number }
) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const showLegend = opts?.showLegend !== false;

  // Hintergrundring
  page.drawCircle({ x: cx, y: cy, size: outerR + 1, color: rgb(...C.barBg) });

  if (total === 0) {
    page.drawCircle({ x: cx, y: cy, size: innerR, color: rgb(...C.card) });
    const z = "0";
    page.drawText(z, { x: cx - bold.widthOfTextAtSize(z, 18) / 2, y: cy - 4, size: 18, font: bold, color: rgb(...C.navy) });
    return;
  }

  const nonZero = segments.filter(s => s.value > 0);
  const GAP = nonZero.length > 1 ? 0.04 : 0; // Luecke zwischen Segmenten

  // SVG-Pfad-Ansatz (echte Kreissegmente)
  let svgOk = true;
  try {
    let angle = -Math.PI / 2; // Start: 12 Uhr
    nonZero.forEach((seg) => {
      const sweep = (seg.value / total) * 2 * Math.PI;
      const drawStart = angle + GAP / 2;
      const drawSweep = Math.max(sweep - GAP, 0.02);
      const path = buildDonutSegmentPath(outerR, innerR + 1, drawStart, drawSweep);
      page.drawSvgPath(path, { x: cx, y: cy, color: rgb(...seg.color) });
      angle += sweep;
    });
  } catch {
    svgOk = false;
  }

  // Fallback: gestapelte Kreise (falls SVG fehlschlaegt)
  if (!svgOk) {
    page.drawCircle({ x: cx, y: cy, size: outerR, color: rgb(...C.barBg) });
    const sorted = [...nonZero].sort((a, b) => b.value - a.value);
    let rem = total;
    sorted.forEach((seg) => {
      const r = outerR * Math.sqrt(rem / total);
      page.drawCircle({ x: cx, y: cy, size: r, color: rgb(...seg.color) });
      rem -= seg.value;
    });
  }

  // Innerer Kreis (Donut-Loch)
  page.drawCircle({ x: cx, y: cy, size: innerR, color: rgb(...C.card) });

  // Zentraler Text
  const ts = String(total);
  const fs = innerR > 22 ? 16 : innerR > 15 ? 13 : 10;
  page.drawText(ts, { x: cx - bold.widthOfTextAtSize(ts, fs) / 2, y: cy + 2, size: fs, font: bold, color: rgb(...C.navy) });
  const gl = "Gesamt";
  page.drawText(gl, { x: cx - font.widthOfTextAtSize(gl, 5.5) / 2, y: cy - 9, size: 5.5, font, color: rgb(...C.textMuted) });

  // Legende
  if (showLegend) {
    const lx = opts?.legendX ?? cx + outerR + 18;
    segments.forEach((seg, i) => {
      const ly = cy + outerR - 4 - i * 18;
      page.drawCircle({ x: lx, y: ly + 2, size: 4, color: rgb(...seg.color) });
      page.drawText(seg.label, { x: lx + 10, y: ly + 1, size: 8, font: bold, color: rgb(...C.textDark) });
      const pct = Math.round((seg.value / total) * 100);
      page.drawText(`${seg.value} (${pct}%)`, { x: lx + 10, y: ly - 9, size: 7, font, color: rgb(...seg.color) });
    });
  }
}

// =====================================================================
// KPI-KARTEN
// =====================================================================

function drawProKpiCard(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string,
  x: number, y: number, w: number, h: number,
  accent: C3
) {
  drawCardShadow(page, rgb, x, y - h, w, h);
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: rgb(...C.card), borderColor: rgb(...C.border), borderWidth: 0.5 });
  // Farbiger Akzentstreifen oben
  page.drawRectangle({ x: x + 0.5, y: y - 3, width: w - 1, height: 3, color: rgb(...accent) });
  // Wert
  const vSz = value.length > 4 ? 16 : 20;
  page.drawText(value, { x: x + 12, y: y - 26, size: vSz, font: bold, color: rgb(...C.navy) });
  // Label
  const lSz = label.length > 18 ? 6.5 : 7.5;
  page.drawText(label, { x: x + 12, y: y - 40, size: lSz, font, color: rgb(...C.textMuted) });
}

// --- Hero-KPI (groesser, fuer Cover-Seite) ----------------------------

function drawHeroKpiCard(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string,
  x: number, y: number, w: number, h: number,
  accent: C3
) {
  drawCardShadow(page, rgb, x, y - h, w, h);
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: rgb(...C.card), borderColor: rgb(...C.border), borderWidth: 0.5 });
  page.drawRectangle({ x: x + 0.5, y: y - 4, width: w - 1, height: 4, color: rgb(...accent) });
  // Icon-Kreis
  page.drawCircle({ x: x + 20, y: y - 20, size: 8, color: rgb(...accent) });
  // Wert gross + zentriert
  const vSz = value.length > 4 ? 22 : 28;
  const vw = bold.widthOfTextAtSize(value, vSz);
  page.drawText(value, { x: x + w / 2 - vw / 2, y: y - 40, size: vSz, font: bold, color: rgb(...C.navy) });
  // Label
  const lw = font.widthOfTextAtSize(label, 8);
  page.drawText(label, { x: x + w / 2 - lw / 2, y: y - 56, size: 8, font, color: rgb(...C.textMuted) });
}

// =====================================================================
// BALKENDIAGRAMME
// =====================================================================

function drawHorizontalBars(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: C3 }[],
  x: number, y: number, totalW: number, barH: number, gap: number
) {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  const labelW = 80;
  const valueW = 40;
  const barX = x + labelW;
  const barW = totalW - labelW - valueW - 10;

  items.forEach((item, i) => {
    const iy = y - i * (barH + gap);
    page.drawText(item.label, { x, y: iy + 1, size: 8, font, color: rgb(...C.textDark) });
    page.drawRectangle({ x: barX, y: iy - 1, width: barW, height: barH, color: rgb(...C.barBg) });
    const fillW = maxVal > 0 ? Math.max(4, barW * (item.value / maxVal)) : 4;
    page.drawRectangle({ x: barX, y: iy - 1, width: fillW, height: barH, color: rgb(...item.color) });
    page.drawText(String(item.value), { x: barX + barW + 8, y: iy, size: 9, font: bold, color: rgb(...C.navy) });
  });
}

function drawVerticalBarChart(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: number; color: C3 }[],
  x: number, y: number, w: number, h: number
) {
  const n = items.length;
  if (n === 0) return;
  const maxVal = Math.max(...items.map(i => i.value), 1) * 1.15;
  const gap = Math.max(14, w / (n * 3));
  const barW = (w - gap * (n + 1)) / n;

  // Basislinie
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.8, color: rgb(...C.divider) });

  // Gitternetz
  for (let i = 1; i <= 4; i++) {
    const gy = y + (h * i) / 4;
    page.drawLine({ start: { x, y: gy }, end: { x: x + w, y: gy }, thickness: 0.3, color: rgb(...C.border) });
    const gv = String(Math.round((maxVal * i) / 4));
    page.drawText(gv, { x: x - 4 - font.widthOfTextAtSize(gv, 6), y: gy - 3, size: 6, font, color: rgb(...C.textLight) });
  }

  items.forEach((item, i) => {
    const bx = x + gap + i * (barW + gap);
    const bh = maxVal > 0 ? Math.max(2, (item.value / maxVal) * h) : 2;
    // Schatten
    page.drawRectangle({ x: bx + 1.5, y: y - 1.5, width: barW, height: bh, color: rgb(...C.shadow) });
    // Balken
    page.drawRectangle({ x: bx, y, width: barW, height: bh, color: rgb(...item.color) });
    // Wert oben
    const vs = String(item.value);
    const vw = bold.widthOfTextAtSize(vs, 9);
    page.drawText(vs, { x: bx + barW / 2 - vw / 2, y: y + bh + 6, size: 9, font: bold, color: rgb(...C.navy) });
    // Label unten
    const lw = font.widthOfTextAtSize(item.label, 7);
    page.drawText(item.label, { x: bx + barW / 2 - lw / 2, y: y - 14, size: 7, font, color: rgb(...C.textMuted) });
  });
}

// =====================================================================
// ABSCHLUSSQUOTE-GAUGE
// =====================================================================

function drawCompletionGauge(
  page: any, rgb: any, bold: any, font: any,
  completed: number, total: number,
  x: number, y: number, w: number
) {
  const pct = total > 0 ? completed / total : 0;
  const pctStr = fmtPct(pct);

  drawCardShadow(page, rgb, x, y - 10, w, 90);
  page.drawRectangle({ x, y: y - 10, width: w, height: 90, color: rgb(...C.card), borderColor: rgb(...C.border), borderWidth: 0.5 });

  page.drawText("Abschlussquote", { x: x + 14, y: y + 62, size: 11, font: bold, color: rgb(...C.navy) });

  // Grosser Prozentwert
  const col = pct >= 0.6 ? C.green : pct >= 0.3 ? C.gold : C.red;
  const pw = bold.widthOfTextAtSize(pctStr, 32);
  page.drawText(pctStr, { x: x + w / 2 - pw / 2, y: y + 26, size: 32, font: bold, color: rgb(...col) });

  // Farb-Gauge
  const barY = y + 6;
  const barH = 12;
  const barX = x + 24;
  const barW = w - 48;
  const third = barW / 3;
  page.drawRectangle({ x: barX, y: barY, width: third, height: barH, color: rgb(...C.red) });
  page.drawRectangle({ x: barX + third, y: barY, width: third, height: barH, color: rgb(...C.gold) });
  page.drawRectangle({ x: barX + 2 * third, y: barY, width: third, height: barH, color: rgb(...C.green) });

  // Marker
  const mx = barX + barW * Math.min(pct, 1);
  page.drawRectangle({ x: mx - 4, y: barY + barH + 3, width: 8, height: 7, color: rgb(...C.navy) });

  // Labels
  page.drawText("0%", { x: barX, y: barY - 12, size: 6, font, color: rgb(...C.textMuted) });
  const m50 = "50%";
  page.drawText(m50, { x: barX + barW / 2 - font.widthOfTextAtSize(m50, 6) / 2, y: barY - 12, size: 6, font, color: rgb(...C.textMuted) });
  const m100 = "100%";
  page.drawText(m100, { x: barX + barW - font.widthOfTextAtSize(m100, 6), y: barY - 12, size: 6, font, color: rgb(...C.textMuted) });

  page.drawText(`${completed} von ${total} abgeschlossen`, { x: barX, y: barY - 26, size: 7.5, font, color: rgb(...C.textMuted) });
}

// =====================================================================
// ZUSAMMENFASSUNGS-BOX
// =====================================================================

function drawSummaryBox(
  page: any, rgb: any, bold: any, font: any,
  summaryText: string, startY: number, W: number
): number {
  const maxW = W - 120;
  const words = summaryText.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, 9) > maxW) { lines.push(line); line = w; }
    else { line = test; }
  }
  if (line) lines.push(line);

  const boxH = lines.length * 14 + 42;
  const boxY = startY - 8;

  page.drawRectangle({ x: 40, y: boxY - boxH, width: W - 80, height: boxH, color: rgb(...C.summaryBg), borderColor: rgb(...C.gold), borderWidth: 1.5 });
  // Gold-Akzent links
  page.drawRectangle({ x: 40, y: boxY - boxH, width: 4, height: boxH, color: rgb(...C.gold) });

  let sy = boxY - 18;
  page.drawCircle({ x: 58, y: sy + 3, size: 6, color: rgb(...C.green) });
  page.drawText("Z", { x: 55, y: sy, size: 6, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Zusammenfassung", { x: 70, y: sy, size: 10, font: bold, color: rgb(...C.navy) });
  sy -= 18;

  for (const l of lines) {
    if (sy > 50) {
      page.drawText(l, { x: 54, y: sy, size: 9, font, color: rgb(...C.textBody) });
      sy -= 14;
    }
  }
  return sy;
}

// =====================================================================
// IMPACT-KARTE (Spenderbericht)
// =====================================================================

function drawImpactCard(
  page: any, rgb: any, bold: any, font: any,
  value: string, label: string, _icon: string,
  x: number, y: number, w: number, h: number,
  accent: C3
) {
  drawCardShadow(page, rgb, x, y, w, h);
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(...C.card), borderColor: rgb(...accent), borderWidth: 1 });
  page.drawRectangle({ x, y, width: 5, height: h, color: rgb(...accent) });
  // Icon-Kreis
  page.drawCircle({ x: x + 26, y: y + h / 2, size: 12, color: rgb(...accent) });
  // Wert
  page.drawText(value, { x: x + 48, y: y + h / 2 + 4, size: 24, font: bold, color: rgb(...C.navy) });
  // Label
  page.drawText(label, { x: x + 48, y: y + h / 2 - 16, size: 8.5, font, color: rgb(...C.textMuted) });
}

// =====================================================================
// METRIK-ZEILE (abgeleitete Kennzahlen)
// =====================================================================

function drawMetricRow(
  page: any, rgb: any, bold: any, font: any,
  items: { label: string; value: string; color: C3 }[],
  x: number, y: number, totalW: number
) {
  const itemW = totalW / items.length;
  // Hintergrund-Box
  drawCardShadow(page, rgb, x - 8, y - 14, totalW + 16, 44);
  page.drawRectangle({ x: x - 8, y: y - 14, width: totalW + 16, height: 44, color: rgb(...C.card), borderColor: rgb(...C.border), borderWidth: 0.5 });

  items.forEach((item, i) => {
    const ix = x + i * itemW;
    if (i > 0) {
      page.drawLine({ start: { x: ix - 2, y: y - 6 }, end: { x: ix - 2, y: y + 22 }, thickness: 0.5, color: rgb(...C.border) });
    }
    page.drawText(item.value, { x: ix + 10, y: y + 8, size: 16, font: bold, color: rgb(...item.color) });
    page.drawText(item.label, { x: ix + 10, y: y - 6, size: 7, font, color: rgb(...C.textMuted) });
  });
}

// =====================================================================
// SEITEN-LAYOUT-KOMPONENTEN
// =====================================================================

// --- Cover-Seite (Titelblatt) ----------------------------------------

function drawCoverPage(
  page: any, rgb: any, bold: any, font: any,
  W: number, H: number,
  reportTitle: string, subtitle: string,
  periodLabel: string, today: string,
  logoImage?: any
): number {
  drawPageBg(page, rgb, W, H);

  // Navy-Banner (obere ~270px)
  const bandH = 270;
  const bandY = H - bandH;
  page.drawRectangle({ x: 0, y: bandY, width: W, height: bandH, color: rgb(...C.navy) });

  // Innere Rahmenlinien
  page.drawRectangle({ x: 30, y: bandY + 14, width: W - 60, height: 0.5, color: rgb(...C.navyLight) });
  page.drawRectangle({ x: 30, y: H - 14, width: W - 60, height: 0.5, color: rgb(...C.navyLight) });
  page.drawLine({ start: { x: 30, y: bandY + 14 }, end: { x: 30, y: H - 14 }, thickness: 0.5, color: rgb(...C.navyLight) });
  page.drawLine({ start: { x: W - 30, y: bandY + 14 }, end: { x: W - 30, y: H - 14 }, thickness: 0.5, color: rgb(...C.navyLight) });

  // Logo
  if (logoImage) {
    page.drawImage(logoImage, { x: W / 2 - 28, y: H - 78, width: 56, height: 56 });
  }

  // "BNM" gross in Gold
  const bnm = "BNM";
  const bnmSz = 44;
  page.drawText(bnm, { x: W / 2 - bold.widthOfTextAtSize(bnm, bnmSz) / 2, y: H - 130, size: bnmSz, font: bold, color: rgb(...C.gold) });

  // Untertitel
  const sub1 = "Betreuung neuer Muslime";
  page.drawText(sub1, { x: W / 2 - font.widthOfTextAtSize(sub1, 11) / 2, y: H - 148, size: 11, font, color: rgb(...C.coverText) });

  // Gold-Akzentlinie
  page.drawRectangle({ x: W / 2 - 40, y: H - 168, width: 80, height: 2.5, color: rgb(...C.gold) });

  // Report-Titel
  const tSz = 24;
  page.drawText(reportTitle, { x: W / 2 - bold.widthOfTextAtSize(reportTitle, tSz) / 2, y: H - 200, size: tSz, font: bold, color: rgb(...C.white) });

  // Optionaler Subtitle
  if (subtitle) {
    page.drawText(subtitle, { x: W / 2 - font.widthOfTextAtSize(subtitle, 10) / 2, y: H - 218, size: 10, font, color: rgb(...C.coverText) });
  }

  // Zeitraum in Gold
  const pSz = 15;
  page.drawText(periodLabel, { x: W / 2 - bold.widthOfTextAtSize(periodLabel, pSz) / 2, y: H - 248, size: pSz, font: bold, color: rgb(...C.gold) });

  // Erstellungsdatum
  const dateT = "Erstellt: " + today;
  page.drawText(dateT, { x: W / 2 - font.widthOfTextAtSize(dateT, 8) / 2, y: H - 264, size: 8, font, color: rgb(...C.coverSub) });

  // Gold-Linie unter Banner
  page.drawRectangle({ x: 0, y: bandY - 3, width: W, height: 3, color: rgb(...C.gold) });

  return bandY - 3;
}

// --- Seiten-Header (Seiten 2+) ----------------------------------------

function drawPageHeader(
  page: any, rgb: any, bold: any, font: any,
  W: number, H: number, title: string, periodLabel: string, today: string,
  logoImage?: any
) {
  // Weisser Header
  page.drawRectangle({ x: 0, y: H - 56, width: W, height: 56, color: rgb(...C.card) });
  // Gold-Akzentlinie
  page.drawRectangle({ x: 0, y: H - 58, width: W, height: 2.5, color: rgb(...C.gold) });
  // Untere Trennlinie
  page.drawLine({ start: { x: 0, y: H - 56 }, end: { x: W, y: H - 56 }, thickness: 0.5, color: rgb(...C.border) });

  // Logo
  if (logoImage) {
    page.drawImage(logoImage, { x: 28, y: H - 53, width: 46, height: 46 });
  } else {
    page.drawText("BNM", { x: 36, y: H - 28, size: 18, font: bold, color: rgb(...C.gold) });
    page.drawText("Betreuung neuer Muslime", { x: 36, y: H - 42, size: 6.5, font, color: rgb(...C.textMuted) });
  }

  // Titel zentriert
  const tw = bold.widthOfTextAtSize(title, 14);
  page.drawText(title, { x: W / 2 - tw / 2, y: H - 33, size: 14, font: bold, color: rgb(...C.navy) });

  // Zeitraum + Datum rechts
  const pW = bold.widthOfTextAtSize(periodLabel, 9);
  page.drawText(periodLabel, { x: W - 36 - pW, y: H - 26, size: 9, font: bold, color: rgb(...C.gold) });
  const eT = "Erstellt: " + today;
  page.drawText(eT, { x: W - 36 - font.widthOfTextAtSize(eT, 7), y: H - 42, size: 7, font, color: rgb(...C.textMuted) });
}

// --- Section-Header ---------------------------------------------------

function drawSectionHeader(
  page: any, rgb: any, bold: any, _font: any,
  text: string, x: number, y: number, letter: string, circleColor: C3
) {
  page.drawCircle({ x: x + 8, y: y + 4, size: 8, color: rgb(...circleColor) });
  page.drawText(letter, { x: x + 5, y: y + 1, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText(text, { x: x + 22, y, size: 12, font: bold, color: rgb(...C.navy) });
  const tw = bold.widthOfTextAtSize(text, 12);
  page.drawRectangle({ x: x + 22, y: y - 5, width: Math.min(tw, 140), height: 2.5, color: rgb(...C.gold) });
}

// --- Footer -----------------------------------------------------------

function drawFooter(page: any, rgb: any, bold: any, font: any, W: number, cur: number, total: number) {
  page.drawLine({ start: { x: 40, y: 44 }, end: { x: W - 40, y: 44 }, thickness: 0.5, color: rgb(...C.divider) });
  page.drawText("BNM | Vertraulich", { x: 40, y: 30, size: 6.5, font, color: rgb(...C.textLight) });
  const mid = "iman.ngo";
  page.drawText(mid, { x: W / 2 - bold.widthOfTextAtSize(mid, 7) / 2, y: 30, size: 7, font: bold, color: rgb(...C.gold) });
  const rt = `Seite ${cur} von ${total}`;
  page.drawText(rt, { x: W - 40 - font.widthOfTextAtSize(rt, 7), y: 30, size: 7, font, color: rgb(...C.textLight) });
}

// --- Cover-Footer (einfacher) -----------------------------------------

function drawCoverFooter(page: any, rgb: any, bold: any, font: any, W: number, cur: number, total: number) {
  page.drawLine({ start: { x: 40, y: 44 }, end: { x: W - 40, y: 44 }, thickness: 0.5, color: rgb(...C.divider) });
  const cf = "iman.ngo | BNM — Betreuung neuer Muslime";
  page.drawText(cf, { x: W / 2 - font.widthOfTextAtSize(cf, 7) / 2, y: 30, size: 7, font, color: rgb(...C.textLight) });
  const pg = `Seite ${cur} von ${total}`;
  page.drawText(pg, { x: W - 40 - font.widthOfTextAtSize(pg, 7), y: 30, size: 7, font, color: rgb(...C.textLight) });
}


// ======================================================================
// MONATSBERICHT — 4 Seiten
//   S1: Cover / Executive Summary
//   S2: KPI-Dashboard + Donut + Mentor des Monats + Analyse
//   S3: Session-Analyse + Top-Mentoren + Abschlussquote
//   S4: Rangliste + Zusammenfassung
// ======================================================================

export async function downloadMonthlyReportPDF(data: ReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595;
    const H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const TP = 4;
    const logo = await loadLogoPng(doc);

    // Berechnete Metriken
    const totalB = data.kpis.activeBetreuungen + data.kpis.abgeschlossen + data.kpis.neueBetreuungen;
    const totalS = data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions;
    const totalSAll = totalS + data.kpis.nachbetreuung;
    const abschlQ = totalB > 0 ? data.kpis.abgeschlossen / totalB : 0;
    const sessPerMentee = data.kpis.mentees > 0 ? totalSAll / data.kpis.mentees : 0;
    const sessPerMentor = data.kpis.mentoren > 0 ? totalSAll / data.kpis.mentoren : 0;
    const nachbetrRate = totalSAll > 0 ? data.kpis.nachbetreuung / totalSAll : 0;

    // ================================================================
    // SEITE 1: COVER / EXECUTIVE SUMMARY
    // ================================================================
    const p1 = doc.addPage([W, H]);
    const below = drawCoverPage(p1, rgb, bold, font, W, H, "MONATSBERICHT", "", data.periodLabel, today, logo);

    // 4 Hero-KPIs
    let y1 = below - 26;
    const hW = 118;
    const hH = 68;
    const hG = 9;
    const heroes: [string, string, C3][] = [
      [String(totalB), "Betreuungen gesamt", C.blue],
      [String(totalSAll), "Sessions gesamt", C.green],
      [String(data.kpis.mentoren), "Aktive Mentoren", C.navy],
      [fmtPct(abschlQ), "Abschlussquote", C.gold],
    ];
    heroes.forEach(([v, l, c], i) => {
      drawHeroKpiCard(p1, rgb, bold, font, v, l, 40 + i * (hW + hG), y1, hW, hH, c);
    });

    drawGoldDivider(p1, rgb, y1 - hH - 18, W);
    drawSummaryBox(p1, rgb, bold, font, data.summaryText, y1 - hH - 38, W);
    drawCoverFooter(p1, rgb, bold, font, W, 1, TP);

    // ================================================================
    // SEITE 2: KPI-DASHBOARD
    // ================================================================
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today, logo);

    let y2 = H - 82;
    drawSectionHeader(p2, rgb, bold, font, "Kennzahlen im Ueberblick", 40, y2, "K", C.blue);

    // 2x4 KPI-Grid
    const kpis: [string, string, C3][] = [
      [String(totalB), "Betreuungen gesamt", C.blue],
      [String(data.kpis.activeBetreuungen), "Aktive Betreuungen", C.green],
      [String(data.kpis.abgeschlossen), "Abgeschlossen", C.gold],
      [String(data.kpis.neueBetreuungen), "Neue Betreuungen", C.teal],
      [String(data.kpis.mentoren), "Mentoren", C.navy],
      [String(data.kpis.mentees), "Mentees", C.purple],
      [String(totalS), "Lern-Sessions", C.orange],
      [String(data.kpis.nachbetreuung), "Nachbetreuung", C.green],
    ];
    const KW = 120;
    const KH = 50;
    const KG = 7;
    kpis.forEach(([v, l, col], i) => {
      const c = i % 4;
      const r = Math.floor(i / 4);
      drawProKpiCard(p2, rgb, bold, font, v, l, 40 + c * (KW + KG), y2 - 18 - r * (KH + KG), KW, KH, col);
    });

    const dv2a = y2 - 18 - 2 * (KH + KG) - 10;
    drawGoldDivider(p2, rgb, dv2a, W);

    // Donut links + Session-Bars rechts
    const chartY = dv2a - 20;
    drawSectionHeader(p2, rgb, bold, font, "Betreuungs-Status", 40, chartY, "B", C.green);
    drawProDonutChart(p2, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeBetreuungen, color: C.green },
      { label: "Abgeschlossen", value: data.kpis.abgeschlossen, color: C.gold },
      { label: "Neu", value: data.kpis.neueBetreuungen, color: C.blue },
    ], 125, chartY - 74, 44, 24);

    drawSectionHeader(p2, rgb, bold, font, "Session-Verteilung", 300, chartY, "S", C.gold);
    drawHorizontalBars(p2, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.blue },
      { label: "Salah", value: data.kpis.salahSessions, color: C.green },
      { label: "Koran", value: data.kpis.koranSessions, color: C.gold },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.purple },
    ], 300, chartY - 32, W - 340, 11, 26);

    const dv2b = chartY - 150;
    drawGoldDivider(p2, rgb, dv2b, W);

    // Mentor des Monats
    if (data.mentorOfMonth) {
      const momY = dv2b - 14;
      drawSectionHeader(p2, rgb, bold, font, "Mentor des Monats", 40, momY, "M", C.gold);
      const cY = momY - 22;
      drawCardShadow(p2, rgb, 40, cY - 52, W - 80, 52);
      p2.drawRectangle({ x: 40, y: cY - 52, width: W - 80, height: 52, color: rgb(...C.card), borderColor: rgb(...C.gold), borderWidth: 2 });
      p2.drawRectangle({ x: 42, y: cY - 48, width: 4, height: 44, color: rgb(...C.gold) });
      p2.drawCircle({ x: 68, y: cY - 24, size: 13, color: rgb(...C.gold) });
      p2.drawText("*", { x: 64, y: cY - 28, size: 14, font: bold, color: rgb(...C.white) });
      p2.drawText(data.mentorOfMonth.name, { x: 92, y: cY - 18, size: 15, font: bold, color: rgb(...C.navy) });
      const statsT = `${data.mentorOfMonth.score} Pkt  |  ${data.mentorOfMonth.completed} Abschl.  |  ${data.mentorOfMonth.sessions} Sessions`;
      p2.drawText(statsT, { x: 92, y: cY - 38, size: 8.5, font, color: rgb(...C.textMuted) });
    }

    // Analyse-Metriken
    const dmY = data.mentorOfMonth ? dv2b - 100 : dv2b - 20;
    drawGoldDivider(p2, rgb, dmY, W);
    const amY = dmY - 14;
    drawSectionHeader(p2, rgb, bold, font, "Analyse", 40, amY, "A", C.navy);
    drawMetricRow(p2, rgb, bold, font, [
      { label: "Sessions / Mentee", value: fmtDe(sessPerMentee), color: C.blue },
      { label: "Sessions / Mentor", value: fmtDe(sessPerMentor), color: C.green },
      { label: "Nachbetreuungs-Rate", value: fmtPct(nachbetrRate), color: C.purple },
    ], 54, amY - 36, W - 108);

    drawFooter(p2, rgb, bold, font, W, 2, TP);

    // ================================================================
    // SEITE 3: SESSION-ANALYSE + TOP-MENTOREN + GAUGE
    // ================================================================
    const p3 = doc.addPage([W, H]);
    drawPageBg(p3, rgb, W, H);
    drawPageHeader(p3, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today, logo);

    let y3 = H - 82;
    drawSectionHeader(p3, rgb, bold, font, "Sessions nach Typ", 40, y3, "S", C.gold);
    drawVerticalBarChart(p3, rgb, bold, font, [
      { label: "Wudu", value: data.kpis.wuduSessions, color: C.blue },
      { label: "Salah", value: data.kpis.salahSessions, color: C.green },
      { label: "Koran", value: data.kpis.koranSessions, color: C.gold },
      { label: "Nachbetr.", value: data.kpis.nachbetreuung, color: C.purple },
    ], 80, y3 - 180, W - 160, 140);

    const dv3a = y3 - 204;
    drawGoldDivider(p3, rgb, dv3a, W);

    // Top 5 Mentoren
    const t5y = dv3a - 16;
    drawSectionHeader(p3, rgb, bold, font, "Top 5 Mentoren (Score)", 40, t5y, "T", C.blue);
    const top5 = data.rankings.slice(0, 5);
    const maxScore = Math.max(...top5.map(m => m.score), 1);
    top5.forEach((m, i) => {
      const my = t5y - 30 - i * 38;
      const rc = i === 0 ? C.gold : i === 1 ? C.silver : i === 2 ? C.bronze : C.textLight;
      p3.drawCircle({ x: 56, y: my + 10, size: 10, color: rgb(...rc) });
      p3.drawText(String(m.rank), { x: 53, y: my + 7, size: 8, font: bold, color: rgb(...C.white) });
      p3.drawText(m.name, { x: 74, y: my + 16, size: 9, font: bold, color: rgb(...C.textDark) });
      const barX = 74;
      const barW = W - 164;
      p3.drawRectangle({ x: barX, y: my - 2, width: barW, height: 10, color: rgb(...C.barBg) });
      const fillW = maxScore > 0 ? Math.max(6, barW * (m.score / maxScore)) : 6;
      const bCol = i === 0 ? C.gold : i < 3 ? C.blue : C.textLight;
      p3.drawRectangle({ x: barX, y: my - 2, width: fillW, height: 10, color: rgb(...bCol) });
      const st = `${m.score} Pkt`;
      p3.drawText(st, { x: W - 44 - bold.widthOfTextAtSize(st, 8), y: my, size: 8, font: bold, color: rgb(...C.navy) });
    });

    const dv3b = t5y - 30 - Math.max(top5.length, 1) * 38 - 10;
    drawGoldDivider(p3, rgb, dv3b, W);

    // Abschlussquote-Gauge
    drawSectionHeader(p3, rgb, bold, font, "Abschlussquote", 40, dv3b - 14, "A", C.navy);
    drawCompletionGauge(p3, rgb, bold, font, data.kpis.abgeschlossen, totalB, 40, dv3b - 44, W - 80);

    drawFooter(p3, rgb, bold, font, W, 3, TP);

    // ================================================================
    // SEITE 4: RANGLISTE + ZUSAMMENFASSUNG
    // ================================================================
    const p4 = doc.addPage([W, H]);
    drawPageBg(p4, rgb, W, H);
    drawPageHeader(p4, rgb, bold, font, W, H, "Monatsbericht", data.periodLabel, today, logo);

    let y4 = H - 82;
    drawSectionHeader(p4, rgb, bold, font, "Mentor-Rangliste", 40, y4, "R", C.gold);

    // Tabellenkopf
    let ty = y4 - 22;
    p4.drawRectangle({ x: 40, y: ty - 2, width: W - 80, height: 20, color: rgb(...C.navy) });
    const cols = [48, 78, 258, 334, 406, 472];
    ["#", "Name", "Score", "Sessions", "Abschl.", "Bewertung"].forEach((h, i) => {
      p4.drawText(h, { x: cols[i], y: ty + 3, size: 7.5, font: bold, color: rgb(...C.white) });
    });
    ty -= 20;

    // Tabellenzeilen
    const maxRows = Math.min(data.rankings.length, 15);
    data.rankings.slice(0, maxRows).forEach((m, i) => {
      const rowBg = i % 2 === 0 ? rgb(...C.card) : rgb(...C.rowAlt);
      p4.drawRectangle({ x: 40, y: ty - 2, width: W - 80, height: 18, color: rowBg });
      p4.drawLine({ start: { x: 40, y: ty - 2 }, end: { x: W - 40, y: ty - 2 }, thickness: 0.3, color: rgb(...C.border) });

      const isTop = m.rank <= 3;
      const fn = isTop ? bold : font;

      // Medaille fuer Top 3
      if (isTop) {
        const mc = m.rank === 1 ? C.gold : m.rank === 2 ? C.silver : C.bronze;
        p4.drawCircle({ x: 59, y: ty + 6, size: 7, color: rgb(...mc) });
        const rs = String(m.rank);
        p4.drawText(rs, { x: 59 - bold.widthOfTextAtSize(rs, 7.5) / 2, y: ty + 3, size: 7.5, font: bold, color: rgb(...C.white) });
      } else {
        p4.drawText(String(m.rank), { x: 56, y: ty + 3, size: 7.5, font: fn, color: rgb(...C.textDark) });
      }

      // Name
      const name = m.name.length > 24 ? m.name.slice(0, 22) + "..." : m.name;
      p4.drawText(name, { x: cols[1], y: ty + 3, size: 7.5, font: fn, color: isTop ? rgb(...C.navy) : rgb(...C.textDark) });

      // Zahlen (rechtsbuendig)
      [String(m.score), String(m.sessions), String(m.completed)].forEach((v, vi) => {
        p4.drawText(v, { x: cols[vi + 2] + 36 - font.widthOfTextAtSize(v, 7.5), y: ty + 3, size: 7.5, font, color: rgb(...C.textDark) });
      });

      // Bewertung
      const rStr = m.rating !== null ? m.rating.toFixed(1) + " *" : "\u2014";
      p4.drawText(rStr, { x: cols[5] + 36 - font.widthOfTextAtSize(rStr, 7.5), y: ty + 3, size: 7.5, font, color: rgb(...C.textDark) });

      ty -= 18;
    });

    // Tabellen-Abschluss
    p4.drawLine({ start: { x: 40, y: ty - 2 }, end: { x: W - 40, y: ty - 2 }, thickness: 0.8, color: rgb(...C.navy) });

    drawGoldDivider(p4, rgb, ty - 18, W);

    // Zusammenfassung
    const sumY = ty - 36;
    drawSectionHeader(p4, rgb, bold, font, "Zusammenfassung", 40, sumY, "Z", C.green);
    drawSummaryBox(p4, rgb, bold, font, data.summaryText, sumY - 14, W);

    drawFooter(p4, rgb, bold, font, W, 4, TP);

    // Download
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
    aStats.forEach(function (pair, i) {
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
    [[30, 30], [W - 30, 30], [30, H - 30], [W - 30, H - 30]].forEach(function (corner) {
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
    stats.forEach(function (pair, i) {
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
// SPENDERBERICHT — 3 Seiten
//   S1: Cover + Hero-KPIs + Zusammenfassung
//   S2: Kennzahlen + Session-Charts + Betreuungs-Donut
//   S3: Impact-Karten + Session-Details + Zusammenfassung
// ======================================================================

export async function downloadDonorReportPDF(data: DonorReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595;
    const H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
    const TP = 3;
    const logo = await loadLogoPng(doc);

    const totalSess = data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions + (data.kpis.nachbetreuungSessions || 0);
    const totalMentees = data.kpis.activeMentorships + data.kpis.completedInPeriod;

    // ================================================================
    // SEITE 1: COVER + HERO-KPIs + ZUSAMMENFASSUNG
    // ================================================================
    const p1 = doc.addPage([W, H]);
    const below = drawCoverPage(p1, rgb, bold, font, W, H, "SPENDERBERICHT", "Wirkungsbericht fuer Foerderer", data.periodLabel, today, logo);

    let y1 = below - 26;
    const hW = 118;
    const hH = 68;
    const hG = 9;
    const dHeroes: [string, string, C3][] = [
      [String(totalMentees), "Mentees betreut", C.green],
      [String(totalSess), "Sessions gesamt", C.blue],
      [String(data.kpis.bnmBoxes), "BNM-Boxen verteilt", C.gold],
      [String(data.kpis.activeMentors), "Aktive Mentoren", C.navy],
    ];
    dHeroes.forEach(([v, l, c], i) => {
      drawHeroKpiCard(p1, rgb, bold, font, v, l, 40 + i * (hW + hG), y1, hW, hH, c);
    });

    drawGoldDivider(p1, rgb, y1 - hH - 18, W);
    drawSummaryBox(p1, rgb, bold, font, data.summaryText, y1 - hH - 38, W);
    drawCoverFooter(p1, rgb, bold, font, W, 1, TP);

    // ================================================================
    // SEITE 2: KENNZAHLEN + CHARTS
    // ================================================================
    const p2 = doc.addPage([W, H]);
    drawPageBg(p2, rgb, W, H);
    drawPageHeader(p2, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today, logo);

    let y2 = H - 82;
    drawSectionHeader(p2, rgb, bold, font, "Kennzahlen", 40, y2, "K", C.blue);

    const dk: [string, string, C3][] = [
      [String(data.kpis.activeMentorships), "Aktive Betreuungen", C.green],
      [String(data.kpis.newRegistrations), "Neue Registrierungen", C.blue],
      [String(data.kpis.completedInPeriod), "Abgeschlossen", C.gold],
      [String(data.kpis.bnmBoxes), "BNM-Boxen", C.orange],
      [String(data.kpis.activeMentors), "Aktive Mentoren", C.navy],
      [String(data.kpis.wuduSessions), "Wudu Sessions", C.blue],
      [String(data.kpis.salahSessions), "Salah Sessions", C.green],
      [String(data.kpis.koranSessions), "Koran Sessions", C.gold],
    ];
    dk.forEach(([v, l, col], i) => {
      const c = i % 4;
      const r = Math.floor(i / 4);
      drawProKpiCard(p2, rgb, bold, font, v, l, 40 + c * (120 + 7), y2 - 18 - r * (50 + 7), 120, 50, col);
    });

    const dv2 = y2 - 18 - 2 * 57 - 10;
    drawGoldDivider(p2, rgb, dv2, W);

    // Session-Verteilung (vertikale Balken)
    const scY = dv2 - 18;
    drawSectionHeader(p2, rgb, bold, font, "Session-Verteilung", 40, scY, "S", C.gold);

    const sessItems = data.sessionDistribution?.items ?? [];
    const displayItems = sessItems.length > 0 ? sessItems : [
      { label: "Wudu", value: data.kpis.wuduSessions },
      { label: "Salah", value: data.kpis.salahSessions },
      { label: "Koran", value: data.kpis.koranSessions },
    ];
    const barColors: C3[] = [C.blue, C.green, C.gold, C.purple, C.orange, C.teal];

    drawVerticalBarChart(p2, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value,
        color: barColors[i % barColors.length],
      })),
      80, scY - 180, W - 160, 140
    );

    // Betreuungs-Donut
    const doY = scY - 212;
    drawSectionHeader(p2, rgb, bold, font, "Betreuungs-Status", 40, doY, "B", C.green);
    drawProDonutChart(p2, rgb, bold, font, [
      { label: "Aktiv", value: data.kpis.activeMentorships, color: C.green },
      { label: "Abgeschlossen", value: data.kpis.completedInPeriod, color: C.gold },
      { label: "BNM-Boxen", value: data.kpis.bnmBoxes, color: C.blue },
    ], 115, doY - 55, 32, 17);

    drawFooter(p2, rgb, bold, font, W, 2, TP);

    // ================================================================
    // SEITE 3: IMPACT + SESSION-DETAILS + ZUSAMMENFASSUNG
    // ================================================================
    const p3 = doc.addPage([W, H]);
    drawPageBg(p3, rgb, W, H);
    drawPageHeader(p3, rgb, bold, font, W, H, "Spenderbericht", data.periodLabel, today, logo);

    let y3 = H - 82;
    drawSectionHeader(p3, rgb, bold, font, "Wirkung & Impact", 40, y3, "W", C.green);

    // 4 Impact-Karten (2x2)
    const ICW = (W - 100) / 2;
    const ICH = 58;
    const icY = y3 - 22;
    drawImpactCard(p3, rgb, bold, font, String(totalMentees), "Mentees betreut", "M", 40, icY - ICH, ICW, ICH, C.green);
    drawImpactCard(p3, rgb, bold, font, String(totalSess), "Sessions durchgefuehrt", "S", 60 + ICW, icY - ICH, ICW, ICH, C.blue);
    drawImpactCard(p3, rgb, bold, font, String(data.kpis.bnmBoxes), "BNM-Boxen verteilt", "B", 40, icY - 2 * ICH - 12, ICW, ICH, C.gold);
    drawImpactCard(p3, rgb, bold, font, String(data.kpis.activeMentors), "Aktive Mentoren", "A", 60 + ICW, icY - 2 * ICH - 12, ICW, ICH, C.purple);

    const idv = icY - 2 * ICH - 30;
    drawGoldDivider(p3, rgb, idv, W);

    // Session-Details (horizontal)
    const hbY = idv - 18;
    drawSectionHeader(p3, rgb, bold, font, "Session-Details", 40, hbY, "D", C.gold);
    drawHorizontalBars(p3, rgb, bold, font,
      displayItems.map((item, i) => ({
        label: item.label.replace(" Sessions", "").replace("Session", "").trim() || item.label,
        value: item.value,
        color: barColors[i % barColors.length],
      })),
      40, hbY - 28, W - 80, 12, 24
    );

    // Zusammenfassung
    const sdv = hbY - 28 - displayItems.length * 24 - 20;
    drawGoldDivider(p3, rgb, sdv, W);
    const s3Y = sdv - 18;
    drawSectionHeader(p3, rgb, bold, font, "Zusammenfassung", 40, s3Y, "Z", C.green);
    drawSummaryBox(p3, rgb, bold, font, data.summaryText, s3Y - 14, W);

    drawFooter(p3, rgb, bold, font, W, 3, TP);

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Spenderbericht-" + data.periodLabel + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}
