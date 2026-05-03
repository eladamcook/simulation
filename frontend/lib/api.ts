import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export const TOKEN_KEY = "auth_token";

export function formatApiError(err: any): string {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e: any) => (typeof e?.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  return String(detail);
}
