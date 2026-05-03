export const colors = {
  bg: "#050509",
  bg2: "#0A0A15",
  surface: "#121220",
  surfaceGlass: "rgba(0, 240, 255, 0.05)",
  primary: "#00F0FF",
  primaryGlow: "rgba(0, 240, 255, 0.5)",
  secondary: "#FF003C",
  purple: "#9D4CDD",
  green: "#39FF14",
  yellow: "#FCEE0A",
  orange: "#FF8A00",
  text: "#FFFFFF",
  textDim: "#8A8A9E",
  borderDim: "rgba(0, 240, 255, 0.2)",
  borderActive: "#00F0FF",
};

export const STATUS_BARS = [
  { key: "health", label: "HEALTH", color: "#FF003C" },
  { key: "hunger", label: "HUNGER", color: "#FF8A00" },
  { key: "hygiene", label: "HYGIENE", color: "#00F0FF" },
  { key: "energy", label: "ENERGY", color: "#FCEE0A" },
  { key: "social", label: "SOCIAL", color: "#9D4CDD" },
  { key: "mood", label: "MOOD", color: "#FF00E5" },
] as const;
