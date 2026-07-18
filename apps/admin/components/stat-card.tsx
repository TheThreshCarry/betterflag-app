import type { ReactNode } from "react";

/** Hero-number tile: label above, mono value, optional context line. */
export function StatCard({
  label,
  value,
  hint,
  chip,
}: {
  label: string;
  value: string;
  hint?: string;
  chip?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-6 py-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        {chip}
      </div>
      <p className="mt-2 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">
        {value}
      </p>
      {hint ? <p className="mt-2 text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** Section wrapper: eyebrow-style title over a white panel. */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
