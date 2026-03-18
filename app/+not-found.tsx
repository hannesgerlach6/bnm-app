import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/Colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Nicht gefunden" }} />
      <View style={styles.container}>
        <Text style={styles.title}>
          Seite nicht gefunden
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Zurück zum Dashboard</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: COLORS.bg,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  link: {
    marginTop: 16,
    paddingVertical: 16,
  },
  linkText: {
    color: COLORS.link,
  },
});
