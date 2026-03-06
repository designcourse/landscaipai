export const MAX_IMAGE_SIZE_MB = 20;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Unsupported image format. Use JPEG, PNG, WebP, or HEIC.";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `Image must be under ${MAX_IMAGE_SIZE_MB}MB.`;
  }
  return null;
}
