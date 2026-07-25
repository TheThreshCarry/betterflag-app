"use client";

import type { ReactNode } from "react";
import { ToastProvider, Toaster } from "@appica/ui-react/toast";

import { toastManager } from "@/lib/toast";

/**
 * Appica toast root: Provider wraps the app; Toaster portals the stack.
 * Portal is a full-viewport fixed layer so enter/exit transforms
 * (translateY 150%) never expand document scroll / shift the page.
 */
export function AppToaster({ children }: { children: ReactNode }) {
  return (
    <ToastProvider toastManager={toastManager}>
      {children}
      <Toaster
        position="bottom-right"
        portalProps={{
          className: "pointer-events-none fixed inset-0 z-50",
        }}
        className="pointer-events-none"
      />
    </ToastProvider>
  );
}
