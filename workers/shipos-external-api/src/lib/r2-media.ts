/**
 * Shared R2 media handlers for worker routes (internal + v1).
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
