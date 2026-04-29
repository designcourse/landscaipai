"use client";

import { useEffect, useRef } from "react";

/**
 * Mouse-driven before/after reveal using a Three.js fragment shader.
 * The CSS hides this section entirely on screens <= 900px (mobile), so the
 * GPU work never runs there.
 */
export function LandingShaderReveal() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    // Skip on small screens (defensive — CSS already hides the section)
    if (typeof window !== "undefined" && window.innerWidth <= 900) return;

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
        uniform sampler2D uBefore;
        uniform sampler2D uAfter;
        uniform vec2  uRes;
        uniform vec2  uBeforeAspect;
        uniform vec2  uAfterAspect;
        uniform vec2  uMouse;
        uniform float uRadius;
        uniform float uTime;
        uniform float uHovered;

        float hash21(vec2 p){
          p = fract(p*vec2(123.34, 456.21));
          p += dot(p, p+45.32);
          return fract(p.x*p.y);
        }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0,0.0));
          float c = hash21(i + vec2(0.0,1.0));
          float d = hash21(i + vec2(1.0,1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8,-0.6,0.6,0.8);
          for(int i=0;i<5;i++){
            v += a * vnoise(p);
            p = rot * p * 2.0 + 0.7;
            a *= 0.5;
          }
          return v;
        }
        vec2 coverUV(vec2 uv, vec2 texAspect, vec2 viewAspect){
          float tr = texAspect.x / texAspect.y;
          float vr = viewAspect.x / viewAspect.y;
          vec2 scale = (tr > vr) ? vec2(vr/tr, 1.0) : vec2(1.0, tr/vr);
          return (uv - 0.5) * scale + 0.5;
        }
        void main(){
          vec2 uv = vUv;
          vec2 viewAspect = uRes;
          vec2 uvBefore = coverUV(uv, uBeforeAspect, viewAspect);
          vec2 uvAfter  = coverUV(uv, uAfterAspect,  viewAspect);
          vec4 before = texture2D(uBefore, uvBefore);
          vec4 after  = texture2D(uAfter,  uvAfter);

          float asp = uRes.x / uRes.y;
          vec2 p = (uv - uMouse) * vec2(asp, 1.0);
          float dist = length(p);

          vec2 nUv = uv * vec2(asp,1.0) * 2.2;
          float n  = fbm(nUv * 1.3 + uTime * 0.18);
          float n2 = fbm(nUv * 2.6 - uTime * 0.33);
          float n3 = fbm(nUv * 5.0 + uTime * 0.55);
          float warp = (n - 0.5) * 0.12 + (n2 - 0.5) * 0.07 + (n3 - 0.5) * 0.035;
          float ripple = sin(dist * 18.0 - uTime * 2.0) * 0.006;
          float effDist = dist + warp + ripple;

          float band = 0.020;
          float reveal = 1.0 - smoothstep(uRadius - band, uRadius + band, effDist);
          vec4 col = mix(before, after, reveal);

          float band2 = smoothstep(0.0, 0.05, abs(effDist - uRadius));
          float fringe = (1.0 - band2) * 0.5 * uHovered;
          if (fringe > 0.001){
            vec2 dir = normalize(p + 1e-5);
            float shift = 0.004 * fringe;
            vec4 bR = texture2D(uBefore, uvBefore - dir*shift);
            vec4 aR = texture2D(uAfter,  uvAfter  + dir*shift*0.7);
            vec4 bB = texture2D(uBefore, uvBefore + dir*shift);
            vec4 aB = texture2D(uAfter,  uvAfter  - dir*shift*0.7);
            col.r = mix(bR.r, aR.r, reveal);
            col.b = mix(bB.b, aB.b, reveal);
          }

          float ringCore   = exp(-pow((effDist - uRadius) * 80.0, 2.0));
          float ringGlow   = exp(-pow((effDist - uRadius) * 22.0, 2.0)) * 0.30;
          float ringTurb   = fbm(nUv * 4.0 + uTime * 0.45);
          float ringMod    = 0.55 + ringTurb * 0.95;
          float ring = (ringCore + ringGlow) * ringMod * uHovered;
          vec3 rim = vec3(0.976, 0.949, 0.906);
          col.rgb = 1.0 - (1.0 - col.rgb) * (1.0 - rim * ring * 0.85);

          float grain = (hash21(gl_FragCoord.xy + uTime*60.0) - 0.5) * 0.018;
          col.rgb += grain;
          gl_FragColor = col;
        }
      `;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      const loader = new THREE.TextureLoader();
      const texBefore = loader.load("/landing/yard-before.jpg", (tex) =>
        onTex(tex, "before")
      );
      const texAfter = loader.load("/landing/yard-modern.webp", (tex) =>
        onTex(tex, "after")
      );
      [texBefore, texAfter].forEach((t) => {
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.wrapS = THREE.ClampToEdgeWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
      });

      const uniforms = {
        uBefore: { value: texBefore },
        uAfter: { value: texAfter },
        uRes: { value: new THREE.Vector2(1, 1) },
        uBeforeAspect: { value: new THREE.Vector2(16, 9) },
        uAfterAspect: { value: new THREE.Vector2(16, 9) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uRadius: { value: 0.0 },
        uTime: { value: 0.0 },
        uHovered: { value: 0.0 },
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

      function onTex(
        tex: import("three").Texture,
        which: "before" | "after"
      ) {
        const img = tex.image as HTMLImageElement | undefined;
        if (!img) return;
        const v = new THREE.Vector2(img.width || 16, img.height || 9);
        if (which === "before") uniforms.uBeforeAspect.value = v;
        else uniforms.uAfterAspect.value = v;
      }

      function resize() {
        const rect = stage!.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        uniforms.uRes.value.set(rect.width, rect.height);
      }
      resize();
      window.addEventListener("resize", resize);

      const target = { x: 0.5, y: 0.5, r: 0.0, hover: 0.0 };
      const current = { x: 0.5, y: 0.5, r: 0.0, hover: 0.0 };

      const onMove = (e: PointerEvent) => {
        const rect = stage!.getBoundingClientRect();
        target.x = (e.clientX - rect.left) / rect.width;
        target.y = 1.0 - (e.clientY - rect.top) / rect.height;
        target.r = 0.34;
        target.hover = 1.0;
        stage!.classList.add("has-moved");
      };
      const onEnter = () => {
        target.r = 0.34;
        target.hover = 1.0;
      };
      const onLeave = () => {
        target.r = 0.0;
        target.hover = 0.0;
      };
      stage!.addEventListener("pointermove", onMove);
      stage!.addEventListener("pointerenter", onEnter);
      stage!.addEventListener("pointerleave", onLeave);

      const start = performance.now();
      let raf = 0;
      function frame(now: number) {
        const t = (now - start) / 1000;
        const idlePulse =
          (1.0 - current.hover) * (0.02 + 0.015 * Math.sin(t * 0.9));
        const tr = target.r + idlePulse;
        current.x += (target.x - current.x) * 0.055;
        current.y += (target.y - current.y) * 0.055;
        current.r += (tr - current.r) * 0.09;
        current.hover += (target.hover - current.hover) * 0.09;
        uniforms.uMouse.value.set(current.x, current.y);
        uniforms.uRadius.value = current.r;
        uniforms.uHovered.value = current.hover;
        uniforms.uTime.value = t;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        stage!.removeEventListener("pointermove", onMove);
        stage!.removeEventListener("pointerenter", onEnter);
        stage!.removeEventListener("pointerleave", onLeave);
        geo.dispose();
        mat.dispose();
        texBefore.dispose();
        texAfter.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <section className="shader-reveal" id="shader-reveal">
      <div className="sr-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          Live demo
        </span>
        <h2 className="sec-title">
          Move your mouse. Watch the <em>yard transform</em>.
        </h2>
        <p className="sec-sub">
          A real render pair from our library. The &ldquo;after&rdquo; lives
          underneath — your cursor&apos;s growing field of vegetation peels
          back the before.
        </p>
      </div>
      <div className="sr-stage reveal" ref={stageRef}>
        <canvas ref={canvasRef} />
        <div className="sr-labels">
          <span className="sr-chip">
            <span className="d" />
            Before
          </span>
          <span className="sr-chip after">
            <span className="d" />
            After · Modern
          </span>
        </div>
        <div className="sr-hint">Move your cursor</div>
      </div>
    </section>
  );
}
