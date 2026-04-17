import type * as React from "react"

export const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 16px",
}

export const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#1a1a1a",
  margin: "0 0 24px",
  whiteSpace: "pre-line",
}

export const button = (bg: string = "#0f172a"): React.CSSProperties => ({
  backgroundColor: bg,
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  borderRadius: "8px",
  padding: "14px 28px",
  textDecoration: "none",
  display: "inline-block",
})

export const divider: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
}

export const secondary: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: "#6b7280",
  margin: 0,
  wordBreak: "break-all" as const,
}

export const link: React.CSSProperties = {
  color: "#3b82f6",
}

export const tokenBox: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
  fontSize: "20px",
  fontWeight: 700,
  letterSpacing: "4px",
  color: "#0f172a",
  backgroundColor: "#f3f4f6",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px 24px",
  textAlign: "center" as const,
  margin: "16px 0 24px",
}
