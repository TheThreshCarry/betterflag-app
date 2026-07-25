"use client";

import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  InfoIcon,
  XIcon,
} from "lucide-react";
import { createToastManager } from "@appica/ui-react/toast";

import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info" | "warning";

type ToastData = { icon?: ReactNode };

export const toastManager = createToastManager<ToastData>();

const ICON_SURFACE: Record<ToastKind, string> = {
  success: "bg-[var(--success-emphasis)] text-[var(--success-foreground)]",
  error: "bg-[var(--error-emphasis)] text-[var(--error-foreground)]",
  info: "bg-[var(--info-emphasis)] text-[var(--info-foreground)]",
  warning: "bg-[var(--warning-emphasis)] text-[var(--warning-foreground)]",
};

/** Solid status circle — white glyph on kind color (matches toast ref). */
function StatusIcon({ kind, children }: { kind: ToastKind; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm",
        ICON_SURFACE[kind],
      )}
    >
      {children}
    </span>
  );
}

type ToastInput = {
  title: string;
  description?: ReactNode;
  timeout?: number;
};

/** Flag key + quieter “in {env} environment” (toast description is already muted). */
export function flagEnvDescription(flagKey: string, envSlug: string): ReactNode {
  return (
    <>
      <span className="font-mono text-[var(--foreground)]">{flagKey}</span>
      <span className="text-[var(--foreground-subtle)]">
        {" "}
        · in {envSlug} environment
      </span>
    </>
  );
}

function add(kind: ToastKind, { title, description, timeout }: ToastInput, icon: ReactNode) {
  return toastManager.add({
    type: kind,
    title,
    description,
    timeout,
    priority: kind === "error" || kind === "warning" ? "high" : "low",
    data: {
      icon: <StatusIcon kind={kind}>{icon}</StatusIcon>,
    },
  });
}

export const toast = {
  success(input: ToastInput) {
    return add("success", input, <CheckIcon className="size-4" strokeWidth={2.5} aria-hidden />);
  },

  error(input: ToastInput) {
    return add("error", input, <XIcon className="size-4" strokeWidth={2.5} aria-hidden />);
  },

  info(input: ToastInput) {
    return add("info", input, <InfoIcon className="size-4" strokeWidth={2.5} aria-hidden />);
  },

  warning(input: ToastInput) {
    return add(
      "warning",
      input,
      <AlertTriangleIcon className="size-4" strokeWidth={2.5} aria-hidden />,
    );
  },

  /** Clipboard confirm — success kind. */
  copied(description = "Copied to clipboard") {
    return add(
      "success",
      { title: "Copied", description, timeout: 2500 },
      <CopyIcon className="size-4" strokeWidth={2.5} aria-hidden />,
    );
  },
};
