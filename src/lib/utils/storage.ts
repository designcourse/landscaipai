export function getUploadPath(
  userId: string,
  projectId: string,
  imageId: string,
  ext: string
) {
  return `uploads/${userId}/${projectId}/${imageId}.${ext}`;
}

export function getThumbnailPath(
  userId: string,
  projectId: string,
  imageId: string
) {
  return `thumbnails/${userId}/${projectId}/${imageId}_thumb.webp`;
}

export function getGenerationPath(
  userId: string,
  projectId: string,
  generationId: string
) {
  return `generations/${userId}/${projectId}/${generationId}.webp`;
}
