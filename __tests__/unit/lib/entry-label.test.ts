import { describe, expect, it } from "vitest"
import { deriveEntryDisplayTitle } from "@/lib/cms/entry-label"

describe("deriveEntryDisplayTitle", () => {
  it("prefers title then name then first string", () => {
    expect(deriveEntryDisplayTitle({ title: " A ", name: "B" })).toBe("A")
    expect(deriveEntryDisplayTitle({ name: "N" })).toBe("N")
    expect(deriveEntryDisplayTitle({ x: "only" })).toBe("only")
  })

  it("returns Untitled when empty", () => {
    expect(deriveEntryDisplayTitle({})).toBe("Untitled")
  })
})
