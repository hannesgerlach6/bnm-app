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
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SESSION_STEPS = [
  "Registrierung",
  "Zuweisung",
  "Erstkontakt",
  "Ersttreffen",
  "BNM-Box",
  "Wudu",
  "Salah",
  "Koran (5 Suren)",
  "Community",
  "Nachbetreuung",
];

const CONTACT_TIPS = [
  "Schreibe innerhalb von 24 Stunden nach der Zuweisung.",
  "Stelle dich kurz und persönlich vor.",
  "Erkläre das BNM-Programm auf einfache Weise.",
  "Vereinbare ein erstes Treffen in einer ruhigen Umgebung.",
  "Zeige echtes Interesse – jeder Mensch hat eine eigene Geschichte.",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = 3;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentPage(page);
  }

  function goToNext() {
    if (currentPage < totalPages - 1) {
      scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
    } else {
      router.replace("/(tabs)");
    }
  }

  function handleSkip() {
    router.replace("/(tabs)");
  }

  return (
    <Container>
      <View style={styles.root}>
        {/* Überspringen-Link */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Überspringen</Text>
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
          {/* Slide 1: Willkommen */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.slideInner}>
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>☪</Text>
                </View>
              </View>

              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>Willkommen bei BNM</Text>
              </View>

              <Text style={styles.slideTitle}>
                Betreuung neuer Muslime
              </Text>

              <Text style={styles.slideBody}>
                BNM ist ein strukturiertes Mentoring-Programm, das neue Muslime
                auf ihrem Weg begleitet. Als Mentor bist du eine wichtige
                Vertrauensperson – du bist der erste Ansprechpartner für Fragen
                zum Islam und zur muslimischen Gemeinschaft.
              </Text>

              <View style={styles.highlightBox}>
                <Text style={styles.highlightTitle}>Deine Rolle als Mentor</Text>
                <Text style={styles.highlightText}>
                  Du begleitest deinen Mentee durch 10 aufeinander aufbauende
                  Schritte – von der Registrierung bis zur langfristigen
                  Nachbetreuung.
                </Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statPill}>
                  <Text style={styles.statPillNumber}>10</Text>
                  <Text style={styles.statPillLabel}>Schritte</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statPillNumber}>1:1</Text>
                  <Text style={styles.statPillLabel}>Betreuung</Text>
                </View>
                <View style={styles.statPill}>
                  <Text style={styles.statPillNumber}>✓</Text>
                  <Text style={styles.statPillLabel}>Dokumentiert</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Slide 2: So funktioniert's */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.slideInner}>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>So funktioniert's</Text>
              </View>

              <Text style={styles.slideTitle}>
                Die 10 Mentoring-Schritte
              </Text>

              <Text style={styles.slideBody}>
                Jeder Schritt wird von dir dokumentiert. Erst nach
                Dokumentation wird der nächste Schritt freigeschaltet.
              </Text>

              <View style={styles.stepsGrid}>
                {SESSION_STEPS.map((step, idx) => (
                  <View key={idx} style={styles.stepItem}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.stepLabel}>{step}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  Alle Schritte sind sequenziell – kein Überspringen möglich.
                  So wird eine vollständige Begleitung sichergestellt.
                </Text>
              </View>
            </View>
          </View>

          {/* Slide 3: Los geht's */}
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.slideInner}>
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: COLORS.cta }]}>
                  <Text style={styles.iconText}>★</Text>
                </View>
              </View>

              <View style={[styles.headerBadge, { backgroundColor: "rgba(238,167,27,0.15)", borderColor: "rgba(238,167,27,0.4)" }]}>
                <Text style={[styles.headerBadgeText, { color: "#92600a" }]}>Tipps für den Erstkontakt</Text>
              </View>

              <Text style={styles.slideTitle}>Los geht's!</Text>

              <Text style={styles.slideBody}>
                Der erste Kontakt ist entscheidend. Hier sind einige Tipps
                für einen guten Start mit deinem Mentee:
              </Text>

              <View style={styles.tipsCard}>
                {CONTACT_TIPS.map((tip, idx) => (
                  <View key={idx} style={[styles.tipRow, idx < CONTACT_TIPS.length - 1 && styles.tipRowBorder]}>
                    <View style={styles.tipDot} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.reminderBox}>
                <Text style={styles.reminderTitle}>Wichtig: Geschlechtertrennung</Text>
                <Text style={styles.reminderText}>
                  Brüder betreuen nur Brüder, Schwestern nur Schwestern.
                  Diese Regel ist absolut verbindlich.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Dots-Indikator */}
        <View style={styles.dotsRow}>
          {Array.from({ length: totalPages }).map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                currentPage === idx ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity style={styles.ctaButton} onPress={goToNext}>
            <Text style={styles.ctaText}>
              {currentPage < totalPages - 1 ? "Weiter" : "Dashboard öffnen"}
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
    backgroundColor: COLORS.bg,
  },
  skipButton: {
    position: "absolute",
    top: 52,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    color: COLORS.secondary,
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
  slideInner: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 36,
    color: COLORS.white,
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
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 12,
    lineHeight: 32,
  },
  slideBody: {
    fontSize: 15,
    color: COLORS.secondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  highlightBox: {
    backgroundColor: "rgba(16,24,40,0.05)",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  highlightTitle: {
    fontWeight: "700",
    color: COLORS.primary,
    fontSize: 14,
    marginBottom: 6,
  },
  highlightText: {
    color: COLORS.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
  },
  statPillNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  statPillLabel: {
    fontSize: 11,
    color: COLORS.tertiary,
    marginTop: 2,
  },
  stepsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
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
    fontWeight: "bold",
    fontSize: 13,
  },
  stepLabel: {
    color: COLORS.primary,
    fontWeight: "500",
    fontSize: 14,
  },
  noteBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 10,
    padding: 14,
  },
  noteText: {
    color: "#1e40af",
    fontSize: 13,
    lineHeight: 19,
  },
  tipsCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
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
    borderBottomColor: COLORS.border,
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
    color: COLORS.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  reminderBox: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 10,
    padding: 14,
  },
  reminderTitle: {
    fontWeight: "700",
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
    backgroundColor: COLORS.border,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  ctaButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  ctaText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 16,
  },
});
