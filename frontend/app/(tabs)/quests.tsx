import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { colors } from "../../lib/theme";

type Skill = { id: string; name: string; color: string };
type Quest = {
  id: string;
  title: string;
  description: string;
  skill_id: string | null;
  xp_reward: number;
  completed: boolean;
};

export default function QuestsScreen() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Quest | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [xp, setXp] = useState("50");
  const [skillId, setSkillId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([api.get<Quest[]>("/quests"), api.get<Skill[]>("/skills")]);
      setQuests(q.data);
      setSkills(s.data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setDesc("");
    setXp("50");
    setSkillId(null);
    setModal("create");
  };

  const openEdit = (q: Quest) => {
    setEditing(q);
    setTitle(q.title);
    setDesc(q.description);
    setXp(String(q.xp_reward));
    setSkillId(q.skill_id);
    setModal("edit");
  };

  const save = async () => {
    if (!title.trim()) return;
    const xpNum = parseInt(xp, 10);
    if (isNaN(xpNum) || xpNum < 1) {
      Alert.alert("Invalid XP", "XP reward must be at least 1");
      return;
    }
    try {
      const payload = { title: title.trim(), description: desc.trim(), skill_id: skillId, xp_reward: xpNum };
      if (modal === "create") await api.post("/quests", payload);
      else if (editing) await api.put(`/quests/${editing.id}`, payload);
      setModal(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };

  const toggle = async (q: Quest) => {
    try {
      if (q.completed) await api.post(`/quests/${q.id}/uncomplete`);
      else await api.post(`/quests/${q.id}/complete`);
      load();
    } catch {}
  };

  const removeQuest = (q: Quest) => {
    Alert.alert("Delete Quest", `Delete "${q.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/quests/${q.id}`);
          load();
        },
      },
    ]);
  };

  const skillOf = (id: string | null) => skills.find((s) => s.id === id);

  const active = quests.filter((q) => !q.completed);
  const done = quests.filter((q) => q.completed);

  return (
    <SafeAreaView style={styles.bg} edges={["top"]}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerLabel}>// QUEST_LOG</Text>
          <Text style={styles.headerSub}>{`${active.length} ACTIVE • ${done.length} COMPLETE`}</Text>
        </View>
        <TouchableOpacity testID="add-quest-button" onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={20} color={colors.bg} />
          <Text style={styles.addBtnText}>NEW</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {quests.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="flash-outline" size={64} color={colors.textDim} />
            <Text style={styles.emptyTitle}>NO QUESTS DEPLOYED</Text>
            <Text style={styles.emptyText}>Create custom quests and earn XP for your skills.</Text>
            <TouchableOpacity onPress={openCreate} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>{"> DEPLOY QUEST"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {active.length > 0 && <Text style={styles.sectionTitle}>ACTIVE</Text>}
            {active.map((q) => (
              <QuestCard key={q.id} quest={q} skill={skillOf(q.skill_id)} onToggle={() => toggle(q)} onEdit={() => openEdit(q)} onDelete={() => removeQuest(q)} />
            ))}
            {done.length > 0 && <Text style={styles.sectionTitle}>COMPLETED</Text>}
            {done.map((q) => (
              <QuestCard key={q.id} quest={q} skill={skillOf(q.skill_id)} onToggle={() => toggle(q)} onEdit={() => openEdit(q)} onDelete={() => removeQuest(q)} />
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{modal === "create" ? "> NEW QUEST" : "> EDIT QUEST"}</Text>

              <Text style={styles.modalLabel}>TITLE</Text>
              <TextInput
                testID="quest-title-input"
                value={title}
                onChangeText={setTitle}
                style={styles.modalInput}
                placeholder="e.g., Run 5km"
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
                testID="quest-xp-input"
                value={xp}
                onChangeText={setXp}
                style={styles.modalInput}
                keyboardType="number-pad"
                placeholder="50"
                placeholderTextColor={colors.textDim}
              />

              <Text style={styles.modalLabel}>ASSIGN TO SKILL</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={styles.skillChipsRow}>
                  <TouchableOpacity onPress={() => setSkillId(null)} style={[styles.skillChip, !skillId && styles.skillChipActive]}>
                    <Text style={[styles.skillChipText, !skillId && { color: colors.bg }]}>NONE</Text>
                  </TouchableOpacity>
                  {skills.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSkillId(s.id)}
                      style={[styles.skillChip, skillId === s.id && { backgroundColor: s.color, borderColor: s.color }]}
                    >
                      <Text style={[styles.skillChipText, skillId === s.id && { color: colors.bg }]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.modalRow}>
                <TouchableOpacity onPress={() => setModal(null)} style={[styles.modalBtn, { borderColor: colors.textDim }]}>
                  <Text style={[styles.modalBtnText, { color: colors.textDim }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="save-quest-button" onPress={save} style={styles.modalBtn}>
                  <Text style={styles.modalBtnText}>SAVE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function QuestCard({
  quest,
  skill,
  onToggle,
  onEdit,
  onDelete,
}: {
  quest: Quest;
  skill?: Skill;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = skill?.color || colors.primary;
  return (
    <View style={[styles.questCard, { borderColor: quest.completed ? "rgba(57,255,20,0.4)" : accent + "55" }]} testID={`quest-${quest.id}`}>
      <TouchableOpacity testID={`toggle-quest-${quest.id}`} onPress={onToggle} style={styles.checkbox}>
        {quest.completed ? <Ionicons name="checkmark" size={20} color={colors.green} /> : null}
        <View style={[styles.checkboxBox, { borderColor: quest.completed ? colors.green : accent }]} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.questTitle, quest.completed && styles.questDone]}>{quest.title}</Text>
        {quest.description ? <Text style={styles.questDesc}>{quest.description}</Text> : null}
        <View style={styles.questMeta}>
          <Text style={[styles.xpBadge, { color: accent, borderColor: accent }]}>{`+${quest.xp_reward} XP`}</Text>
          {skill ? <Text style={[styles.skillBadge, { color: skill.color }]}>{`◆ ${skill.name}`}</Text> : <Text style={styles.skillBadge}>UNASSIGNED</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
          <Ionicons name="create-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={16} color={colors.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
  },
  headerLabel: { color: colors.primary, fontSize: 16, letterSpacing: 3, fontWeight: "700" },
  headerSub: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  addBtnText: { color: colors.bg, fontSize: 12, letterSpacing: 2, fontWeight: "800" },

  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  sectionTitle: { color: colors.textDim, fontSize: 11, letterSpacing: 3, fontWeight: "700", marginTop: 8 },
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyTitle: { color: colors.textDim, fontSize: 14, letterSpacing: 3, fontWeight: "700", marginTop: 12 },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: "center" },
  emptyBtn: { borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, marginTop: 12 },
  emptyBtnText: { color: colors.primary, fontSize: 12, letterSpacing: 3, fontWeight: "700" },

  questCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    padding: 12,
  },
  checkbox: { width: 28, height: 28, alignItems: "center", justifyContent: "center", position: "relative" },
  checkboxBox: { ...StyleSheet.absoluteFillObject, borderWidth: 2, zIndex: -1 },
  questTitle: { color: colors.text, fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  questDone: { textDecorationLine: "line-through", color: colors.textDim },
  questDesc: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  questMeta: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  xpBadge: { fontSize: 10, letterSpacing: 2, fontWeight: "800", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  skillBadge: { color: colors.textDim, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  actions: { gap: 6 },
  iconBtn: { borderWidth: 1, borderColor: colors.borderDim, padding: 6 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)" },
  modalCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, padding: 20, gap: 10 },
  modalTitle: { color: colors.primary, fontSize: 16, letterSpacing: 3, fontWeight: "700", marginBottom: 6 },
  modalLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  modalInput: { color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.borderDim, fontSize: 16, paddingVertical: 8 },
  skillChipsRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  skillChip: { borderWidth: 1, borderColor: colors.borderDim, paddingHorizontal: 12, paddingVertical: 6 },
  skillChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  skillChipText: { color: colors.text, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  modalBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { color: colors.primary, fontSize: 13, letterSpacing: 3, fontWeight: "700" },
});
