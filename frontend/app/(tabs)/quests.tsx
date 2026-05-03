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
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

type Skill = { id: string; name: string; color: string };
type Quest = {
  id: string;
  title: string;
  description: string;
  skill_id: string | null;
  xp_reward: number;
  completed: boolean;
  from_user_id: string | null;
  to_user_id: string | null;
  deadline: string | null;
  assignment_status: string;
  owner_user_id: string;
  from_character_name?: string;
  to_character_name?: string;
};

export default function QuestsScreen() {
  const { user } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"mine" | "from-friends" | "sent">("mine");
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

  const myId = user?.id || "";

  const myQuests = quests.filter((q) => !q.from_user_id && q.owner_user_id === myId);
  const fromFriends = quests.filter((q) => q.to_user_id === myId && q.from_user_id);
  const sent = quests.filter((q) => q.from_user_id === myId && q.to_user_id !== myId);

  const visible = filter === "mine" ? myQuests : filter === "from-friends" ? fromFriends : sent;

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
      Alert.alert("Error", formatApiError(e));
    }
  };

  const accept = async (q: Quest) => {
    try {
      await api.post(`/quests/${q.id}/accept`);
      load();
    } catch (e: any) {
      Alert.alert("Failed", formatApiError(e));
    }
  };

  const decline = async (q: Quest) => {
    Alert.alert("Decline Quest", `Declining drops your relationship with ${q.from_character_name} by ${Math.max(1, Math.floor(q.xp_reward / 5))}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            const { data } = await api.post(`/quests/${q.id}/decline`);
            if (data.relationship !== null && data.relationship !== undefined) {
              Alert.alert("Quest Declined", `Relationship with ${q.from_character_name} now ${data.relationship}/100`);
            }
            load();
          } catch (e: any) {
            Alert.alert("Failed", formatApiError(e));
          }
        },
      },
    ]);
  };

  const complete = async (q: Quest) => {
    try {
      const { data } = await api.post(`/quests/${q.id}/complete`);
      const skillName = data.skill?.name;
      const rel = data.relationship;
      const parts: string[] = [];
      if (skillName) parts.push(`+${q.xp_reward} XP → ${skillName}`);
      if (rel !== null && rel !== undefined) parts.push(`Relationship with ${q.from_character_name}: ${rel}/100`);
      if (parts.length) Alert.alert("Quest Complete", parts.join("\n"));
      load();
    } catch (e: any) {
      Alert.alert("Failed", formatApiError(e));
    }
  };

  const uncomplete = async (q: Quest) => {
    try {
      await api.post(`/quests/${q.id}/uncomplete`);
      load();
    } catch (e: any) {
      Alert.alert("Failed", formatApiError(e));
    }
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

  return (
    <SafeAreaView style={styles.bg} edges={["top"]}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerLabel}>// QUEST_LOG</Text>
          <Text style={styles.headerSub}>{`${myQuests.length} MINE • ${fromFriends.length} INCOMING • ${sent.length} SENT`}</Text>
        </View>
        <TouchableOpacity testID="add-quest-button" onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add" size={20} color={colors.bg} />
          <Text style={styles.addBtnText}>NEW</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {[
          { k: "mine", l: "MINE" },
          { k: "from-friends", l: `FROM FRIENDS${fromFriends.filter((q) => q.assignment_status === "pending").length ? " ●" : ""}` },
          { k: "sent", l: "SENT" },
        ].map((t) => (
          <TouchableOpacity
            key={t.k}
            testID={`filter-${t.k}`}
            onPress={() => setFilter(t.k as any)}
            style={[styles.tabBtn, filter === t.k && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, filter === t.k && { color: colors.bg }]}>{t.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="flash-outline" size={56} color={colors.textDim} />
            <Text style={styles.emptyTitle}>NOTHING HERE</Text>
            <Text style={styles.emptyText}>{filter === "mine" ? "Create a personal quest." : filter === "from-friends" ? "No quests from friends yet." : "Visit a friend's profile to send them a quest."}</Text>
          </View>
        ) : (
          visible.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              skill={skillOf(q.skill_id)}
              isFromFriend={!!q.from_user_id && q.to_user_id === myId}
              isSent={q.from_user_id === myId && q.to_user_id !== myId}
              onAccept={() => accept(q)}
              onDecline={() => decline(q)}
              onComplete={() => complete(q)}
              onUncomplete={() => uncomplete(q)}
              onEdit={() => openEdit(q)}
              onDelete={() => removeQuest(q)}
            />
          ))
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
              />

              <Text style={styles.modalLabel}>ASSIGN TO SKILL</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipsRow}>
                  <TouchableOpacity onPress={() => setSkillId(null)} style={[styles.chip, !skillId && styles.chipActive]}>
                    <Text style={[styles.chipText, !skillId && { color: colors.bg }]}>NONE</Text>
                  </TouchableOpacity>
                  {skills.map((s) => (
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
  isFromFriend,
  isSent,
  onAccept,
  onDecline,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
}: {
  quest: Quest;
  skill?: Skill;
  isFromFriend: boolean;
  isSent: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = skill?.color || colors.primary;
  const status = quest.assignment_status;

  let statusBadge: { text: string; color: string } | null = null;
  if (isFromFriend) {
    if (status === "pending") statusBadge = { text: "PENDING", color: colors.yellow };
    else if (status === "accepted") statusBadge = { text: "ACCEPTED", color: colors.primary };
    else if (status === "completed") statusBadge = { text: "DONE", color: colors.green };
    else if (status === "declined") statusBadge = { text: "DECLINED", color: colors.secondary };
    else if (status === "expired") statusBadge = { text: "EXPIRED", color: colors.secondary };
  } else if (isSent) {
    statusBadge = { text: status.toUpperCase(), color: status === "completed" ? colors.green : status === "declined" || status === "expired" ? colors.secondary : colors.yellow };
  }

  let deadlineLabel = "";
  if (quest.deadline) {
    try {
      const dl = new Date(quest.deadline);
      const ms = dl.getTime() - Date.now();
      if (ms <= 0) deadlineLabel = "OVERDUE";
      else {
        const days = Math.floor(ms / 86400000);
        const hrs = Math.floor((ms % 86400000) / 3600000);
        deadlineLabel = days > 0 ? `${days}d ${hrs}h LEFT` : `${hrs}h LEFT`;
      }
    } catch {}
  }

  return (
    <View style={[styles.questCard, { borderColor: quest.completed ? "rgba(57,255,20,0.4)" : accent + "55" }]} testID={`quest-${quest.id}`}>
      <View style={{ flex: 1 }}>
        {(isFromFriend || isSent) && (
          <Text style={styles.relayLine}>
            {isFromFriend ? `FROM ${quest.from_character_name?.toUpperCase()}` : `TO ${quest.to_character_name?.toUpperCase()}`}
          </Text>
        )}
        <Text style={[styles.questTitle, quest.completed && styles.questDone]}>{quest.title}</Text>
        {quest.description ? <Text style={styles.questDesc}>{quest.description}</Text> : null}

        <View style={styles.metaRow}>
          <Text style={[styles.xpBadge, { color: accent, borderColor: accent }]}>{`+${quest.xp_reward} XP`}</Text>
          {skill ? <Text style={[styles.skillBadge, { color: skill.color }]}>{`◆ ${skill.name}`}</Text> : <Text style={styles.skillBadge}>UNASSIGNED</Text>}
          {statusBadge && (
            <Text style={[styles.statusBadge, { color: statusBadge.color, borderColor: statusBadge.color }]}>{statusBadge.text}</Text>
          )}
          {deadlineLabel ? <Text style={styles.deadline}>{`⌛ ${deadlineLabel}`}</Text> : null}
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          {isFromFriend && status === "pending" && (
            <>
              <TouchableOpacity testID={`accept-quest-${quest.id}`} onPress={onAccept} style={[styles.actBtn, { borderColor: colors.primary }]}>
                <Text style={[styles.actText, { color: colors.primary }]}>ACCEPT</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`decline-quest-${quest.id}`} onPress={onDecline} style={[styles.actBtn, { borderColor: colors.secondary }]}>
                <Text style={[styles.actText, { color: colors.secondary }]}>DECLINE</Text>
              </TouchableOpacity>
            </>
          )}
          {isFromFriend && status === "accepted" && (
            <>
              <TouchableOpacity testID={`complete-quest-${quest.id}`} onPress={onComplete} style={[styles.actBtn, { borderColor: colors.green }]}>
                <Text style={[styles.actText, { color: colors.green }]}>MARK COMPLETE</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDecline} style={[styles.actBtn, { borderColor: colors.secondary }]}>
                <Text style={[styles.actText, { color: colors.secondary }]}>GIVE UP</Text>
              </TouchableOpacity>
            </>
          )}
          {!isFromFriend && !isSent && !quest.completed && (
            <TouchableOpacity testID={`toggle-quest-${quest.id}`} onPress={onComplete} style={[styles.actBtn, { borderColor: colors.green }]}>
              <Text style={[styles.actText, { color: colors.green }]}>COMPLETE</Text>
            </TouchableOpacity>
          )}
          {!isFromFriend && !isSent && quest.completed && (
            <TouchableOpacity onPress={onUncomplete} style={[styles.actBtn, { borderColor: colors.textDim }]}>
              <Text style={[styles.actText, { color: colors.textDim }]}>UNDO</Text>
            </TouchableOpacity>
          )}
          {!isFromFriend && !isSent && (
            <>
              <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
                <Ionicons name="create-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.secondary} />
              </TouchableOpacity>
            </>
          )}
          {isSent && (
            <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
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
  headerSub: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  addBtnText: { color: colors.bg, fontSize: 12, letterSpacing: 2, fontWeight: "800" },

  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tabBtn: { borderWidth: 1, borderColor: colors.borderDim, paddingHorizontal: 12, paddingVertical: 6 },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.text, fontSize: 10, letterSpacing: 2, fontWeight: "700" },

  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  empty: { alignItems: "center", padding: 40, gap: 12 },
  emptyTitle: { color: colors.textDim, fontSize: 14, letterSpacing: 3, fontWeight: "700", marginTop: 12 },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: "center" },

  questCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  relayLine: { color: colors.purple, fontSize: 10, letterSpacing: 2, fontWeight: "700", marginBottom: 2 },
  questTitle: { color: colors.text, fontSize: 15, fontWeight: "700", letterSpacing: 1 },
  questDone: { textDecorationLine: "line-through", color: colors.textDim },
  questDesc: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" },
  xpBadge: { fontSize: 10, letterSpacing: 2, fontWeight: "800", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  skillBadge: { color: colors.textDim, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  statusBadge: { fontSize: 10, letterSpacing: 2, fontWeight: "800", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  deadline: { color: colors.yellow, fontSize: 10, letterSpacing: 1, fontWeight: "700" },

  actionRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  actBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  actText: { fontSize: 10, letterSpacing: 2, fontWeight: "800" },
  iconBtn: { borderWidth: 1, borderColor: colors.borderDim, padding: 6, marginLeft: "auto" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)" },
  modalCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, padding: 20, gap: 10 },
  modalTitle: { color: colors.primary, fontSize: 16, letterSpacing: 3, fontWeight: "700", marginBottom: 6 },
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
