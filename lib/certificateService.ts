import { Platform } from "react-native";

export interface CertificateData {
  mentorName: string;
  mentorCity: string;
  completedMentorships: number;
  totalSessions: number;
  issueDate: string; // z.B. "1. April 2026"
}

/**
 * Generiert eine BNM-Mentor-Urkunde als PDF (Native) oder öffnet sie im Browser (Web).
 */
export async function generateMentorCertificate(data: CertificateData): Promise<void> {
  const html = buildCertificateHTML(data);

  if (Platform.OS === "web") {
    // Web: neues Fenster mit druckbarem HTML
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
    return;
  }

  // Native: expo-print → PDF → expo-sharing
  try {
    const Print = await import("expo-print");
    const Sharing = await import("expo-sharing");

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Urkunde – ${data.mentorName}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      await Print.printAsync({ html });
    }
  } catch (e: any) {
    throw new Error("PDF konnte nicht erstellt werden: " + (e?.message ?? e));
  }
}

function buildCertificateHTML(data: CertificateData): string {
  const { mentorName, mentorCity, completedMentorships, totalSessions, issueDate } = data;

  const mentorshipsText =
    completedMentorships === 1
      ? "1 Betreuung erfolgreich abgeschlossen"
      : `${completedMentorships} Betreuungen erfolgreich abgeschlossen`;

  const sessionsText =
    totalSessions === 1
      ? "1 Begegnung dokumentiert"
      : `${totalSessions} Begegnungen dokumentiert`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>BNM Mentor-Urkunde – ${mentorName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Open+Sans:wght@400;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Open Sans', Arial, sans-serif;
    background: #f5f0e8;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 40px 20px;
  }

  .certificate {
    background: #ffffff;
    width: 210mm;
    max-width: 100%;
    min-height: 148mm;
    padding: 50px 60px;
    border: 3px solid #0A3A5A;
    box-shadow: 0 8px 40px rgba(10,58,90,0.18);
    position: relative;
    text-align: center;
  }

  /* Eckornamente */
  .corner {
    position: absolute;
    width: 60px;
    height: 60px;
    border-color: #EEA71B;
    border-style: solid;
  }
  .corner-tl { top: 14px; left: 14px; border-width: 3px 0 0 3px; }
  .corner-tr { top: 14px; right: 14px; border-width: 3px 3px 0 0; }
  .corner-bl { bottom: 14px; left: 14px; border-width: 0 0 3px 3px; }
  .corner-br { bottom: 14px; right: 14px; border-width: 0 3px 3px 0; }

  /* Goldene Trennlinie */
  .gold-line {
    width: 120px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #EEA71B, transparent);
    margin: 12px auto;
  }

  .org-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 13px;
    letter-spacing: 4px;
    color: #EEA71B;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .cert-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 42px;
    font-weight: 700;
    color: #0A3A5A;
    line-height: 1.15;
    margin-bottom: 4px;
  }

  .cert-subtitle {
    font-size: 12px;
    letter-spacing: 3px;
    color: #8a9bb0;
    text-transform: uppercase;
    margin-bottom: 24px;
  }

  .award-text {
    font-size: 14px;
    color: #555;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }

  .recipient-name {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 36px;
    font-weight: 700;
    color: #0A3A5A;
    margin: 8px 0;
  }

  .recipient-city {
    font-size: 13px;
    color: #8a9bb0;
    margin-bottom: 24px;
    letter-spacing: 1px;
  }

  .description {
    font-size: 15px;
    color: #444;
    line-height: 1.8;
    max-width: 480px;
    margin: 0 auto 28px;
  }

  .stats-row {
    display: flex;
    gap: 30px;
    justify-content: center;
    margin: 20px 0 28px;
  }

  .stat-box {
    background: #f8f3e8;
    border: 1px solid #EEA71B;
    border-radius: 6px;
    padding: 12px 24px;
    min-width: 130px;
  }

  .stat-number {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 32px;
    font-weight: 700;
    color: #0A3A5A;
    line-height: 1;
  }

  .stat-label {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
  }

  .arabic-quote {
    font-size: 18px;
    color: #EEA71B;
    direction: rtl;
    margin-bottom: 4px;
    letter-spacing: 1px;
  }

  .hadith-text {
    font-style: italic;
    color: #777;
    font-size: 12px;
    margin-bottom: 28px;
  }

  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e8e0d0;
  }

  .signature-block {
    text-align: center;
  }

  .signature-line {
    width: 140px;
    height: 1px;
    background: #0A3A5A;
    margin: 0 auto 6px;
  }

  .signature-label {
    font-size: 11px;
    color: #888;
    letter-spacing: 0.5px;
  }

  .date-block {
    text-align: right;
    font-size: 12px;
    color: #888;
  }

  .date-label {
    font-weight: 600;
    color: #0A3A5A;
    display: block;
    margin-bottom: 2px;
  }

  @media print {
    body { background: white; padding: 0; }
    .certificate { box-shadow: none; border-color: #0A3A5A; }
  }
</style>
</head>
<body>
  <div class="certificate">
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <p class="org-name">BNM · Betreuung neuer Muslime</p>
    <div class="gold-line"></div>

    <h1 class="cert-title">Urkunde</h1>
    <p class="cert-subtitle">Mentor-Zertifikat</p>

    <p class="award-text">Hiermit wird bestätigt, dass</p>

    <p class="recipient-name">${mentorName}</p>
    <p class="recipient-city">${mentorCity}</p>

    <div class="gold-line"></div>

    <p class="description">
      im Rahmen des BNM-Mentoring-Programms mit vollem Einsatz und großer Hingabe<br/>
      neue Muslime auf ihrem Weg begleitet hat.
    </p>

    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-number">${completedMentorships}</div>
        <div class="stat-label">Betreuung${completedMentorships !== 1 ? "en" : ""}</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${totalSessions}</div>
        <div class="stat-label">Begegnung${totalSessions !== 1 ? "en" : ""}</div>
      </div>
    </div>

    <div class="gold-line"></div>

    <p class="arabic-quote">مَنْ كَانَ فِي حَاجَةِ أَخِيهِ كَانَ اللَّهُ فِي حَاجَتِهِ</p>
    <p class="hadith-text">„Wer für seinen Bruder da ist, für den ist Allah da." (Bukhari &amp; Muslim)</p>

    <div class="footer-row">
      <div class="signature-block">
        <div class="signature-line"></div>
        <p class="signature-label">BNM-Programmleitung</p>
        <p class="signature-label">neuemuslime.com · iERA</p>
      </div>
      <div class="date-block">
        <span class="date-label">Ausgestellt am</span>
        ${issueDate}
      </div>
    </div>
  </div>
</body>
</html>`;
}
