"use client";

import {
  Skeleton as AppicaSkeleton,
  type SkeletonProps,
} from "@appica/ui-react/skeleton";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <AppicaSkeleton
      className={cn("bg-line-strong/45 text-ink-muted", className)}
      {...props}
    />
  );
}

export type { SkeletonProps };
