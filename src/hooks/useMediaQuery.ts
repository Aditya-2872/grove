// ---------------------------------------------------------------------------
// Subscribe to a CSS media query from React. Used to switch Grove between the
// free-drag canvas (pointer + room) and a stacked column (phones), and to drop
// cursor-only flourishes on touch devices.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Phones and narrow windows: stack widgets instead of free-placing them. */
export const useIsStacked = () => useMediaQuery("(max-width: 767px)");

/** Touch/pen: no hover, no cursor — skip cursor-driven effects. */
export const useIsCoarsePointer = () => useMediaQuery("(pointer: coarse)");
