import Link from "next/link";
import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const logoVariants = cva("relative shrink-0", {
  variants: {
    size: {
      xs: "size-6",
      sm: "size-8",
      default: "size-10",
      lg: "size-12",
      xl: "size-20",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface LogoProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof logoVariants> {
  showText?: boolean;
  textClassName?: string;
  href?: string;
  asLink?: boolean;
}

export function Logo({
  className,
  size = "default",
  showText = false,
  textClassName,
  href = "/flags",
  asLink = true,
  ...props
}: LogoProps) {
  // The metal flag centered in the dark rounded box: the only way the mark ships.
  const mark = (
    <span
      aria-hidden
      className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[28%]"
      style={{ background: "linear-gradient(180deg, #19191B 0%, #060607 100%)" }}
    >
      <Image
        src="/brand/betterflag-mark-liquidmetal.png"
        alt=""
        width={482}
        height={289}
        className="h-auto w-[42%]"
        priority
      />
    </span>
  );

  const icon = asLink ? (
    <Link href={href} className={cn(logoVariants({ size }))} aria-label="Betterflag home">
      {mark}
    </Link>
  ) : (
    <div className={cn(logoVariants({ size }))}>{mark}</div>
  );

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} {...props}>
      {icon}
      {showText ? (
        <span
          className={cn(
            "font-semibold tracking-[-0.01em]",
            size === "xs" && "text-sm",
            size === "sm" && "text-[17px]",
            size === "default" && "text-lg",
            size === "lg" && "text-xl",
            size === "xl" && "text-2xl",
            textClassName,
          )}
        >
          Betterflag
        </span>
      ) : null}
    </div>
  );
}
