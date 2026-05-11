"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePurchaseCredits } from "@/components/billing/purchase-credits-modal-context";

interface CanvasMobileToolbarProps {
  projectId: string;
  projectName: string;
  credits: number;
  userProfile: { full_name: string | null; avatar_url: string | null; email: string };
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
  userProfile,
  onUpload,
}: CanvasMobileToolbarProps) {
  const router = useRouter();
  const { open: openPurchaseCredits } = usePurchaseCredits();

  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [kebabMenuOpen, setKebabMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const projectMenuRef = useRef<HTMLDivElement>(null);
  const kebabMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      const target = e.target as Node;
      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuOpen(false);
      }
      if (kebabMenuRef.current && !kebabMenuRef.current.contains(target)) {
        setKebabMenuOpen(false);
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

  function handleUploadClick() {
    setKebabMenuOpen(false);
    if (credits <= 0) {
      openPurchaseCredits({
        title: "You're out of credits",
        subtitle: "Buy credits to upload a new photo and keep designing.",
      });
      return;
    }
    onUpload();
  }

  async function handleSignOut() {
    setKebabMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const displayName = userProfile.full_name || userProfile.email;

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

      {/* Kebab menu */}
      <div className="relative" ref={kebabMenuRef}>
        <button
          onClick={() => setKebabMenuOpen(!kebabMenuOpen)}
          aria-label="More options"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="12" cy="19" r="1.7" />
          </svg>
        </button>

        {kebabMenuOpen && (
          <div
            className="absolute right-0 z-40 mt-2 overflow-hidden rounded-md border border-border bg-white shadow-md"
            style={{ width: "min(15rem, calc(100vw - 1rem))" }}
          >
            <div className="border-b border-border px-3 py-3">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{userProfile.email}</p>
            </div>
            <div className="py-1">
              <button
                onClick={handleUploadClick}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                Upload photo
              </button>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                onClick={() => setKebabMenuOpen(false)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4H10v4a2 2 0 01-2 2H4a2 2 0 01-2-2V10z" />
                </svg>
                Dashboard
              </Link>
              <Link
                href="/account"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                onClick={() => setKebabMenuOpen(false)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Account settings
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-destructive hover:bg-muted"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
