"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface CanvasToolbarProps {
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

export function CanvasToolbar({
  projectId,
  projectName,
  credits,
  userProfile,
  onUpload,
}: CanvasToolbarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(target)) {
        setProjectDropdownOpen(false);
      }
    }
    // Use pointerdown instead of mousedown — canvas calls preventDefault() on
    // pointerdown which suppresses mousedown, so mousedown never reaches here.
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  async function handleProjectDropdownToggle() {
    if (projectDropdownOpen) {
      setProjectDropdownOpen(false);
      return;
    }
    setProjectDropdownOpen(true);
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

  const displayName = userProfile.full_name || userProfile.email;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="relative z-20 flex h-[74px] shrink-0 items-center justify-between bg-white px-5"
      style={{ borderBottom: "1px solid var(--color-canvas-toolbar-border)" }}
    >
      {/* Left: Back + Logo */}
      <div className="flex items-center gap-3 overflow-hidden">
        <Link
          href="/dashboard"
          className="whitespace-nowrap text-base font-medium text-foreground transition-colors hover:text-primary"
        >
          &larr; Back
        </Link>
        <div
          className="h-5 w-px shrink-0"
          style={{ backgroundColor: "var(--color-canvas-separator)" }}
        />
        <Link href="/dashboard" className="shrink-0">
          <img src="/assets/logo.png" alt="Landscaip" className="h-5" />
        </Link>
      </div>

      {/* Center: Project Dropdown */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" ref={projectDropdownRef}>
        <button
          className="flex items-center gap-2.5 rounded-md border border-border px-6 py-2.5"
          onClick={handleProjectDropdownToggle}
        >
          <span className="text-base font-bold text-foreground">{projectName}</span>
          <span className="text-lg text-muted-foreground">&#9662;</span>
        </button>

        {projectDropdownOpen && (
          <div className="absolute left-1/2 mt-2 w-64 -translate-x-1/2 rounded-md border border-border bg-white shadow-md">
            <div className="border-b border-border px-4 py-2">
              <p className="text-xs font-medium text-muted-foreground">Switch project</p>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {loadingProjects ? (
                <p className="px-4 py-2 text-sm text-muted-foreground">Loading...</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProjectDropdownOpen(false);
                      if (p.id !== projectId) {
                        // Full navigation so the server component re-fetches project data
                        window.location.href = `/generate?project=${p.id}`;
                      }
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-muted ${
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

      {/* Right: Upload, Dashboard, Credits, Avatar */}
      <div className="flex items-center gap-8 overflow-hidden">
        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 whitespace-nowrap text-base font-medium text-foreground transition-colors hover:text-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          Upload
        </button>

        <Link
          href="/dashboard"
          className="whitespace-nowrap text-base font-medium text-foreground transition-colors hover:text-primary"
        >
          Dashboard
        </Link>

        <div className="flex items-center gap-3">
          {/* Credits Badge */}
          <div
            className="flex items-center gap-1 rounded-xl px-2.5 py-1"
            style={{ backgroundColor: "var(--color-credits-badge-bg)" }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-sm font-medium text-primary">{credits} credits</span>
          </div>

          {/* Avatar */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-dark text-xs font-semibold text-white"
            >
              {userProfile.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt=""
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-white shadow-md">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userProfile.email}</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/account"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Account settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
