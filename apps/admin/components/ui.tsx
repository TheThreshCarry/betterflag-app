"use client";

/** Shared UI primitives per DESIGN.md, ported from the dashboard app. */

import { useEffect, useState, type ReactNode } from "react";

export type ChipColor = "blue" | "pink" | "green" | "orange" | "gray";

const CHIP_CLASSES: Record<ChipColor, string> = {
  blue: "bg-chip-blue/10 text-chip-blue",
  pink: "bg-chip-pink/10 text-chip-pink",
  green: "bg-chip-green/10 text-chip-green",
  orange: "bg-chip-orange/10 text-chip-orange",
  gray: "bg-chip-gray/10 text-chip-gray",
};

export function Chip({
  color,
  children,
  className = "",
  title,
}: {
  color: ChipColor;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium ${CHIP_CLASSES[color]} ${className}`}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40",
  secondary: "bg-transparent border border-line text-ink hover:bg-surface disabled:opacity-40",
  danger: "bg-chip-pink/10 text-chip-pink hover:bg-chip-pink/20 disabled:opacity-40",
  ghost: "bg-transparent text-ink-muted hover:bg-surface hover:text-ink disabled:opacity-40",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  const sizing =
    size === "lg"
      ? "h-12 px-7 text-[15px]"
      : size === "sm"
        ? "h-8 px-3.5 text-[13px]"
        : "h-10 px-5 text-[14px]";
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-colors ${sizing} ${BUTTON_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl border border-line bg-surface ${className}`}>{children}</div>
  );
}

export const inputClass =
  "h-10 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] text-ink placeholder:text-ink-muted/60 outline-none focus:border-line-strong";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-white p-6 shadow-[0_12px_48px_rgba(0,0,0,0.09)]">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-muted hover:bg-surface hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-8 py-14 text-center">
      <h3 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h3>
      {body ? <p className="max-w-sm text-[14px] text-ink-muted">{body}</p> : null}
    </Card>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-xl bg-chip-pink/10 px-4 py-2.5 text-[13px] font-medium text-chip-pink">
      {message}
    </div>
  );
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

export function RelativeTime({ iso }: { iso: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString("en-US")} suppressHydrationWarning>
      {formatRelative(iso)}
    </time>
  );
}
