"use client";

import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button, ErrorNote } from "@/components/ui";
import { ApiClientError } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

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
  const [localBusy, setLocalBusy] = useState(false);
  const working = busy || localBusy;

  async function run(action: () => Promise<void>) {
    setError(null);
    setLocalBusy(true);
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed",
      );
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <div className={cn("flex items-start gap-4", className)}>
      <div
        className={cn(
          "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-canvas",
          !imageUrl && "text-ink-muted",
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external media CDN URL
          <img src={imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5" aria-hidden />
        )}
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
                void run(() => onUpload(file));
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={working}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon className="size-3.5" aria-hidden />
              {imageUrl ? "Replace" : "Upload"}
            </Button>
            {imageUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={working}
                onClick={() => void run(() => onRemove())}
              >
                <Trash2Icon className="size-3.5" aria-hidden />
                Remove
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
