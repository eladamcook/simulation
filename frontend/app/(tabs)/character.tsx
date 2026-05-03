import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { colors, STATUS_BARS } from "../../lib/theme";
import { useAuth } from "../../lib/auth";

const AVATAR_URL = "https://images.unsplash.com/photo-1684254285146-1b8b8db00a8b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2ODl8MHwxfHNlYXJjaHwxfHxuZW9uJTIwcG9ydHJhaXQlMjBmYWNlfGVufDB8fHx8MTc3NzgzNzgyMnww&ixlib=rb-4.1.0&q=85";

type Character = {
  character_name: string;
  status_bars: Record<string, number>;
  overall_level: number;
  total_xp: number;
  next_level_xp: number;
  email: string;
};

export default function CharacterScreen() {
  const [data, setData] = useState<Character | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const { refresh } = useAuth();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Character>("/character");
      setData(data);
      setName(data.character_name);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const adjust = async (bar: string, delta: number) => {
    try {
      const { data: res } = await api.post("/character/status/adjust", { bar, delta });
      setData((d) => (d ? { ...d, status_bars: res.status_bars } : d));
    } catch {}
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await api.put("/character/name", { character_name: trimmed });
      setData((d) => (d ? { ...d, character_name: trimmed } : d));
      setEditName(false);
      refresh();
    } catch {
      Alert.alert("Error", "Failed to update name");
    }
  };

  if (!data) return <View style={styles.bg} />;

  const xpPct = Math.min(100, Math.round((data.total_xp / Math.max(1, data.next_level_xp)) * 100));

  return (
    <SafeAreaView style={styles.bg} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.headerBar}>
          <Text style={styles.headerLabel}>// CHARACTER_PROFILE</Text>
          <Text style={styles.headerStatus}>● ONLINE</Text>
        </View>

        <View style={styles.avatarFrame}>
          <Image source={{ uri: AVATAR_URL }} style={styles.avatar} />
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>

        <TouchableOpacity testID="edit-name-button" onPress={() => setEditName(true)} style={styles.nameBlock}>
          <Text style={styles.nameLabel}>IDENTIFIER</Text>
          <Text testID="character-name" style={styles.nameValue}>{data.character_name}</Text>
          <Text style={styles.editHint}>{"> TAP TO RENAME"}</Text>
        </TouchableOpacity>

        <View style={styles.levelBadge}>
          <Text style={styles.levelLabel}>OVERALL LEVEL</Text>
          <Text testID="overall-level" style={styles.levelValue}>{`LV ${data.overall_level}`}</Text>
          <View style={styles.xpBarOuter}>
            <View style={[styles.xpBarInner, { width: `${xpPct}%` }]} />
          </View>
          <Text style={styles.xpText}>{`${data.total_xp} / ${data.next_level_xp} XP`}</Text>
        </View>

        <Text style={styles.sectionTitle}>// VITAL_STATS</Text>

        {STATUS_BARS.map((b) => {
          const value = data.status_bars[b.key] ?? 0;
          return (
            <View key={b.key} style={styles.barRow} testID={`status-${b.key}`}>
              <View style={styles.barHeader}>
                <Text style={[styles.barLabel, { color: b.color }]}>{b.label}</Text>
                <Text style={styles.barValue}>{`${value}/100`}</Text>
              </View>
              <View style={styles.barOuter}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.barSegment,
                      i < Math.floor(value / 5) ? { backgroundColor: b.color } : { backgroundColor: "rgba(255,255,255,0.05)" },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.barControls}>
                <TouchableOpacity testID={`status-${b.key}-minus`} onPress={() => adjust(b.key, -10)} style={styles.ctrlBtn}>
                  <Ionicons name="remove" size={20} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => adjust(b.key, -5)} style={styles.ctrlBtnSmall}>
                  <Text style={styles.ctrlText}>-5</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => adjust(b.key, 5)} style={styles.ctrlBtnSmall}>
                  <Text style={styles.ctrlText}>+5</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`status-${b.key}-plus`} onPress={() => adjust(b.key, 10)} style={styles.ctrlBtn}>
                  <Ionicons name="add" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={editName} transparent animationType="fade" onRequestClose={() => setEditName(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{"> RENAME CHARACTER"}</Text>
            <TextInput
              testID="rename-input"
              value={name}
              onChangeText={setName}
              style={styles.modalInput}
              placeholderTextColor={colors.textDim}
              maxLength={32}
              autoFocus
            />
            <View style={styles.modalRow}>
              <TouchableOpacity onPress={() => setEditName(false)} style={[styles.modalBtn, { borderColor: colors.textDim }]}>
                <Text style={[styles.modalBtnText, { color: colors.textDim }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="save-name-button" onPress={saveName} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  headerLabel: { color: colors.primary, fontSize: 12, letterSpacing: 3, fontWeight: "700" },
  headerStatus: { color: colors.green, fontSize: 11, letterSpacing: 2 },

  avatarFrame: {
    height: 220,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDim,
    overflow: "hidden",
    position: "relative",
  },
  avatar: { width: "100%", height: "100%" },
  cornerTL: { position: "absolute", top: 0, left: 0, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: colors.primary },
  cornerTR: { position: "absolute", top: 0, right: 0, width: 20, height: 20, borderTopWidth: 2, borderRightWidth: 2, borderColor: colors.primary },
  cornerBL: { position: "absolute", bottom: 0, left: 0, width: 20, height: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: colors.primary },
  cornerBR: { position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderBottomWidth: 2, borderRightWidth: 2, borderColor: colors.primary },

  nameBlock: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDim,
    padding: 14,
  },
  nameLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 3 },
  nameValue: { color: colors.text, fontSize: 24, fontWeight: "800", letterSpacing: 2, marginTop: 4 },
  editHint: { color: colors.purple, fontSize: 10, letterSpacing: 2, marginTop: 4 },

  levelBadge: {
    backgroundColor: "rgba(0,240,255,0.05)",
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 14,
    gap: 8,
  },
  levelLabel: { color: colors.primary, fontSize: 10, letterSpacing: 3 },
  levelValue: { color: colors.primary, fontSize: 28, fontWeight: "900", letterSpacing: 4 },
  xpBarOuter: { height: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.borderDim },
  xpBarInner: { height: "100%", backgroundColor: colors.primary },
  xpText: { color: colors.textDim, fontSize: 11, letterSpacing: 2 },

  sectionTitle: { color: colors.primary, fontSize: 14, letterSpacing: 3, fontWeight: "700", marginTop: 8 },

  barRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim, padding: 12, gap: 8 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 12, letterSpacing: 3, fontWeight: "700" },
  barValue: { color: colors.textDim, fontSize: 11, letterSpacing: 2 },
  barOuter: { flexDirection: "row", gap: 2, height: 14 },
  barSegment: { flex: 1, height: "100%" },
  barControls: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  ctrlBtn: {
    width: 44,
    height: 36,
    borderWidth: 1,
    borderColor: colors.borderDim,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnSmall: {
    width: 44,
    height: 36,
    borderWidth: 1,
    borderColor: colors.borderDim,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlText: { color: colors.text, fontSize: 13, fontWeight: "700" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, padding: 20, gap: 14 },
  modalTitle: { color: colors.primary, fontSize: 16, letterSpacing: 3, fontWeight: "700" },
  modalInput: { color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.primary, fontSize: 18, paddingVertical: 8 },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { color: colors.primary, fontSize: 13, letterSpacing: 3, fontWeight: "700" },
});
