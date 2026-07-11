// ---------------------------------------------------------------------------
// A quiet, anime-inspired backdrop for the welcome/compose screen: a soft moon,
// a few drifting stars, and layered hills in the tab's accent tones.
// ---------------------------------------------------------------------------

const STARS = [
  { x: 12, y: 18, d: 0 },
  { x: 22, y: 34, d: 1.2 },
  { x: 31, y: 12, d: 0.6 },
  { x: 68, y: 20, d: 0.3 },
  { x: 78, y: 32, d: 1.6 },
  { x: 85, y: 14, d: 0.9 },
  { x: 47, y: 10, d: 2.1 },
  { x: 58, y: 26, d: 1.4 },
  { x: 8, y: 44, d: 0.5 },
  { x: 91, y: 46, d: 1.9 },
];

export default function WelcomeArt() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* moon glow */}
      <div
        className="floaty absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, var(--glow), transparent 68%)" }}
      />
      <div
        className="absolute left-1/2 top-24 h-24 w-24 -translate-x-1/2 rounded-full opacity-70 blur-md"
        style={{ background: "radial-gradient(circle, rgba(230,240,225,0.35), transparent 70%)" }}
      />

      {/* stars */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute size-[3px] rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            animation: `twinkle ${3 + s.d}s ease-in-out ${s.d}s infinite`,
          }}
        />
      ))}

      {/* layered hills */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        <path
          d="M0 300 C 240 240 420 340 720 300 C 1020 260 1200 340 1440 290 L1440 420 L0 420 Z"
          fill="var(--accent)"
          opacity="0.10"
        />
        <path
          d="M0 350 C 300 300 520 380 760 350 C 1040 316 1220 380 1440 344 L1440 420 L0 420 Z"
          fill="var(--accent)"
          opacity="0.14"
        />
        <path
          d="M0 392 C 320 366 560 410 820 392 C 1080 374 1260 410 1440 390 L1440 420 L0 420 Z"
          fill="var(--accent)"
          opacity="0.20"
        />
      </svg>
    </div>
  );
}
