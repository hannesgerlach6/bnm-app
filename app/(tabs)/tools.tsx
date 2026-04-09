import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS, SHADOWS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { geocodeAllUsers } from "../../lib/geocoding";

export default function ToolsTabScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [isGeocoding, setIsGeocoding] = useState(false);
  // Auf Mobile: 2-Spalten-Grid; auf Web/Desktop: flexibles Layout
  const isMobileLayout = Platform.OS !== "web" || width < 600;
  const itemWidth = isMobileLayout ? "48%" : undefined;

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
              <BNMPressable
                style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
                onPress={() => router.push("/admin/session-types")}
                accessibilityRole="link"
                accessibilityLabel="Sitzungstypen verwalten"
              >
                <View style={[styles.toolIconBg, { backgroundColor: "#E8F0FE" }]}>
                  <Ionicons name="list-outline" size={24} color={COLORS.gradientStart} />
                </View>
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("dashboard.sessionTypes")}</Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>{t("tools.sessionTypesDesc")}</Text>
              </BNMPressable>
            )}

            <BNMPressable
              style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
              onPress={() => router.push("/admin/qa-management" as never)}
              accessibilityRole="link"
              accessibilityLabel="Fragen und Antworten verwalten"
            >
              <View style={[styles.toolIconBg, { backgroundColor: "#FFF8E6" }]}>
                <Ionicons name="help-circle-outline" size={24} color={COLORS.gold} />
              </View>
              <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("qa.manage")}</Text>
              <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>{t("tools.qaDesc")}</Text>
            </BNMPressable>

            {showSystemSettings && (
              <BNMPressable
                style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
                onPress={() => router.push("/admin/hadithe-management" as never)}
                accessibilityRole="link"
                accessibilityLabel="Hadithe verwalten"
              >
                <View style={[styles.toolIconBg, { backgroundColor: "#ECFDF5" }]}>
                  <Ionicons name="book-outline" size={24} color={COLORS.cta} />
                </View>
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("haditheMgmt.title")}</Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>{t("tools.hadithDesc")}</Text>
              </BNMPressable>
            )}

            <BNMPressable
              style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
              onPress={() => router.push("/admin/message-templates" as never)}
            >
              <View style={[styles.toolIconBg, { backgroundColor: isDark ? "#2A2518" : "#FFF8E6" }]}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.gold} />
              </View>
              <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("templates.manage")}</Text>
              <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>{t("templates.manageDesc")}</Text>
            </BNMPressable>

            <BNMPressable
              style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
              onPress={() => router.push("/admin/certificate-generator" as never)}
            >
              <View style={[styles.toolIconBg, { backgroundColor: "#FFF8E6" }]}>
                <Ionicons name="ribbon-outline" size={24} color={COLORS.gold} />
              </View>
              <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("certGen.toolTitle")}</Text>
              <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>{t("certGen.toolDesc")}</Text>
            </BNMPressable>

            {showSystemSettings && (
              <BNMPressable
                style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth, opacity: isGeocoding ? 0.6 : 1 }]}
                onPress={handleGeocodeAllUsers}
                disabled={isGeocoding}
              >
                <View style={[styles.toolIconBg, { backgroundColor: "#E8F0FE" }]}>
                  {isGeocoding ? (
                    <ActivityIndicator size="small" color={COLORS.gradientStart} />
                  ) : (
                    <Ionicons name="location-outline" size={24} color={COLORS.gradientStart} />
                  )}
                </View>
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>
                  {isGeocoding ? "Geocoding..." : "PLZ → Koordinaten"}
                </Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>
                  Fehlende lat/lng für alle User setzen
                </Text>
              </BNMPressable>
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
    justifyContent: "space-between",
  },
  toolItem: {
    borderRadius: RADIUS.lg,
    padding: 16,
    alignItems: "center",
    gap: 10,
    ...SHADOWS.md,
    // Ohne explizite Breite: flex für Web/breite Screens
    flex: Platform.OS === "web" ? 1 : undefined,
    minWidth: Platform.OS === "web" ? 120 : undefined,
  },
  toolIconBg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 17,
  },
  toolSubLabel: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
});
