"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ReducedMotionProvider } from "@appica/ui-react/providers/reduced-motion-provider";

import { DISABLE_ANIMATIONS_KEY, readDisableAnimations } from "@/lib/preferences";

/** Delay before stagger / entrance animations turn back on. */
const ENABLE_ANIMATIONS_DELAY_MS = 500;

type PreferencesContextValue = {
  /** Stored preference (drives the settings toggle). */
  disableAnimations: boolean;
  setDisableAnimations: (next: boolean) => void;
  /** False until client has read storage — guard preference UI. */
  mounted: boolean;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  disableAnimations: false,
  setDisableAnimations: () => {},
  mounted: false,
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [disableAnimations, setPreference] = useState(false);
  /** Applied to the DOM — lags preference by 500ms when turning animations on. */
  const [activeDisable, setActiveDisable] = useState(false);
  const [mounted, setMounted] = useState(false);
  const enableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEnableTimer = useCallback(() => {
    if (enableTimerRef.current != null) {
      clearTimeout(enableTimerRef.current);
      enableTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const stored = readDisableAnimations();
    setPreference(stored);
    setActiveDisable(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== DISABLE_ANIMATIONS_KEY) return;
      clearEnableTimer();
      const next = event.newValue === "true";
      setPreference(next);
      setActiveDisable(next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearEnableTimer]);

  useEffect(() => () => clearEnableTimer(), [clearEnableTimer]);

  const setDisableAnimations = useCallback(
    (next: boolean) => {
      setPreference(next);
      try {
        window.localStorage.setItem(DISABLE_ANIMATIONS_KEY, next ? "true" : "false");
      } catch {
        /* private mode / quota */
      }

      clearEnableTimer();

      if (next) {
        // Off immediately.
        setActiveDisable(true);
        return;
      }

      // On — wait so the toggle itself doesn't trigger entrance motion.
      enableTimerRef.current = setTimeout(() => {
        setActiveDisable(false);
        enableTimerRef.current = null;
      }, ENABLE_ANIMATIONS_DELAY_MS);
    },
    [clearEnableTimer],
  );

  const value = useMemo(
    () => ({ disableAnimations, setDisableAnimations, mounted }),
    [disableAnimations, setDisableAnimations, mounted],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <ReducedMotionProvider disableAnimations={activeDisable}>
        {children}
      </ReducedMotionProvider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
