import { Platform } from "react-native";

// ============================================================
// PDF-Generator für BNM-Berichte
// HTML-basierte Lösung via window.open + window.print()
// NUR auf Web verfügbar.
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

// ─── HTML-Generator: Monatsbericht ───────────────────────────────────────────

function generateReportHTML(data: ReportData): string {
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>BNM Monatsbericht - ${data.periodLabel}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Helvetica, Arial, sans-serif; color: #101828; margin: 0; padding: 40px; }
    .logo { font-size: 36px; font-weight: bold; color: #EEA71B; text-align: center; }
    .logo-sub { font-size: 10px; color: #475467; letter-spacing: 3px; text-align: center; }
    .gold-line { width: 60px; height: 3px; background: #EEA71B; margin: 20px auto; }
    .title { font-size: 28px; font-weight: bold; color: #0A3A5A; text-align: center; }
    .subtitle { font-size: 14px; color: #475467; text-align: center; margin-bottom: 8px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .kpi-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    .kpi-value { font-size: 24px; font-weight: bold; color: #0A3A5A; }
    .kpi-label { font-size: 9px; color: #475467; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-title { font-size: 16px; font-weight: bold; color: #0A3A5A; margin-top: 24px; margin-bottom: 8px; }
    .section-line { width: 40px; height: 2px; background: #EEA71B; margin-bottom: 16px; }
    .highlight { background: #FEF3C7; border-left: 3px solid #EEA71B; border-radius: 8px; padding: 14px; margin: 16px 0; }
    .highlight-label { font-size: 9px; color: #92400E; font-weight: bold; }
    .highlight-value { font-size: 18px; font-weight: bold; color: #101828; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #F9FAFB; text-align: left; font-size: 8px; color: #475467; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    td { font-size: 9px; padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
    tr:nth-child(even) { background: #FAFAFA; }
    .summary { background: #F9FAFB; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 7px; color: #98A2B3; }
    .page-break { page-break-before: always; }
    .info { font-size: 10px; color: #98A2B3; text-align: center; }
    @media print { body { padding: 0; } }
  </style>
</head><body>
  <!-- Seite 1: Deckblatt -->
  <div style="text-align:center; padding-top:200px;">
    <div class="logo">BNM</div>
    <div class="logo-sub">BETREUUNG NEUER MUSLIME</div>
    <div class="gold-line"></div>
    <div class="title">Monatsbericht</div>
    <div class="subtitle">${data.periodLabel}</div>
    <div class="gold-line"></div>
    <div class="info">Erstellt am: ${today}</div>
    <div class="info">BNM – Ein iERA Projekt in Kooperation mit IMAN</div>
  </div>
  <div class="footer"><span>BNM · Vertraulich</span><span>iman.ngo</span><span>Seite 1</span></div>

  <!-- Seite 2: KPIs -->
  <div class="page-break"></div>
  <div class="section-title">Kennzahlen-Übersicht</div>
  <div class="section-line"></div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-value">${data.kpis.activeBetreuungen}</div><div class="kpi-label">Aktive Betreuungen</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:#15803d">${data.kpis.abgeschlossen}</div><div class="kpi-label">Abgeschlossen</div></div>
    <div class="kpi-card"><div class="kpi-value">${data.kpis.mentoren}</div><div class="kpi-label">Mentoren</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:#EEA71B">${data.kpis.mentees}</div><div class="kpi-label">Mentees gesamt</div></div>
    <div class="kpi-card"><div class="kpi-value">${data.kpis.sessions}</div><div class="kpi-label">Sessions gesamt</div></div>
    <div class="kpi-card"><div class="kpi-value">${data.kpis.neueBetreuungen}</div><div class="kpi-label">Neue Betreuungen</div></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-value">${data.kpis.wuduSessions}</div><div class="kpi-label">Wudu-Sessions</div></div>
    <div class="kpi-card"><div class="kpi-value">${data.kpis.salahSessions}</div><div class="kpi-label">Salah-Sessions</div></div>
    <div class="kpi-card"><div class="kpi-value">${data.kpis.koranSessions}</div><div class="kpi-label">Koran-Sessions</div></div>
  </div>
  ${data.mentorOfMonth ? `<div class="highlight"><div class="highlight-label">★ MENTOR DES MONATS</div><div class="highlight-value">${data.mentorOfMonth.name}</div><div style="font-size:9px;color:#475467;margin-top:4px">${data.mentorOfMonth.score} Punkte · ${data.mentorOfMonth.completed} Abschlüsse · ${data.mentorOfMonth.sessions} Sessions</div></div>` : ""}
  <div class="footer"><span>BNM · Vertraulich</span><span>iman.ngo</span><span>Seite 2</span></div>

  <!-- Seite 3: Rangliste -->
  <div class="page-break"></div>
  <div class="section-title">Mentor-Rangliste</div>
  <div class="section-line"></div>
  <table>
    <tr><th>#</th><th>Name</th><th>Score</th><th>Sessions</th><th>Abschlüsse</th><th>Bewertung</th></tr>
    ${data.rankings.slice(0, 20).map((m) => `<tr><td style="${m.rank <= 3 ? "font-weight:bold;color:#EEA71B" : ""}">${m.rank}</td><td style="${m.rank <= 3 ? "font-weight:bold" : ""}">${m.name}</td><td>${m.score}</td><td>${m.sessions}</td><td>${m.completed}</td><td>${m.rating !== null ? m.rating.toFixed(1) + " ★" : "–"}</td></tr>`).join("")}
  </table>
  <div class="footer"><span>BNM · Vertraulich</span><span>iman.ngo</span><span>Seite 3</span></div>

  <!-- Seite 4: Zusammenfassung -->
  <div class="page-break"></div>
  <div class="section-title">Zusammenfassung</div>
  <div class="section-line"></div>
  <div class="summary"><p>${data.summaryText}</p></div>
  <div class="summary" style="margin-top:16px"><p style="color:#98A2B3;font-size:9px">Dieser Bericht wurde automatisch generiert. BNM – Ein iERA Projekt in Kooperation mit IMAN (iman.ngo).</p></div>
  <div class="footer"><span>BNM · Vertraulich</span><span>iman.ngo</span><span>Seite 4</span></div>
</body></html>`;
}

// ─── HTML-Generator: Mentor Award ────────────────────────────────────────────

function generateAwardHTML(data: AwardData): string {
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>BNM Mentor des Monats - ${data.period}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Helvetica, Arial, sans-serif; color: #101828; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .award-page { border: 3px solid #EEA71B; border-radius: 16px; margin: 30px; padding: 60px 40px; text-align: center; }
    .logo { font-size: 36px; font-weight: bold; color: #EEA71B; }
    .logo-sub { font-size: 10px; color: #475467; letter-spacing: 4px; margin-bottom: 8px; }
    .gold-line { width: 60px; height: 3px; background: #EEA71B; margin: 20px auto; }
    .label { font-size: 11px; color: #475467; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 8px; }
    .award-title { font-size: 26px; font-weight: bold; color: #0A3A5A; margin-bottom: 4px; }
    .period { font-size: 14px; color: #475467; font-style: italic; margin-bottom: 24px; }
    .name { font-size: 32px; font-weight: bold; color: #EEA71B; margin-bottom: 24px; }
    .stats { display: flex; justify-content: center; gap: 20px; margin-bottom: 24px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 20px; min-width: 90px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #0A3A5A; }
    .stat-label { font-size: 9px; color: #475467; margin-top: 4px; }
    .footer-text { font-size: 9px; color: #98A2B3; margin-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head><body>
  <div class="award-page">
    <div class="logo">BNM</div>
    <div class="logo-sub">BETREUUNG NEUER MUSLIME</div>
    <div class="gold-line"></div>
    <div class="label">AUSZEICHNUNG</div>
    <div class="award-title">Mentor des Monats</div>
    <div class="period">${data.period}</div>
    <div class="gold-line"></div>
    <div class="name">${data.mentorName}</div>
    <div class="stats">
      <div class="stat"><div class="stat-value">${data.score}</div><div class="stat-label">Punkte</div></div>
      <div class="stat"><div class="stat-value">${data.completed}</div><div class="stat-label">Abschlüsse</div></div>
      <div class="stat"><div class="stat-value">${data.sessions}</div><div class="stat-label">Sessions</div></div>
    </div>
    <div class="gold-line"></div>
    <div class="footer-text">BNM – Betreuung neuer Muslime · iman.ngo</div>
    <div class="footer-text">Ein iERA Projekt in Kooperation mit IMAN</div>
    <div class="footer-text" style="margin-top:12px;font-size:8px">Erstellt am: ${today}</div>
  </div>
</body></html>`;
}

// ─── Download-Funktionen ─────────────────────────────────────────────────────

// Öffnet ein neues Fenster mit dem Bericht-HTML.
// Der User kann dort "Speichern als PDF" wählen (Strg+P → PDF).
// Das Fenster zeigt NUR den Bericht, keine App-UI.
function openReportWindow(html: string, title: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.document.title = title;
  return true;
}

export async function downloadMonthlyReportPDF(data: ReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  const html = generateReportHTML(data);
  return openReportWindow(html, `BNM Monatsbericht - ${data.periodLabel}`);
}

export async function downloadMentorAwardPDF(data: AwardData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  const html = generateAwardHTML(data);
  return openReportWindow(html, `BNM Mentor des Monats - ${data.period}`);
}
