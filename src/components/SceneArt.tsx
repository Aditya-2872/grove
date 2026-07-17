// ---------------------------------------------------------------------------
// A calm, looping scene along the bottom of each tab. Every workspace gets a
// different creature (panda, fox, cat, deer, rabbit, owl) resting on a soft
// hill with swaying grass. Purely decorative and non-interactive.
//
// The creatures themselves live in animalShapes.tsx (shared with profile
// avatars). Here we only place one on the hill with a breathing "bob".
//
// Important: positioning uses the SVG `transform` ATTRIBUTE on an outer <g>,
// while the breathing "bob" animation (a CSS transform) lives on a separate
// INNER <g>. CSS transform overrides the SVG transform attribute, so mixing the
// two on one element would wipe out the positioning.
// ---------------------------------------------------------------------------

import { animalForIndex, swayStyle } from "../animalShapes";

const bob = (dur = 6): React.CSSProperties => ({ animation: `bob ${dur}s ease-in-out infinite` });

/** Positioning wrapper (attribute) + breathing wrapper (CSS), kept separate. */
function Creature({ x, y, dur, children }: { x: number; y: number; dur: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={bob(dur)}>{children}</g>
    </g>
  );
}

function Grass() {
  const tufts = [90, 240, 430, 560, 760, 980, 1160, 1330];
  return (
    <g>
      {tufts.map((x, i) => (
        <g key={x} style={swayStyle(3.4 + (i % 3) * 0.6, (i % 4) * 0.3)}>
          <path d={`M${x} 200 q -3 -20 -8 -30`} stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
          <path d={`M${x} 200 q 0 -22 0 -34`} stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.55" />
          <path d={`M${x} 200 q 3 -20 8 -30`} stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

export default function SceneArt({ index }: { index: number }) {
  const animal = animalForIndex(index);
  return (
    // No fixed height + no "slice": the scene keeps its own aspect ratio and the
    // strip's height follows the width. A fixed height with `slice` scaled the
    // art to COVER, cropping the overflow off the top — which beheaded the
    // creatures on any window wider than ~1267px.
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
      <svg className="block h-auto w-full" viewBox="0 0 1440 200" preserveAspectRatio="xMidYMax meet" fill="none">
        <path d="M0 140 C 300 108 560 150 820 132 C 1080 116 1260 150 1440 128 L1440 200 L0 200 Z" fill="var(--accent)" opacity="0.12" />
        <path d="M0 172 C 360 150 640 184 900 168 C 1160 154 1300 182 1440 166 L1440 200 L0 200 Z" fill="var(--accent)" opacity="0.16" />
        <Grass />
        <Creature x={1050} y={8} dur={6}>
          <animal.Shape />
        </Creature>
      </svg>
    </div>
  );
}
