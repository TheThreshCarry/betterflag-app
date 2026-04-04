import { describe, it, expect } from "vitest";
import {
  classifyTypeChange,
  diffSchemas,
  getMaxSeverity,
  hasDestructiveChanges,
  hasRiskyChanges,
  groupChangesBySeverity,
} from "@/lib/cms/schema-diff";
import type { SchemaField, SchemaChange } from "@/lib/cms/types";

function field(overrides: Partial<SchemaField>): SchemaField {
  return {
    uid: "f_1",
    name: "field1",
    type: "text",
    ...overrides,
  };
}

describe("classifyTypeChange", () => {
  it("returns safe for same type", () => {
    expect(classifyTypeChange("text", "text")).toBe("safe");
  });

  it("returns safe for safe transitions", () => {
    expect(classifyTypeChange("integer", "float")).toBe("safe");
    expect(classifyTypeChange("text", "richtext")).toBe("safe");
    expect(classifyTypeChange("date", "datetime")).toBe("safe");
    expect(classifyTypeChange("text", "email")).toBe("safe");
    expect(classifyTypeChange("text", "url")).toBe("safe");
    expect(classifyTypeChange("text", "enum")).toBe("safe");
  });

  it("returns risky for risky transitions", () => {
    expect(classifyTypeChange("text", "number")).toBe("risky");
    expect(classifyTypeChange("text", "boolean")).toBe("risky");
    expect(classifyTypeChange("float", "integer")).toBe("risky");
    expect(classifyTypeChange("richtext", "text")).toBe("risky");
  });

  it("returns destructive for destructive transitions", () => {
    expect(classifyTypeChange("json", "text")).toBe("destructive");
    expect(classifyTypeChange("repeater", "text")).toBe("destructive");
    expect(classifyTypeChange("media", "text")).toBe("destructive");
    expect(classifyTypeChange("richtext", "boolean")).toBe("destructive");
  });

  it("defaults to risky for unknown transitions", () => {
    expect(classifyTypeChange("boolean", "json")).toBe("risky");
  });
});

describe("diffSchemas", () => {
  it("detects removed fields", () => {
    const old = [field({ uid: "a", name: "a" })];
    const changes = diffSchemas(old, []);
    expect(changes).toHaveLength(1);
    expect(changes[0].action).toBe("remove");
    expect(changes[0].severity).toBe("destructive");
  });

  it("detects added optional fields as safe", () => {
    const changes = diffSchemas([], [field({ uid: "a", name: "a", required: false })]);
    expect(changes).toHaveLength(1);
    expect(changes[0].action).toBe("add");
    expect(changes[0].severity).toBe("safe");
  });

  it("detects added required fields as risky", () => {
    const changes = diffSchemas([], [field({ uid: "a", name: "a", required: true })]);
    expect(changes).toHaveLength(1);
    expect(changes[0].action).toBe("add");
    expect(changes[0].severity).toBe("risky");
  });

  it("detects type changes", () => {
    const old = [field({ uid: "a", name: "a", type: "text" })];
    const next = [field({ uid: "a", name: "a", type: "number" })];
    const changes = diffSchemas(old, next);
    const typeChange = changes.find((c) => c.action === "typeChange");
    expect(typeChange).toBeDefined();
    expect(typeChange?.fromType).toBe("text");
    expect(typeChange?.toType).toBe("number");
  });

  it("detects validation changes", () => {
    const old = [field({ uid: "a", name: "a", validation: { minLength: 1 } })];
    const next = [field({ uid: "a", name: "a", validation: { minLength: 5 } })];
    const changes = diffSchemas(old, next);
    expect(changes.some((c) => c.action === "validationChange")).toBe(true);
  });

  it("detects config changes", () => {
    const old = [field({ uid: "a", name: "a", type: "enum", config: { options: ["x"] } })];
    const next = [field({ uid: "a", name: "a", type: "enum", config: { options: ["x", "y"] } })];
    const changes = diffSchemas(old, next);
    expect(changes.some((c) => c.action === "configChange")).toBe(true);
  });

  it("detects reorder", () => {
    const a = field({ uid: "a", name: "a" });
    const b = field({ uid: "b", name: "b" });
    const changes = diffSchemas([a, b], [b, a]);
    expect(changes.some((c) => c.action === "reorder")).toBe(true);
  });

  it("returns empty for identical schemas", () => {
    const f = field({ uid: "a", name: "a" });
    expect(diffSchemas([f], [f])).toEqual([]);
  });
});

describe("severity helpers", () => {
  const changes: SchemaChange[] = [
    { action: "add", field: "x", severity: "safe" },
    { action: "remove", field: "y", severity: "destructive" },
    { action: "typeChange", field: "z", severity: "risky" },
  ];

  it("getMaxSeverity returns the highest severity", () => {
    expect(getMaxSeverity(changes)).toBe("destructive");
    expect(getMaxSeverity([changes[0]])).toBe("safe");
    expect(getMaxSeverity([changes[2]])).toBe("risky");
  });

  it("hasDestructiveChanges returns true when present", () => {
    expect(hasDestructiveChanges(changes)).toBe(true);
    expect(hasDestructiveChanges([changes[0]])).toBe(false);
  });

  it("hasRiskyChanges returns true when present", () => {
    expect(hasRiskyChanges(changes)).toBe(true);
    expect(hasRiskyChanges([changes[0]])).toBe(false);
  });

  it("groupChangesBySeverity groups correctly", () => {
    const grouped = groupChangesBySeverity(changes);
    expect(grouped.safe).toHaveLength(1);
    expect(grouped.risky).toHaveLength(1);
    expect(grouped.destructive).toHaveLength(1);
  });
});
