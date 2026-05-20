"use client";

import { useEffect, useRef, useState } from "react";
import "./pwa-splash.css";

const HOLD_MS = 1500;
const FADE_MS = 500;
const TOTAL_MS = HOLD_MS + FADE_MS;

// Same leaf SVG used in landing-gallery.tsx — single curved leaf shape.
const LEAF_SVG =
  '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">' +
  '<path d="M50,95 C 35,70 30,45 40,22 C 48,4 60,0 68,8 C 76,18 70,45 62,62 C 55,78 52,87 50,95 Z"/>' +
  '<path d="M50,95 L 50,32" stroke="rgba(0,0,0,.12)" stroke-width="1.2" fill="none"/>' +
  "</svg>";

// Tones that read well against the green splash background.
const COLORS = ["cream", "sand", "lime", "moss", "olive", "leaf"];

function detectStandalone(): { standalone: boolean; isIosLegacy: boolean } {
  if (typeof window === "undefined") return { standalone: false, isIosLegacy: false };
  const mediaMatch = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const iosLegacy = nav.standalone === true;
  return { standalone: mediaMatch || iosLegacy, isIosLegacy: iosLegacy && !mediaMatch };
}

export function PwaSplash() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");
  const [iosLegacy, setIosLegacy] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { standalone, isIosLegacy } = detectStandalone();
    if (!standalone) {
      setPhase("gone");
      return;
    }
    if (isIosLegacy) setIosLegacy(true);
    const fadeT = window.setTimeout(() => setPhase("fading"), HOLD_MS);
    const goneT = window.setTimeout(() => setPhase("gone"), TOTAL_MS);
    return () => {
      window.clearTimeout(fadeT);
      window.clearTimeout(goneT);
    };
  }, []);

  useEffect(() => {
    if (phase === "gone") return;
    const layer = layerRef.current;
    if (!layer) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const COUNT = 30;
    const leaves: Array<{
      el: HTMLDivElement;
      x0: number;
      y0: number;
      driftSpeed: number;
      swayAmp: number;
      swayFreq: number;
      phase: number;
      rot0: number;
      rotSpeed: number;
      size: number;
    }> = [];

    const rnd = (min: number, max: number) => Math.random() * (max - min) + min;

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement("div");
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      el.className = "lf " + color;
      el.innerHTML = LEAF_SVG;
      const sizeRoll = Math.random();
      let size: number;
      if (sizeRoll < 0.5) size = rnd(26, 42);
      else if (sizeRoll < 0.85) size = rnd(42, 64);
      else size = rnd(64, 90);
      el.style.width = size + "px";
      el.style.height = size + "px";
      layer.appendChild(el);
      leaves.push({
        el,
        x0: rnd(0, 100),
        y0: rnd(-30, 120),
        driftSpeed: rnd(14, 38),
        swayAmp: rnd(20, 80),
        swayFreq: rnd(0.08, 0.25),
        phase: rnd(0, Math.PI * 2),
        rot0: rnd(-40, 40),
        rotSpeed: rnd(6, 24) * (Math.random() < 0.5 ? -1 : 1),
        size,
      });
    }

    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rect = layer.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      // Layer can be 0×0 while CSS keeps the splash display:none in non-standalone mode.
      // Skip positioning until the browser actually lays it out.
      if (w > 0 && h > 0) {
        const wrapH = h + 160;
        leaves.forEach((l) => {
          l.y0 += ((l.driftSpeed * dt) / h) * 100;
          l.rot0 += l.rotSpeed * dt;
          const yPx = (l.y0 / 100) * h;
          const yWrap = ((yPx % wrapH) + wrapH) % wrapH - 80;
          const sway =
            Math.sin(now * 0.001 * l.swayFreq * Math.PI * 2 + l.phase) *
            l.swayAmp;
          const x = (l.x0 / 100) * w + sway - l.size / 2;
          l.el.style.transform = `translate3d(${x.toFixed(1)}px,${yWrap.toFixed(
            1
          )}px,0) rotate(${l.rot0.toFixed(1)}deg)`;
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      while (layer.firstChild) layer.removeChild(layer.firstChild);
    };
  }, [phase]);

  if (phase === "gone") return null;

  const cls = [
    "pwa-splash",
    phase === "fading" ? "is-fading" : "",
    iosLegacy ? "is-ios-standalone" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} aria-hidden="true">
      <div className="pwa-splash-leaves" ref={layerRef} />
      <div className="pwa-splash-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/leaf-mark-white.png" alt="" width={140} height={118} />
      </div>
    </div>
  );
}
