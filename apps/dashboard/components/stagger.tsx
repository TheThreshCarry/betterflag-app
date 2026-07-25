"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import { staggerStyle } from "@/lib/stagger";
import { cn } from "@/lib/utils";

type StaggerChildProps = {
  className?: string;
  style?: CSSProperties;
  /** Child owns its own stagger chain (e.g. DataTable). Receives `staggerFrom`. */
  staggerSelf?: boolean;
  staggerFrom?: number;
};

/**
 * Top-to-bottom entrance: first child animates first, then each sibling +STAGGER_STEP_MS.
 * Pass `staggerSelf` on a child (DataTable) so it continues the chain internally
 * instead of animating as one opaque block.
 */
export function Stagger({
  children,
  className,
  from = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Starting stagger index (default 0). */
  from?: number;
}) {
  const items = Children.toArray(children).filter((child) => child != null);

  const content = items.map((child, index) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<StaggerChildProps>;
    const staggerIndex = from + index;

    if (el.props.staggerSelf) {
      return cloneElement(el, { staggerFrom: staggerIndex });
    }

    // DOM nodes can take className/style directly.
    if (typeof el.type === "string") {
      return cloneElement(el, {
        className: cn(el.props.className, "stagger-in"),
        style: { ...el.props.style, ...staggerStyle(staggerIndex) },
      });
    }

    // Custom components: wrap so animation always applies.
    return (
      <div
        key={el.key ?? `stagger-${staggerIndex}`}
        className="stagger-in"
        style={staggerStyle(staggerIndex)}
      >
        {child}
      </div>
    );
  });

  if (className) {
    return <div className={className}>{content}</div>;
  }
  return <>{content}</>;
}
