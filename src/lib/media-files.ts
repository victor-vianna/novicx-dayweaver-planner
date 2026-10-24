// Client-side checks for art uploads. The bucket enforces the same limits
// server-side; these only give a clear message before sending.
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateImageFile(file: Pick<File, "type" | "size" | "name">): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" não é JPG, PNG ou WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) return `"${file.name}" passa de 15 MB.`;
  return null;
}

export function imageExtension(type: string) {
  return EXTENSIONS[type] ?? "jpg";
}

/** Reads pixel dimensions; falls back to the app's 4:5 default if decoding fails. */
export async function readImageSize(file: Blob): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 1080, height: 1350 };
  }
}
