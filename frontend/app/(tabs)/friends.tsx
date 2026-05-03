import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

type Friend = {
  user_id: string;
  character_name: string;
  friend_code: string;
  relationship: number;
  overall_level: number;
  total_xp: number;
};

type Req = {
  id: string;
  other_user_id: string;
  other_character_name: string;
  other_friend_code: string;
  created_at: string;
};

export default function FriendsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Req[]>([]);
  const [outgoing, setOutgoing] = useState<Req[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([api.get<Friend[]>("/friends"), api.get("/friends/requests")]);
      setFriends(f.data);
      setIncoming(r.data.incoming || []);
      setOutgoing(r.data.outgoing || []);
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

  const sendRequest = async () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) {
      Alert.alert("Invalid Code", "Friend code must be exactly 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/friends/request", { code: c });
      Alert.alert("Request Sent", `Pinged ${data.to_character_name}`);
      setCode("");
      load();
    } catch (e: any) {
      Alert.alert("Failed", formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = async (id: string) => {
    try {
      await api.post(`/friends/requests/${id}/accept`);
      load();
    } catch (e: any) {
      Alert.alert("Failed", formatApiError(e));
    }
  };

  const decline = async (id: string) => {
    try {
      await api.post(`/friends/requests/${id}/decline`);
      load();
    } catch (e: any) {
      Alert.alert("Failed", formatApiError(e));
    }
  };

  return (
    <SafeAreaView style={styles.bg} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={styles.header}>// CONNECTIONS</Text>

        {/* My friend code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR FRIEND CODE</Text>
          <Text testID="my-friend-code" style={styles.codeValue}>{user?.friend_code || "------"}</Text>
          <Text style={styles.codeHint}>Share this code with friends so they can add you.</Text>
        </View>

        {/* Add friend */}
        <View style={styles.addCard}>
          <Text style={styles.sectionLabel}>{"> ADD A FRIEND"}</Text>
          <View style={styles.addRow}>
            <TextInput
              testID="friend-code-input"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="6-CHAR CODE"
              placeholderTextColor={colors.textDim}
              maxLength={6}
              autoCapitalize="characters"
              style={styles.codeInput}
            />
            <TouchableOpacity testID="send-friend-request-button" onPress={sendRequest} disabled={busy} style={[styles.sendBtn, busy && { opacity: 0.5 }]}>
              <Text style={styles.sendBtnText}>SEND</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{`INCOMING (${incoming.length})`}</Text>
            {incoming.map((r) => (
              <View key={r.id} style={styles.reqCard} testID={`req-${r.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqName}>{r.other_character_name}</Text>
                  <Text style={styles.reqCode}>{`#${r.other_friend_code}`}</Text>
                </View>
                <TouchableOpacity testID={`accept-${r.id}`} onPress={() => accept(r.id)} style={[styles.smallBtn, { borderColor: colors.green }]}>
                  <Text style={[styles.smallBtnText, { color: colors.green }]}>ACCEPT</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`decline-${r.id}`} onPress={() => decline(r.id)} style={[styles.smallBtn, { borderColor: colors.secondary }]}>
                  <Text style={[styles.smallBtnText, { color: colors.secondary }]}>DENY</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{`PENDING SENT (${outgoing.length})`}</Text>
            {outgoing.map((r) => (
              <View key={r.id} style={styles.reqCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqName}>{r.other_character_name}</Text>
                  <Text style={styles.reqCode}>{`#${r.other_friend_code}`}</Text>
                </View>
                <Text style={styles.pending}>WAITING...</Text>
                <TouchableOpacity onPress={() => decline(r.id)} style={[styles.smallBtn, { borderColor: colors.textDim }]}>
                  <Text style={[styles.smallBtnText, { color: colors.textDim }]}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Friends list */}
        <Text style={styles.sectionTitle}>{`ALLIES (${friends.length})`}</Text>
        {friends.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color={colors.textDim} />
            <Text style={styles.emptyTitle}>NO CONNECTIONS YET</Text>
            <Text style={styles.emptyText}>Share your code or add a friend's to start a connection.</Text>
          </View>
        ) : (
          friends.map((f) => {
            const pct = Math.max(0, Math.min(100, f.relationship));
            const relColor = pct >= 70 ? colors.green : pct >= 35 ? colors.yellow : colors.secondary;
            return (
              <TouchableOpacity
                key={f.user_id}
                testID={`friend-${f.user_id}`}
                onPress={() => router.push({ pathname: "/friend/[id]", params: { id: f.user_id } })}
                style={styles.friendCard}
              >
                <View style={styles.friendTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{f.character_name}</Text>
                    <Text style={styles.friendMeta}>{`#${f.friend_code} • LV ${f.overall_level}`}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </View>
                <View style={styles.relRow}>
                  <Text style={styles.relLabel}>RELATIONSHIP</Text>
                  <Text style={[styles.relVal, { color: relColor }]}>{`${pct}/100`}</Text>
                </View>
                <View style={styles.barOuter}>
                  <View style={[styles.barInner, { width: `${pct}%`, backgroundColor: relColor }]} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  header: { color: colors.primary, fontSize: 16, letterSpacing: 3, fontWeight: "700" },

  codeCard: { backgroundColor: "rgba(0,240,255,0.05)", borderWidth: 1, borderColor: colors.primary, padding: 16, gap: 6 },
  codeLabel: { color: colors.primary, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  codeValue: { color: colors.text, fontSize: 36, fontWeight: "900", letterSpacing: 8 },
  codeHint: { color: colors.textDim, fontSize: 11, letterSpacing: 1 },

  addCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim, padding: 14, gap: 10 },
  sectionLabel: { color: colors.purple, fontSize: 12, letterSpacing: 3, fontWeight: "700" },
  addRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderDim,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 4,
    fontWeight: "700",
  },
  sendBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, justifyContent: "center" },
  sendBtnText: { color: colors.bg, fontSize: 13, letterSpacing: 3, fontWeight: "800" },

  sectionTitle: { color: colors.textDim, fontSize: 11, letterSpacing: 3, fontWeight: "700", marginTop: 8 },
  reqCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim, padding: 12 },
  reqName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  reqCode: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginTop: 2 },
  smallBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  smallBtnText: { fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  pending: { color: colors.yellow, fontSize: 11, letterSpacing: 2, fontWeight: "700" },

  empty: { alignItems: "center", padding: 24, gap: 8 },
  emptyTitle: { color: colors.textDim, fontSize: 14, letterSpacing: 3, fontWeight: "700", marginTop: 8 },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: "center" },

  friendCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDim, padding: 14, gap: 8 },
  friendTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  friendName: { color: colors.text, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  friendMeta: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginTop: 2 },
  relRow: { flexDirection: "row", justifyContent: "space-between" },
  relLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 3 },
  relVal: { fontSize: 12, letterSpacing: 2, fontWeight: "800" },
  barOuter: { height: 8, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.borderDim },
  barInner: { height: "100%" },
});
