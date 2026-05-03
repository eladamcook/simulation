import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { colors } from "../lib/theme";

export default function Index() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (user) router.replace("/(tabs)/character");
    else router.replace("/login");
  }, [user]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Text style={styles.brand}>LIFETRACK_OS</Text>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  brand: {
    color: colors.primary,
    fontSize: 24,
    letterSpacing: 4,
    fontWeight: "700",
  },
});
