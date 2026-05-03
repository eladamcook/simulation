import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../lib/auth";
import { colors } from "../lib/theme";

const BG = "https://images.pexels.com/photos/20278554/pexels-photo-20278554.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function Login() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    if (!email || !password) {
      setErr("Email and password are required");
      return;
    }
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/character");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    }
  };

  return (
    <ImageBackground source={{ uri: BG }} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>LIFETRACK_OS</Text>
          <Text style={styles.subtitle}>// AUTHENTICATION REQUIRED</Text>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{"> SIGN IN"}</Text>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="user@grid.net"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              style={styles.input}
            />

            {err ? <Text testID="login-error" style={styles.error}>{`! ${err}`}</Text> : null}

            <TouchableOpacity
              testID="login-submit-button"
              onPress={onSubmit}
              disabled={loading}
              style={[styles.btn, loading && { opacity: 0.5 }]}
            >
              <Text style={styles.btnText}>{loading ? "CONNECTING..." : "JACK IN >"}</Text>
            </TouchableOpacity>

            <Link href="/register" asChild>
              <TouchableOpacity testID="goto-register-link" style={styles.linkBtn}>
                <Text style={styles.linkText}>{"> CREATE NEW IDENTITY"}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,5,9,0.85)" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 16 },
  brand: { color: colors.primary, fontSize: 32, letterSpacing: 4, fontWeight: "800", textAlign: "center" },
  subtitle: { color: colors.textDim, fontSize: 12, letterSpacing: 3, textAlign: "center", marginBottom: 16 },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDim,
    padding: 20,
    gap: 12,
  },
  panelTitle: { color: colors.primary, fontSize: 18, letterSpacing: 2, fontWeight: "700", marginBottom: 8 },
  label: { color: colors.textDim, fontSize: 11, letterSpacing: 2 },
  input: {
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: colors.secondary, fontSize: 12, letterSpacing: 1 },
  btn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "rgba(0,240,255,0.05)",
  },
  btnText: { color: colors.primary, fontSize: 14, letterSpacing: 4, fontWeight: "700" },
  linkBtn: { paddingVertical: 8, alignItems: "center" },
  linkText: { color: colors.purple, fontSize: 12, letterSpacing: 2 },
});
