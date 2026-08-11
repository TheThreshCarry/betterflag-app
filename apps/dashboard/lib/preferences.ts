/** localStorage keys for client-only appearance prefs. */
export const THEME_STORAGE_KEY = "betterflag.theme";
export const DISABLE_ANIMATIONS_KEY = "betterflag.disableAnimations";

export type ThemePreference = "light" | "dark" | "system";

export function readDisableAnimations(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISABLE_ANIMATIONS_KEY) === "true";
  } catch {
    return false;
  }
}

/** Inline script — set `data-disable-animations` before paint (no motion flash). */
export const DISABLE_ANIMATIONS_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(DISABLE_ANIMATIONS_KEY)})==="true")document.documentElement.setAttribute("data-disable-animations","");}catch(e){}})();`;
