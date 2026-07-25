"use client";

/** Shared UI primitives — Appica under ShipOS DESIGN.md API. */

import { useEffect, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@appica/ui-react/alert";
import { Button as AppicaButton } from "@appica/ui-react/button";
import { Chip as AppicaChip } from "@appica/ui-react/chip";
import { CopyButton as AppicaCopyButton } from "@appica/ui-react/copy-button";
import {
  Dialog as AppicaDialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@appica/ui-react/dialog";
import {
  Field as AppicaField,
  FieldDescription,
  FieldLabel,
} from "@appica/ui-react/field";
import { Spinner as AppicaSpinner } from "@appica/ui-react/spinner";
import { Switch } from "@appica/ui-react/switch";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type ChipColor = "blue" | "pink" | "green" | "orange" | "gray";

const CHIP_CLASSES: Record<ChipColor, string> = {
  blue: "bg-chip-blue/10 text-chip-blue border-transparent",
  pink: "bg-chip-pink/10 text-chip-pink border-transparent",
  green: "bg-chip-green/10 text-chip-green border-transparent",
  orange: "bg-chip-orange/10 text-chip-orange border-transparent",
  gray: "bg-chip-gray/10 text-chip-gray border-transparent",
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
    <AppicaChip
      variant="soft"
      size="sm"
      title={title}
      render={<span />}
      className={cn(
        "inline-flex cursor-default items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium",
        CHIP_CLASSES[color],
        className,
      )}
    >
      {children}
    </AppicaChip>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANT_MAP: Record<
  ButtonVariant,
  "primary" | "outline" | "destructive" | "ghost"
> = {
  primary: "primary",
  secondary: "outline",
  danger: "destructive",
  ghost: "ghost",
};

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <AppicaSpinner
      currentColor
      className={cn(className)}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: Omit<React.ComponentProps<typeof AppicaButton>, "variant" | "size"> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <AppicaButton
      type={type}
      variant={BUTTON_VARIANT_MAP[variant]}
      size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(loading && "cursor-wait", className)}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? 14 : 16} /> : children}
    </AppicaButton>
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
    <div
      className={cn(
        "rounded-3xl border border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Compat class for native inputs until call sites move to Appica Input. */
export const inputClass =
  "h-10 w-full rounded-xl border border-line bg-canvas px-3.5 text-[14px] text-ink placeholder:text-ink-muted/60 outline-none focus:border-line-strong";

export const textareaClass =
  "w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[13px] font-mono text-ink placeholder:text-ink-muted/60 outline-none focus:border-line-strong";

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
    <AppicaField className="block gap-0">
      <FieldLabel className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </FieldLabel>
      {children}
      {hint ? (
        <FieldDescription className="mt-1 block text-[12px] text-ink-muted">
          {hint}
        </FieldDescription>
      ) : null}
    </AppicaField>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AppicaDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        closeButton
        className={cn(
          "max-h-[85vh] overflow-y-auto rounded-3xl border border-line bg-canvas p-6 shadow-[0_12px_48px_rgba(0,0,0,0.09)]",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-[20px] font-semibold tracking-[-0.01em]">
            {title}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="p-0">{children}</DialogBody>
      </DialogContent>
    </AppicaDialog>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(checked && "data-checked:bg-chip-green")}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-8 py-14 text-center">
      <h3 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h3>
      {body ? <p className="max-w-sm text-[14px] text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="error" layout="inline" className="rounded-xl px-4 py-2.5 text-[13px] font-medium">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <AppicaCopyButton
      value={text}
      label={label}
      copiedLabel="Copied"
      variant="outline"
      size="sm"
      onCopy={() => toast.copied()}
    />
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
  return new Date(iso).toLocaleDateString();
}

export function RelativeTime({ iso }: { iso: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} suppressHydrationWarning>
      {formatRelative(iso)}
    </time>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-xl border border-line bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
