"use client";

import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, ErrorNote, Spinner } from "@/components/ui";
import { ApiClientError } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

type PendingAction = "upload" | "remove" | null;

export function ImageUploadField({
  label,
  description,
  imageUrl,
  canEdit,
  busy,
  onUpload,
  onRemove,
  className,
}: {
  label: string;
  description?: string;
  imageUrl: string | null;
  canEdit: boolean;
  busy?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const working = busy || pending !== null;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Drop local preview once parent gets a new remote URL (successful upload).
  const prevImageUrl = useRef(imageUrl);
  useEffect(() => {
    if (prevImageUrl.current === imageUrl) return;
    prevImageUrl.current = imageUrl;
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [imageUrl, previewUrl]);

  async function run(action: PendingAction, fn: () => Promise<void>) {
    setError(null);
    setPending(action);
    try {
      await fn();
    } catch (err) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed",
      );
    } finally {
      setPending(null);
    }
  }

  const displayUrl = previewUrl ?? imageUrl;
  const uploading = pending === "upload";
  const removing = pending === "remove";

  return (
    <div className={cn("flex items-start gap-4", className)} aria-busy={working || undefined}>
      <div
        className={cn(
          "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-canvas",
          !displayUrl && "text-ink-muted",
        )}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external media CDN / object URL
          <img
            src={displayUrl}
            alt=""
            className={cn(
              "size-full object-cover transition-opacity duration-200",
              working && "opacity-40",
            )}
          />
        ) : (
          <ImageIcon
            className={cn("size-5 transition-opacity duration-200", working && "opacity-40")}
            aria-hidden
          />
        )}
        {working ? (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/40">
            <Spinner size={18} className="text-ink" />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[12px] text-ink-muted">{description}</p>
        ) : null}
        {canEdit ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={working}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(file));
                void run("upload", () => onUpload(file));
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              disabled={working}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon className="size-3.5" aria-hidden />
              {uploading ? "Uploading…" : imageUrl || previewUrl ? "Replace" : "Upload"}
            </Button>
            {imageUrl || previewUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={removing}
                disabled={working}
                onClick={() => {
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                  void run("remove", () => onRemove());
                }}
              >
                <Trash2Icon className="size-3.5" aria-hidden />
                {removing ? "Removing…" : "Remove"}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-ink-muted">
            {imageUrl ? "Only owners and admins can change this." : "No image set."}
          </p>
        )}
        {error ? (
          <div className="mt-2">
            <ErrorNote message={error} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
