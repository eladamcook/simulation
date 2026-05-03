import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { colors } from "../../lib/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<{ skills: number; quests: number; completed: number; total_xp: number }>({
    skills: 0,
    quests: 0,
    completed: 0,
    total_xp: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [s, q, c] = await Promise.all([api.get("/skills"), api.get("/quests"), api.get("/character")]);
        const completed = (q.data as any[]).filter((x) => x.completed).length;
        setStats({ skills: s.data.length, quests: q.data.length, completed, total_xp: c.data.total_xp });
      } catch {}
    })();
  }, []);

  const onLogout = () => {
    Alert.alert("Log Out", "Disconnect from the grid?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.bg} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>// USER_PROFILE</Text>

        <View style={styles.card}>
          <Text style={styles.label}>EMAIL</Text>
          <Text testID="profile-email" style={styles.value}>{user?.email || "—"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>CHARACTER</Text>
          <Text style={styles.value}>{user?.character_name || "—"}</Text>
        </View>

        <Text style={styles.section}>// STATISTICS</Text>

        <View style={styles.statsGrid}>
          <Stat label="SKILLS" value={stats.skills} color={colors.primary} />
          <Stat label="QUESTS" value={stats.quests} color={colors.purple} />
          <Stat label="COMPLETE" value={stats.completed} color={colors.green} />
          <Stat label="TOTAL XP" value={stats.total_xp} color={colors.yellow} />
        </View>

        <TouchableOpacity testID="logout-button" onPress={onLogout} style={styles.logoutBtn}>
          <Ionicons name="power" size={18} color={colors.secondary} />
          <Text style={styles.logoutText}>DISCONNECT</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>LIFETRACK_OS v1.0 // BUILD 2026.02</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBox, { borderColor: color + "55" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { color: colors.primary, fontSize: 16, letterSpacing: 3, fontWeight: "700", marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim, padding: 14 },
  label: { color: colors.textDim, fontSize: 10, letterSpacing: 3 },
  value: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 4, letterSpacing: 1 },
  section: { color: colors.primary, fontSize: 14, letterSpacing: 3, fontWeight: "700", marginTop: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, padding: 16, alignItems: "center", gap: 4 },
  statValue: { fontSize: 28, fontWeight: "900", letterSpacing: 2 },
  statLabel: { color: colors.textDim, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingVertical: 14,
    marginTop: 16,
  },
  logoutText: { color: colors.secondary, fontSize: 13, letterSpacing: 3, fontWeight: "800" },
  footer: { color: colors.textDim, fontSize: 10, letterSpacing: 2, textAlign: "center", marginTop: 16 },
});
