"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type PresetKey = "cottage" | "modern" | "zen" | "xeriscape";

interface Preset {
  label: string;
  prompt: string;
  after: string;
}

const PRESETS: Record<PresetKey, Preset> = {
  cottage: {
    label: "In-ground Pool",
    prompt: "in-ground pool, paver deck, lush poolside plantings",
    after: "/landing/yard-after.webp",
  },
  modern: {
    label: "Entertainment",
    prompt: "outdoor lounge, fire pit, string lights, low planters",
    after: "/landing/yard-entertainment.webp",
  },
  zen: {
    label: "Modern",
    prompt: "minimalist modern, boxwood cubes, pea gravel, concrete pavers",
    after: "/landing/yard-modern.webp",
  },
  xeriscape: {
    label: "Child Friendly",
    prompt: "soft turf, play bed, smooth pavers, kid-safe shrubs",
    after: "/landing/yard-child-friendly.webp",
  },
};

const PRESET_ORDER: PresetKey[] = ["cottage", "modern", "zen", "xeriscape"];

export function LandingHero() {
  const [preset, setPreset] = useState<PresetKey>("cottage");
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hoveringRef = useRef(false);
  const phaseOffsetRef = useRef(0);
  const wasPausedRef = useRef(true);

  const active = PRESETS[preset];

  const beforeSrc = "/landing/yard-before.jpg";

  const presetTags = useMemo(
    () =>
      PRESET_ORDER.map((k) => ({
        key: k,
        label: PRESETS[k].label,
      })),
    []
  );

  // Preload presets for instant toggle
  useEffect(() => {
    const urls = [beforeSrc, ...PRESET_ORDER.map((k) => PRESETS[k].after)];
    urls.forEach((url) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      if (img.decode) img.decode().catch(() => {});
    });
  }, []);

  // Idle sweep animation + drag handling
  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const PERIOD = 7;
    const AMP = 18;
    const CENTER = 50;
    let raf = 0;

    function setPct(pct: number) {
      slider!.style.setProperty("--split", pct + "%");
    }
    function getPct() {
      return (
        parseFloat(getComputedStyle(slider!).getPropertyValue("--split")) || 50
      );
    }
    function set(x: number) {
      const r = slider!.getBoundingClientRect();
      const pct = Math.max(4, Math.min(96, ((x - r.left) / r.width) * 100));
      setPct(pct);
    }

    const onDown = (e: MouseEvent) => {
      draggingRef.current = true;
      set(e.clientX);
    };
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) set(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    const onTouchStart = (e: TouchEvent) => {
      draggingRef.current = true;
      set(e.touches[0].clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (draggingRef.current) set(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      draggingRef.current = false;
    };
    const onEnter = () => {
      hoveringRef.current = true;
    };
    const onLeave = () => {
      hoveringRef.current = false;
    };

    slider.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    slider.addEventListener("touchstart", onTouchStart, { passive: true });
    slider.addEventListener("touchmove", onTouchMove, { passive: true });
    slider.addEventListener("touchend", onTouchEnd);
    slider.addEventListener("mouseenter", onEnter);
    slider.addEventListener("mouseleave", onLeave);

    function tick(now: number) {
      const paused =
        reduced || draggingRef.current || hoveringRef.current;
      if (!paused) {
        if (wasPausedRef.current) {
          const cur = getPct();
          const ratio = Math.max(-1, Math.min(1, (cur - CENTER) / AMP));
          const baseAngle = Math.asin(ratio);
          phaseOffsetRef.current =
            now / 1000 - baseAngle / ((Math.PI * 2) / PERIOD);
          wasPausedRef.current = false;
        }
        const t = now / 1000 - phaseOffsetRef.current;
        setPct(CENTER + Math.sin(t * ((Math.PI * 2) / PERIOD)) * AMP);
      } else {
        wasPausedRef.current = true;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      slider.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      slider.removeEventListener("touchstart", onTouchStart);
      slider.removeEventListener("touchmove", onTouchMove);
      slider.removeEventListener("touchend", onTouchEnd);
      slider.removeEventListener("mouseenter", onEnter);
      slider.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section className="hero" id="product" data-variant="A">
      <div className="vA">
        <div className="veg vA-leaf left" aria-hidden="true">
          <svg viewBox="0 0 540 640" preserveAspectRatio="xMidYMid meet">
            <g>
              <path d="M115,625 C 80,440 125,245 235,95 C 305,15 370,5 388,36 C 405,66 362,178 280,300 C 210,412 160,515 140,625 Z" />
            </g>
            <g opacity="0.72" transform="translate(170 90) rotate(20)">
              <path d="M60,510 C 40,370 82,208 172,75 C 220,15 260,5 270,30 C 280,55 250,154 190,255 C 130,348 92,430 80,510 Z" />
            </g>
          </svg>
        </div>

        <div className="veg vA-leaf right" aria-hidden="true">
          <svg viewBox="0 0 640 720" preserveAspectRatio="xMidYMid meet">
            <g transform="translate(340 50) rotate(14)">
              <path d="M-6,0 C 6,120 36,260 76,420 C 92,500 108,582 118,642 L 108,648 C 94,588 74,506 54,420 C 18,260 -12,120 -14,4 Z" />
              <ellipse cx="-58" cy="72" rx="72" ry="19" transform="rotate(-28 -58 72)" />
              <ellipse cx="70" cy="88" rx="72" ry="19" transform="rotate(28 70 88)" />
              <ellipse cx="-64" cy="154" rx="82" ry="21" transform="rotate(-24 -64 154)" />
              <ellipse cx="80" cy="170" rx="82" ry="21" transform="rotate(24 80 170)" />
              <ellipse cx="-58" cy="238" rx="76" ry="20" transform="rotate(-20 -58 238)" />
              <ellipse cx="72" cy="254" rx="76" ry="20" transform="rotate(20 72 254)" />
              <ellipse cx="-50" cy="322" rx="66" ry="18" transform="rotate(-18 -50 322)" />
              <ellipse cx="62" cy="338" rx="66" ry="18" transform="rotate(18 62 338)" />
              <ellipse cx="-42" cy="402" rx="54" ry="15" transform="rotate(-16 -42 402)" />
              <ellipse cx="50" cy="418" rx="54" ry="15" transform="rotate(16 50 418)" />
              <ellipse cx="-32" cy="478" rx="42" ry="12" transform="rotate(-14 -32 478)" />
              <ellipse cx="37" cy="494" rx="42" ry="12" transform="rotate(14 37 494)" />
              <ellipse cx="-22" cy="548" rx="30" ry="10" transform="rotate(-12 -22 548)" />
              <ellipse cx="26" cy="562" rx="30" ry="10" transform="rotate(12 26 562)" />
            </g>
            <g transform="translate(110 720)" opacity="0.85">
              <path d="M0,0 C -10,-200 14,-360 44,-520 C 56,-582 60,-618 58,-635 C 50,-620 30,-530 16,-400 C 4,-260 -6,-120 -10,0 Z" />
              <path d="M44,0 C 42,-220 86,-380 128,-520 C 148,-580 158,-606 158,-620 C 146,-604 112,-520 90,-386 C 70,-244 52,-120 46,0 Z" />
              <path d="M96,0 C 102,-240 148,-400 200,-540 C 220,-590 230,-608 232,-618 C 214,-598 178,-498 146,-376 C 122,-256 104,-120 100,0 Z" />
              <path d="M160,0 C 168,-200 210,-340 252,-460 C 268,-506 280,-526 280,-536 C 262,-516 232,-440 204,-340 C 180,-240 164,-120 164,0 Z" />
            </g>
          </svg>
        </div>

        <div className="vA-copy">
          <span className="eyebrow">
            <span className="dot" />
            <strong>New</strong>&nbsp;Generate in under 8 seconds
          </span>
          <h1>
            Redesign your yard before you <em>plant a thing</em>.
          </h1>
          <p className="hero-sub">
            Upload a photo of your house, pick a style, get a professional
            landscaping design in seconds. Your house stays exactly the way it
            is.
          </p>
          <div className="vA-ctas">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Start free — 3 credits
            </Link>
            <button type="button" className="btn btn-outline btn-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch 30-sec demo
            </button>
          </div>
          <div className="vA-preset-row">
            <span className="label">Try a style</span>
            {presetTags.map((p) => (
              <button
                type="button"
                key={p.key}
                className={`chip${preset === p.key ? " active" : ""}`}
                onClick={() => setPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="trust">
            <div className="trust-avatars">
              <span style={{ background: "linear-gradient(135deg,#c8a878,#8a6a4a)" }} />
              <span style={{ background: "linear-gradient(135deg,#a8c878,#6a8a4a)" }} />
              <span style={{ background: "linear-gradient(135deg,#78a8c8,#4a6a8a)" }} />
              <span style={{ background: "linear-gradient(135deg,#c878a8,#8a4a6a)" }} />
            </div>
            <div>
              <div className="trust-stars">★★★★★</div>
              <div>
                Trusted by{" "}
                <strong style={{ color: "var(--ls-fg)", fontWeight: 600 }}>
                  2,400+
                </strong>{" "}
                landscapers &amp; homeowners
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div className="ba-card">
            <div className="ba-meta">
              <div className="ba-meta-left">
                <span className="ls-label">Project</span>
                <span className="title">211 Maple Ave · Front yard</span>
              </div>
              <div className="ba-chips">
                <span className="ba-chip">☀️ Afternoon</span>
                <span className="ba-chip">🌸 Spring</span>
              </div>
            </div>
            <div
              ref={sliderRef}
              className="ba-slider"
              style={{ "--split": "48%" } as React.CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ba-img ba-before" src={beforeSrc} alt="Before" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ba-img ba-after"
                src={active.after}
                alt={`After: ${active.label}`}
              />
              <span className="ba-tag left">Before</span>
              <span className="ba-tag right">After · {active.label}</span>
              <div className="ba-handle" />
              <div className="ba-knob">
                <svg viewBox="0 0 24 24">
                  <path d="M15 6l-6 6 6 6M9 6l6 6-6 6" />
                </svg>
              </div>
            </div>
            <div className="ba-footer">
              <div className="ba-footer-left">
                <span className="ls-label">Prompt</span>
                <span className="ba-prompt" title={active.prompt}>
                  {active.prompt}
                </span>
              </div>
              <span className="ba-time">6.2s · 1 credit</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
