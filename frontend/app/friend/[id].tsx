import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, formatApiError } from "../../lib/api";
import { colors, STATUS_BARS } from "../../lib/theme";

type Skill = {
  id: string;
  name: string;
  description: string;
  color: string;
  total_xp: number;
  level: number;
  current_xp: number;
  next_level_xp: number;
};

type Profile = {
  user_id: string;
  character_name: string;
  friend_code: string;
  status_bars: Record<string, number>;
  overall_level: number;
  total_xp: number;
  next_level_xp: number;
  skills: Skill[];
  relationship: number | null;
};

export default function FriendDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [xp, setXp] = useState("50");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [deadlineDays, setDeadlineDays] = useState("3");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<Profile>(`/users/${id}/profile`);
      setProfile(data);
    } catch (e: any) {
      Alert.alert("Error", formatApiError(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unfriend = () => {
    Alert.alert("Unfriend", `Disconnect from ${profile?.character_name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/friends/${id}`);
            router.back();
          } catch (e: any) {
            Alert.alert("Failed", formatApiError(e));
          }
        },
      },
    ]);
  };

  const assignQuest = async () => {
    if (!title.trim()) return;
    const xpNum = parseInt(xp, 10);
    if (isNaN(xpNum) || xpNum < 1) {
      Alert.alert("Invalid XP", "Reward must be at least 1");
      return;
    }
    let deadline: string | null = null;
    const days = parseInt(deadlineDays, 10);
    if (!isNaN(days) && days > 0) {
      deadline = new Date(Date.now() + days * 86400 * 1000).toISOString();
    }
    try {
      await api.post(`/friends/${id}/quests`, {
        title: title.trim(),
        description: desc.trim(),
        xp_reward: xpNum,
        skill_id: skillId,
        to_user_id: id,
        deadline,
      });
      const swing = Math.max(1, Math.floor(xpNum / 5));
      Alert.alert(
        "Quest Sent",
        `Sent to ${profile?.character_name}.\n+${swing} relationship if completed, -${swing} if declined or expired.`
      );
      setModalOpen(false);
      setTitle("");
      setDesc("");
      setXp("50");
      setSkillId(null);
    } catch (e: any) {
      Alert.alert("Failed", formatApiError(e));
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.bg} edges={["top"]}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.textDim }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rel = profile.relationship ?? 50;
  const relColor = rel >= 70 ? colors.green : rel >= 35 ? colors.yellow : colors.secondary;

  return (
    <SafeAreaView style={styles.bg} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="friend-back-button" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>// PROFILE_VIEW</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.charName} testID="profile-character-name">{profile.character_name}</Text>
          <Text style={styles.codeText}>{`#${profile.friend_code}`}</Text>

          <View style={styles.relPanel}>
            <Text style={styles.relTitle}>RELATIONSHIP</Text>
            <Text style={[styles.relValue, { color: relColor }]}>{`${rel}/100`}</Text>
            <View style={styles.barOuter}>
              <View style={[styles.barInner, { width: `${rel}%`, backgroundColor: relColor }]} />
            </View>
          </View>

          <View style={styles.levelRow}>
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>{`LV ${profile.overall_level}`}</Text>
            </View>
            <Text style={styles.xpText}>{`${profile.total_xp} TOTAL XP`}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity testID="assign-quest-button" onPress={() => setModalOpen(true)} style={styles.primaryBtn}>
            <Ionicons name="flash" size={16} color={colors.bg} />
            <Text style={styles.primaryBtnText}>ASSIGN QUEST</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="unfriend-button" onPress={unfriend} style={styles.dangerBtn}>
            <Ionicons name="close-circle-outline" size={16} color={colors.secondary} />
            <Text style={styles.dangerBtnText}>UNFRIEND</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>// VITAL_STATS</Text>
        {STATUS_BARS.map((b) => {
          const v = profile.status_bars[b.key] ?? 0;
          return (
            <View key={b.key} style={styles.statRow}>
              <Text style={[styles.statLabel, { color: b.color }]}>{b.label}</Text>
              <View style={styles.statBarOuter}>
                <View style={[styles.statBarInner, { width: `${v}%`, backgroundColor: b.color }]} />
              </View>
              <Text style={styles.statVal}>{`${v}`}</Text>
            </View>
          );
        })}

        <Text style={styles.section}>{`// SKILLS (${profile.skills.length})`}</Text>
        {profile.skills.length === 0 ? (
          <Text style={styles.empty}>No skills installed.</Text>
        ) : (
          profile.skills.map((s) => (
            <View key={s.id} style={[styles.skillCard, { borderColor: s.color + "55" }]}>
              <View style={[styles.skillStripe, { backgroundColor: s.color }]} />
              <View style={{ flex: 1, padding: 10 }}>
                <Text style={styles.skillName}>{s.name}</Text>
                <Text style={styles.skillMeta}>{`LV ${s.level} • ${s.current_xp}/${s.next_level_xp} XP`}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalBg}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{`> ASSIGN QUEST → ${profile.character_name}`}</Text>

                <Text style={styles.modalLabel}>TITLE</Text>
                <TextInput
                  testID="assign-title-input"
                  value={title}
                  onChangeText={setTitle}
                  style={styles.modalInput}
                  placeholder="Run 5km, study 1hr..."
                  placeholderTextColor={colors.textDim}
                />

                <Text style={styles.modalLabel}>DESCRIPTION</Text>
                <TextInput
                  value={desc}
                  onChangeText={setDesc}
                  style={styles.modalInput}
                  placeholder="Optional"
                  placeholderTextColor={colors.textDim}
                  multiline
                />

                <Text style={styles.modalLabel}>XP REWARD</Text>
                <TextInput
                  testID="assign-xp-input"
                  value={xp}
                  onChangeText={setXp}
                  style={styles.modalInput}
                  keyboardType="number-pad"
                />

                <Text style={styles.modalLabel}>DEADLINE (DAYS, 0 = NONE)</Text>
                <TextInput
                  testID="assign-deadline-input"
                  value={deadlineDays}
                  onChangeText={setDeadlineDays}
                  style={styles.modalInput}
                  keyboardType="number-pad"
                />

                <Text style={styles.modalLabel}>TARGET SKILL (THEIR SKILL TREE)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipsRow}>
                    <TouchableOpacity onPress={() => setSkillId(null)} style={[styles.chip, !skillId && styles.chipActive]}>
                      <Text style={[styles.chipText, !skillId && { color: colors.bg }]}>NONE</Text>
                    </TouchableOpacity>
                    {profile.skills.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => setSkillId(s.id)}
                        style={[styles.chip, skillId === s.id && { backgroundColor: s.color, borderColor: s.color }]}
                      >
                        <Text style={[styles.chipText, skillId === s.id && { color: colors.bg }]}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.modalRow}>
                  <TouchableOpacity onPress={() => setModalOpen(false)} style={[styles.modalBtn, { borderColor: colors.textDim }]}>
                    <Text style={[styles.modalBtnText, { color: colors.textDim }]}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="assign-quest-confirm" onPress={assignQuest} style={styles.modalBtn}>
                    <Text style={styles.modalBtnText}>SEND</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
  },
  iconBtn: { padding: 6 },
  topTitle: { color: colors.primary, fontSize: 13, letterSpacing: 3, fontWeight: "700" },

  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  heroCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, padding: 16, gap: 10 },
  charName: { color: colors.text, fontSize: 26, fontWeight: "900", letterSpacing: 2 },
  codeText: { color: colors.textDim, fontSize: 12, letterSpacing: 4 },

  relPanel: { gap: 4, marginTop: 6 },
  relTitle: { color: colors.textDim, fontSize: 10, letterSpacing: 3 },
  relValue: { fontSize: 28, fontWeight: "900", letterSpacing: 2 },
  barOuter: { height: 10, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.borderDim },
  barInner: { height: "100%" },

  levelRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  levelChip: { borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 4 },
  levelChipText: { color: colors.primary, fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  xpText: { color: colors.textDim, fontSize: 11, letterSpacing: 2 },

  actionRow: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
  },
  primaryBtnText: { color: colors.bg, fontSize: 12, letterSpacing: 3, fontWeight: "800" },
  dangerBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.secondary,
    paddingVertical: 12,
  },
  dangerBtnText: { color: colors.secondary, fontSize: 12, letterSpacing: 3, fontWeight: "800" },

  section: { color: colors.primary, fontSize: 13, letterSpacing: 3, fontWeight: "700", marginTop: 8 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim, padding: 10 },
  statLabel: { width: 80, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  statBarOuter: { flex: 1, height: 8, backgroundColor: "rgba(255,255,255,0.05)" },
  statBarInner: { height: "100%" },
  statVal: { color: colors.textDim, fontSize: 11, fontWeight: "700", width: 32, textAlign: "right" },

  empty: { color: colors.textDim, fontSize: 12 },
  skillCard: { flexDirection: "row", backgroundColor: colors.surface, borderWidth: 1 },
  skillStripe: { width: 4 },
  skillName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  skillMeta: { color: colors.textDim, fontSize: 11, marginTop: 2, letterSpacing: 1 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)" },
  modalCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, padding: 20, gap: 8 },
  modalTitle: { color: colors.primary, fontSize: 14, letterSpacing: 2, fontWeight: "700", marginBottom: 4 },
  modalLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  modalInput: { color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.borderDim, fontSize: 16, paddingVertical: 8 },
  chipsRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: { borderWidth: 1, borderColor: colors.borderDim, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  modalBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { color: colors.primary, fontSize: 13, letterSpacing: 3, fontWeight: "700" },
});
