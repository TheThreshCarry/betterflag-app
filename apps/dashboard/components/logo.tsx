import Link from "next/link";
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
  const svg = (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 155 155"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="154.69" height="154.69" rx="43.2963" fill="#222222" />
      <path
        d="M67.7248 84.8159L121.298 76.5131L113.229 105.881L44.8111 117.822L33.8384 90.0677L67.7248 84.8159ZM67.7248 84.8159V72.9631M67.7248 72.9631V30.6858L99.3521 61.9904L67.7248 72.9631Z"
        stroke="white"
        strokeWidth="5.88494"
        strokeLinejoin="round"
      />
    </svg>
  );

  const icon = asLink ? (
    <Link href={href} className={cn(logoVariants({ size }))} aria-label="ShipOS home">
      {svg}
    </Link>
  ) : (
    <div className={cn(logoVariants({ size }))}>{svg}</div>
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
            textClassName,
          )}
        >
          ShipOS
        </span>
      ) : null}
    </div>
  );
}
