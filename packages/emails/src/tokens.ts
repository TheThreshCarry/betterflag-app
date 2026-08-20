/**
 * Betterflag email design tokens. Mirrors apps/dashboard/app/globals.css and the
 * original hand-rolled templates so the React Email output stays pixel-faithful
 * to what customers already receive.
 */
export const TOKENS = {
  ink: "#171717",
  muted: "#737373",
  faint: "#a3a3a3",
  line: "#e8e4de",
  canvas: "#f4f3f1",
  surface: "#f6f5f3",
  orange: "#ff5a1a",
  badgeDark: "#222222",
  terminalBar: "#21252b",
  terminalBody: "#16181d",
  green: "#00bc72",
} as const;

export const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export const APP_URL = "https://dashboard.betterflag.app";

export const FROM_ADDRESS = {
  email: "hi@betterflag.app",
  name: "Mehdi from Betterflag",
} as const;
