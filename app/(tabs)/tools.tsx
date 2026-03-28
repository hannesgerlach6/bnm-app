import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useThemeColors } from "../../contexts/ThemeContext";

export default function ToolsTabScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const themeColors = useThemeColors();

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
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  accessDenied: { textAlign: "center" },
  pageTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  pageSubtitle: { fontSize: 13, marginBottom: 20 },
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  toolItem: {
    width: "22%",
    minWidth: 80,
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
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
