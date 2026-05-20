"use client";

import { useCallback, useEffect, useState } from "react";

interface EditorOnboardingProps {
  onClose: () => void;
}

type Step = {
  id: "style" | "settings" | "library" | "prompt" | "generate";
  label: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const STEPS: Step[] = [
  {
    id: "style",
    label: "Style",
    title: "Pick a style",
    description:
      "Choose from 16 predefined styles like Modern, Mediterranean, Cottage, or Japanese to set the overall look of your design.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="10" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="16" cy="10" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    title: "Set the scene",
    description:
      "Adjust the time of day, season, and weather to match the mood you're going for — golden hour, fall foliage, a crisp winter morning.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="9" cy="6" r="2" fill="white" />
        <circle cx="15" cy="12" r="2" fill="white" />
        <circle cx="8" cy="18" r="2" fill="white" />
      </svg>
    ),
  },
  {
    id: "library",
    label: "Library",
    title: "Browse the library",
    description:
      "Pick real plants and hardscape items to drop into your design. Everything is filtered to your hardiness zone, so it'll actually grow where you live.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s-7-4-7-12a7 7 0 0114 0c0 8-7 12-7 12z" />
        <path d="M12 14V3" />
      </svg>
    ),
  },
  {
    id: "prompt",
    label: "Prompt",
    title: "Describe your vision",
    description:
      "Write what you want changed. Be as specific as possible — call out plant placement, materials, colors, and any details that matter. The more precise, the better the result.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    id: "generate",
    label: "Generate",
    title: "Hit Generate",
    description:
      "Each generation uses 1 credit and lands on the canvas in a few seconds. Iterate by tweaking the prompt or settings and generating again.",
    icon: (
      <span
        aria-hidden
        className="block h-full w-full"
        style={{
          backgroundColor: "currentColor",
          WebkitMaskImage: "url(/icons/leaf-mark-white.png)",
          maskImage: "url(/icons/leaf-mark-white.png)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
    ),
  },
];

export function EditorOnboarding({ onClose }: EditorOnboardingProps) {
  const [index, setIndex] = useState(0);

  const handlePrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setIndex((i) => {
      if (i >= STEPS.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }, [onClose]);

  // Keyboard navigation: Esc closes, arrows step
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleNext, handlePrev, onClose]);

  const step = STEPS[index];
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-onboarding-title"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Skip button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Skip tour"
        >
          Skip
        </button>

        {/* Top section: icon + title + description */}
        <div className="px-element pb-element pt-section text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white">
            <span className="block h-7 w-7">{step.icon}</span>
          </div>
          <h2
            id="editor-onboarding-title"
            className="mt-element text-xl font-bold text-foreground"
          >
            {step.title}
          </h2>
          <p className="mt-tight text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        </div>

        {/* Step indicator with labels */}
        <div className="border-t border-border bg-panel-subtle px-element py-element">
          <div className="flex items-start justify-between gap-1">
            {STEPS.map((s, i) => {
              const active = i === index;
              const done = i < index;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                  aria-label={`Go to step ${i + 1}: ${s.label}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={`h-1.5 w-full rounded-full transition-colors ${
                      active || done ? "bg-primary" : "bg-border"
                    }`}
                  />
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      active
                        ? "text-primary"
                        : done
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between gap-tight border-t border-border px-element py-element">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirst}
            className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Back
          </button>
          <span className="text-xs text-muted-foreground">
            {index + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
