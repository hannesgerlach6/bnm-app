import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useThemeColors } from "../../contexts/ThemeContext";
import { geocodeAllUsers } from "../../lib/geocoding";

export default function ToolsTabScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const themeColors = useThemeColors();
  const [isGeocoding, setIsGeocoding] = useState(false);

  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessDenied, { color: themeColors.error }]}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  const showSystemSettings = user.role === "admin";

  async function handleGeocodeAllUsers() {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Koordinaten nachträglich setzen",
        "Für alle User ohne Koordinaten wird die PLZ per Nominatim API geocodiert (1 Request/Sekunde). Dies kann je nach Anzahl der User einige Minuten dauern.",
        [
          { text: "Abbrechen", onPress: () => resolve(false), style: "cancel" },
          { text: "Starten", onPress: () => resolve(true) },
        ]
      );
    });
    if (!confirmed) return;

    setIsGeocoding(true);
    const result = await geocodeAllUsers();
    setIsGeocoding(false);

    Alert.alert(
      "Geocoding abgeschlossen",
      `Gesamt: ${result.total}\nErfolgreich: ${result.success}\nFehlgeschlagen: ${result.failed}`
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>Tools</Text>
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
            {t("dashboard.quickLinks")}
          </Text>

          <View style={styles.toolGrid}>
            {showSystemSettings && (
              <TouchableOpacity
                style={[styles.toolItem, { backgroundColor: themeColors.card }]}
                onPress={() => router.push("/admin/session-types")}
              >
                <Ionicons name="list-outline" size={28} color={COLORS.gradientStart} />
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("dashboard.sessionTypes")}</Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>{t("tools.sessionTypesDesc")}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.toolItem, { backgroundColor: themeColors.card }]}
              onPress={() => router.push("/admin/qa-management" as never)}
            >
              <Ionicons name="help-circle-outline" size={28} color={COLORS.gold} />
              <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("qa.manage")}</Text>
            </TouchableOpacity>

            {showSystemSettings && (
              <TouchableOpacity
                style={[styles.toolItem, { backgroundColor: themeColors.card }]}
                onPress={() => router.push("/admin/hadithe-management" as never)}
              >
                <Ionicons name="book-outline" size={28} color={COLORS.cta} />
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("haditheMgmt.title")}</Text>
              </TouchableOpacity>
            )}

            {showSystemSettings && (
              <TouchableOpacity
                style={[styles.toolItem, { backgroundColor: themeColors.card, opacity: isGeocoding ? 0.6 : 1 }]}
                onPress={handleGeocodeAllUsers}
                disabled={isGeocoding}
              >
                {isGeocoding ? (
                  <ActivityIndicator size="small" color={COLORS.gradientStart} />
                ) : (
                  <Ionicons name="location-outline" size={28} color={COLORS.gradientStart} />
                )}
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>
                  {isGeocoding ? "Geocoding..." : "PLZ → Koordinaten"}
                </Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>
                  Fehlende lat/lng für alle User setzen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  accessDenied: { textAlign: "center" },
  pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3, textAlign: "center", marginBottom: 4 },
  pageSubtitle: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  toolItem: {
    width: "22%",
    minWidth: 80,
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 16,
  },
  toolSubLabel: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
    marginTop: 2,
  },
});
