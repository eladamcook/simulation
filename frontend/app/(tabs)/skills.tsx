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

const SKILL_COLORS = ["#00F0FF", "#FF003C", "#9D4CDD", "#39FF14", "#FCEE0A", "#FF8A00", "#FF00E5"];

export default function SkillsScreen() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState(SKILL_COLORS[0]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Skill[]>("/skills");
      setSkills(data);
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
    setEditingSkill(null);
    setName("");
    setDesc("");
    setColor(SKILL_COLORS[0]);
    setModal("create");
  };

  const openEdit = (s: Skill) => {
    setEditingSkill(s);
    setName(s.name);
    setDesc(s.description || "");
    setColor(s.color);
    setModal("edit");
  };

  const save = async () => {
    if (!name.trim()) return;
    try {
      if (modal === "create") {
        await api.post("/skills", { name: name.trim(), description: desc.trim(), color });
      } else if (editingSkill) {
        await api.put(`/skills/${editingSkill.id}`, { name: name.trim(), description: desc.trim(), color });
      }
      setModal(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };

  const removeSkill = (s: Skill) => {
    Alert.alert("Delete Skill", `Delete "${s.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.delete(`/skills/${s.id}`);
          load();
        },
      },
    ]);
  };

  const addXP = async (s: Skill, amount: number) => {
    try {
      await api.post(`/skills/${s.id}/xp`, { amount });
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.bg} edges={["top"]}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerLabel}>// SKILL_TREE</Text>
          <Text style={styles.headerSub}>{`${skills.length} NODES ACTIVE`}</Text>
        </View>
        <TouchableOpacity testID="add-skill-button" onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={20} color={colors.bg} />
          <Text style={styles.addBtnText}>NEW</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {skills.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="git-branch-outline" size={64} color={colors.textDim} />
            <Text style={styles.emptyTitle}>NO SKILLS INITIALIZED</Text>
            <Text style={styles.emptyText}>Create your first skill node to begin.</Text>
            <TouchableOpacity onPress={openCreate} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>{"> INSTALL SKILL"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          skills.map((s) => {
            const pct = Math.round((s.current_xp / Math.max(1, s.next_level_xp)) * 100);
            return (
              <View key={s.id} style={[styles.skillCard, { borderColor: s.color + "55" }]} testID={`skill-${s.id}`}>
                <View style={[styles.skillStripe, { backgroundColor: s.color }]} />
                <View style={styles.skillBody}>
                  <View style={styles.skillTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.skillName}>{s.name}</Text>
                      {s.description ? <Text style={styles.skillDesc}>{s.description}</Text> : null}
                    </View>
                    <View style={[styles.levelChip, { borderColor: s.color }]}>
                      <Text style={[styles.levelChipText, { color: s.color }]}>{`LV ${s.level}`}</Text>
                    </View>
                  </View>

                  <View style={styles.xpRow}>
                    <View style={styles.xpBarOuter}>
                      <View style={[styles.xpBarInner, { width: `${pct}%`, backgroundColor: s.color }]} />
                    </View>
                    <Text style={styles.xpLabel}>{`${s.current_xp} / ${s.next_level_xp} XP`}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity testID={`xp-25-${s.id}`} onPress={() => addXP(s, 25)} style={styles.actionBtn}>
                      <Text style={styles.actionText}>+25 XP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => addXP(s, 100)} style={styles.actionBtn}>
                      <Text style={styles.actionText}>+100 XP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID={`edit-skill-${s.id}`} onPress={() => openEdit(s)} style={styles.iconBtn}>
                      <Ionicons name="create-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity testID={`delete-skill-${s.id}`} onPress={() => removeSkill(s)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color={colors.secondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modal === "create" ? "> NEW SKILL" : "> EDIT SKILL"}</Text>

            <Text style={styles.modalLabel}>NAME</Text>
            <TextInput
              testID="skill-name-input"
              value={name}
              onChangeText={setName}
              style={styles.modalInput}
              placeholder="e.g., Strength, Coding..."
              placeholderTextColor={colors.textDim}
              maxLength={40}
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

            <Text style={styles.modalLabel}>NODE COLOR</Text>
            <View style={styles.colorRow}>
              {SKILL_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && { borderWidth: 2, borderColor: colors.text },
                  ]}
                />
              ))}
            </View>

            <View style={styles.modalRow}>
              <TouchableOpacity onPress={() => setModal(null)} style={[styles.modalBtn, { borderColor: colors.textDim }]}>
                <Text style={[styles.modalBtnText, { color: colors.textDim }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="save-skill-button" onPress={save} style={styles.modalBtn}>
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

  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyTitle: { color: colors.textDim, fontSize: 14, letterSpacing: 3, fontWeight: "700", marginTop: 12 },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: "center" },
  emptyBtn: { borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, marginTop: 12 },
  emptyBtnText: { color: colors.primary, fontSize: 12, letterSpacing: 3, fontWeight: "700" },

  skillCard: { flexDirection: "row", backgroundColor: colors.surface, borderWidth: 1 },
  skillStripe: { width: 4 },
  skillBody: { flex: 1, padding: 14, gap: 10 },
  skillTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  skillName: { color: colors.text, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  skillDesc: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  levelChip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  levelChipText: { fontSize: 12, fontWeight: "800", letterSpacing: 2 },

  xpRow: { gap: 4 },
  xpBarOuter: { height: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.borderDim },
  xpBarInner: { height: "100%" },
  xpLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2 },

  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { borderWidth: 1, borderColor: colors.borderDim, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { color: colors.text, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  iconBtn: { borderWidth: 1, borderColor: colors.borderDim, padding: 8, marginLeft: "auto" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, padding: 20, gap: 10 },
  modalTitle: { color: colors.primary, fontSize: 16, letterSpacing: 3, fontWeight: "700", marginBottom: 6 },
  modalLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2 },
  modalInput: { color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.borderDim, fontSize: 16, paddingVertical: 8 },
  colorRow: { flexDirection: "row", gap: 10, marginVertical: 4 },
  colorDot: { width: 32, height: 32 },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  modalBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, paddingVertical: 12, alignItems: "center" },
  modalBtnText: { color: colors.primary, fontSize: 13, letterSpacing: 3, fontWeight: "700" },
});
