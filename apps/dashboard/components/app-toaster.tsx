"use client";

import type { ReactNode } from "react";
import { ToastProvider, Toaster } from "@appica/ui-react/toast";

import { toastManager } from "@/lib/toast";

export function AppToaster({ children }: { children: ReactNode }) {
  return (
    <ToastProvider toastManager={toastManager}>
      {children}
      <Toaster position="bottom-right" />
    </ToastProvider>
  );
}
