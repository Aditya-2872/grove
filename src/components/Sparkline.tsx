// ---------------------------------------------------------------------------
// A tiny inline trend line for a widget's history. Stretches to full width;
// renders nothing until there are at least two points to connect.
// ---------------------------------------------------------------------------

export default function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const W = 100;
  const H = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - 2 - ((v - min) / range) * (H - 4);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `M0 ${H} ${pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L${W} ${H} Z`;
  const [ex, ey] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: "22px", display: "block" }}
      aria-hidden="true"
    >
      <path d={area} fill="var(--accent)" opacity="0.13" />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={ex} cy={ey} r="1.8" fill="var(--accent)" />
    </svg>
  );
}
