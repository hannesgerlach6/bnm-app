import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS, SHADOWS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
export default function ToolsTabScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { refreshData } = useData();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);
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

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>Tools</Text>
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
            {t("dashboard.quickLinks")}
          </Text>

          <View style={styles.toolGrid}>
            {showSystemSettings && (
              <BNMPressable
                style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
                onPress={() => router.push("/admin/create-user" as never)}
                accessibilityRole="link"
                accessibilityLabel="Neuen User anlegen"
              >
                <View style={[styles.toolIconBg, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="person-add-outline" size={24} color={COLORS.error} />
                </View>
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>User anlegen</Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>Office, Admin, Mentor, Mentee</Text>
              </BNMPressable>
            )}

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

            {showSystemSettings && (
              <BNMPressable
                style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
                onPress={() => router.push("/admin/message-templates" as never)}
                accessibilityRole="link"
                accessibilityLabel="Nachrichtenvorlagen verwalten"
              >
                <View style={[styles.toolIconBg, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="mail-outline" size={24} color={COLORS.gold} />
                </View>
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>Nachrichtenvorlagen</Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>Chat- und E-Mail-Vorlagen</Text>
              </BNMPressable>
            )}

            {showSystemSettings && (
              <BNMPressable
                style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
                onPress={() => router.push("/admin/resources" as never)}
                accessibilityRole="link"
                accessibilityLabel="Ressourcen verwalten"
              >
                <View style={[styles.toolIconBg, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="link-outline" size={24} color="#7C3AED" />
                </View>
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>Ressourcen</Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>Links für Mentoren verwalten</Text>
              </BNMPressable>
            )}

            {showSystemSettings && (
              <BNMPressable
                style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
                onPress={() => router.push("/admin/calendar-management" as never)}
                accessibilityRole="link"
                accessibilityLabel="Kalender verwalten"
              >
                <View style={[styles.toolIconBg, { backgroundColor: "#E6F7F0" }]}>
                  <Ionicons name="calendar-outline" size={24} color={COLORS.cta} />
                </View>
                <Text style={[styles.toolLabel, { color: themeColors.text }]}>Kalender</Text>
                <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>Events verwalten</Text>
              </BNMPressable>
            )}

            <BNMPressable
              style={[styles.toolItem, { backgroundColor: themeColors.card, width: itemWidth }]}
              onPress={() => router.push("/admin/certificate-generator" as never)}
              accessibilityRole="link"
              accessibilityLabel="Zertifikate erstellen"
            >
              <View style={[styles.toolIconBg, { backgroundColor: "#FFF8E6" }]}>
                <Ionicons name="ribbon-outline" size={24} color={COLORS.gold} />
              </View>
              <Text style={[styles.toolLabel, { color: themeColors.text }]}>{t("certGen.toolTitle")}</Text>
              <Text style={[styles.toolSubLabel, { color: themeColors.textSecondary }]}>{t("certGen.toolDesc")}</Text>
            </BNMPressable>

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
