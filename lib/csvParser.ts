// ============================================================
// CSV-Parser Utility
// Erkennt automatisch Trennzeichen (Komma oder Semikolon)
// Unterstützt Anführungszeichen, trimmt Whitespace, ignoriert Leerzeilen
// ============================================================

export interface CSVRow {
  [key: string]: string;
}

export function parseCSV(text: string): CSVRow[] {
  // BOM entfernen (Excel/Windows fügt unsichtbare Zeichen am Anfang hinzu)
  const cleaned = text.replace(/^\uFEFF/, "").replace(/^\xEF\xBB\xBF/, "");
  // Zeilenumbrüche normalisieren
  const lines = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Leere Zeilen herausfiltern
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 2) return [];

  // Trennzeichen ermitteln: Semikolon wenn häufiger als Komma in Header-Zeile
  const header = nonEmpty[0];
  const semicolonCount = (header.match(/;/g) || []).length;
  const commaCount = (header.match(/,/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ";" : ",";

  // Header parsen + normalisieren (flexible Zuordnung)
  const HEADER_MAP: Record<string, string> = {
    "name": "Name",
    "vorname": "Name",
    "e-mail": "E-Mail",
    "email": "E-Mail",
    "mail": "E-Mail",
    "geschlecht": "Geschlecht",
    "gender": "Geschlecht",
    "stadt": "Stadt",
    "city": "Stadt",
    "ort": "Stadt",
    "alter": "Alter",
    "age": "Alter",
    "telefon": "Telefon",
    "phone": "Telefon",
    "tel": "Telefon",
    "kontaktpräferenz": "Kontaktpräferenz",
    "kontaktpraferenz": "Kontaktpräferenz",
    "plz": "PLZ",
    "postleitzahl": "PLZ",
    "zip": "PLZ",
    "kontakt": "Kontaktpräferenz",
    "contact": "Kontaktpräferenz",
    "erfahrung": "Erfahrung",
    "experience": "Erfahrung",
  };
  const rawHeaders = parseLine(header, delimiter).map((h) => h.trim());
  const headers = rawHeaders.map((h) => HEADER_MAP[h.toLowerCase()] || h);

  const rows: CSVRow[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseLine(nonEmpty[i], delimiter);
    // Zeile überspringen wenn alle Felder leer
    if (values.every((v) => v.trim() === "")) continue;

    const row: CSVRow = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

// Parst eine CSV-Zeile respektiert Anführungszeichen
function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Doppelte Anführungszeichen = escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// ─── Mapping-Funktionen ───────────────────────────────────────────────────────

export function mapGender(value: string): "male" | "female" | null {
  const lower = value.toLowerCase().trim();
  if (["männlich", "m", "male", "bruder", "brother"].includes(lower)) return "male";
  if (["weiblich", "w", "female", "schwester", "sister"].includes(lower)) return "female";
  return null;
}

export function mapContactPreference(value: string): string {
  const lower = value.toLowerCase().trim();
  if (lower.includes("whatsapp")) return "whatsapp";
  if (lower.includes("telegram")) return "telegram";
  if (lower.includes("telefon") || lower.includes("phone")) return "phone";
  if (lower.includes("email") || lower.includes("e-mail") || lower.includes("mail")) return "email";
  return "whatsapp"; // Default
}

// ─── Template-Generierung ─────────────────────────────────────────────────────

export function getMenteeCSVTemplate(): string {
  const header = "Name,E-Mail,Geschlecht,Stadt,Alter,Telefon,Kontaktpräferenz";
  const example1 = "Thomas Müller,thomas@test.de,männlich,Berlin,25,+49 123 456,WhatsApp";
  const example2 = "Fatima Hassan,fatima@test.de,weiblich,Wien,30,+43 664 123,Telegram";
  return `${header}\n${example1}\n${example2}`;
}

export function getMentorCSVTemplate(): string {
  const header = "Name,E-Mail,Geschlecht,Stadt,Alter,Telefon,Kontaktpräferenz,Erfahrung";
  const example1 = "Ahmad Yilmaz,ahmad@test.de,männlich,Wien,30,+43 664 789,WhatsApp,3 Jahre Mentoring";
  const example2 = "Sara Khalil,sara@test.de,weiblich,Berlin,28,+49 176 123,Telegram,Ehrenamtliche Arbeit 2 Jahre";
  return `${header}\n${example1}\n${example2}`;
}

// ─── Validierung ──────────────────────────────────────────────────────────────

export interface ParsedMentee {
  name: string;
  email: string;
  gender: "male" | "female" | null;
  city: string;
  plz: string;
  age: number | null;
  phone: string;
  contactPreference: string;
}

export interface ParsedMentor extends ParsedMentee {
  experience: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMenteeRow(row: CSVRow, existingEmails: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Name
  const name = row["Name"]?.trim() || "";
  if (!name) errors.push("Name fehlt");

  // E-Mail
  const email = (row["E-Mail"] || row["Email"] || row["E-mail"] || "").trim();
  if (!email) {
    errors.push("E-Mail fehlt");
  } else if (!email.includes("@")) {
    errors.push("E-Mail ungültig");
  } else if (existingEmails.includes(email.toLowerCase())) {
    warnings.push("E-Mail bereits vorhanden (wird übersprungen)");
  }

  // Geschlecht
  const gender = mapGender(row["Geschlecht"] || row["Gender"] || "");
  if (!gender) errors.push("Geschlecht ungültig (erwartet: männlich/weiblich)");

  // Stadt
  const city = row["Stadt"] || row["City"] || "";
  if (!city.trim()) errors.push("Stadt fehlt");

  // Alter
  const ageStr = row["Alter"] || row["Age"] || "";
  const age = parseInt(ageStr, 10);
  if (!ageStr.trim()) errors.push("Alter fehlt");
  else if (isNaN(age) || age < 10 || age > 120) errors.push("Alter ungültig");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateMentorRow(row: CSVRow, existingEmails: string[]): ValidationResult {
  // Gleiche Pflichtfelder wie Mentee — Erfahrung ist optional
  return validateMenteeRow(row, existingEmails);
}

export function parseMenteeRow(row: CSVRow): ParsedMentee {
  return {
    name: row["Name"]?.trim() || "",
    email: (row["E-Mail"] || row["Email"] || row["E-mail"] || "").trim(),
    gender: mapGender(row["Geschlecht"] || row["Gender"] || ""),
    city: (row["Stadt"] || row["City"] || "").trim(),
    plz: (row["PLZ"] || row["Postleitzahl"] || "").trim(),
    age: parseInt(row["Alter"] || row["Age"] || "", 10) || null,
    phone: (row["Telefon"] || row["Phone"] || "").trim(),
    contactPreference: mapContactPreference(row["Kontaktpräferenz"] || row["Kontaktpraferenz"] || row["Contact"] || ""),
  };
}

export function parseMentorRow(row: CSVRow): ParsedMentor {
  return {
    ...parseMenteeRow(row),
    experience: (row["Erfahrung"] || row["Experience"] || "").trim(),
  };
}
