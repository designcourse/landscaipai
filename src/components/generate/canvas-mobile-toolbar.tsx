"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePurchaseCredits } from "@/components/billing/purchase-credits-modal-context";

interface CanvasMobileToolbarProps {
  projectId: string;
  projectName: string;
  credits: number;
  onUpload: () => void;
}

interface ProjectOption {
  id: string;
  name: string;
}

export function CanvasMobileToolbar({
  projectId,
  projectName,
  credits,
  onUpload,
}: CanvasMobileToolbarProps) {
  const { open: openPurchaseCredits } = usePurchaseCredits();

  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      const target = e.target as Node;
      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  async function handleProjectMenuToggle() {
    if (projectMenuOpen) {
      setProjectMenuOpen(false);
      return;
    }
    setProjectMenuOpen(true);
    if (projects.length === 0) {
      setLoadingProjects(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .order("created_at", { ascending: false });
      setProjects(data ?? []);
      setLoadingProjects(false);
    }
  }

  return (
    <div
      className="relative z-30 flex h-12 shrink-0 items-center gap-2 bg-white px-3"
      style={{ borderBottom: "1px solid var(--color-canvas-toolbar-border)" }}
    >
      {/* Back */}
      <Link
        href="/dashboard"
        aria-label="Back to dashboard"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      {/* Project pill (centered, fluid) */}
      <div className="relative min-w-0 flex-1" ref={projectMenuRef}>
        <button
          onClick={handleProjectMenuToggle}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-white px-3"
        >
          <span className="truncate text-sm font-bold text-foreground">{projectName}</span>
          <svg className="h-3 w-3 shrink-0 text-muted-foreground" fill="currentColor" viewBox="0 0 12 12">
            <path d="M2 4l4 4 4-4z" />
          </svg>
        </button>

        {projectMenuOpen && (
          <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-md border border-border bg-white shadow-md">
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Switch project</p>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {loadingProjects ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Loading...</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProjectMenuOpen(false);
                      if (p.id !== projectId) {
                        window.location.href = `/generate?project=${p.id}`;
                      }
                    }}
                    className={`block w-full truncate px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      p.id === projectId ? "font-bold text-primary" : "text-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Credits pill */}
      <button
        type="button"
        onClick={() => openPurchaseCredits()}
        className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2"
        style={{ backgroundColor: "var(--color-credits-badge-bg)" }}
        aria-label={`${credits} credits — buy more`}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-xs font-medium text-primary">{credits}</span>
      </button>

      {/* Upload — primary action */}
      <button
        type="button"
        onClick={() => {
          if (credits <= 0) {
            openPurchaseCredits({
              title: "You're out of credits",
              subtitle: "Buy credits to upload a new photo and keep designing.",
            });
            return;
          }
          onUpload();
        }}
        aria-label="Upload photo"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary-light"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0-12l-4 4m4-4l4 4M5 20h14" />
        </svg>
      </button>
    </div>
  );
}
