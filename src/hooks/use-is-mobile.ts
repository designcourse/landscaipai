"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe matchMedia hook that returns true when the viewport width is
 * below `breakpoint` (defaults to 768px — Tailwind's `md`).
 *
 * Used by floating-panel modals (Plant Library, Video Generation) to switch
 * into a fullscreen takeover layout on phones, where panel-style chrome
 * (drag/resize/maximize) doesn't make sense.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
