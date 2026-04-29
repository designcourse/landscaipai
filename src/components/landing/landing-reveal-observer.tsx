"use client";

import { useEffect } from "react";

/**
 * Activates `.reveal.in` on any `.reveal` element as it scrolls into view.
 * Mirrors the design's IntersectionObserver pattern.
 */
export function LandingRevealObserver() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".landing-root .reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
