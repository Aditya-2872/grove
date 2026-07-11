// ---------------------------------------------------------------------------
// A profile avatar. Three sources, in priority order:
//   1. an uploaded image (data URL)  → shown as a cover-fit picture
//   2. a preset animal (avatarId)    → the app's own creature on a soft disc
//   3. neither                        → a gentle initial on a disc
// Sizes to whatever box it's placed in (width/height via className or style).
// ---------------------------------------------------------------------------

import { animalById } from "../animalShapes";

export default function Avatar({
  avatarId,
  avatarImage,
  name,
  color = "#9db38c",
  className,
}: {
  avatarId?: string | null;
  avatarImage?: string | null;
  name?: string;
  color?: string;
  className?: string;
}) {
  if (avatarImage) {
    return (
      <img
        src={avatarImage}
        alt={name ? `${name}'s avatar` : "avatar"}
        className={className}
        style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }}
      />
    );
  }

  const animal = animalById(avatarId);
  return (
    <svg viewBox="0 0 100 100" className={className} style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <radialGradient id={`disc_${avatarId ?? "init"}`} cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="#151a15" />
      <rect width="100" height="100" fill={`url(#disc_${avatarId ?? "init"})`} />
      <circle cx="50" cy="50" r="46" fill={color} opacity="0.12" />
      {animal ? (
        <g transform={animal.frame}>
          <animal.Shape />
        </g>
      ) : (
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="38"
          fill={color}
          fontFamily="Georgia, serif"
        >
          {(name?.trim()?.[0] ?? "·").toUpperCase()}
        </text>
      )}
    </svg>
  );
}
