import { describe, it, expect } from "vitest";
import {
  getFieldRequirements,
  buildZodSchema,
  buildFieldSchema,
  validateEntryData,
  coerceFieldValues,
} from "@/lib/cms/schema-validation";
import type { SchemaField } from "@/lib/cms/types";

function field(overrides: Partial<SchemaField>): SchemaField {
  return {
    uid: "f_test",
    name: "testField",
    type: "text",
    ...overrides,
  };
}

describe("getFieldRequirements", () => {
  it("returns Required for required fields", () => {
    const reqs = getFieldRequirements(field({ required: true }));
    expect(reqs).toContain("Required");
  });

  it("returns min/max length for text fields", () => {
    const reqs = getFieldRequirements(
      field({ validation: { minLength: 2, maxLength: 100 } })
    );
    expect(reqs).toContain("Min 2 characters");
    expect(reqs).toContain("Max 100 characters");
  });

  it("returns pattern hint for text with pattern", () => {
    const reqs = getFieldRequirements(
      field({ validation: { pattern: "^[a-z]+$" } })
    );
    expect(reqs).toContain("Must match pattern");
  });

  it("returns email format for email type", () => {
    const reqs = getFieldRequirements(field({ type: "email" }));
    expect(reqs).toContain("Valid email format");
  });

  it("returns URL hint for url type", () => {
    const reqs = getFieldRequirements(field({ type: "url" }));
    expect(reqs).toContain("Valid URL");
  });

  it("returns min/max for number types", () => {
    const reqs = getFieldRequirements(
      field({ type: "number", validation: { min: 0, max: 100 } })
    );
    expect(reqs).toContain("Min: 0");
    expect(reqs).toContain("Max: 100");
  });

  it("returns Whole number for integer type", () => {
    const reqs = getFieldRequirements(field({ type: "integer" }));
    expect(reqs).toContain("Whole number");
  });

  it("returns date range for date types", () => {
    const reqs = getFieldRequirements(
      field({ type: "date", validation: { minDate: "2024-01-01", maxDate: "2025-12-31" } })
    );
    expect(reqs).toContain("From 2024-01-01");
    expect(reqs).toContain("Until 2025-12-31");
  });

  it("returns options count for enum", () => {
    const reqs = getFieldRequirements(
      field({ type: "enum", config: { options: ["a", "b", "c", "d", "e"] } })
    );
    expect(reqs.some((r) => r.includes("a, b, c"))).toBe(true);
  });

  it("returns Valid JSON for json type", () => {
    const reqs = getFieldRequirements(field({ type: "json" }));
    expect(reqs).toContain("Valid JSON");
  });

  it("returns item limits for media/relation/repeater", () => {
    const reqs = getFieldRequirements(
      field({ type: "media", validation: { minItems: 1, maxItems: 5 } })
    );
    expect(reqs).toContain("Min 1 items");
    expect(reqs).toContain("Max 5 items");
  });
});

describe("buildFieldSchema", () => {
  it("builds required text schema", () => {
    const schema = buildFieldSchema(field({ required: true }));
    expect(schema.safeParse("hello").success).toBe(true);
    expect(schema.safeParse("").success).toBe(false);
  });

  it("builds optional text schema", () => {
    const schema = buildFieldSchema(field({ required: false }));
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it("builds email schema", () => {
    const schema = buildFieldSchema(field({ type: "email", required: true }));
    expect(schema.safeParse("user@example.com").success).toBe(true);
    expect(schema.safeParse("not-an-email").success).toBe(false);
  });

  it("builds url schema", () => {
    const schema = buildFieldSchema(field({ type: "url", required: true }));
    expect(schema.safeParse("https://example.com").success).toBe(true);
    expect(schema.safeParse("not-a-url").success).toBe(false);
  });

  it("builds number schema with min/max", () => {
    const schema = buildFieldSchema(
      field({ type: "number", required: true, validation: { min: 0, max: 100 } })
    );
    expect(schema.safeParse(50).success).toBe(true);
    expect(schema.safeParse(-1).success).toBe(false);
    expect(schema.safeParse(101).success).toBe(false);
  });

  it("builds integer schema rejecting floats", () => {
    const schema = buildFieldSchema(field({ type: "integer", required: true }));
    expect(schema.safeParse(5).success).toBe(true);
    expect(schema.safeParse(5.5).success).toBe(false);
  });

  it("builds boolean schema", () => {
    const schema = buildFieldSchema(field({ type: "boolean", required: true }));
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse(false).success).toBe(true);
    expect(schema.safeParse("yes").success).toBe(false);
  });

  it("builds enum schema with allowed values", () => {
    const schema = buildFieldSchema(
      field({ type: "enum", required: true, config: { options: ["a", "b", "c"] } })
    );
    expect(schema.safeParse("a").success).toBe(true);
    expect(schema.safeParse("z").success).toBe(false);
  });

  it("builds json schema accepting valid JSON", () => {
    const schema = buildFieldSchema(field({ type: "json", required: false }));
    expect(schema.safeParse({ key: "val" }).success).toBe(true);
    expect(schema.safeParse('{"key":"val"}').success).toBe(true);
  });
});

describe("buildZodSchema", () => {
  it("builds composite schema from multiple fields", () => {
    const fields: SchemaField[] = [
      field({ uid: "1", name: "title", type: "text", required: true }),
      field({ uid: "2", name: "count", type: "integer", required: false }),
    ];
    const schema = buildZodSchema(fields);
    expect(schema.safeParse({ title: "hello" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("validateEntryData", () => {
  const fields: SchemaField[] = [
    field({ uid: "1", name: "title", type: "text", required: true }),
    field({ uid: "2", name: "email", type: "email", required: true }),
  ];

  it("returns success for valid data", () => {
    const result = validateEntryData(fields, {
      title: "Hello",
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("returns errors for invalid data", () => {
    const result = validateEntryData(fields, { title: "", email: "bad" });
    expect(result.success).toBe(false);
    expect(result.errors.title).toBeDefined();
    expect(result.errors.email).toBeDefined();
  });
});

describe("coerceFieldValues", () => {
  it("coerces string numbers to numbers", () => {
    const fields = [field({ name: "count", type: "number" })];
    const result = coerceFieldValues(fields, { count: "42" });
    expect(result.count).toBe(42);
  });

  it("coerces to null for NaN", () => {
    const fields = [field({ name: "count", type: "number" })];
    const result = coerceFieldValues(fields, { count: "not-a-number" });
    expect(result.count).toBeNull();
  });

  it("coerces boolean values", () => {
    const fields = [field({ name: "active", type: "boolean" })];
    expect(coerceFieldValues(fields, { active: 1 }).active).toBe(true);
    expect(coerceFieldValues(fields, { active: 0 }).active).toBe(false);
  });

  it("parses JSON strings for json fields", () => {
    const fields = [field({ name: "meta", type: "json" })];
    const result = coerceFieldValues(fields, { meta: '{"a":1}' });
    expect(result.meta).toEqual({ a: 1 });
  });

  it("handles empty/null/undefined for optional fields", () => {
    const fields = [field({ name: "opt", type: "text", required: false })];
    expect(coerceFieldValues(fields, { opt: "" }).opt).toBeNull();
    expect(coerceFieldValues(fields, { opt: null }).opt).toBeNull();
    expect(coerceFieldValues(fields, { opt: undefined }).opt).toBeNull();
  });

  it("sets undefined for empty required fields", () => {
    const fields = [field({ name: "req", type: "text", required: true })];
    expect(coerceFieldValues(fields, { req: "" }).req).toBeUndefined();
  });
});
