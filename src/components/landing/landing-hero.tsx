"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthModal } from "@/components/shared/auth-modal-context";

type Frame = { src: string; label: string };

// First entry is the "before" image; everything after is a styled after.
// PNGs are pre-aligned (scripts/align-hero-images.cjs) so the house occupies
// identical canvas coordinates in every frame and transitions stay registered.
const FRAMES: Frame[] = [
  { src: "/landing/hero-house-before-aligned.webp", label: "Before" },
  { src: "/landing/hero-house-after-1-aligned.webp", label: "Modern" },
  { src: "/landing/hero-house-after-desert-aligned.webp", label: "Desert" },
  { src: "/landing/hero-house-after-luxe-aligned.webp", label: "Luxe" },
];

// Locked Liquid Warp transition.  The fragment shader still contains the
// full switch over uType, but only the type==8 branch is ever taken now
// that the settings UI is gone.  Params, cycle delay, and duration are
// the hand-tuned values that survived the live-tweaking phase.
const SHADER_TYPE = 8;
const INTERVAL_MS = 2000;
const TRANSITION_MS = 2900;
const INITIAL_DELAY_MS = 1500;
// uParam1..4 for the liquid shader: [Warp Intensity, Edge Softness,
// Rim Glow, Chromatic].
const SHADER_PARAMS: readonly [number, number, number, number] = [
  0.005, 0.045, 0.05, 0.0,
];

// Soft white cloud cluster — overlapping ellipses chewed up by a
// fbm-turbulence displacement filter so the silhouette reads as a real
// cumulus instead of stacked circles.  Each instance picks its own seed
// for shape variety.
function HeroCloud({
  id,
  seed,
  scale,
}: {
  id: string;
  seed: number;
  scale: number;
}) {
  return (
    <svg viewBox="0 0 320 130" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id={id} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.022"
            numOctaves="2"
            seed={seed}
          />
          <feDisplacementMap in="SourceGraphic" scale={scale} />
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <g fill="#fff" filter={`url(#${id})`}>
        <ellipse cx="120" cy="78" rx="95" ry="35" />
        <ellipse cx="80" cy="65" rx="55" ry="38" />
        <ellipse cx="165" cy="60" rx="65" ry="40" />
        <ellipse cx="225" cy="78" rx="50" ry="32" />
      </g>
    </svg>
  );
}

function HeroClouds() {
  return (
    <div className="hero-3d-clouds" aria-hidden="true">
      <div className="hero-3d-cloud hero-3d-cloud--a">
        <HeroCloud id="hero-cloud-a" seed={3} scale={36} />
      </div>
      <div className="hero-3d-cloud hero-3d-cloud--b">
        <HeroCloud id="hero-cloud-b" seed={11} scale={48} />
      </div>
      <div className="hero-3d-cloud hero-3d-cloud--c">
        <HeroCloud id="hero-cloud-c" seed={17} scale={28} />
      </div>
      <div className="hero-3d-cloud hero-3d-cloud--d">
        <HeroCloud id="hero-cloud-d" seed={29} scale={42} />
      </div>
    </div>
  );
}

// Two butterflies that arc in from off-canvas on a random cubic bezier
// and then permanently flutter around the CTA.  The fluttering is a
// pure-CSS orbital trick (inspired by the lbebber CodePen): each
// butterfly is wrapped in nested transform layers that combine a fast
// inner oval orbit with a slow outer drift, while the wing pattern
// itself is just two radial-gradient ovals rapidly scale-flipped to
// fake a wing flap.  JS only owns the initial fly-in path and the
// resize re-anchor — once arrived, CSS keeps everything moving.
function HeroButterfly() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;

    const section = stage.closest(".hero-3d") as HTMLElement | null;
    if (!section) return;
    const cta = section.querySelector(".hero-3d-cta") as HTMLElement | null;
    if (!cta) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Hover-zone target: just above the CTA, centered horizontally.
    const hoverTarget = () => {
      const sect = section.getBoundingClientRect();
      const btn = cta.getBoundingClientRect();
      const x = btn.left - sect.left + btn.width * 0.5;
      const y = btn.top - sect.top - 36;
      return { x, y };
    };

    if (reduced) {
      const p = hoverTarget();
      wrap.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      queueMicrotask(() => setArrived(true));
      return;
    }

    const target = hoverTarget();
    const sectRect = section.getBoundingClientRect();

    // Randomised entry: alternates side, height, and arc steepness on
    // every reload so the fly-in never feels canned.
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -140 : sectRect.width + 140;
    const startY =
      sectRect.height * (0.1 + Math.random() * 0.35);
    const start = { x: startX, y: startY };

    // Two control points sketched around the midline with random jitter
    // produce a wandering rather than straight arc.
    const midX = (start.x + target.x) / 2;
    const peakY = Math.min(start.y, target.y) - (120 + Math.random() * 160);
    const ctrl1 = {
      x: midX + (Math.random() - 0.5) * sectRect.width * 0.3,
      y: peakY + (Math.random() - 0.5) * 60,
    };
    const ctrl2 = {
      x: target.x + (fromLeft ? -1 : 1) * (60 + Math.random() * 120),
      y: target.y - (60 + Math.random() * 120),
    };

    const DELAY = 2200 + Math.random() * 600;
    const DURATION = 3400 + Math.random() * 800;
    const startTime = performance.now() + DELAY;

    let raf = 0;
    let cancelled = false;

    const bezier = (
      t: number,
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ) => {
      const mt = 1 - t;
      return {
        x:
          mt * mt * mt * p0.x +
          3 * mt * mt * t * p1.x +
          3 * mt * t * t * p2.x +
          t * t * t * p3.x,
        y:
          mt * mt * mt * p0.y +
          3 * mt * mt * t * p1.y +
          3 * mt * t * t * p2.y +
          t * t * t * p3.y,
      };
    };
    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Hold off-screen during the pre-delay so the swarm doesn't pop in.
    wrap.style.transform = `translate3d(${start.x}px, ${start.y}px, 0)`;

    const tick = (now: number) => {
      if (cancelled) return;
      const raw = Math.min(1, Math.max(0, (now - startTime) / DURATION));
      const t = easeInOut(raw);
      const p = bezier(t, start, ctrl1, ctrl2, target);
      wrap.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(
        2
      )}px, 0)`;
      if (raw < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        wrap.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
        setArrived(true);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Once arrived, keep the swarm anchored over the CTA across font/
  // layout shifts.  CSS handles the continuous hover motion on top.
  useEffect(() => {
    if (!arrived) return;
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;
    const section = stage.closest(".hero-3d") as HTMLElement | null;
    if (!section) return;
    const cta = section.querySelector(".hero-3d-cta") as HTMLElement | null;
    if (!cta) return;

    const place = () => {
      const sect = section.getBoundingClientRect();
      const btn = cta.getBoundingClientRect();
      const x = btn.left - sect.left + btn.width * 0.5;
      const y = btn.top - sect.top - 36;
      wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(section);
    ro.observe(cta);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [arrived]);

  return (
    <div
      ref={stageRef}
      className={`hero-butterfly-stage ${arrived ? "is-hovering" : "is-arriving"}`}
      aria-hidden="true"
    >
      <div ref={wrapRef} className="hero-butterfly-wrap">
        <div className="bfly-swarm">
          <div className="bfly bfly--a">
            <div className="bfly-squish">
              <div className="bfly-orbit">
                <div className="bfly-oval">
                  <div className="bfly-counter">
                    <div className="bfly-wings" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bfly bfly--b">
            <div className="bfly-squish">
              <div className="bfly-orbit">
                <div className="bfly-oval">
                  <div className="bfly-counter">
                    <div className="bfly-wings" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bfly bfly--c">
            <div className="bfly-squish">
              <div className="bfly-orbit">
                <div className="bfly-oval">
                  <div className="bfly-counter">
                    <div className="bfly-wings" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  const { openModal } = useAuthModal();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placeholderRef = useRef<HTMLImageElement>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const advanceRequestRef = useRef(0);

  const requestAdvance = useCallback((dir: 1 | -1) => {
    advanceRequestRef.current += dir;
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      if (cancelled) return;

      const vertexShader = /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `;
      const fragmentShader = /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        // Auto-cycle pair (uFrom is the current displayed frame, uTo is the
        // next style being transitioned to).
        uniform sampler2D uFrom;
        uniform sampler2D uTo;
        // Hover pair — uBefore is ALWAYS the original "before" image, and
        // uCurrent is whichever "after" style is currently visible (last
        // transition target).  uHover cross-fades the two pairs so dragging
        // the mouse always reveals from the original yard to the current
        // styled version, regardless of where the auto-cycle is.
        // uCurrentPrev holds the PREVIOUS "after" so that when the auto-
        // cycle fires mid-hover, the right-half cross-fades from old to
        // new via uProgress instead of hard-swapping in one frame.
        uniform sampler2D uBefore;
        uniform sampler2D uCurrent;
        uniform sampler2D uCurrentPrev;
        uniform vec2 uRes;
        uniform vec2 uFromAspect;
        uniform vec2 uToAspect;
        uniform vec2 uMouse;
        uniform float uProgress;
        uniform float uHover;
        uniform float uHoverRadius;
        uniform float uTime;
        uniform int uType;
        // +1 sweeps the reveal boundary left-to-right (forward / next /
        // auto-cycle), -1 mirrors uv.x so the boundary sweeps right-to-
        // left (prev button).  Only the boundary math sees the flip —
        // uvFrom / uvTo are computed in main() from the un-flipped UV so
        // the actual texture content isn't mirrored.
        uniform float uDirection;
        // Per-preset configurable knobs.  Each preset reads its own
        // meaning from these slots (see PRESET_PARAMS in JS); presets
        // that don't need a slot simply ignore the corresponding uniform.
        uniform float uParam1;
        uniform float uParam2;
        uniform float uParam3;
        uniform float uParam4;

        float hash21(vec2 p){
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
          for(int i = 0; i < 5; i++){
            v += a * vnoise(p);
            p = rot * p * 2.0 + 0.7;
            a *= 0.5;
          }
          return v;
        }

        // Fit a texture to the viewport via "cover" — fill the view, crop
        // excess. Mirrors CSS "object-fit: cover" so the canvas renders the
        // placeholder image in the exact same position the static <img> uses.
        vec2 coverUV(vec2 uv, vec2 texAspect, vec2 viewAspect){
          float tr = texAspect.x / texAspect.y;
          float vr = viewAspect.x / viewAspect.y;
          vec2 scale = (tr > vr) ? vec2(vr / tr, 1.0) : vec2(1.0, tr / vr);
          return (uv - 0.5) * scale + 0.5;
        }

        // Cross-faded "from" sample — auto-cycle's uFrom blended with the
        // always-Before texture by uHover.  When hovering, only uBefore is
        // visible; when idle, only uFrom is visible.  Aligned PNGs share a
        // canvas size so a single UV is correct for both samplers.
        vec4 sampleFrom(vec2 uv){
          vec4 a = texture2D(uFrom, uv);
          vec4 b = texture2D(uBefore, uv);
          return mix(a, b, uHover);
        }
        vec4 sampleTo(vec2 uv){
          vec4 a = texture2D(uTo, uv);
          // Cross-fade the hover-target between the previous "after" and
          // the new one along with the auto-cycle's uProgress.  When no
          // transition is running, uCurrentPrev is synced to uCurrent so
          // the mix returns uCurrent regardless of uProgress.
          vec4 b = mix(texture2D(uCurrentPrev, uv), texture2D(uCurrent, uv), uProgress);
          return mix(a, b, uHover);
        }
        vec4 sampleFromCA(vec2 uv, vec2 dir, float amt){
          vec4 base = sampleFrom(uv);
          float r = sampleFrom(uv + dir * amt).r;
          float b = sampleFrom(uv - dir * amt).b;
          return vec4(r, base.g, b, base.a);
        }
        vec4 sampleToCA(vec2 uv, vec2 dir, float amt){
          vec4 base = sampleTo(uv);
          float r = sampleTo(uv + dir * amt).r;
          float b = sampleTo(uv - dir * amt).b;
          return vec4(r, base.g, b, base.a);
        }

        // Compute the global reveal time. uProgress drives auto-transitions
        // when idle; on hover, the cursor's X position takes over and scrubs
        // the active transition directly — so dragging the mouse left-to-right
        // sweeps through whichever effect is selected instead of producing a
        // local cursor-anchored reveal.
        float pixelT(vec2 uv){
          float autoT = uProgress;
          float cursorT = clamp(uMouse.x, 0.0, 1.0);
          return clamp(mix(autoT, cursorT, uHover), 0.0, 1.0);
        }

        // 1.0 mid-reveal (t = 0.5), 0.0 at the endpoints (t = 0 and t = 1).
        // Multiplied into every decorative tracer/glow/fringe/smoke/ink/
        // sparkle contribution so the boundary's bright bar doesn't bake
        // itself into the idle frame between auto-cycles (t = 0) or at
        // the end of a hover-scrub past the right edge (t = 1).
        float edgeActivity(float t){
          return clamp(4.0 * t * (1.0 - t), 0.0, 1.0);
        }

        vec4 effectColor(vec2 uv, vec2 uvFrom, vec2 uvTo, float t){
          // Mirror uv.x for backward transitions.  pos / fbm / sin
          // expressions downstream all reference this local uv, so the
          // boundary sweeps the other way without us touching every
          // shader branch individually.  uvFrom / uvTo were computed in
          // main() from the un-flipped UV, so texture sampling stays
          // un-mirrored — only the *boundary* moves the opposite way.
          uv.x = mix(1.0 - uv.x, uv.x, step(0.0, uDirection));
          vec4 col;
          if (uType == 0) {
            // ── SWEEP · SOFT ─────────────────────────────────────────
            // uParam1 = Edge Softness | uParam2 = Edge Wobble
            // uParam3 = Tracer Glow   | uParam4 = Chromatic
            float act = edgeActivity(t);
            float edgeNoise = (fbm(vec2(uv.y * 6.0 + uTime * 0.3, uv.x * 4.0)) - 0.5) * uParam2;
            float pos = uv.x + edgeNoise;
            float band = uParam1;
            float edge = exp(-pow((pos - t) * 14.0, 2.0)) * act;
            float warp = edge * 0.04;
            vec2 wFrom = uvFrom + vec2(warp, 0.0);
            vec2 wTo   = uvTo   + vec2(-warp * 0.5, 0.0);
            float ca = edge * uParam4;
            vec4 from = sampleFromCA(wFrom, vec2(1.0, 0.0), ca);
            vec4 to   = sampleToCA(wTo,   vec2(1.0, 0.0), ca * 0.7);
            float mask = smoothstep(pos - band, pos + band, t);
            col = mix(from, to, mask);
            float bar = exp(-pow((pos - t) * 22.0, 2.0)) * act;
            col.rgb += vec3(0.34, 0.55, 0.32) * bar * uParam3;
            col.rgb = mix(col.rgb, vec3(0.97, 0.99, 0.94), edge * 0.18);
          }
          else if (uType == 1) {
            // ── SWEEP · DIAGONAL ─────────────────────────────────────
            // uParam1 = Edge Softness | uParam2 = Slope Ratio
            // uParam3 = Tracer Glow   | uParam4 = Chromatic
            float act = edgeActivity(t);
            vec2 slope = vec2(uParam2, 1.0 - uParam2);
            float edgeNoise = (fbm(vec2(uv.x * 5.0 - uTime * 0.25, uv.y * 5.0)) - 0.5) * 0.035;
            float pos = (uv.x * slope.x + uv.y * slope.y) + edgeNoise;
            float band = uParam1;
            float edge = exp(-pow((pos - t) * 14.0, 2.0)) * act;
            vec2 dir = normalize(slope);
            float ca = edge * uParam4;
            vec4 from = sampleFromCA(uvFrom + dir * edge * 0.035, dir, ca);
            vec4 to   = sampleToCA(uvTo   - dir * edge * 0.020, dir, ca * 0.7);
            float mask = smoothstep(pos - band, pos + band, t);
            col = mix(from, to, mask);
            float bar = exp(-pow((pos - t) * 22.0, 2.0)) * act;
            col.rgb += vec3(0.40, 0.60, 0.35) * bar * uParam3;
            col.rgb = mix(col.rgb, vec3(0.97, 0.99, 0.94), edge * 0.18);
          }
          else if (uType == 2) {
            // ── SWEEP · CURTAIN ──────────────────────────────────────
            // uParam1 = Edge Softness | uParam2 = Edge Wobble
            // uParam3 = Tracer Glow   | uParam4 = Chromatic
            float act = edgeActivity(t);
            float fromCenter = abs(uv.x - 0.5) * 2.0;
            float edgeNoise = (fbm(vec2(uv.y * 7.0, uv.x * 4.0 + uTime * 0.2)) - 0.5) * uParam2;
            float pos = (1.0 - fromCenter) + edgeNoise;
            float band = uParam1;
            float edge = exp(-pow((pos - t) * 14.0, 2.0)) * act;
            vec2 dirL = vec2(-1.0, 0.0);
            vec2 dirR = vec2( 1.0, 0.0);
            vec2 dir  = (uv.x < 0.5) ? dirL : dirR;
            float ca = edge * uParam4;
            vec4 from = sampleFromCA(uvFrom + dir * edge * 0.03, dir, ca);
            vec4 to   = sampleToCA(uvTo   - dir * edge * 0.02, dir, ca * 0.7);
            float mask = smoothstep(pos - band, pos + band, t);
            col = mix(from, to, mask);
            float bar = exp(-pow((pos - t) * 22.0, 2.0)) * act;
            col.rgb += vec3(0.34, 0.55, 0.32) * bar * uParam3;
          }
          else if (uType == 3) {
            // ── SWEEP · WAVE ─────────────────────────────────────────
            // uParam1 = Wave Amplitude | uParam2 = Wave Frequency
            // uParam3 = Tracer Glow    | uParam4 = Chromatic
            float act = edgeActivity(t);
            float w1 = sin(uv.y * uParam2          + uTime * 0.6) * uParam1;
            float w2 = sin(uv.y * uParam2 * 2.16   - uTime * 0.4) * uParam1 * 0.42;
            float pos = uv.x + w1 + w2;
            float band = 0.06;
            float edge = exp(-pow((pos - t) * 16.0, 2.0)) * act;
            vec2 wFrom = uvFrom + vec2(edge * 0.045, 0.0);
            vec2 wTo   = uvTo   + vec2(-edge * 0.025, 0.0);
            float ca = edge * uParam4;
            vec4 from = sampleFromCA(wFrom, vec2(1.0, 0.0), ca);
            vec4 to   = sampleToCA(wTo,   vec2(1.0, 0.0), ca * 0.7);
            float mask = smoothstep(pos - band, pos + band, t);
            col = mix(from, to, mask);
            float bar = exp(-pow((pos - t) * 26.0, 2.0)) * act;
            col.rgb += vec3(0.38, 0.62, 0.40) * bar * uParam3;
          }
          else if (uType == 4) {
            // ── SWEEP · SHUTTER ──────────────────────────────────────
            // uParam1 = Bar Count | uParam2 = Jitter
            // uParam3 = Lead Glow | uParam4 = Chromatic
            float act = edgeActivity(t);
            float numBars = max(2.0, uParam1);
            float barIdx = floor(uv.x * numBars);
            float seed = hash21(vec2(barIdx, 7.0));
            float jitter = (seed - 0.5) * uParam2;
            float threshold = (barIdx / (numBars - 1.0)) * 0.85 + jitter;
            float localT = smoothstep(threshold, threshold + 0.12, t);
            float slide = (1.0 - localT) * 0.012 * (seed - 0.5) * act;
            float ca = (1.0 - localT) * localT * uParam4;
            vec4 from = sampleFromCA(uvFrom + vec2(slide, 0.0), vec2(1.0, 0.0), ca);
            vec4 to   = sampleToCA(uvTo   + vec2(slide, 0.0), vec2(1.0, 0.0), ca * 0.6);
            col = mix(from, to, localT);
            float lead = exp(-pow((t - threshold) * 26.0, 2.0)) * act;
            col.rgb += vec3(0.30, 0.50, 0.30) * lead * uParam3;
          }
          else if (uType == 5) {
            // ── SWEEP · PIXEL COLUMNS ────────────────────────────────
            // uParam1 = Column Count | uParam2 = Jitter | uParam3 = Chromatic
            float act = edgeActivity(t);
            float numCols = max(4.0, uParam1);
            float colIdx = floor(uv.x * numCols);
            float seed = hash21(vec2(colIdx, 3.0));
            float colThreshold = colIdx / (numCols - 1.0);
            float threshold = colThreshold * 0.78 + (seed - 0.5) * uParam2;
            float localT = smoothstep(threshold, threshold + 0.05, t);
            float vJitter = (1.0 - localT) * localT * (seed - 0.5) * 0.020 * act;
            float ca = (1.0 - localT) * localT * uParam3 * act;
            vec4 from = sampleFromCA(uvFrom + vec2(0.0, vJitter), vec2(1.0, 0.0), ca);
            vec4 to   = sampleToCA(uvTo   + vec2(0.0, vJitter), vec2(1.0, 0.0), ca);
            col = mix(from, to, localT);
          }
          else if (uType == 6) {
            // ── SMOKE BLOOM ───────────────────────────────────────────
            // uParam1 = Edge Warp | uParam2 = Bloom | uParam3 = Edge Softness
            float act = edgeActivity(t);
            float warp = (fbm(vec2(uv.y * 3.5 + uTime * 0.10, uv.x * 2.5)) - 0.5) * uParam1;
            float pos = uv.x + warp;
            float band = uParam3;
            float mask = smoothstep(pos - band, pos + band, t);
            float edgeDist = abs(pos - t);
            float edge = exp(-pow(edgeDist * 7.0, 2.0)) * act;
            float puff = fbm(uv * 5.0 + uTime * 0.18) * edge;
            vec2 dir = vec2(cos(puff * 6.2831 + uTime * 0.3),
                            sin(puff * 6.2831 - uTime * 0.2));
            float amp = edge * 0.05;
            vec4 from = sampleFrom(uvFrom + dir * amp);
            vec4 to   = sampleTo(uvTo   - dir * amp * 0.6);
            col = mix(from, to, mask);
            col.rgb = mix(col.rgb, vec3(0.97, 0.96, 0.93), puff * uParam2);
            col.rgb += vec3(0.06, 0.08, 0.06) * edge * 0.30;
          }
          else if (uType == 7) {
            // ── GLITCH SLICE ──────────────────────────────────────────
            // uParam1 = Slice Height | uParam2 = Shift
            // uParam3 = Beat Rate    | uParam4 = Chromatic
            float act = edgeActivity(t);
            float warpY = (fbm(vec2(uv.y * 30.0, uTime * 5.0)) - 0.5) * 0.025;
            float pos = uv.x + warpY;
            float band = 0.025;
            float mask = smoothstep(pos - band, pos + band, t);
            float edgeDist = abs(pos - t);
            float window = exp(-pow(edgeDist * 7.0, 2.0)) * act;
            float bandH = max(0.004, uParam1);
            float bandIdx = floor(uv.y / bandH);
            float beat = floor(uTime * uParam3);
            float seedA = hash21(vec2(bandIdx, beat));
            float seedB = hash21(vec2(bandIdx + 17.0, beat));
            float fire = step(0.55, seedA) * window;
            float shift = (seedB - 0.5) * uParam2 * fire;
            float ca = (uParam4 * act + uParam4 * 2.0 * window) * (fire + 0.4);
            vec2 fOff = vec2(shift, 0.0);
            vec4 from = sampleFromCA(uvFrom + fOff, vec2(1.0, 0.0), ca);
            vec4 to   = sampleToCA(uvTo   + fOff, vec2(1.0, 0.0), ca);
            col = mix(from, to, mask);
            col.rgb *= 1.0 - 0.10 * fire;
          }
          else if (uType == 8) {
            // ── LIQUID WARP ───────────────────────────────────────────
            // uParam1 = Warp Intensity | uParam2 = Edge Softness
            // uParam3 = Rim Glow       | uParam4 = Chromatic
            float act = edgeActivity(t);
            float waveB = sin(uv.y * 9.0 + uTime * 0.5) * 0.012;
            float pos = uv.x + waveB;
            float band = uParam2;
            float mask = smoothstep(pos - band, pos + band, t);
            float edgeDist = abs(pos - t);
            float edge = exp(-pow(edgeDist * 6.5, 2.0)) * act;
            vec2 q = uv * 3.4;
            float e = 0.06;
            float gx = fbm(q + vec2(e, 0.0)) - fbm(q - vec2(e, 0.0));
            float gy = fbm(q + vec2(0.0, e)) - fbm(q - vec2(0.0, e));
            vec2 grad = normalize(vec2(gx, gy) + 1e-5);
            float amp = edge * uParam1;
            vec2 wFrom = uvFrom + grad * amp;
            vec2 wTo   = uvTo   - grad * amp;
            float ca = edge * uParam4;
            vec4 from = sampleFromCA(wFrom, grad, ca);
            vec4 to   = sampleToCA(wTo,  -grad, ca * 0.8);
            col = mix(from, to, mask);
            float rim = exp(-pow(edgeDist * 22.0, 2.0)) * act;
            col.rgb += vec3(0.18, 0.24, 0.20) * rim * uParam3;
          }
          else if (uType == 9) {
            // ── IRIS REFRACT ──────────────────────────────────────────
            // uParam1 = Refraction | uParam2 = Chromatic | uParam3 = Edge Glow
            float act = edgeActivity(t);
            float wob = sin(uv.y * 14.0 + uTime * 0.4) * 0.005;
            float pos = uv.x + wob;
            float band = 0.020;
            float mask = smoothstep(pos - band, pos + band, t);
            float edgeDist = abs(pos - t);
            float ring = exp(-pow(edgeDist * 18.0, 2.0)) * act;
            vec2 dir = vec2(1.0, 0.0);
            float ref = ring * uParam1;
            vec2 wFrom = uvFrom + dir * ref * 0.7;
            vec2 wTo   = uvTo   - dir * ref * 0.55;
            float ca = ring * uParam2;
            vec4 from = sampleFromCA(wFrom, dir, ca);
            vec4 to   = sampleToCA(wTo,  -dir, ca * 0.8);
            col = mix(from, to, mask);
            float crisp = exp(-pow(edgeDist * 30.0, 2.0)) * act;
            col.rgb += vec3(0.62, 0.85, 0.72) * crisp * uParam3;
          }
          else if (uType == 10) {
            // ── PARTICLE DISSOLVE ─────────────────────────────────────
            // uParam1 = Dissolve Band     | uParam2 = Particle Density
            // uParam3 = Dust Drift        | uParam4 = Chromatic
            float act = edgeActivity(t);
            float band = uParam1;
            float density = max(20.0, uParam2);
            vec2 cellId = floor(uv * vec2(density, density * 0.65));
            float seed = hash21(cellId);
            float seed2 = hash21(cellId + vec2(13.0, 7.0));
            float threshold = uv.x + (seed - 0.5) * band;
            float reveal = step(threshold, t);
            float edgeDist = abs(uv.x - t);
            float window = exp(-pow(edgeDist * 6.5, 2.0)) * act;
            float dust = (1.0 - reveal) * window;
            vec2 drift = vec2(
              (seed2 - 0.5) * 0.020 * dust,
              dust * uParam3
            );
            float ca = dust * uParam4;
            vec4 from = sampleFromCA(uvFrom + drift, vec2(1.0, 0.3), ca);
            vec4 to   = sampleTo(uvTo);
            col = mix(from, to, reveal);
            float sparkle = pow(seed, 5.0) * window;
            col.rgb += vec3(0.94, 0.91, 0.78) * sparkle * 0.55;
            col.rgb *= 1.0 - sparkle * 0.12;
          }
          else if (uType == 11) {
            // ── INK SPATTER ───────────────────────────────────────────
            // uParam1 = Spatter Chaos | uParam2 = Tendril Detail | uParam3 = Ink Darkness
            float act = edgeActivity(t);
            float bigWarp   = (fbm(vec2(uv.y * 3.5, uv.x * 2.0 + uTime * 0.05)) - 0.5) * uParam1;
            float medWarp   = (fbm(vec2(uv.y * 9.0 + uTime * 0.07, uv.x * 4.5)) - 0.5) * uParam2;
            float smallWarp = (fbm(vec2(uv.y * 22.0, uv.x * 12.0 - uTime * 0.1)) - 0.5) * uParam2 * 0.4;
            float pos = uv.x + bigWarp + medWarp + smallWarp;
            float band = 0.022;
            float mask = smoothstep(pos - band, pos + band, t);
            vec4 from = sampleFrom(uvFrom);
            vec4 to   = sampleTo(uvTo);
            col = mix(from, to, mask);
            float edge = exp(-pow((pos - t) * 28.0, 2.0)) * act;
            col.rgb *= 1.0 - edge * uParam3;
            col.rgb = mix(col.rgb, vec3(0.04, 0.04, 0.04), edge * uParam3 * 0.5);
          }
          else if (uType == 12) {
            // ── VINE GROWTH ───────────────────────────────────────────
            // uParam1 = Vine Density | uParam2 = Tendril Reach | uParam3 = Tip Glow
            float act = edgeActivity(t);
            float waveB = sin(uv.y * 12.0 + uTime * 0.4) * 0.010;
            float pos = uv.x + waveB;
            float band = 0.020;
            float mask = smoothstep(pos - band, pos + band, t);
            vec2 vUV = uv * vec2(uParam1, uParam1 * 1.45);
            float ridge1 = abs(fbm(vUV) - 0.5);
            float ridge2 = abs(fbm(vUV * 1.4 + vec2(2.3, -1.7)) - 0.5);
            float vines = 1.0 - smoothstep(0.0, 0.07, min(ridge1, ridge2));
            float reach = uParam2;
            float fwd = uv.x - pos;
            float forwardBand = step(0.0, fwd) * (1.0 - smoothstep(0.0, reach, fwd)) * act;
            float tendrils = vines * forwardBand;
            float coverage = max(mask, tendrils);
            vec4 from = sampleFrom(uvFrom);
            vec4 to   = sampleTo(uvTo);
            col = mix(from, to, coverage);
            float tip = tendrils * (1.0 - mask);
            col.rgb += vec3(0.20, 0.58, 0.22) * tip * uParam3;
            col.rgb = mix(col.rgb, col.rgb * 0.78, vines * mask * 0.20);
          }
          else if (uType == 13) {
            // ── PETAL BLOOM ───────────────────────────────────────────
            // uParam1 = Petal Frequency | uParam2 = Petal Depth
            // uParam3 = Petal Glow      | uParam4 = Chromatic
            float act = edgeActivity(t);
            float scallop  = sin(uv.y * uParam1          + uTime * 0.5) * uParam2;
            float scallop2 = sin(uv.y * uParam1 * 0.50   - uTime * 0.3) * uParam2 * 0.45;
            float wob = (fbm(vec2(uv.y * 5.0, uTime * 0.25)) - 0.5) * 0.018;
            float pos = uv.x + scallop + scallop2 + wob;
            float band = 0.025;
            float mask = smoothstep(pos - band, pos + band, t);
            float edge = exp(-pow((pos - t) * 18.0, 2.0)) * act;
            vec2 dir = vec2(1.0, 0.0);
            float ca = edge * uParam4;
            vec4 from = sampleFromCA(uvFrom + dir * edge * 0.030, dir, ca);
            vec4 to   = sampleToCA(uvTo   - dir * edge * 0.018, dir, ca * 0.7);
            col = mix(from, to, mask);
            col.rgb += vec3(0.94, 0.58, 0.55) * edge * uParam3;
            col.rgb = mix(col.rgb, vec3(0.98, 0.92, 0.88), edge * uParam3 * 0.36);
          }
          else {
            // ── POLLEN DRIFT ──────────────────────────────────────────
            // uParam1 = Pollen Density | uParam2 = Sparkle | uParam3 = Cloud Behind
            float act = edgeActivity(t);
            float wob = sin(uv.y * 7.0 + uTime * 0.5) * 0.012;
            float pos = uv.x + wob;
            float band = 0.040;
            float mask = smoothstep(pos - band, pos + band, t);
            vec2 grainUV = uv * vec2(uParam1, uParam1 * 0.75);
            float grain = hash21(floor(grainUV) + floor(uTime * 3.0));
            float density = pow(fbm(uv * 5.0 + vec2(uTime * 0.12, 0.0)), 1.3);
            float sparkle = pow(grain, 22.0) * density * 5.0;
            float fwd = uv.x - pos;
            float ahead = step(0.0, fwd) * exp(-fwd * 14.0) * act;
            float behind = step(0.0, -fwd) * exp(fwd * 14.0) * act;
            float pollen = sparkle * ahead;
            float cloud  = density * behind;
            vec4 from = sampleFrom(uvFrom);
            vec4 to   = sampleTo(uvTo);
            col = mix(from, to, mask);
            col.rgb += vec3(0.93, 0.85, 0.42) * pollen * uParam2;
            col.rgb += vec3(0.95, 0.92, 0.62) * cloud * uParam3;
          }
          return col;
        }

        void main(){
          vec2 uv = vUv;
          vec2 viewAspect = uRes;
          vec2 uvFrom = coverUV(uv, uFromAspect, viewAspect);
          vec2 uvTo   = coverUV(uv, uToAspect,   viewAspect);

          float t = pixelT(uv);
          vec4 col = effectColor(uv, uvFrom, uvTo, t);

          // Output straight alpha — the canvas is alpha-transparent so the
          // section background (or the gallery section below it, where the
          // canvas overlaps) shows through the PNG's transparent padding.
          gl_FragColor = col;
        }
      `;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        premultipliedAlpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const loader = new THREE.TextureLoader();
      const texCache = new Map<string, import("three").Texture>();
      const aspectCache = new Map<string, [number, number]>();
      const loading = new Map<string, Promise<import("three").Texture>>();

      function loadTex(src: string): Promise<import("three").Texture> {
        const cached = texCache.get(src);
        if (cached) return Promise.resolve(cached);
        const inflight = loading.get(src);
        if (inflight) return inflight;
        const p = new Promise<import("three").Texture>((resolve, reject) => {
          loader.load(
            src,
            (t) => {
              t.minFilter = THREE.LinearFilter;
              t.magFilter = THREE.LinearFilter;
              t.wrapS = THREE.ClampToEdgeWrapping;
              t.wrapT = THREE.ClampToEdgeWrapping;
              const img = t.image as HTMLImageElement | undefined;
              aspectCache.set(src, [img?.width || 16, img?.height || 9]);
              texCache.set(src, t);
              resolve(t);
            },
            undefined,
            reject
          );
        });
        loading.set(src, p);
        return p;
      }

      const initFrom = 0;
      const initTo = FRAMES.length > 1 ? 1 : 0;
      const [texFrom, texTo] = await Promise.all([
        loadTex(FRAMES[initFrom].src),
        loadTex(FRAMES[initTo].src),
      ]);
      if (cancelled) return;
      FRAMES.slice(2).forEach((f) => loadTex(f.src));

      const fromAsp = aspectCache.get(FRAMES[initFrom].src) ?? [16, 9];
      const toAsp = aspectCache.get(FRAMES[initTo].src) ?? [16, 9];

      const uniforms = {
        uFrom: { value: texFrom },
        uTo: { value: texTo },
        // Hover-reveal pair — uBefore stays pinned to FRAMES[0] for the
        // lifetime of the component; uCurrent tracks whichever "after"
        // style is most recently visible, so hover scrubs Before -> latest.
        // uCurrentPrev mirrors uCurrent at rest; when a cycle fires it
        // captures the previous "after" so the shader can cross-fade it
        // out under the hover view while the new "after" cross-fades in.
        uBefore: { value: texFrom },
        uCurrent: { value: texTo },
        uCurrentPrev: { value: texTo },
        uRes: { value: new THREE.Vector2(1, 1) },
        uFromAspect: { value: new THREE.Vector2(fromAsp[0], fromAsp[1]) },
        uToAspect: { value: new THREE.Vector2(toAsp[0], toAsp[1]) },
        // uMouse.x defaults to 1.0 so when the cursor first enters the
        // stage and uHover ramps from 0->1, t = cursor.x = 1 keeps the
        // render pinned to the "after" image instead of flashing to a
        // half-transition state during the ramp.
        uMouse: { value: new THREE.Vector2(1.0, 0.5) },
        uProgress: { value: 0.0 },
        uHover: { value: 0.0 },
        uHoverRadius: { value: 0.34 },
        uTime: { value: 0.0 },
        uType: { value: SHADER_TYPE },
        uDirection: { value: 1.0 },
        uParam1: { value: SHADER_PARAMS[0] },
        uParam2: { value: SHADER_PARAMS[1] },
        uParam3: { value: SHADER_PARAMS[2] },
        uParam4: { value: SHADER_PARAMS[3] },
      };

      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry(2, 2);
      scene.add(new THREE.Mesh(geo, mat));

      function resize() {
        const rect = stage!.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        uniforms.uRes.value.set(rect.width, rect.height);
      }
      resize();
      window.addEventListener("resize", resize);

      // Start at x=1.0 to match uMouse initial value (see uniforms comment).
      const target = { x: 1.0, y: 0.5, hover: 0.0 };
      const current = { x: 1.0, y: 0.5, hover: 0.0 };

      const isFinePointer = () =>
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(pointer: fine)").matches;

      const readCursor = (e: PointerEvent) => {
        const rect = stage!.getBoundingClientRect();
        target.x = (e.clientX - rect.left) / rect.width;
        target.y = 1.0 - (e.clientY - rect.top) / rect.height;
      };
      const onMove = (e: PointerEvent) => readCursor(e);
      const onEnter = (e: PointerEvent) => {
        if (!isFinePointer()) return;
        // Sync target.x to the actual entry coordinate immediately, then
        // snap current.x to it as well so the very first frame of hover
        // already shows the correct cursor-driven t (instead of lerping
        // from the old idle value through stale positions on the way to
        // the user's cursor).
        readCursor(e);
        current.x = target.x;
        current.y = target.y;
        target.hover = 1.0;
      };
      const onLeave = () => {
        target.hover = 0.0;
      };
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerenter", onEnter);
      stage.addEventListener("pointerleave", onLeave);

      // Placeholder is invisible by default (CSS opacity: 0) — kept in
      // the DOM only to prefetch the Before WebP.  The canvas itself
      // starts at opacity 0 via CSS and fades in once we add .is-ready
      // after the first WebGL frame has rendered.

      let phase: "idle" | "transitioning" = "idle";
      let lastTransitionEnd =
        performance.now() - INTERVAL_MS + INITIAL_DELAY_MS;
      let transitionStart = 0;
      let curIdx = initFrom;
      let nextIdx = initTo;
      let lastAdvanceCount = 0;

      function applyAspect(toI: number) {
        const ta = aspectCache.get(FRAMES[toI].src);
        if (ta) uniforms.uToAspect.value.set(ta[0], ta[1]);
      }

      function beginTransition(toI: number, dir: 1 | -1 = 1) {
        const src = FRAMES[toI].src;
        const start = () => {
          nextIdx = toI;
          const tex = texCache.get(src);
          if (tex) {
            uniforms.uTo.value = tex;
            // Any time we transition to an after-frame, that frame becomes
            // the "current after" that hover should reveal toward.  Keep
            // uCurrent pinned to Before only while still showing Before
            // (toI == 0) so hover stays a no-op until a style has been
            // seen.  Capture the prior uCurrent into uCurrentPrev so the
            // shader can cross-fade it out under the hover view as
            // uProgress sweeps 0 -> 1.
            if (toI > 0) {
              uniforms.uCurrentPrev.value = uniforms.uCurrent.value;
              uniforms.uCurrent.value = tex;
            }
          }
          applyAspect(toI);
          uniforms.uProgress.value = 0;
          uniforms.uDirection.value = dir;
          transitionStart = performance.now();
          phase = "transitioning";
          setCurrentIdx(toI);
        };
        if (texCache.has(src)) start();
        else loadTex(src).then(() => !cancelled && start());
      }

      function nextAutoIdx(cur: number): number {
        if (FRAMES.length <= 1) return cur;
        const n = cur + 1;
        // Wrap, but skip "Before" (idx 0) on auto-cycle once we've left it.
        if (n >= FRAMES.length) return FRAMES.length > 2 ? 1 : cur;
        return n;
      }

      const start = performance.now();
      let raf = 0;
      function frame(now: number) {
        const t = (now - start) / 1000;
        uniforms.uTime.value = t;

        current.x += (target.x - current.x) * 0.12;
        current.y += (target.y - current.y) * 0.12;
        current.hover += (target.hover - current.hover) * 0.1;
        uniforms.uMouse.value.set(current.x, current.y);
        uniforms.uHover.value = current.hover;

        // Manual advance from prev/next buttons — direction follows the
        // sign of the accumulated delta so the shader's boundary sweeps
        // left-to-right on next and right-to-left on prev.
        if (advanceRequestRef.current !== lastAdvanceCount) {
          const delta = advanceRequestRef.current - lastAdvanceCount;
          lastAdvanceCount = advanceRequestRef.current;
          if (phase === "transitioning") curIdx = nextIdx;
          const tgt =
            ((curIdx + delta) % FRAMES.length + FRAMES.length) %
            FRAMES.length;
          if (tgt !== curIdx) {
            phase = "idle";
            const dir: 1 | -1 = delta < 0 ? -1 : 1;
            beginTransition(tgt, dir);
          }
        }

        if (phase === "idle") {
          // Auto-cycle continues even while hovering — the shader keeps
          // the user's cursor-driven reveal stable on the left half while
          // the right-hand "current after" texture cross-fades to the
          // next style via uCurrentPrev → uCurrent driven by uProgress.
          if (now - lastTransitionEnd >= INTERVAL_MS) {
            const ni = nextAutoIdx(curIdx);
            if (ni !== curIdx) beginTransition(ni);
            else lastTransitionEnd = now;
          }
        } else {
          const elapsed = now - transitionStart;
          const dur = Math.max(120, TRANSITION_MS);
          const tt = Math.min(1, elapsed / dur);
          // easeInOutQuad
          const eased =
            tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
          uniforms.uProgress.value = eased;
          if (tt >= 1) {
            curIdx = nextIdx;
            uniforms.uFrom.value = uniforms.uTo.value;
            uniforms.uFromAspect.value.copy(uniforms.uToAspect.value);
            // Sync prev → current so mix(prev, current, uProgress=0) keeps
            // returning uCurrent at rest (otherwise the hover-side image
            // would snap back to the previous "after" the moment uProgress
            // resets at the end of the transition).
            uniforms.uCurrentPrev.value = uniforms.uCurrent.value;
            uniforms.uProgress.value = 0;
            phase = "idle";
            lastTransitionEnd = now;
          }
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      // Add .is-ready on the next paint so the CSS opacity transition
      // has a discrete 0 → 1 step to animate against.  Setting opacity
      // inline in the same task as the initial 0 would batch into a
      // single frame and skip the transition entirely.
      requestAnimationFrame(() => {
        if (!cancelled) canvas.classList.add("is-ready");
      });

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        stage.removeEventListener("pointermove", onMove);
        stage.removeEventListener("pointerenter", onEnter);
        stage.removeEventListener("pointerleave", onLeave);
        geo.dispose();
        mat.dispose();
        texCache.forEach((t) => t.dispose());
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, []);

  const currentFrame = FRAMES[currentIdx] ?? FRAMES[0];

  return (
    <section className="hero-3d" id="product">
      <HeroButterfly />
      <div className="hero-3d-inner">
        <HeroClouds />
        <div className="hero-3d-copy">
          <span className="eyebrow">
            <span className="dot" />
            <strong>New</strong>&nbsp;AI landscape designs in seconds
          </span>
          <h1>
            <span className="hero-3d-emph">Redesign your yard</span> before
            <br />
            you plant a thing
          </h1>
          <div className="hero-3d-row">
            <p className="hero-3d-sub">
              Upload a photo of your house, pick a style, get a professional
              landscaping design in seconds. Your house stays exactly the way
              it is.
            </p>
            <button
              type="button"
              onClick={() => openModal("signup")}
              className="btn btn-primary btn-lg hero-3d-cta"
            >
              <span>Try it out</span>
              <span className="hero-3d-cta-meta" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    d="M12 2l2.95 6.6 7.05.65-5.35 4.85L18.1 22 12 17.8 5.9 22l1.45-7.9L2 9.25l7.05-.65L12 2z"
                    fill="currentColor"
                  />
                </svg>
                3 Free Credits
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="hero-3d-stage-wrap">
          <div className="hero-3d-stage" ref={stageRef}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={placeholderRef}
              src={FRAMES[0].src}
              alt=""
              className="hero-3d-placeholder"
              aria-hidden="true"
            />
            <canvas ref={canvasRef} />

            {FRAMES.length > 1 && (
              <>
                <button
                  type="button"
                  className="hero-3d-nav hero-3d-nav-prev"
                  onClick={() => requestAdvance(-1)}
                  aria-label="Previous style"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 6 9 12 15 18" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="hero-3d-nav hero-3d-nav-next"
                  onClick={() => requestAdvance(1)}
                  aria-label="Next style"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              </>
            )}

            <div className="hero-3d-label" key={currentIdx}>
              <span className="ls-label">Style</span>
              <span className="hero-3d-label-text">{currentFrame.label}</span>
            </div>
          </div>

        </div>
    </section>
  );
}
