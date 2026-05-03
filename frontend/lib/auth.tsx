import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, TOKEN_KEY, formatApiError } from "./api";

type User = {
  id: string;
  email: string;
  character_name: string;
  status_bars: Record<string, number>;
  friend_code?: string;
};

type AuthCtx = {
  user: User | null | undefined; // undefined = checking
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, character_name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch (e) {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
    } catch (e: any) {
      throw new Error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, character_name: string) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { email, password, character_name });
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
    } catch (e: any) {
      throw new Error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {}
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
