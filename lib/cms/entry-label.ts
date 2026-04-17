/**
 * Human-readable label for list views, breadcrumbs, and server actions.
 * Uses common field names first, then the first non-empty string in `data`.
 */
export function deriveEntryDisplayTitle(data: Record<string, unknown>): string {
  const pick = (key: string): string | null => {
    const v = data[key]
    return typeof v === "string" && v.trim() ? v.trim() : null
  }

  return (
    pick("title") ??
    pick("name") ??
    pick("label") ??
    (() => {
      for (const v of Object.values(data)) {
        if (typeof v === "string" && v.trim()) return v.trim()
      }
      return null
    })() ??
    "Untitled"
  )
}
