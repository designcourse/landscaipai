"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ZoneSelector } from "@/components/shared/zone-selector";
import type { Project } from "@/types";

type ProjectWithMeta = Project & {
  thumbnail_url: string | null;
  seed_count: number;
  generated_count: number;
};

interface ProjectListProps {
  initialProjects: ProjectWithMeta[];
}

export function ProjectList({ initialProjects }: ProjectListProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCreate && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Not authenticated");
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, user_id: user.id })
      .select()
      .single();

    if (error) {
      alert("Failed to create project: " + error.message);
      setCreating(false);
      return;
    }

    setProjects((prev) => [
      { ...data, thumbnail_url: null, seed_count: 0, generated_count: 0 },
      ...prev,
    ]);
    setNewName("");
    setShowCreate(false);
    setCreating(false);
    router.push(`/generate?project=${data.id}`);
  }

  async function handleRename(id: string, name: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ name })
      .eq("id", id);
    if (error) {
      alert("Failed to rename project: " + error.message);
      return;
    }
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"? This will permanently remove the project and all its images.`
      )
    ) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      alert("Failed to delete project: " + error.message);
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleToggleShare(id: string) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const newShared = !project.is_shared;
    const slug =
      newShared && !project.share_slug
        ? crypto.randomUUID().slice(0, 8)
        : project.share_slug;
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({
        is_shared: newShared,
        share_slug: newShared ? slug : project.share_slug,
      })
      .eq("id", id);
    if (error) {
      alert("Failed to update sharing: " + error.message);
      return;
    }
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, is_shared: newShared, share_slug: slug ?? p.share_slug }
          : p
      )
    );
    if (newShared && slug) {
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}/share/${slug}`
        );
      } catch {
        // clipboard may fail silently on insecure contexts — ignore
      }
    }
  }

  async function handleSetZone(id: string, zone: string, zipCode?: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({
        hardiness_zone: zone,
        zip_code: zipCode ?? null,
      })
      .eq("id", id);
    if (error) {
      alert("Failed to update zone: " + error.message);
      return;
    }
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, hardiness_zone: zone, zip_code: zipCode ?? p.zip_code }
          : p
      )
    );
  }

  const hasProjects = projects.length > 0;

  return (
    <div className="space-y-group">
      {/* Section header */}
      <div className="flex flex-col gap-element md:flex-row md:items-center md:justify-between">
        <div className="flex items-baseline gap-tight">
          <h2 className="text-lg font-semibold text-foreground">Projects</h2>
          <span className="text-sm text-muted-foreground">
            {projects.length} total
          </span>
        </div>
        {hasProjects && (
          <div className="relative w-full md:mx-element md:max-w-sm md:flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full rounded-md border border-panel-border bg-white py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
        {hasProjects && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-tight rounded-md bg-primary px-element py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New Project
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-tight sm:flex-row sm:items-center"
        >
          <input
            ref={createInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name (e.g., Front yard redesign)"
            className="flex-1 rounded-md border border-panel-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-tight">
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="rounded-lg border border-panel-border bg-panel p-section text-center">
          <div className="mx-auto max-w-sm">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium text-foreground">
              No projects yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to start uploading photos and
              generating landscaping designs.
            </p>
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-tight rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Create your first project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-panel-border bg-white">
          {/* Column header row (desktop only) */}
          <div className="hidden items-center gap-6 bg-panel-chip px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:flex">
            <div className="w-40 shrink-0" aria-hidden />
            <div className="flex-1">Project</div>
            <div className="w-[120px] text-right">Seeds</div>
            <div className="w-[140px] text-right">AI Generated</div>
            <div className="w-[180px]" aria-hidden />
          </div>

          {filtered.length === 0 ? (
            <div className="bg-panel px-5 py-10 text-center text-sm text-muted-foreground">
              No projects match &ldquo;{search}&rdquo;.
            </div>
          ) : (
            filtered.map((project, idx) => (
              <ProjectRow
                key={project.id}
                project={project}
                isLast={idx === filtered.length - 1}
                onRename={handleRename}
                onDelete={handleDelete}
                onToggleShare={handleToggleShare}
                onSetZone={handleSetZone}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  isLast,
  onRename,
  onDelete,
  onToggleShare,
  onSetZone,
}: {
  project: ProjectWithMeta;
  isLast: boolean;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  onToggleShare: (id: string) => void;
  onSetZone: (id: string, zone: string, zipCode?: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [zonePickerOpen, setZonePickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      onRename(project.id, trimmed);
    }
    setEditing(false);
  }

  const date = new Date(project.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const updated = formatRelative(project.updated_at);

  return (
    <div
      className={`relative flex items-center gap-4 bg-panel px-3 py-3 transition-colors hover:bg-panel-subtle md:h-[110px] md:gap-6 md:px-5 md:py-0 ${
        isLast ? "" : "border-b border-panel-border-strong"
      }`}
    >
      <Link
        href={`/generate?project=${project.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 md:gap-6"
        onClick={(e) => {
          if (editing || zonePickerOpen) e.preventDefault();
        }}
      >
        {/* Thumbnail */}
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-panel-subtle md:h-[100px] md:w-40">
          {project.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnail_url}
              alt={project.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-7 w-7 text-muted-foreground/60" />
            </div>
          )}
          {project.is_shared && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary backdrop-blur-sm">
              Shared
            </span>
          )}
        </div>

        {/* Name + date (+ mobile stats) */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <form onSubmit={handleRenameSubmit}>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditName(project.name);
                      setEditing(false);
                    }
                  }}
                  className="w-full rounded-sm border border-primary bg-white px-2 py-1 text-base font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </form>
            </div>
          ) : (
            <h3 className="truncate text-base font-semibold text-foreground">
              {project.name}
            </h3>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">{date}</p>
          {/* Mobile-only stats */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
            <span className="inline-flex items-center gap-1 rounded-full bg-panel-chip px-2 py-0.5 text-[11px] font-medium text-foreground">
              <ImageIcon className="h-3 w-3" />
              {project.seed_count} seed{project.seed_count === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-medium text-primary-dark">
              <SparklesIcon className="h-3 w-3" />
              {project.generated_count} generated
            </span>
          </div>
        </div>

        {/* Seeds (desktop) */}
        <div className="hidden w-[120px] shrink-0 flex-col items-end justify-center gap-0.5 md:flex">
          <div className="flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-2xl font-bold leading-none text-foreground">
              {project.seed_count}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">seeds</span>
        </div>

        {/* AI generated (desktop) */}
        <div className="hidden w-[140px] shrink-0 flex-col items-end justify-center gap-0.5 md:flex">
          <div className="flex items-center gap-1.5">
            <SparklesIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-2xl font-bold leading-none text-primary">
              {project.generated_count}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">generated</span>
        </div>
      </Link>

      {/* Actions column */}
      <div className="flex shrink-0 items-center justify-end gap-2 md:w-[180px]">
        <span className="hidden text-xs text-muted-foreground lg:inline">
          Updated {updated}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-panel-subtle hover:text-foreground"
            aria-label="Project options"
          >
            <MoreIcon className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-md border border-border bg-white py-1 shadow-md">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  setEditing(true);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              >
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  onToggleShare(project.id);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              >
                {project.is_shared ? "Unshare" : "Share"}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  setZonePickerOpen(true);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
              >
                {project.hardiness_zone
                  ? `Zone: ${project.hardiness_zone.toUpperCase()}`
                  : "Set zone"}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(project.id, project.name);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Zone picker popover — below actions, right-aligned */}
      {zonePickerOpen && (
        <div
          className="absolute right-3 top-full z-40 mt-1 rounded-md border border-border bg-white p-element shadow-md md:right-5"
          onClick={(e) => e.stopPropagation()}
        >
          <ZoneSelector
            onSelect={(zone, zipCode) => {
              onSetZone(project.id, zone, zipCode);
              setZonePickerOpen(false);
            }}
            onCancel={() => setZonePickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function formatRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "1 minute ago" : `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "1 day ago" : `${d} days ago`;
  const w = Math.floor(d / 7);
  if (d < 30) return w === 1 ? "1 week ago" : `${w} weeks ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo === 1 ? "1 month ago" : `${mo} months ago`;
  const y = Math.floor(d / 365);
  return y === 1 ? "1 year ago" : `${y} years ago`;
}

/* ---------- icons (Lucide-style, 1.5 stroke) ---------- */

function ImageIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function SparklesIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function MoreIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}
