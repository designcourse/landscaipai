"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/projects/image-upload";
import { BUCKET_UPLOADS } from "@/lib/utils/storage";
import type { Project, Image } from "@/types";

type ImageWithUrl = Image & { url: string };

interface ProjectDetailProps {
  project: Project;
  images: ImageWithUrl[];
  userId: string;
}

export function ProjectDetail({ project, images: initialImages, userId }: ProjectDetailProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [shared, setShared] = useState(project.is_shared);
  const [shareSlug, setShareSlug] = useState(project.share_slug);
  const [menuOpen, setMenuOpen] = useState(false);
  const [images, setImages] = useState<ImageWithUrl[]>(initialImages);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ name: trimmed })
      .eq("id", project.id);

    if (error) {
      alert("Failed to rename: " + error.message);
      return;
    }

    setName(trimmed);
    setEditing(false);
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${name}"? This will permanently remove the project and all its images.`
      )
    ) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);

    if (error) {
      alert("Failed to delete: " + error.message);
      return;
    }

    router.push("/dashboard");
  }

  async function handleToggleShare() {
    const supabase = createClient();
    const newShared = !shared;
    const slug = newShared && !shareSlug ? crypto.randomUUID().slice(0, 8) : shareSlug;

    const { error } = await supabase
      .from("projects")
      .update({
        is_shared: newShared,
        share_slug: newShared ? slug : shareSlug,
      })
      .eq("id", project.id);

    if (error) {
      alert("Failed to update sharing: " + error.message);
      return;
    }

    setShared(newShared);
    if (slug) setShareSlug(slug);
  }

  function copyShareLink() {
    if (shareSlug) {
      navigator.clipboard.writeText(
        `${window.location.origin}/share/${shareSlug}`
      );
    }
  }

  function handleImageUploaded(image: ImageWithUrl) {
    setImages((prev) => [image, ...prev]);
  }

  async function handleDeleteImage(imageId: string, storagePath: string) {
    if (!confirm("Delete this image and all its generations?")) return;

    const supabase = createClient();

    // Delete DB record (cascade deletes generations)
    const { error: dbError } = await supabase
      .from("images")
      .delete()
      .eq("id", imageId);

    if (dbError) {
      alert("Failed to delete image: " + dbError.message);
      return;
    }

    // Delete storage file
    await supabase.storage.from(BUCKET_UPLOADS).remove([storagePath]);

    setImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  return (
    <div className="space-y-group">
      {/* Breadcrumb + header */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Dashboard
        </Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {editing ? (
              <form onSubmit={handleRename} className="flex items-center gap-2">
                <input
                  ref={editInputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditName(name);
                      setEditing(false);
                    }
                  }}
                  className="w-full rounded-md border border-primary bg-background px-3 py-1.5 text-xl font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </form>
            ) : (
              <h1 className="truncate text-2xl font-bold text-foreground">
                {name}
              </h1>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {images.length} {images.length === 1 ? "image" : "images"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Share toggle */}
            <button
              onClick={handleToggleShare}
              className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors ${
                shared
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              {shared ? "Shared" : "Share"}
            </button>

            {/* Copy link (only when shared) */}
            {shared && shareSlug && (
              <button
                onClick={copyShareLink}
                className="rounded-sm border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                title="Copy share link"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}

            {/* More menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label="More options"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-36 rounded-md border border-border bg-background py-1 shadow-md">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setEditName(name);
                      setEditing(true);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDelete();
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      <ImageUpload projectId={project.id} userId={userId} onUploaded={handleImageUploaded} />

      {/* Images grid */}
      {images.length > 0 && (
        <div className="grid gap-element sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-lg border border-border bg-background"
            >
              <Link
                href={`/generate?image=${image.id}`}
                className="block aspect-[4/3] bg-muted"
              >
                {image.url ? (
                  <img
                    src={image.url}
                    alt={image.original_filename ?? "Uploaded photo"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
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
                )}
              </Link>
              <div className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {image.original_filename ?? "Uploaded image"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(image.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {image.width && image.height && (
                      <> &middot; {image.width}&times;{image.height}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteImage(image.id, image.storage_path)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
                  title="Delete image"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
