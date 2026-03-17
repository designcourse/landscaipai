"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/utils/images";
import { getUploadPath, BUCKET_UPLOADS } from "@/lib/utils/storage";
import type { Image } from "@/types";

interface ImageUploadProps {
  projectId: string;
  userId: string;
  onUploaded: (image: Image & { url: string }) => void;
}

function getExtension(filename: string, mimeType: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "heic"].includes(fromName)) {
    return fromName;
  }
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[mimeType] ?? "jpg";
}

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

export function ImageUpload({ projectId, userId, onUploaded }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setUploading(true);

      try {
        const supabase = createClient();

        const imageId = crypto.randomUUID();
        const ext = getExtension(file.name, file.type);
        const storagePath = getUploadPath(userId, projectId, imageId, ext);

        // Get dimensions
        const { width, height } = await getImageDimensions(file);

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_UPLOADS)
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setError("Upload failed: " + uploadError.message);
          setUploading(false);
          return;
        }

        // Create DB record
        const { data: imageRecord, error: dbError } = await supabase
          .from("images")
          .insert({
            id: imageId,
            project_id: projectId,
            user_id: userId,
            storage_path: storagePath,
            original_filename: file.name,
            width: width || null,
            height: height || null,
            file_size_bytes: file.size,
          })
          .select()
          .single();

        if (dbError) {
          // Clean up orphaned storage file
          await supabase.storage.from(BUCKET_UPLOADS).remove([storagePath]);
          setError("Failed to save image: " + dbError.message);
          setUploading(false);
          return;
        }

        // Get a signed URL for display
        const { data: urlData } = await supabase.storage
          .from(BUCKET_UPLOADS)
          .createSignedUrl(storagePath, 3600);

        onUploaded({
          ...imageRecord,
          url: urlData?.signedUrl ?? "",
        });
      } catch (err) {
        setError("Upload failed. Please try again.");
        console.error(err);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [projectId, onUploaded]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        } ${uploading ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={handleFileInput}
          className="hidden"
        />

        {uploading ? (
          <>
            <svg
              className="h-8 w-8 animate-spin text-primary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="mt-3 text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-foreground">
              Drop a photo here or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, WebP, or HEIC up to 20MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
