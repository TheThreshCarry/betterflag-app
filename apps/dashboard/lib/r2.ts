/**
 * Cloudflare R2 helpers for public branding assets (org logos, project pictures).
 * Uses the S3-compatible API. Objects are served from R2_PUBLIC_BASE_URL
 * (e.g. https://media.shipos.app).
 *
 * Unset env → throws HttpError 503 so routes can surface a clear message
 * (unlike CF KV helpers which no-op; uploads must fail visibly).
 */

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { optionalEnv } from "@/lib/env";
import { HttpError } from "@/lib/errors";

export const MEDIA_MAX_BYTES = 1_048_576; // 1 MiB

export const MEDIA_CONTENT_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
} as const;

export type MediaContentType = keyof typeof MEDIA_CONTENT_TYPES;

interface R2Config {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
}

function r2Config(context: string): R2Config {
  const accountId = optionalEnv("R2_ACCOUNT_ID");
  const accessKeyId = optionalEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = optionalEnv("R2_SECRET_ACCESS_KEY");
  const bucket = optionalEnv("R2_BUCKET");
  const publicBaseUrl = optionalEnv("R2_PUBLIC_BASE_URL");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new HttpError(
      503,
      "media_unavailable",
      `Media storage is not configured (${context})`,
    );
  }

  return {
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export function isMediaContentType(value: string): value is MediaContentType {
  return value in MEDIA_CONTENT_TYPES;
}

export function extForContentType(contentType: MediaContentType): string {
  return MEDIA_CONTENT_TYPES[contentType];
}

/** Build the public CDN URL with a cache-bust query. */
export function publicMediaUrl(baseUrl: string, key: string, version = Date.now()): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/${key}?v=${version}`;
}

/** Extract the object key from a stored public URL, or null if not ours. */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const publicBaseUrl = optionalEnv("R2_PUBLIC_BASE_URL")?.replace(/\/$/, "");
  if (!publicBaseUrl) return null;
  try {
    const parsed = new URL(url);
    const base = new URL(publicBaseUrl);
    if (parsed.origin !== base.origin) return null;
    const key = parsed.pathname.replace(/^\//, "");
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

export async function putPublicImage(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: MediaContentType;
}): Promise<string> {
  const { client, bucket, publicBaseUrl } = r2Config("put image");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicMediaUrl(publicBaseUrl, input.key);
}

/** Best-effort delete; swallows missing-object / config errors. */
export async function deleteMediaObject(key: string): Promise<void> {
  try {
    const { client, bucket } = r2Config("delete image");
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    console.warn(`[r2] delete skipped for ${key}:`, error);
  }
}

export function orgLogoKey(orgId: string, ext: string): string {
  return `orgs/${orgId}/logo.${ext}`;
}

export function projectPictureKey(projectId: string, ext: string): string {
  return `projects/${projectId}/picture.${ext}`;
}

export function profileAvatarKey(userId: string, ext: string): string {
  return `users/${userId}/avatar.${ext}`;
}
