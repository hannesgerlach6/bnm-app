import { Platform } from "react-native";

// ============================================================
// PDF-Generator für BNM-Berichte
// Lädt pdf-lib über CDN zur Laufzeit (nur wenn PDF gebraucht wird).
// Erzeugt echte .pdf Dateien als direkten Download.
// ============================================================

// ─── Interfaces ──────────────────────────────────────────────────────────────

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

// ─── CDN Loader ──────────────────────────────────────────────────────────────

let _pdfLib: any = null;

async function loadPdfLib(): Promise<any> {
  if (_pdfLib) return _pdfLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    script.onload = () => {
      _pdfLib = (window as any).PDFLib;
      resolve(_pdfLib);
    };
    script.onerror = () => reject(new Error("pdf-lib CDN konnte nicht geladen werden"));
    document.head.appendChild(script);
  });
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

// ─── Farben ──────────────────────────────────────────────────────────────────

const C = {
  navy: [10 / 255, 58 / 255, 90 / 255] as [number, number, number],
  gold: [238 / 255, 167 / 255, 27 / 255] as [number, number, number],
  green: [21 / 255, 128 / 255, 61 / 255] as [number, number, number],
  gray: [71 / 255, 84 / 255, 103 / 255] as [number, number, number],
  lgray: [152 / 255, 162 / 255, 179 / 255] as [number, number, number],
  white: [1, 1, 1] as [number, number, number],
  border: [0.9, 0.91, 0.92] as [number, number, number],
  bg: [0.98, 0.98, 0.98] as [number, number, number],
};

// ─── Monatsbericht ───────────────────────────────────────────────────────────

export async function downloadMonthlyReportPDF(data: ReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const PDFLib = await loadPdfLib();
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595; const H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

    // Seite 1: Deckblatt
    const p1 = doc.addPage([W, H]);
    p1.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: rgb(...C.navy) });
    p1.drawText("BNM", { x: W / 2 - bold.widthOfTextAtSize("BNM", 42) / 2, y: H - 70, size: 42, font: bold, color: rgb(...C.gold) });
    p1.drawText("BETREUUNG NEUER MUSLIME", { x: W / 2 - font.widthOfTextAtSize("BETREUUNG NEUER MUSLIME", 8) / 2, y: H - 90, size: 8, font, color: rgb(...C.white) });
    p1.drawRectangle({ x: W / 2 - 30, y: H / 2 + 40, width: 60, height: 3, color: rgb(...C.gold) });
    p1.drawText("Monatsbericht", { x: W / 2 - bold.widthOfTextAtSize("Monatsbericht", 28) / 2, y: H / 2, size: 28, font: bold, color: rgb(...C.navy) });
    p1.drawText(data.periodLabel, { x: W / 2 - font.widthOfTextAtSize(data.periodLabel, 14) / 2, y: H / 2 - 24, size: 14, font, color: rgb(...C.gray) });
    p1.drawRectangle({ x: W / 2 - 30, y: H / 2 - 50, width: 60, height: 3, color: rgb(...C.gold) });
    p1.drawText("Erstellt am: " + today, { x: W / 2 - font.widthOfTextAtSize("Erstellt am: " + today, 9) / 2, y: H / 2 - 80, size: 9, font, color: rgb(...C.lgray) });
    p1.drawText("BNM - Ein iERA Projekt in Kooperation mit IMAN", { x: W / 2 - font.widthOfTextAtSize("BNM - Ein iERA Projekt in Kooperation mit IMAN", 8) / 2, y: H / 2 - 100, size: 8, font, color: rgb(...C.lgray) });
    p1.drawText("BNM - Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.lgray) });
    p1.drawText("Seite 1", { x: W - 70, y: 30, size: 7, font, color: rgb(...C.lgray) });

    // Seite 2: KPIs
    const p2 = doc.addPage([W, H]);
    p2.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: rgb(...C.navy) });
    p2.drawText("Monatsbericht", { x: 40, y: H - 35, size: 14, font: bold, color: rgb(...C.white) });
    p2.drawText(data.periodLabel, { x: W - 40 - font.widthOfTextAtSize(data.periodLabel, 10), y: H - 35, size: 10, font, color: rgb(...C.gold) });
    p2.drawText("Kennzahlen", { x: 40, y: H - 80, size: 16, font: bold, color: rgb(...C.navy) });
    p2.drawRectangle({ x: 40, y: H - 88, width: 40, height: 2, color: rgb(...C.gold) });

    const kpis = [
      [String(data.kpis.activeBetreuungen), "Aktive Betreuungen"],
      [String(data.kpis.abgeschlossen), "Abgeschlossen"],
      [String(data.kpis.mentoren), "Mentoren"],
      [String(data.kpis.mentees), "Mentees gesamt"],
      [String(data.kpis.sessions), "Sessions gesamt"],
      [String(data.kpis.neueBetreuungen), "Neue Betreuungen"],
    ];
    kpis.forEach(([v, l], i) => {
      const col = i % 3; const row = Math.floor(i / 3);
      const bx = 40 + col * 170; const by = H - 110 - row * 55;
      p2.drawRectangle({ x: bx, y: by - 50, width: 160, height: 50, borderColor: rgb(...C.border), borderWidth: 1 });
      p2.drawText(v, { x: bx + 10, y: by - 25, size: 22, font: bold, color: rgb(...C.navy) });
      p2.drawText(l, { x: bx + 10, y: by - 42, size: 8, font, color: rgb(...C.gray) });
    });

    if (data.mentorOfMonth) {
      const my = H - 250;
      p2.drawRectangle({ x: 40, y: my - 55, width: W - 80, height: 55, color: rgb(254 / 255, 243 / 255, 199 / 255), borderColor: rgb(...C.gold), borderWidth: 1 });
      p2.drawText("MENTOR DES MONATS", { x: 55, y: my - 18, size: 8, font: bold, color: rgb(146 / 255, 64 / 255, 14 / 255) });
      p2.drawText(data.mentorOfMonth.name, { x: 55, y: my - 35, size: 16, font: bold, color: rgb(...C.navy) });
      p2.drawText(data.mentorOfMonth.score + " Pkt - " + data.mentorOfMonth.completed + " Abschl. - " + data.mentorOfMonth.sessions + " Sessions", { x: 55, y: my - 48, size: 8, font, color: rgb(...C.gray) });
    }
    p2.drawText("BNM - Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.lgray) });
    p2.drawText("Seite 2", { x: W - 70, y: 30, size: 7, font, color: rgb(...C.lgray) });

    // Seite 3: Rangliste
    const p3 = doc.addPage([W, H]);
    p3.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: rgb(...C.navy) });
    p3.drawText("Mentor-Rangliste", { x: 40, y: H - 35, size: 14, font: bold, color: rgb(...C.white) });
    p3.drawText("Rangliste", { x: 40, y: H - 80, size: 16, font: bold, color: rgb(...C.navy) });
    p3.drawRectangle({ x: 40, y: H - 88, width: 40, height: 2, color: rgb(...C.gold) });

    let ty = H - 105;
    p3.drawRectangle({ x: 40, y: ty - 14, width: W - 80, height: 14, color: rgb(...C.bg) });
    ["#", "Name", "Score", "Sessions", "Abschl.", "Bewertung"].forEach((h, i) => {
      const positions = [45, 70, 250, 330, 410, 480];
      p3.drawText(h, { x: positions[i], y: ty - 11, size: 7, font: bold, color: rgb(...C.gray) });
    });
    ty -= 16;

    data.rankings.slice(0, 20).forEach((m, i) => {
      if (i % 2 === 1) p3.drawRectangle({ x: 40, y: ty - 14, width: W - 80, height: 14, color: rgb(...C.bg) });
      const isTop = m.rank <= 3;
      const f = isTop ? bold : font;
      const c = isTop ? rgb(...C.gold) : rgb(...C.navy);
      p3.drawText(String(m.rank), { x: 45, y: ty - 10, size: 8, font: f, color: c });
      p3.drawText(m.name, { x: 70, y: ty - 10, size: 8, font: f, color: c });
      p3.drawText(String(m.score), { x: 250, y: ty - 10, size: 8, font, color: rgb(...C.navy) });
      p3.drawText(String(m.sessions), { x: 330, y: ty - 10, size: 8, font, color: rgb(...C.navy) });
      p3.drawText(String(m.completed), { x: 410, y: ty - 10, size: 8, font, color: rgb(...C.navy) });
      p3.drawText(m.rating !== null ? m.rating.toFixed(1) + " *" : "-", { x: 480, y: ty - 10, size: 8, font, color: rgb(...C.navy) });
      ty -= 16;
    });
    p3.drawText("BNM - Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.lgray) });
    p3.drawText("Seite 3", { x: W - 70, y: 30, size: 7, font, color: rgb(...C.lgray) });

    // Seite 4: Zusammenfassung
    const p4 = doc.addPage([W, H]);
    p4.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: rgb(...C.navy) });
    p4.drawText("Zusammenfassung", { x: 40, y: H - 35, size: 14, font: bold, color: rgb(...C.white) });
    p4.drawText("Zusammenfassung", { x: 40, y: H - 80, size: 16, font: bold, color: rgb(...C.navy) });
    p4.drawRectangle({ x: 40, y: H - 88, width: 40, height: 2, color: rgb(...C.gold) });

    const words = data.summaryText.split(" ");
    let line = ""; let sy = H - 110;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, 10) > W - 100) {
        p4.drawText(line, { x: 50, y: sy, size: 10, font, color: rgb(...C.navy) });
        sy -= 16; line = w;
      } else { line = test; }
    }
    if (line) p4.drawText(line, { x: 50, y: sy, size: 10, font, color: rgb(...C.navy) });
    p4.drawText("Automatisch generiert. BNM - iman.ngo", { x: 40, y: 60, size: 7, font, color: rgb(...C.lgray) });
    p4.drawText("BNM - Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.lgray) });
    p4.drawText("Seite 4", { x: W - 70, y: 30, size: 7, font, color: rgb(...C.lgray) });

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Monatsbericht-" + data.period + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}

// ─── Mentor Award ────────────────────────────────────────────────────────────

export async function downloadMentorAwardPDF(data: AwardData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const PDFLib = await loadPdfLib();
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595; const H = 842; const cx = W / 2;

    const p = doc.addPage([W, H]);
    p.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: rgb(...C.gold), borderWidth: 3 });
    p.drawText("BNM", { x: cx - bold.widthOfTextAtSize("BNM", 36) / 2, y: H - 120, size: 36, font: bold, color: rgb(...C.gold) });
    p.drawText("BETREUUNG NEUER MUSLIME", { x: cx - font.widthOfTextAtSize("BETREUUNG NEUER MUSLIME", 8) / 2, y: H - 140, size: 8, font, color: rgb(...C.gray) });
    p.drawRectangle({ x: cx - 30, y: H - 170, width: 60, height: 3, color: rgb(...C.gold) });
    p.drawText("AUSZEICHNUNG", { x: cx - font.widthOfTextAtSize("AUSZEICHNUNG", 10) / 2, y: H - 200, size: 10, font, color: rgb(...C.gray) });
    p.drawText("Mentor des Monats", { x: cx - bold.widthOfTextAtSize("Mentor des Monats", 24) / 2, y: H - 240, size: 24, font: bold, color: rgb(...C.navy) });
    p.drawText(data.period, { x: cx - font.widthOfTextAtSize(data.period, 12) / 2, y: H - 265, size: 12, font, color: rgb(...C.gray) });
    p.drawRectangle({ x: cx - 30, y: H - 290, width: 60, height: 3, color: rgb(...C.gold) });
    p.drawText(data.mentorName, { x: cx - bold.widthOfTextAtSize(data.mentorName, 28) / 2, y: H - 340, size: 28, font: bold, color: rgb(...C.gold) });

    [[String(data.score), "Punkte"], [String(data.completed), "Abschluesse"], [String(data.sessions), "Sessions"]].forEach(([v, l], i) => {
      const sx = 120 + i * 140;
      p.drawRectangle({ x: sx, y: H - 430, width: 110, height: 50, borderColor: rgb(...C.border), borderWidth: 1 });
      p.drawText(v, { x: sx + 55 - bold.widthOfTextAtSize(v, 20) / 2, y: H - 410, size: 20, font: bold, color: rgb(...C.navy) });
      p.drawText(l, { x: sx + 55 - font.widthOfTextAtSize(l, 8) / 2, y: H - 425, size: 8, font, color: rgb(...C.gray) });
    });

    p.drawRectangle({ x: cx - 30, y: H - 470, width: 60, height: 3, color: rgb(...C.gold) });
    p.drawText("BNM - Betreuung neuer Muslime - iman.ngo", { x: cx - font.widthOfTextAtSize("BNM - Betreuung neuer Muslime - iman.ngo", 8) / 2, y: H - 500, size: 8, font, color: rgb(...C.lgray) });

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Mentor-des-Monats-" + data.period + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}

// ─── Spenderbericht ──────────────────────────────────────────────────────────

export async function downloadDonorReportPDF(data: DonorReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const PDFLib = await loadPdfLib();
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const W = 595; const H = 842;
    const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

    // Deckblatt
    const p1 = doc.addPage([W, H]);
    p1.drawRectangle({ x: 0, y: H - 120, width: W, height: 120, color: rgb(...C.navy) });
    p1.drawText("BNM", { x: W / 2 - bold.widthOfTextAtSize("BNM", 42) / 2, y: H - 70, size: 42, font: bold, color: rgb(...C.gold) });
    p1.drawText("BETREUUNG NEUER MUSLIME", { x: W / 2 - font.widthOfTextAtSize("BETREUUNG NEUER MUSLIME", 8) / 2, y: H - 90, size: 8, font, color: rgb(...C.white) });
    p1.drawRectangle({ x: W / 2 - 30, y: H / 2 + 40, width: 60, height: 3, color: rgb(...C.gold) });
    p1.drawText("Spenderbericht", { x: W / 2 - bold.widthOfTextAtSize("Spenderbericht", 28) / 2, y: H / 2, size: 28, font: bold, color: rgb(...C.navy) });
    p1.drawText(data.periodLabel, { x: W / 2 - font.widthOfTextAtSize(data.periodLabel, 14) / 2, y: H / 2 - 24, size: 14, font, color: rgb(...C.gray) });
    p1.drawRectangle({ x: W / 2 - 30, y: H / 2 - 50, width: 60, height: 3, color: rgb(...C.gold) });
    p1.drawText("Erstellt am: " + today, { x: W / 2 - font.widthOfTextAtSize("Erstellt am: " + today, 9) / 2, y: H / 2 - 80, size: 9, font, color: rgb(...C.lgray) });
    p1.drawText("BNM - Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.lgray) });

    // KPIs
    const p2 = doc.addPage([W, H]);
    p2.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: rgb(...C.navy) });
    p2.drawText("Spenderbericht", { x: 40, y: H - 35, size: 14, font: bold, color: rgb(...C.white) });
    p2.drawText("Kennzahlen", { x: 40, y: H - 80, size: 16, font: bold, color: rgb(...C.navy) });
    p2.drawRectangle({ x: 40, y: H - 88, width: 40, height: 2, color: rgb(...C.gold) });

    const dk = [
      [String(data.kpis.activeMentorships), "Aktive Betreuungen"],
      [String(data.kpis.newRegistrations), "Neue Registrierungen"],
      [String(data.kpis.completedInPeriod), "Abgeschlossen"],
      [String(data.kpis.bnmBoxes), "BNM-Boxen"],
      [String(data.kpis.activeMentors), "Aktive Mentoren"],
      [String(data.kpis.wuduSessions + data.kpis.salahSessions + data.kpis.koranSessions), "Religioese Sessions"],
    ];
    dk.forEach(([v, l], i) => {
      const col = i % 3; const row = Math.floor(i / 3);
      const bx = 40 + col * 170; const by = H - 110 - row * 55;
      p2.drawRectangle({ x: bx, y: by - 50, width: 160, height: 50, borderColor: rgb(...C.border), borderWidth: 1 });
      p2.drawText(v, { x: bx + 10, y: by - 25, size: 22, font: bold, color: rgb(...C.navy) });
      p2.drawText(l, { x: bx + 10, y: by - 42, size: 8, font, color: rgb(...C.gray) });
    });

    // Zusammenfassung
    p2.drawText("Zusammenfassung", { x: 40, y: H - 260, size: 14, font: bold, color: rgb(...C.navy) });
    const w2 = data.summaryText.split(" ");
    let l2 = ""; let sy2 = H - 285;
    for (const w of w2) {
      const test = l2 ? l2 + " " + w : w;
      if (font.widthOfTextAtSize(test, 9) > W - 100) {
        p2.drawText(l2, { x: 50, y: sy2, size: 9, font, color: rgb(...C.navy) });
        sy2 -= 14; l2 = w;
      } else { l2 = test; }
    }
    if (l2) p2.drawText(l2, { x: 50, y: sy2, size: 9, font, color: rgb(...C.navy) });
    p2.drawText("BNM - Vertraulich", { x: 40, y: 30, size: 7, font, color: rgb(...C.lgray) });
    p2.drawText("Seite 2", { x: W - 70, y: 30, size: 7, font, color: rgb(...C.lgray) });

    const bytes = await doc.save();
    triggerDownload(bytes, "BNM-Spenderbericht-" + data.periodLabel + ".pdf");
    return true;
  } catch (err) {
    if (typeof window !== "undefined") window.alert("PDF-Fehler: " + String(err));
    return false;
  }
}
