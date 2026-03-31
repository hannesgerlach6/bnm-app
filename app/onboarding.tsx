import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";
import { BNMLogo } from "../components/BNMLogo";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export async function markOnboardingAsSeen(userId: string): Promise<void> {
  const key = `bnm_onboarding_seen_${userId}`;
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(key, "1");
    } else {
      try {
        // @ts-ignore
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.setItem(key, "1");
      } catch { /* AsyncStorage nicht verfügbar */ }
    }
  } catch { /* Fehler ignorieren */ }
}

export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  const key = `bnm_onboarding_seen_${userId}`;
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(key) === "1";
    } else {
      try {
        // @ts-ignore
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const val = await AsyncStorage.getItem(key);
        return val === "1";
      } catch { return false; }
    }
  } catch { return false; }
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const role = user?.role ?? "mentee";
  const isAdmin = role === "admin" || role === "office";
  const isMentee = role === "mentee";
  const totalPages = isAdmin ? 2 : 3;

  const SESSION_STEPS = [
    "Registrierung", "Zuweisung", "Erstkontakt", "Ersttreffen", "BNM-Box",
    "Wudu", "Salah", "Koran (5 Suren)", "Community", "Nachbetreuung",
  ];

  // Tips: Mentor nutzt die bestehenden Keys, Mentee bekommt eigene Keys
  const CONTACT_TIPS = isMentee
    ? [
        t("onboarding.mentee.tip1"),
        t("onboarding.mentee.tip2"),
        t("onboarding.mentee.tip3"),
        t("onboarding.mentee.tip4"),
        t("onboarding.mentee.tip5"),
      ]
    : [
        t("onboarding.tip1"),
        t("onboarding.tip2"),
        t("onboarding.tip3"),
        t("onboarding.tip4"),
        t("onboarding.tip5"),
      ];

  const ADMIN_TOOLS = [
    t("onboarding.admin.tool1"),
    t("onboarding.admin.tool2"),
    t("onboarding.admin.tool3"),
    t("onboarding.admin.tool4"),
  ];

  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentPage(page);
  }

  async function markSeen() {
    if (!user) return;
    await markOnboardingAsSeen(user.id);
  }

  async function goToNext() {
    if (currentPage < totalPages - 1) {
      scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
    } else {
      await markSeen();
      router.replace("/(tabs)");
    }
  }

  async function handleSkip() {
    await markSeen();
    router.replace("/(tabs)");
  }

  // ─────────────────────────────────────────────
  // Slide-Render-Helfer
  // ─────────────────────────────────────────────

  function renderMentorSlide1() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={styles.iconContainer}>
            <BNMLogo size={80} showSubtitle={false} />
          </View>

          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{t("onboarding.slide1Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>
            {t("onboarding.slide1Title")}
          </Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.slide1Body")}
          </Text>

          <View style={[styles.highlightBox, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.highlightTitle, { color: themeColors.text }]}>{t("onboarding.slide1HighlightTitle")}</Text>
            <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>
              {t("onboarding.slide1HighlightText")}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statPillNumber, { color: themeColors.text }]}>10</Text>
              <Text style={[styles.statPillLabel, { color: themeColors.textTertiary }]}>{t("onboarding.slide1Steps")}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statPillNumber, { color: themeColors.text }]}>1:1</Text>
              <Text style={[styles.statPillLabel, { color: themeColors.textTertiary }]}>{t("onboarding.slide1OneOnOne")}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statPillNumber, { color: themeColors.text }]}>✓</Text>
              <Text style={[styles.statPillLabel, { color: themeColors.textTertiary }]}>{t("onboarding.slide1Documented")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderMentorSlide2() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{t("onboarding.slide2Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>
            {t("onboarding.slide2Title")}
          </Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.slide2Body")}
          </Text>

          <View style={styles.stepsGrid}>
            {SESSION_STEPS.map((step, idx) => (
              <View key={idx} style={[styles.stepItem, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{idx + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: themeColors.text }]}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.noteBox, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff", borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
            <Text style={[styles.noteText, { color: isDark ? "#93c5fd" : "#1e40af" }]}>
              {t("onboarding.slide2Note")}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderMentorSlide3() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={styles.iconContainer}>
            <BNMLogo size={80} showSubtitle={false} />
          </View>

          <View style={[styles.headerBadge, { backgroundColor: "rgba(238,167,27,0.15)", borderColor: "rgba(238,167,27,0.4)" }]}>
            <Text style={[styles.headerBadgeText, { color: "#92600a" }]}>{t("onboarding.slide3Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>{t("onboarding.slide3Title")}</Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.slide3Body")}
          </Text>

          <View style={[styles.tipsCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {CONTACT_TIPS.map((tip, idx) => (
              <View key={idx} style={[styles.tipRow, idx < CONTACT_TIPS.length - 1 && [styles.tipRowBorder, { borderBottomColor: themeColors.border }]]}>
                <View style={styles.tipDot} />
                <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{tip}</Text>
              </View>
            ))}
          </View>

          <View style={styles.reminderBox}>
            <Text style={styles.reminderTitle}>{t("onboarding.reminderTitle")}</Text>
            <Text style={styles.reminderText}>
              {t("onboarding.reminderText")}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderMenteeSlide1() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={styles.iconContainer}>
            <BNMLogo size={80} showSubtitle={false} />
          </View>

          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{t("onboarding.mentee.slide1Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>
            {t("onboarding.mentee.slide1Title")}
          </Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.mentee.slide1Body")}
          </Text>

          <View style={[styles.highlightBox, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.highlightTitle, { color: themeColors.text }]}>{t("onboarding.mentee.slide1HighlightTitle")}</Text>
            <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>
              {t("onboarding.mentee.slide1HighlightText")}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statPillNumber, { color: themeColors.text }]}>10</Text>
              <Text style={[styles.statPillLabel, { color: themeColors.textTertiary }]}>{t("onboarding.slide1Steps")}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statPillNumber, { color: themeColors.text }]}>1:1</Text>
              <Text style={[styles.statPillLabel, { color: themeColors.textTertiary }]}>{t("onboarding.slide1OneOnOne")}</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statPillNumber, { color: themeColors.text }]}>✓</Text>
              <Text style={[styles.statPillLabel, { color: themeColors.textTertiary }]}>{t("onboarding.slide1Documented")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderMenteeSlide2() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{t("onboarding.mentee.slide2Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>
            {t("onboarding.mentee.slide2Title")}
          </Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.mentee.slide2Body")}
          </Text>

          <View style={styles.stepsGrid}>
            {SESSION_STEPS.map((step, idx) => (
              <View key={idx} style={[styles.stepItem, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{idx + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: themeColors.text }]}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.noteBox, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff", borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
            <Text style={[styles.noteText, { color: isDark ? "#93c5fd" : "#1e40af" }]}>
              {t("onboarding.mentee.slide2Note")}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderMenteeSlide3() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={styles.iconContainer}>
            <BNMLogo size={80} showSubtitle={false} />
          </View>

          <View style={[styles.headerBadge, { backgroundColor: "rgba(238,167,27,0.15)", borderColor: "rgba(238,167,27,0.4)" }]}>
            <Text style={[styles.headerBadgeText, { color: "#92600a" }]}>{t("onboarding.mentee.slide3Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>{t("onboarding.mentee.slide3Title")}</Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.mentee.slide3Body")}
          </Text>

          <View style={[styles.tipsCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {CONTACT_TIPS.map((tip, idx) => (
              <View key={idx} style={[styles.tipRow, idx < CONTACT_TIPS.length - 1 && [styles.tipRowBorder, { borderBottomColor: themeColors.border }]]}>
                <View style={styles.tipDot} />
                <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderAdminSlide1() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={styles.iconContainer}>
            <BNMLogo size={80} showSubtitle={false} />
          </View>

          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{t("onboarding.admin.slide1Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>
            {t("onboarding.admin.slide1Title")}
          </Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.admin.slide1Body")}
          </Text>

          <View style={[styles.highlightBox, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.highlightTitle, { color: themeColors.text }]}>{t("onboarding.admin.slide1HighlightTitle")}</Text>
            <Text style={[styles.highlightText, { color: themeColors.textSecondary }]}>
              {t("onboarding.admin.slide1HighlightText")}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  function renderAdminSlide2() {
    return (
      <ScrollView
        style={[styles.slide, { width: SCREEN_WIDTH }]}
        contentContainerStyle={styles.slideScrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.slideInner}>
          <View style={[styles.headerBadge, { backgroundColor: "rgba(238,167,27,0.15)", borderColor: "rgba(238,167,27,0.4)" }]}>
            <Text style={[styles.headerBadgeText, { color: "#92600a" }]}>{t("onboarding.admin.slide2Badge")}</Text>
          </View>

          <Text style={[styles.slideTitle, { color: themeColors.text }]}>
            {t("onboarding.admin.slide2Title")}
          </Text>

          <Text style={[styles.slideBody, { color: themeColors.textSecondary }]}>
            {t("onboarding.admin.slide2Body")}
          </Text>

          <View style={[styles.tipsCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {ADMIN_TOOLS.map((tool, idx) => (
              <View key={idx} style={[styles.tipRow, idx < ADMIN_TOOLS.length - 1 && [styles.tipRowBorder, { borderBottomColor: themeColors.border }]]}>
                <View style={styles.tipDot} />
                <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{tool}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────
  // Slides zusammenstellen je nach Rolle
  // ─────────────────────────────────────────────
  function renderSlides() {
    if (isAdmin) {
      return (
        <>
          {renderAdminSlide1()}
          {renderAdminSlide2()}
        </>
      );
    }
    if (isMentee) {
      return (
        <>
          {renderMenteeSlide1()}
          {renderMenteeSlide2()}
          {renderMenteeSlide3()}
        </>
      );
    }
    // Mentor (default)
    return (
      <>
        {renderMentorSlide1()}
        {renderMentorSlide2()}
        {renderMentorSlide3()}
      </>
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Überspringen-Link */}
        <TouchableOpacity style={[styles.skipButton, { top: insets.top + 12 }]} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: themeColors.textSecondary }]}>{t("onboarding.skip")}</Text>
        </TouchableOpacity>

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {renderSlides()}
        </ScrollView>

        {/* Dots-Indikator */}
        <View style={styles.dotsRow}>
          {Array.from({ length: totalPages }).map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                currentPage === idx ? styles.dotActive : [styles.dotInactive, { backgroundColor: themeColors.border }],
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity style={styles.ctaButton} onPress={goToNext}>
            <Text style={styles.ctaText}>
              {currentPage < totalPages - 1 ? t("onboarding.next") : t("onboarding.openDashboard")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  skipButton: {
    position: "absolute",
    // top wird dynamisch via insets.top + 12 gesetzt (SafeAreaInsets-Fix für iOS)
    right: 20,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // no extra styles needed, slides handle width
  },
  slide: {
    flex: 1,
    paddingTop: 80,
  },
  slideScrollContent: {
    flexGrow: 1,
  },
  slideInner: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,24,40,0.08)",
    borderWidth: 1,
    borderColor: "rgba(16,24,40,0.15)",
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 12,
    lineHeight: 32,
  },
  slideBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  highlightBox: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  highlightTitle: {
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 6,
  },
  highlightText: {
    fontSize: 13,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 9,
    alignItems: "center",
  },
  statPillNumber: {
    fontSize: 20,
    fontWeight: "800",
  },
  statPillLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  stepsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumberText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 13,
  },
  stepLabel: {
    fontWeight: "500",
    fontSize: 14,
  },
  noteBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
  },
  tipsCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    gap: 12,
  },
  tipRowBorder: {
    borderBottomWidth: 1,
  },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
    marginTop: 6,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  reminderBox: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 12,
    padding: 18,
  },
  reminderTitle: {
    fontWeight: "800",
    color: "#9a3412",
    fontSize: 13,
    marginBottom: 4,
  },
  reminderText: {
    color: "#c2410c",
    fontSize: 13,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    width: 8,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  ctaText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 16,
  },
});
