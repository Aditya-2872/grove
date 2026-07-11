// ---------------------------------------------------------------------------
// A small palette of calm, muted themes — one quiet green (or earthy) accent
// per tab. Every theme sits on the same near-black canvas; only the accent and
// its ambient glow change, so each goal feels distinct but the app stays serene.
// ---------------------------------------------------------------------------

export interface TabTheme {
  name: string;
  accent: string;
  accentSoft: string;
  glow: string;
}

export const THEMES: TabTheme[] = [
  { name: "sage", accent: "#9db38c", accentSoft: "#7f9a71", glow: "rgba(157,179,140,0.14)" },
  { name: "eucalyptus", accent: "#a7c4b5", accentSoft: "#7fa392", glow: "rgba(167,196,181,0.14)" },
  { name: "moss", accent: "#8fb08a", accentSoft: "#6f9268", glow: "rgba(143,176,138,0.14)" },
  { name: "sea pine", accent: "#86b3a3", accentSoft: "#5f9182", glow: "rgba(134,179,163,0.14)" },
  { name: "olive", accent: "#adb389", accentSoft: "#8a9068", glow: "rgba(173,179,137,0.13)" },
  { name: "fern", accent: "#93bd94", accentSoft: "#6d9a70", glow: "rgba(147,189,148,0.14)" },
];

function at(index: number): TabTheme {
  const len = THEMES.length;
  return THEMES[((index % len) + len) % len];
}

/** CSS custom properties to spread onto the app container for a given theme. */
export function themeVars(index: number): React.CSSProperties {
  const t = at(index);
  return {
    ["--accent" as string]: t.accent,
    ["--accent-soft" as string]: t.accentSoft,
    ["--glow" as string]: t.glow,
  };
}

export const themeAccent = (index: number): string => at(index).accent;
export const themeGlow = (index: number): string => at(index).glow;
export const themeLabel = (index: number): string => at(index).name;
