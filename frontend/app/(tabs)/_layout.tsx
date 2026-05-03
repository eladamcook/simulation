import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";
import { View, ActivityIndicator } from "react-native";

export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user]);

  if (user === undefined || user === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: "rgba(0,240,255,0.3)",
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 2, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="character"
        options={{
          title: "CHARACTER",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          title: "SKILLS",
          tabBarIcon: ({ color, size }) => <Ionicons name="git-branch-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quests"
        options={{
          title: "QUESTS",
          tabBarIcon: ({ color, size }) => <Ionicons name="flash-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "FRIENDS",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFILE",
          tabBarIcon: ({ color, size }) => <Ionicons name="hardware-chip-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
