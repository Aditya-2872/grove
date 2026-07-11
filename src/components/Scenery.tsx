// ---------------------------------------------------------------------------
// The scene behind a tab. Built-in scenes are hand-drawn SVG that read the
// world's CSS variables (--accent / --accent-soft / --glow / --text), so they
// re-tint whenever the profile's world changes. A user's uploaded image is
// shown instead when chosen. This layer sits at the very back; the RevealTrail
// canvas above it keeps it hidden until the cursor unveils it.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import type { Scenery as SceneryType } from "../types";
import { resolveScenery } from "../scenery";

// deterministic star field (a tiny LCG so positions are stable across renders)
function stars(count: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: count }, () => ({
    x: rnd() * 1440,
    y: rnd() * 560,
    r: 0.6 + rnd() * 1.6,
    o: 0.25 + rnd() * 0.5,
    d: 2 + rnd() * 4,
  }));
}

function Sky({ children, seed = 7, starCount = 46 }: { children?: React.ReactNode; seed?: number; starCount?: number }) {
  const st = useMemo(() => stars(starCount, seed), [seed, starCount]);
  return (
    <>
      <defs>
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="45%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="skyTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--glow)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1440" height="900" fill="url(#skyTop)" opacity="0.6" />
      {st.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="var(--text)" opacity={s.o}>
          <animate attributeName="opacity" values={`${s.o};${s.o * 0.25};${s.o}`} dur={`${s.d}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {children}
    </>
  );
}

function Moon({ x = 1180, y = 190, r = 66 }: { x?: number; y?: number; r?: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r * 2.4} fill="url(#moonGlow)" />
      <circle cx={x} cy={y} r={r} fill="var(--accent)" opacity="0.85" />
      <circle cx={x + r * 0.28} cy={y - r * 0.2} r={r} fill="var(--bg)" opacity="0.55" />
    </>
  );
}

function Mountains() {
  return (
    <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <Sky seed={11}>
        <Moon x={1150} y={200} r={70} />
      </Sky>
      <path d="M0 640 L240 430 L430 600 L640 380 L860 610 L1080 440 L1260 590 L1440 470 L1440 900 L0 900 Z" fill="var(--accent-soft)" opacity="0.16" />
      <path d="M0 640 L240 430 L430 600 L640 380 L860 610 L1080 440 L1260 590 L1440 470" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.4" />
      <path d="M0 760 L300 600 L560 740 L820 560 L1080 730 L1320 620 L1440 700 L1440 900 L0 900 Z" fill="var(--bg)" opacity="0.9" />
      <path d="M0 760 L300 600 L560 740 L820 560 L1080 730 L1320 620 L1440 700" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.3" />
    </svg>
  );
}

function Forest() {
  const pines = [80, 250, 470, 690, 900, 1120, 1330];
  return (
    <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <Sky seed={29} starCount={40}>
        <Moon x={320} y={180} r={54} />
      </Sky>
      <path d="M0 700 C300 660 560 700 820 675 C1080 650 1300 695 1440 668 L1440 900 L0 900 Z" fill="var(--accent-soft)" opacity="0.12" />
      {pines.map((x, i) => {
        const s = 0.8 + ((i * 37) % 5) * 0.12;
        const h = 150 * s;
        const base = 760;
        return (
          <g key={x} opacity="0.9">
            <path d={`M${x} ${base - h} L${x - 40 * s} ${base} L${x + 40 * s} ${base} Z`} fill="var(--bg)" />
            <path d={`M${x} ${base - h} L${x - 34 * s} ${base - 30 * s} L${x + 34 * s} ${base - 30 * s} Z`} fill="var(--accent)" opacity="0.14" />
            <rect x={x - 4} y={base} width="8" height="30" fill="var(--bg)" />
          </g>
        );
      })}
      <path d="M0 790 C360 760 640 800 900 782 C1160 764 1320 796 1440 778 L1440 900 L0 900 Z" fill="var(--bg)" />
    </svg>
  );
}

function Starfield() {
  return (
    <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="galaxy" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="360" rx="620" ry="240" fill="url(#galaxy)" transform="rotate(-16 720 360)" />
      <Sky seed={5} starCount={90} />
      <path d="M980 120 L1120 240" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" opacity="0.6">
        <animate attributeName="opacity" values="0;0.7;0" dur="5s" repeatCount="indefinite" />
      </path>
      <path d="M0 820 C400 800 800 815 1440 800 L1440 900 L0 900 Z" fill="var(--bg)" opacity="0.85" />
    </svg>
  );
}

const SCENE_MAP: Record<string, React.FC> = {
  mountains: Mountains,
  forest: Forest,
  starfield: Starfield,
};

export default function Scenery({ scenery }: { scenery?: SceneryType }) {
  const s = resolveScenery(scenery);
  const Scene = (s.kind === "scene" && SCENE_MAP[s.id]) || Mountains;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {s.kind === "image" ? <img src={s.url} alt="" className="h-full w-full object-cover" /> : <Scene />}
    </div>
  );
}
