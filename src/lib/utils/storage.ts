import type { SupabaseClient } from "@supabase/supabase-js";

// Bucket names
export const BUCKET_UPLOADS = "uploads";
export const BUCKET_THUMBNAILS = "thumbnails";
export const BUCKET_GENERATIONS = "generations";

// Signed URL expiry (1 hour)
export const SIGNED_URL_EXPIRY = 3600;

// Batch signed URL helper — single HTTP request for N paths
export async function attachSignedUrls<T extends { storage_path: string }>(
  client: SupabaseClient,
  bucket: string,
  items: T[],
  expiresIn = SIGNED_URL_EXPIRY
): Promise<(T & { url: string })[]> {
  if (items.length === 0) return [];

  const paths = items.map((item) => item.storage_path);
  const { data } = await client.storage.from(bucket).createSignedUrls(paths, expiresIn);

  return items.map((item, i) => ({
    ...item,
    url: data?.[i]?.signedUrl ?? "",
  }));
}

export const BUCKET_PLANT_LIBRARY = "plant-library";

// Fetch library reference images as base64 for Gemini multimodal input
export async function fetchLibraryImageParts(
  client: SupabaseClient,
  items: { common_name: string; image_path?: string | null }[]
): Promise<{ mimeType: string; data: string; label: string }[]> {
  const withImages = items.filter((i) => i.image_path);
  if (!withImages.length) return [];

  const results = await Promise.all(
    withImages.map(async (item) => {
      try {
        const { data, error } = await client.storage
          .from(BUCKET_PLANT_LIBRARY)
          .download(item.image_path!);
        if (error || !data) return null;
        const buf = Buffer.from(await data.arrayBuffer());
        return {
          mimeType: "image/webp",
          data: buf.toString("base64"),
          label: item.common_name,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// Path within each bucket: {user_id}/{project_id}/{filename}

export function getUploadPath(
  userId: string,
  projectId: string,
  imageId: string,
  ext: string
) {
  return `${userId}/${projectId}/${imageId}.${ext}`;
}

export function getThumbnailPath(
  userId: string,
  projectId: string,
  imageId: string
) {
  return `${userId}/${projectId}/${imageId}_thumb.webp`;
}

export function getGenerationPath(
  userId: string,
  projectId: string,
  generationId: string
) {
  return `${userId}/${projectId}/${generationId}.webp`;
}
