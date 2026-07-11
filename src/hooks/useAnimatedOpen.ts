// ---------------------------------------------------------------------------
// Keeps a popup mounted through its exit animation. Returns whether to render;
// callers apply a "pop-in" class while `open`, "pop-out" while closing. Once the
// exit window elapses the element unmounts.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

export function useAnimatedOpen(open: boolean, exitMs = 240): boolean {
  const [render, setRender] = useState(open);

  useEffect(() => {
    if (open) {
      setRender(true);
      return;
    }
    const t = window.setTimeout(() => setRender(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return render;
}
