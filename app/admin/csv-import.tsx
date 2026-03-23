import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";
import { supabase } from "../../lib/supabase";
import { supabaseAnon } from "../../lib/supabaseAnon";
import { sendCredentialsEmail } from "../../lib/emailService";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import {
  parseCSV,
  validateMenteeRow,
  validateMentorRow,
  parseMenteeRow,
  parseMentorRow,
  getMenteeCSVTemplate,
  getMentorCSVTemplate,
  type CSVRow,
} from "../../lib/csvParser";

// ─── Typen ────────────────────────────────────────────────────────────────────

type TabType = "mentees" | "mentors";
type RowStatus = "valid" | "error" | "duplicate";

interface PreviewRow {
  index: number;
  raw: CSVRow;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  name: string;
  email: string;
  gender: string;
  city: string;
  plz: string;
  age: string;
}

interface ImportResult {
  created: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// ─── Hilfsfunction: Passwort generieren ──────────────────────────────────────

function generateTempPassword(): string {
  return "BNM-" + Math.floor(100000 + Math.random() * 900000);
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function CSVImportScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { users, refreshData } = useData();

  const [activeTab, setActiveTab] = useState<TabType>("mentees");
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);

  // Nur Admin/Office darf importieren
  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.errorText, { color: themeColors.error }]}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  // ─── CSV-Datei laden (nur Web) ──────────────────────────────────────────────

  const handleFileUpload = useCallback(() => {
    if (Platform.OS !== "web") return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!text) return;

        const rows = parseCSV(text);
        setParsedRows(rows);
        setImportResult(null);
        buildPreview(rows);
      };
      reader.readAsText(file, "UTF-8");
    };

    input.click();
  }, [activeTab, users]);

  // ─── Vorschau aufbauen ──────────────────────────────────────────────────────

  const buildPreview = useCallback(
    (rows: CSVRow[]) => {
      const existingEmails = users.map((u) => u.email.toLowerCase());

      const preview: PreviewRow[] = rows.map((row, idx) => {
        const validation =
          activeTab === "mentors"
            ? validateMentorRow(row, existingEmails)
            : validateMenteeRow(row, existingEmails);
        const isDuplicate = validation.warnings.some((w) =>
          w.includes("bereits vorhanden")
        );

        let status: RowStatus = "valid";
        if (!validation.valid) status = "error";
        else if (isDuplicate) status = "duplicate";

        const parsed = activeTab === "mentors" ? parseMentorRow(row) : parseMenteeRow(row);

        return {
          index: idx + 1,
          raw: row,
          status,
          errors: validation.errors,
          warnings: validation.warnings,
          name: parsed.name,
          email: parsed.email,
          gender: parsed.gender === "male" ? "Bruder" : parsed.gender === "female" ? "Schwester" : "?",
          city: parsed.city,
          plz: parsed.plz || "",
          age: parsed.age != null ? String(parsed.age) : "?",
        };
      });

      setPreviewRows(preview);
    },
    [users, activeTab]
  );

  // ─── Tab wechseln ───────────────────────────────────────────────────────────

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      setParsedRows([]);
      setPreviewRows([]);
      setImportResult(null);
      setProgress(0);
      setProgressTotal(0);
    },
    []
  );

  // ─── Vorlage herunterladen ──────────────────────────────────────────────────

  const handleDownloadTemplate = useCallback(() => {
    if (Platform.OS !== "web") return;

    const content =
      activeTab === "mentees" ? getMenteeCSVTemplate() : getMentorCSVTemplate();
    const filename =
      activeTab === "mentees"
        ? "BNM-Mentees-Vorlage.csv"
        : "BNM-Mentoren-Vorlage.csv";

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [activeTab]);

  // ─── Import-Logik ───────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const toImport = previewRows.filter((r) => r.status === "valid");
    if (toImport.length === 0) return;

    setIsImporting(true);
    setImportResult(null);
    setProgress(0);
    setProgressTotal(toImport.length);

    const result: ImportResult = { created: 0, failed: 0, skipped: 0, errors: [] };
    const skipped = previewRows.filter((r) => r.status === "duplicate").length;
    result.skipped = skipped;

    // Admin-Session EINMAL sichern am Anfang
    const { data: adminSessionData } = await supabase.auth.getSession();
    const adminSession = adminSessionData?.session ?? null;

    for (let i = 0; i < toImport.length; i++) {
      const previewRow = toImport[i];
      const raw = previewRow.raw;

      try {
        const role = activeTab === "mentees" ? "mentee" : "mentor";
        const parsed = activeTab === "mentors" ? parseMentorRow(raw) : parseMenteeRow(raw);
        const tempPassword = generateTempPassword();

        const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
          email: parsed.email,
          password: tempPassword,
          options: {
            data: {
              name: parsed.name,
              role,
              gender: parsed.gender ?? "male",
              city: parsed.city,
              plz: parsed.plz || "",
              age: parsed.age ?? 0,
            },
          },
        });

        if (signUpError) {
          if (
            signUpError.message.includes("already registered") ||
            signUpError.message.includes("User already registered")
          ) {
            result.skipped++;
          } else {
            result.failed++;
            result.errors.push(`${parsed.name}: ${signUpError.message}`);
          }
        } else if (signUpData?.user) {
          // Zugangsdaten per E-Mail versenden
          await sendCredentialsEmail(parsed.email, parsed.name, tempPassword);
          result.created++;
        } else {
          result.failed++;
          result.errors.push(`${parsed.name}: Unbekannter Fehler`);
        }
      } catch (err) {
        result.failed++;
        result.errors.push(`Zeile ${previewRow.index}: ${String(err)}`);
      }

      setProgress(i + 1);

      // Rate Limit vermeiden: 500ms Pause zwischen signUp-Aufrufen
      if (i < toImport.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Admin-Session EINMAL wiederherstellen am Ende
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }

    // Daten neu laden
    await refreshData();

    setIsImporting(false);
    setImportResult(result);
    setParsedRows([]);
    setPreviewRows([]);
    setProgress(0);
    setProgressTotal(0);
  }, [previewRows, activeTab, refreshData]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const validCount = previewRows.filter((r) => r.status === "valid").length;
  const duplicateCount = previewRows.filter((r) => r.status === "duplicate").length;
  const errorCount = previewRows.filter((r) => r.status === "error").length;

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: themeColors.text }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("csvImport.title")}</Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "mentees" && styles.tabActive]}
            onPress={() => handleTabChange("mentees")}
          >
            <Text
              style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === "mentees" && styles.tabTextActive]}
            >
              {t("csvImport.tabMentees")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "mentors" && styles.tabActive]}
            onPress={() => handleTabChange("mentors")}
          >
            <Text
              style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === "mentors" && styles.tabTextActive]}
            >
              {t("csvImport.tabMentors")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Aktionsbereich */}
        <View style={[styles.actionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          {Platform.OS === "web" ? (
            <>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleFileUpload}
                  disabled={isImporting}
                >
                  <Text style={styles.uploadButtonText}>
                    ↑ {t("csvImport.upload")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.templateButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                  onPress={handleDownloadTemplate}
                  disabled={isImporting}
                >
                  <Text style={[styles.templateButtonText, { color: themeColors.textSecondary }]}>
                    ↓ {t("csvImport.downloadTemplate")}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.uploadHint, { color: themeColors.textTertiary }]}>{t("csvImport.uploadHint")}</Text>
            </>
          ) : (
            <View style={[styles.nativeHintBox, { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7" }]}>
              <Text style={[styles.nativeHintText, { color: isDark ? "#fbbf24" : "#b45309" }]}>{t("csvImport.nativeHint")}</Text>
            </View>
          )}
        </View>

        {/* Ergebnis nach Import */}
        {importResult && (
          <View style={[styles.resultCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.resultTitle, { color: themeColors.text }]}>{t("csvImport.resultTitle")}</Text>
            <View style={styles.resultRow}>
              <View style={[styles.resultChip, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7" }]}>
                <Text style={[styles.resultChipValue, { color: themeColors.text }]}>{importResult.created}</Text>
                <Text style={[styles.resultChipLabel, { color: themeColors.textSecondary }]}>{t("csvImport.created")}</Text>
              </View>
              <View style={[styles.resultChip, { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7" }]}>
                <Text style={[styles.resultChipValue, { color: themeColors.text }]}>{importResult.skipped}</Text>
                <Text style={[styles.resultChipLabel, { color: themeColors.textSecondary }]}>{t("csvImport.skipped")}</Text>
              </View>
              <View style={[styles.resultChip, { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2" }]}>
                <Text style={[styles.resultChipValue, { color: themeColors.text }]}>{importResult.failed}</Text>
                <Text style={[styles.resultChipLabel, { color: themeColors.textSecondary }]}>{t("csvImport.failed")}</Text>
              </View>
            </View>
            {importResult.errors.length > 0 && (
              <View style={[styles.errorList, { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2" }]}>
                {importResult.errors.map((err, idx) => (
                  <Text key={idx} style={[styles.errorListItem, { color: isDark ? "#f87171" : "#b91c1c" }]}>
                    • {err}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Fortschritt während Import */}
        {isImporting && (
          <View style={[styles.progressCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <ActivityIndicator color={COLORS.gradientStart} size="small" />
            <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
              {t("csvImport.importing")}{" "}
              {t("csvImport.progress")
                .replace("{0}", String(progress))
                .replace("{1}", String(progressTotal))}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: themeColors.background }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: progressTotal > 0
                      ? `${Math.round((progress / progressTotal) * 100)}%`
                      : "0%",
                  } as any,
                ]}
              />
            </View>
          </View>
        )}

        {/* Vorschau-Tabelle */}
        {previewRows.length > 0 && !isImporting && (
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                {t("csvImport.preview")} ({previewRows.length})
              </Text>
              <View style={styles.previewStats}>
                {validCount > 0 && (
                  <View style={[styles.statBadgeGreen, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7" }]}>
                    <Text style={[styles.statBadgeText, { color: isDark ? "#4ade80" : "#15803d" }]}>{validCount} OK</Text>
                  </View>
                )}
                {duplicateCount > 0 && (
                  <View style={[styles.statBadgeYellow, { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7" }]}>
                    <Text style={[styles.statBadgeText, { color: isDark ? "#fbbf24" : "#b45309" }]}>{duplicateCount} Duplikat</Text>
                  </View>
                )}
                {errorCount > 0 && (
                  <View style={[styles.statBadgeRed, { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2" }]}>
                    <Text style={[styles.statBadgeText, { color: isDark ? "#f87171" : "#b91c1c" }]}>{errorCount} Fehler</Text>
                  </View>
                )}
              </View>
            </View>

            {previewRows.map((row) => (
              <View
                key={row.index}
                style={[
                  styles.previewRow,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border },
                  row.status === "valid" && styles.previewRowValid,
                  row.status === "error" && styles.previewRowError,
                  row.status === "duplicate" && styles.previewRowDuplicate,
                ]}
              >
                <View style={styles.previewRowHeader}>
                  <Text style={[styles.previewRowName, { color: themeColors.text }]}>
                    {row.index}. {row.name || "(kein Name)"}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      row.status === "valid" && { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7" },
                      row.status === "error" && { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2" },
                      row.status === "duplicate" && { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        row.status === "valid" && { color: isDark ? "#4ade80" : "#15803d" },
                        row.status === "error" && { color: isDark ? "#f87171" : "#b91c1c" },
                        row.status === "duplicate" && { color: isDark ? "#fbbf24" : "#b45309" },
                      ]}
                    >
                      {row.status === "valid"
                        ? t("csvImport.rowValid")
                        : row.status === "duplicate"
                        ? t("csvImport.rowDuplicate")
                        : t("csvImport.rowError")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.previewRowMeta, { color: themeColors.textTertiary }]}>
                  {row.email} · {row.gender} · {row.city} · {row.age} J.
                </Text>
                {row.errors.length > 0 && (
                  <Text style={styles.previewRowErrors}>
                    {row.errors.join(", ")}
                  </Text>
                )}
                {row.warnings.length > 0 && (
                  <Text style={styles.previewRowWarnings}>
                    {row.warnings.join(", ")}
                  </Text>
                )}
              </View>
            ))}

            {/* Import-Button */}
            {validCount > 0 && (
              <TouchableOpacity
                style={styles.importButton}
                onPress={handleImport}
                disabled={isImporting}
              >
                <Text style={styles.importButtonText}>
                  {t("csvImport.import")} ({validCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {parsedRows.length === 0 && previewRows.length === 0 && !importResult && Platform.OS === "web" && (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("csvImport.noPreview")}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { textAlign: "center" },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backBtnText: { fontSize: 24, fontWeight: "300" },
  pageTitle: { fontSize: 20, fontWeight: "700" },

  // Tabs
  tabRow: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: COLORS.gradientStart,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: COLORS.white,
  },

  // Aktionsbereich
  actionCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: COLORS.gradientStart,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  uploadButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 13,
  },
  templateButton: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  templateButtonText: {
    fontWeight: "600",
    fontSize: 13,
  },
  uploadHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  nativeHintBox: {
    borderRadius: 6,
    padding: 12,
  },
  nativeHintText: {
    fontSize: 13,
    textAlign: "center",
  },

  // Ergebnis
  resultCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    gap: 10,
  },
  resultChip: {
    flex: 1,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  resultChipGreen: {},
  resultChipYellow: {},
  resultChipRed: {},
  resultChipValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  resultChipLabel: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
  errorList: {
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
  },
  errorListItem: {
    fontSize: 12,
    marginBottom: 4,
  },

  // Fortschritt
  progressCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  progressText: {
    fontSize: 13,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.gradientStart,
    borderRadius: 3,
  },

  // Vorschau
  previewSection: { marginBottom: 16 },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  previewStats: { flexDirection: "row", gap: 6 },
  statBadgeGreen: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statBadgeYellow: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statBadgeRed: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statBadgeText: { fontSize: 11, fontWeight: "600" },

  // Vorschau-Zeilen
  previewRow: {
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  previewRowValid: {
    borderLeftColor: COLORS.cta,
  },
  previewRowError: {
    borderLeftColor: COLORS.error,
  },
  previewRowDuplicate: {
    borderLeftColor: COLORS.gold,
  },
  previewRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  previewRowName: {
    fontWeight: "600",
    fontSize: 13,
    flex: 1,
  },
  previewRowMeta: {
    fontSize: 12,
  },
  previewRowErrors: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: 4,
  },
  previewRowWarnings: {
    fontSize: 11,
    color: "#b45309",
    marginTop: 2,
  },

  // Status-Badges
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeGreen: {},
  statusBadgeRed: {},
  statusBadgeYellow: {},
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  // Import-Button
  importButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  importButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 15,
  },

  // Leer-Zustand
  emptyCard: {
    borderRadius: 8,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyText: {
    fontSize: 13,
  },
});
