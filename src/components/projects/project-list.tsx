"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types";

type ProjectWithCount = Project & { image_count: number };

interface ProjectListProps {
  initialProjects: ProjectWithCount[];
}

export function ProjectList({ initialProjects }: ProjectListProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCreate && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
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

    setProjects((prev) => [{ ...data, image_count: 0 }, ...prev]);
    setNewName("");
    setShowCreate(false);
    setCreating(false);
    router.push(`/project/${data.id}`);
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
    if (!confirm(`Delete "${name}"? This will permanently remove the project and all its images.`)) {
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

  return (
    <div className="space-y-group">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Projects</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
        >
          New Project
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="flex items-center gap-3">
          <input
            ref={createInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name (e.g., Front yard redesign)"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!newName.trim() || creating}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewName("");
            }}
            className="rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Project grid or empty state */}
      {projects.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-section text-center">
          <div className="mx-auto max-w-sm">
            <svg
              className="mx-auto h-12 w-12 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
            <p className="mt-4 text-sm font-medium text-foreground">
              No projects yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to start uploading photos and generating landscaping designs.
            </p>
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
              >
                Create your first project
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-element sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onRename,
  onDelete,
}: {
  project: ProjectWithCount;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
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

  return (
    <div className="group relative rounded-lg border border-border bg-background transition-shadow hover:shadow-sm">
      {/* Clickable card body */}
      <Link
        href={`/project/${project.id}`}
        className="block p-element"
      >
        {/* Thumbnail placeholder */}
        <div className="flex h-32 items-center justify-center rounded-md bg-muted">
          <svg
            className="h-10 w-10 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
        </div>

        {/* Project info */}
        <div className="mt-3">
          {editing ? (
            /* Stop link navigation when editing */
            <div onClick={(e) => e.preventDefault()}>
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
                  className="w-full rounded border border-primary bg-background px-2 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </form>
            </div>
          ) : (
            <h3 className="truncate text-sm font-medium text-foreground">
              {project.name}
            </h3>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {project.image_count} {project.image_count === 1 ? "image" : "images"} &middot; {date}
          </p>
        </div>
      </Link>

      {/* Three-dot menu */}
      <div className="absolute right-3 top-3" ref={menuRef}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label="Project options"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 w-36 rounded-md border border-border bg-background py-1 shadow-md">
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
  );
}
