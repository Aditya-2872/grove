// ---------------------------------------------------------------------------
// The calm creatures, defined once. Each shape is drawn in its own local
// coordinates (no positioning) so it can be reused two ways:
//   • SceneArt — placed on the hill at the foot of a tab (with a breathing bob)
//   • Avatar   — centered in a disc as a profile avatar (via AVATAR_FRAME)
// Colors and forms match the established sage-night aesthetic.
// ---------------------------------------------------------------------------

export const blink: React.CSSProperties = {
  transformBox: "fill-box",
  transformOrigin: "center",
  animation: "blink 6s ease-in-out infinite",
};
export const swayStyle = (dur: number, delay = 0): React.CSSProperties => ({
  transformBox: "fill-box",
  transformOrigin: "bottom center",
  animation: `sway ${dur}s ease-in-out ${delay}s infinite`,
});

export function PandaShape() {
  return (
    <>
      <ellipse cx="0" cy="150" rx="16" ry="10" fill="#2a2f2a" />
      <ellipse cx="34" cy="150" rx="16" ry="10" fill="#2a2f2a" />
      <ellipse cx="17" cy="120" rx="46" ry="42" fill="#e8ece6" />
      <ellipse cx="-24" cy="120" rx="12" ry="20" fill="#2a2f2a" />
      <ellipse cx="58" cy="120" rx="12" ry="20" fill="#2a2f2a" />
      <circle cx="17" cy="66" r="36" fill="#e8ece6" />
      <circle cx="-9" cy="40" r="12" fill="#2a2f2a" />
      <circle cx="43" cy="40" r="12" fill="#2a2f2a" />
      <ellipse cx="2" cy="64" rx="8" ry="11" fill="#2a2f2a" transform="rotate(-20 2 64)" />
      <ellipse cx="32" cy="64" rx="8" ry="11" fill="#2a2f2a" transform="rotate(20 32 64)" />
      <g style={blink}>
        <circle cx="4" cy="66" r="3" fill="#12140f" />
        <circle cx="30" cy="66" r="3" fill="#12140f" />
      </g>
      <ellipse cx="17" cy="80" rx="4" ry="3" fill="#2a2f2a" />
    </>
  );
}

export function FoxShape() {
  return (
    <>
      <path d="M40 148 q 40 -6 34 -54 q -4 24 -34 30 Z" fill="#b08968" />
      <path d="M60 128 q 18 -6 16 -28 q -4 12 -16 18 Z" fill="#e8ece6" opacity="0.85" />
      <ellipse cx="18" cy="120" rx="34" ry="30" fill="#b08968" />
      <path d="M-6 74 L-18 40 L6 60 Z" fill="#b08968" />
      <path d="M42 74 L54 40 L30 60 Z" fill="#b08968" />
      <path d="M-4 66 L-11 46 L4 58 Z" fill="#2a2f2a" opacity="0.6" />
      <path d="M40 66 L47 46 L32 58 Z" fill="#2a2f2a" opacity="0.6" />
      <circle cx="18" cy="82" r="26" fill="#b08968" />
      <path d="M18 66 q -20 6 -22 30 q 22 8 22 8 q 0 0 22 -8 q -2 -24 -22 -30 Z" fill="#e8ece6" />
      <g style={blink}>
        <circle cx="7" cy="80" r="3" fill="#12140f" />
        <circle cx="29" cy="80" r="3" fill="#12140f" />
      </g>
      <circle cx="18" cy="98" r="4" fill="#2a2f2a" />
    </>
  );
}

export function CatShape() {
  return (
    <>
      <path d="M50 150 q 44 4 30 -44 q -2 24 -30 26 Z" fill="#7a8a80" style={swayStyle(4, 0)} />
      <ellipse cx="20" cy="120" rx="30" ry="34" fill="#7a8a80" />
      <circle cx="20" cy="78" r="27" fill="#7a8a80" />
      <path d="M-2 58 L-8 30 L14 52 Z" fill="#7a8a80" />
      <path d="M42 58 L48 30 L26 52 Z" fill="#7a8a80" />
      <g style={blink}>
        <path d="M6 78 q 4 -5 8 0" stroke="#12140f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M26 78 q 4 -5 8 0" stroke="#12140f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      <path d="M20 86 l-3 4 h6 Z" fill="#2a2f2a" />
      <path d="M14 92 q 6 4 12 0" stroke="#2a2f2a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  );
}

export function DeerShape() {
  return (
    <>
      <ellipse cx="24" cy="120" rx="40" ry="26" fill="#a8916f" />
      <rect x="2" y="128" width="7" height="34" rx="3" fill="#8a7659" />
      <rect x="40" y="128" width="7" height="34" rx="3" fill="#8a7659" />
      <rect x="52" y="70" width="9" height="52" rx="4" fill="#a8916f" transform="rotate(14 56 96)" />
      <ellipse cx="70" cy="60" rx="16" ry="20" fill="#a8916f" />
      <path d="M62 44 L54 20 L64 36 L60 16" stroke="#8a7659" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M78 44 L86 20 L76 36 L80 16" stroke="#8a7659" strokeWidth="3" fill="none" strokeLinecap="round" />
      <g style={blink}>
        <circle cx="70" cy="58" r="3" fill="#12140f" />
      </g>
      <ellipse cx="72" cy="72" rx="4" ry="3" fill="#2a2f2a" />
    </>
  );
}

export function RabbitShape() {
  return (
    <>
      <g style={swayStyle(4.5, 0.4)}>
        <ellipse cx="8" cy="52" rx="7" ry="30" fill="#c9ccc4" />
        <ellipse cx="8" cy="52" rx="3" ry="22" fill="#e7c9cf" />
      </g>
      <g style={swayStyle(4.5, 0)}>
        <ellipse cx="30" cy="50" rx="7" ry="32" fill="#c9ccc4" />
        <ellipse cx="30" cy="50" rx="3" ry="24" fill="#e7c9cf" />
      </g>
      <ellipse cx="20" cy="124" rx="30" ry="30" fill="#c9ccc4" />
      <circle cx="20" cy="92" r="24" fill="#c9ccc4" />
      <g style={blink}>
        <circle cx="10" cy="92" r="3" fill="#12140f" />
        <circle cx="30" cy="92" r="3" fill="#12140f" />
      </g>
      <path d="M20 100 l-2 3 h4 Z" fill="#e7a9b3" />
      <ellipse cx="44" cy="140" rx="9" ry="9" fill="#e8ece6" />
    </>
  );
}

export function OwlShape() {
  return (
    <>
      <ellipse cx="24" cy="112" rx="34" ry="40" fill="#8a9a86" />
      <path d="M24 78 q -30 -2 -22 40 q 22 -14 22 -14 q 0 0 22 14 q 8 -42 -22 -40 Z" fill="#a7b8a0" opacity="0.7" />
      <path d="M0 74 L-6 52 L14 66 Z" fill="#8a9a86" />
      <path d="M48 74 L54 52 L34 66 Z" fill="#8a9a86" />
      <circle cx="10" cy="86" r="12" fill="#e8ece6" />
      <circle cx="38" cy="86" r="12" fill="#e8ece6" />
      <g style={blink}>
        <circle cx="10" cy="86" r="5" fill="#12140f" />
        <circle cx="38" cy="86" r="5" fill="#12140f" />
      </g>
      <path d="M24 92 l-5 6 h10 Z" fill="#d0a24e" />
      <path d="M6 132 l6 8 M24 134 l0 8 M42 132 l-6 8" stroke="#6f7f6b" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

export interface AnimalDef {
  id: string;
  name: string;
  Shape: React.FC;
  /** transform to center the creature's face in a 100×100 avatar disc */
  frame: string;
  /** representative color — used as the profile's default accent swatch */
  color: string;
}

// The order here is also the SceneArt cycle order (kept identical to before).
export const ANIMALS: AnimalDef[] = [
  { id: "panda", name: "Panda", Shape: PandaShape, frame: "translate(34 -12) scale(0.95)", color: "#e8ece6" },
  { id: "fox", name: "Fox", Shape: FoxShape, frame: "translate(33 -25) scale(0.92)", color: "#b08968" },
  { id: "cat", name: "Cat", Shape: CatShape, frame: "translate(31 -22) scale(0.92)", color: "#7a8a80" },
  { id: "deer", name: "Deer", Shape: DeerShape, frame: "translate(-16 -7) scale(0.95)", color: "#a8916f" },
  { id: "rabbit", name: "Rabbit", Shape: RabbitShape, frame: "translate(33 -34) scale(0.85)", color: "#c9ccc4" },
  { id: "owl", name: "Owl", Shape: OwlShape, frame: "translate(30 -40) scale(0.82)", color: "#8a9a86" },
];

export const animalById = (id?: string | null): AnimalDef | undefined =>
  ANIMALS.find((a) => a.id === id);

/** The animal shown on a tab's scene, by theme index (unchanged cycle). */
export const animalForIndex = (index: number): AnimalDef =>
  ANIMALS[((index % ANIMALS.length) + ANIMALS.length) % ANIMALS.length];
