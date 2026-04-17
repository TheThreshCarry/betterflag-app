/** Shared rules + URL parsing for Supabase Storage brand images (avatars + org logos). */

export const BRAND_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export const BRAND_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

const MIME_TO_EXT: Record<(typeof BRAND_IMAGE_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

export function brandImageExt(mime: string): string | null {
  return MIME_TO_EXT[mime as keyof typeof MIME_TO_EXT] ?? null
}

export function validateBrandImageFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!BRAND_IMAGE_MIME_TYPES.includes(file.type as (typeof BRAND_IMAGE_MIME_TYPES)[number])) {
    return {
      ok: false,
      error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed",
    }
  }
  if (file.size > BRAND_IMAGE_MAX_BYTES) {
    return { ok: false, error: "File size exceeds 5MB limit" }
  }
  return { ok: true }
}

/**
 * Returns object path within the bucket (e.g. `userId/123.jpg`), or null if URL is not
 * a public object for this bucket+prefix.
 */
export function parsePublicStoragePath(
  publicUrl: string,
  bucket: string,
  idPrefix: string
): string | null {
  try {
    const u = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    const path = u.pathname.slice(idx + marker.length)
    const decoded = decodeURIComponent(path)
    const prefix = `${idPrefix}/`
    if (!decoded.startsWith(prefix)) return null
    return decoded
  } catch {
    return null
  }
}
