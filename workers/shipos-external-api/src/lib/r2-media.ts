/**
 * Shared R2 media / profile handlers for worker routes (internal + v1).
 */

import type { Bindings } from "../types";

export async function uploadMediaAsset(
  env: Bindings,
  input: {
    file: File;
    organizationId: string;
    userId: string;
    folder: string;
  }
) {
  const { file, organizationId, userId, folder } = input;
  const fileExtension = file.name.split(".").pop() || "bin";
  const uniqueId = crypto.randomUUID();
  const folderPath = folder === "/" ? "" : folder.slice(1);
  const key = `media/${organizationId}/${folderPath}${uniqueId}.${fileExtension}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.MEDIA_ASSETS.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
    customMetadata: {
      organizationId,
      userId: userId || "",
      originalName: file.name,
      folder,
      uploadedAt: new Date().toISOString(),
    },
  });

  return {
    success: true as const,
    key,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function deleteMediaAssetByKey(env: Bindings, key: string) {
  const object = await env.MEDIA_ASSETS.head(key);
  if (!object) {
    return { ok: false as const, status: 404 as const };
  }
  await env.MEDIA_ASSETS.delete(key);
  return { ok: true as const };
}

export async function serveMediaAsset(env: Bindings, orgId: string, restPath: string) {
  const key = `media/${orgId}/${restPath}`;
  const object = await env.MEDIA_ASSETS.get(key);
  if (!object) {
    return null;
  }
  const contentType = object.httpMetadata?.contentType || "application/octet-stream";
  const isInline = contentType.startsWith("image/") || contentType.startsWith("video/");
  return {
    body: object.body,
    contentType,
    contentDisposition: isInline
      ? "inline"
      : `attachment; filename="${object.customMetadata?.originalName || "download"}"`,
  };
}

export async function uploadProfilePicture(
  env: Bindings,
  input: { file: File; userId: string; publicOrigin: string }
) {
  const { file, userId, publicOrigin } = input;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return {
      error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed",
      status: 400 as const,
    };
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { error: "File size exceeds 5MB limit", status: 400 as const };
  }

  const fileExtension = file.name.split(".").pop();
  const timestamp = Date.now();
  const key = `profile-pictures/${userId}-${timestamp}.${fileExtension}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.PROFILE_PICTURES.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
    customMetadata: {
      userId,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  const base = publicOrigin.replace(/\/$/, "");
  /** Public URL; path after host matches pathname the client uses for delete (see profile-picture-upload.tsx). */
  const publicUrl = `${base}/${key}`;

  return {
    success: true as const,
    url: publicUrl,
    key,
  };
}

export async function deleteProfilePicture(
  env: Bindings,
  input: { key: string; userId: string }
) {
  const { key, userId } = input;
  const object = await env.PROFILE_PICTURES.head(key);
  if (!object) {
    return { error: "File not found", status: 404 as const };
  }
  if (object.customMetadata?.userId !== userId) {
    return { error: "Unauthorized", status: 403 as const };
  }
  await env.PROFILE_PICTURES.delete(key);
  return { success: true as const, message: "Profile picture deleted" };
}
