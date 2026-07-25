/**
 * Shared multipart image parsing for org logo / project picture uploads.
 */

import {
  extForContentType,
  isMediaContentType,
  MEDIA_MAX_BYTES,
  type MediaContentType,
} from "@/lib/r2";
import { HttpError } from "@/lib/errors";

export interface ParsedMediaFile {
  buffer: Buffer;
  contentType: MediaContentType;
  ext: string;
}

export async function parseMediaUpload(request: Request): Promise<ParsedMediaFile> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new HttpError(400, "invalid_content_type", "Expected multipart/form-data");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "invalid_body", "Could not parse multipart body");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new HttpError(400, "missing_file", "Missing file field");
  }

  if (file.size <= 0) {
    throw new HttpError(400, "empty_file", "File is empty");
  }
  if (file.size > MEDIA_MAX_BYTES) {
    throw new HttpError(
      400,
      "file_too_large",
      `Image must be at most ${MEDIA_MAX_BYTES / 1024 / 1024}MB`,
    );
  }

  const mime = (file.type || "").toLowerCase();
  if (!isMediaContentType(mime)) {
    throw new HttpError(
      400,
      "unsupported_type",
      "Supported types: PNG, JPEG, WebP, SVG",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    buffer,
    contentType: mime,
    ext: extForContentType(mime),
  };
}

export function requireSessionOnly(request: Request): void {
  const header = request.headers.get("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "session_required", "This endpoint requires a signed-in session");
  }
}
