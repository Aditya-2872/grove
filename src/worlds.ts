// ---------------------------------------------------------------------------
// Worlds: a per-profile palette that re-skins the ENTIRE app. Each world is a
// set of CSS custom properties written to document.documentElement, so body,
// glass, dots, scenery, and every accent shift together. All worlds sit on the
// same near-black canvas — the calm identity holds; only temperature and mood
// change.
//
// Picking a profile avatar suggests that creature's signature world (see
// `worldForAnimal`), but the two are independent — a profile can keep its
// avatar and change its world, or vice-versa.
// ---------------------------------------------------------------------------

export interface World {
  id: string;
  name: string;
  tagline: string;
  /** the creature whose avatar suggests this world */
  animalId: string;
  vars: {
    bg: string;
    panelSolid: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentSoft: string;
    glow: string;
    /** the glass base colour as an "r, g, b" triplet; alpha is the global slider */
    glassRgb: string;
    dot: string;
  };
}

export const WORLDS: World[] = [
  {
    id: "sage-night",
    name: "Sage Night",
    tagline: "quiet hills under a green moon",
    animalId: "deer",
    vars: {
      bg: "#0a0d0b",
      panelSolid: "#11150f",
      border: "rgba(200, 220, 200, 0.09)",
      text: "#dbe4db",
      textMuted: "#8b988c",
      accent: "#9db38c",
      accentSoft: "#7f9a71",
      glow: "rgba(157, 179, 140, 0.14)",
      glassRgb: "20, 26, 20",
      dot: "rgba(200, 220, 200, 0.05)",
    },
  },
  {
    id: "bamboo-mist",
    name: "Bamboo Mist",
    tagline: "cool green light through tall stalks",
    animalId: "panda",
    vars: {
      bg: "#0a0f0e",
      panelSolid: "#101613",
      border: "rgba(190, 220, 210, 0.09)",
      text: "#d8e6e0",
      textMuted: "#86988f",
      accent: "#8fc0b0",
      accentSoft: "#6fa090",
      glow: "rgba(143, 192, 176, 0.14)",
      glassRgb: "18, 28, 25",
      dot: "rgba(190, 220, 210, 0.05)",
    },
  },
  {
    id: "autumn-ember",
    name: "Autumn Ember",
    tagline: "warm dusk, leaves letting go",
    animalId: "fox",
    vars: {
      bg: "#100c08",
      panelSolid: "#17110b",
      border: "rgba(220, 200, 180, 0.09)",
      text: "#e6dccf",
      textMuted: "#9a8b78",
      accent: "#d9a066",
      accentSoft: "#b57e46",
      glow: "rgba(217, 160, 102, 0.13)",
      glassRgb: "30, 22, 14",
      dot: "rgba(220, 200, 180, 0.05)",
    },
  },
  {
    id: "twilight",
    name: "Twilight",
    tagline: "the blue hour, first stars out",
    animalId: "owl",
    vars: {
      bg: "#090b12",
      panelSolid: "#0f1320",
      border: "rgba(190, 200, 230, 0.09)",
      text: "#d6ddec",
      textMuted: "#838ba0",
      accent: "#8aa0d8",
      accentSoft: "#6a80b8",
      glow: "rgba(138, 160, 216, 0.14)",
      glassRgb: "18, 22, 36",
      dot: "rgba(190, 200, 230, 0.05)",
    },
  },
  {
    id: "blossom",
    name: "Blossom",
    tagline: "a branch of sakura at night",
    animalId: "rabbit",
    vars: {
      bg: "#100a0d",
      panelSolid: "#180f13",
      border: "rgba(230, 200, 210, 0.09)",
      text: "#ecdde3",
      textMuted: "#a08893",
      accent: "#d99bb0",
      accentSoft: "#b87890",
      glow: "rgba(217, 155, 176, 0.13)",
      glassRgb: "32, 20, 26",
      dot: "rgba(230, 200, 210, 0.05)",
    },
  },
  {
    id: "deep-moss",
    name: "Deep Moss",
    tagline: "still air in an old forest",
    animalId: "cat",
    vars: {
      bg: "#080c0a",
      panelSolid: "#0d140f",
      border: "rgba(190, 210, 190, 0.09)",
      text: "#d6e4d9",
      textMuted: "#849585",
      accent: "#7bad86",
      accentSoft: "#5c8c67",
      glow: "rgba(123, 173, 134, 0.14)",
      glassRgb: "16, 26, 18",
      dot: "rgba(190, 210, 190, 0.05)",
    },
  },
];

export const DEFAULT_WORLD = WORLDS[0];

export const resolveWorld = (id?: string | null): World =>
  WORLDS.find((w) => w.id === id) ?? DEFAULT_WORLD;

/** The world an avatar suggests when it's chosen (null → default). */
export const worldForAnimal = (animalId?: string | null): World =>
  WORLDS.find((w) => w.animalId === animalId) ?? DEFAULT_WORLD;

/** Write a world's palette to the document root — re-skins the whole app. */
export function applyWorld(world: World): void {
  const s = document.documentElement.style;
  const v = world.vars;
  s.setProperty("--bg", v.bg);
  s.setProperty("--panel-solid", v.panelSolid);
  s.setProperty("--border", v.border);
  s.setProperty("--text", v.text);
  s.setProperty("--text-muted", v.textMuted);
  s.setProperty("--accent", v.accent);
  s.setProperty("--accent-soft", v.accentSoft);
  s.setProperty("--glow", v.glow);
  s.setProperty("--glass-rgb", v.glassRgb);
  s.setProperty("--dot", v.dot);
}
