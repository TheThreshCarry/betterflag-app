import { describe, expect, it } from "vitest"
import { parsePublicStoragePath } from "@/lib/supabase/storage-brand"

describe("parsePublicStoragePath", () => {
  it("returns object path when url matches bucket and prefix", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000"
    const url = `https://abc.supabase.co/storage/v1/object/public/avatars/${id}/123.jpg`
    expect(parsePublicStoragePath(url, "avatars", id)).toBe(`${id}/123.jpg`)
  })

  it("returns null for wrong prefix", () => {
    const url =
      "https://abc.supabase.co/storage/v1/object/public/avatars/other/123.jpg"
    expect(
      parsePublicStoragePath(url, "avatars", "550e8400-e29b-41d4-a716-446655440000")
    ).toBeNull()
  })

  it("returns null for wrong bucket", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000"
    const url = `https://abc.supabase.co/storage/v1/object/public/other/${id}/123.jpg`
    expect(parsePublicStoragePath(url, "avatars", id)).toBeNull()
  })
})
