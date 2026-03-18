import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import type { UserRole } from "../../types";
import { COLORS } from "../../constants/Colors";
import { BNMLogo } from "../../components/BNMLogo";

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginAs, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setErrorMsg("");
    const success = await login(email.trim(), password);
    if (!success) {
      setErrorMsg("E-Mail oder Passwort ist falsch.");
    }
  }

  function handleQuickLogin(role: UserRole) {
    setErrorMsg("");
    loginAs(role);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Header */}
        <View style={styles.header}>
          <BNMLogo size={72} showSubtitle={false} />
          <Text style={styles.logoTitle}>BNM</Text>
          <Text style={styles.logoSubtitle}>Betreuung neuer Muslime</Text>
          <View style={styles.goldDivider} />
        </View>

        {/* Login-Formular */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeTitle}>Willkommen</Text>
          <Text style={styles.welcomeSubtitle}>
            Melde dich an, um fortzufahren.
          </Text>

          {/* E-Mail */}
          <Text style={styles.fieldLabel}>E-Mail-Adresse</Text>
          <TextInput
            style={styles.input}
            placeholder="deine@email.de"
            placeholderTextColor="#98A2B3"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          {/* Passwort */}
          <Text style={styles.fieldLabel}>Passwort</Text>
          <TextInput
            style={styles.input}
            placeholder="Passwort"
            placeholderTextColor="#98A2B3"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Fehlermeldung */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Login-Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Anmelden</Text>
            )}
          </TouchableOpacity>

          {/* Registrierungs-Links */}
          <View style={styles.registerRow}>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register-mentee")}
            >
              <Text style={styles.linkText}>Mentee registrieren</Text>
            </TouchableOpacity>
            <Text style={styles.divider}>|</Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register-mentor")}
            >
              <Text style={styles.linkText}>Als Mentor bewerben</Text>
            </TouchableOpacity>
          </View>

          {/* Öffentliche Anmeldung */}
          <TouchableOpacity
            style={styles.publicRegisterButton}
            onPress={() => router.push("/(auth)/register-public")}
          >
            <Text style={styles.publicRegisterText}>
              Neu beim Islam? Hier anmelden →
            </Text>
          </TouchableOpacity>

          {/* Test-Schnellzugang */}
          <View style={styles.quickSection}>
            <Text style={styles.quickLabel}>SCHNELLZUGANG (ENTWICKLUNG)</Text>
            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => handleQuickLogin("admin")}
              >
                <Text style={styles.quickButtonText}>Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => handleQuickLogin("mentor")}
              >
                <Text style={styles.quickButtonText}>Mentor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => handleQuickLogin("mentee")}
              >
                <Text style={styles.quickButtonText}>Mentee</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.gradientStart,
    paddingTop: 52,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  logoTitle: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 3,
  },
  logoSubtitle: {
    color: COLORS.white,
    opacity: 0.75,
    fontSize: 13,
    textAlign: "center",
  },
  goldDivider: {
    marginTop: 18,
    width: 48,
    height: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  welcomeTitle: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    color: COLORS.secondary,
    fontSize: 14,
    marginBottom: 20,
  },
  fieldLabel: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.primary,
    marginBottom: 12,
    fontSize: 14,
    height: 42,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
  },
  loginButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  publicRegisterButton: {
    backgroundColor: "rgba(238,167,27,0.10)",
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  publicRegisterText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  linkText: {
    color: COLORS.link,
    fontSize: 13,
  },
  divider: {
    color: COLORS.tertiary,
    fontSize: 13,
  },
  quickSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginBottom: 28,
  },
  quickLabel: {
    color: COLORS.tertiary,
    fontSize: 10,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 1,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickButtonText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "500",
  },
});
