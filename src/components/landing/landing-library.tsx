"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const ORBS = [
  { src: "/landing/lib/plant-01.png", label: "Cosmos" },
  { src: "/landing/lib/plant-02.png", label: "Salvia" },
  { src: "/landing/lib/plant-03.png", label: "Black-eyed Susan" },
  { src: "/landing/lib/plant-04.png", label: "Swiss Chard" },
  { src: "/landing/lib/plant-05.png", label: "Pillow Moss" },
  { src: "/landing/lib/plant-06.png", label: "Agave" },
  { src: "/landing/lib/plant-07.png", label: "Hedgehog Cactus" },
  { src: "/landing/lib/plant-08.png", label: "Avocado Tree" },
  { src: "/landing/lib/plant-09.png", label: "Eastern Hemlock" },
  { src: "/landing/lib/plant-10.png", label: "River Pebbles" },
  { src: "/landing/lib/plant-11.png", label: "Path Spotlight" },
];

export function LandingLibrary() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("visible");
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const angleStep = 360 / ORBS.length;

  return (
    <section className="lib" id="library" ref={ref}>
      <div className="lib-head">
        <span className="lib-eyebrow">
          <span className="dot" />
          Catalog
        </span>
        <h2 className="lib-title">
          <em>500+</em> plants, materials &amp; fixtures — referenced into
          your design.
        </h2>
        <p className="lib-sub">
          Filtered to your USDA hardiness zone. Browse by category, select
          specific species, and they become part of the prompt.
        </p>
      </div>

      <div className="lib-stage" aria-label="Plant library with orbiting specimens">
        <div className="lib-ui">
          <Image
            src="/landing/lib/library-ui.png"
            alt="Plant & Material Library"
            width={1000}
            height={625}
            sizes="(max-width: 900px) 84vw, 860px"
          />
        </div>
        <div className="orbit" aria-hidden="true">
          <div className="orbit-inner">
            {ORBS.map((orb, i) => (
              <span
                key={orb.src}
                className="orb"
                style={{
                  // CSS custom properties for orbit position + delay
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--a" as any]: `${(i * angleStep).toFixed(2)}deg`,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--d" as any]: `${(i * 0.08).toFixed(2)}s`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={orb.src} alt="" />
                <span className="orb-label">{orb.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
