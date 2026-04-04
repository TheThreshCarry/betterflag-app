import { describe, it, expect } from "vitest";
import {
  validateFieldName,
  addField,
  updateField,
  removeField,
  moveFieldUp,
  moveFieldDown,
  createFieldTemplate,
  createEmptySchema,
  toSchemaJson,
  isLegacySchema,
  isV2Schema,
  migrateLegacySchema,
  parseSchemaFields,
  getFieldLabel,
  getFieldSummary,
  getStatusBadgeVariant,
} from "@/lib/cms/schema-utils";
import type { SchemaField, LegacySchema } from "@/lib/cms/types";

function makeField(overrides: Partial<SchemaField> = {}): SchemaField {
  return {
    uid: overrides.uid ?? "f_1",
    name: overrides.name ?? "title",
    type: overrides.type ?? "text",
    ...overrides,
  };
}

describe("validateFieldName", () => {
  const existing = [makeField({ uid: "f_1", name: "title" })];

  it("returns null for valid names", () => {
    expect(validateFieldName("description", existing)).toBeNull();
  });

  it("rejects empty names", () => {
    expect(validateFieldName("", existing)).toBe("Name is required");
    expect(validateFieldName("  ", existing)).toBe("Name is required");
  });

  it("rejects names not starting with lowercase letter", () => {
    expect(validateFieldName("Title", existing)).toMatch(/lowercase/);
    expect(validateFieldName("1abc", existing)).toMatch(/lowercase/);
  });

  it("rejects reserved names", () => {
    expect(validateFieldName("id", [])).toMatch(/reserved/);
    expect(validateFieldName("slug", [])).toMatch(/reserved/);
    expect(validateFieldName("createdAt", [])).toMatch(/reserved/);
  });

  it("rejects duplicate names (different uid)", () => {
    expect(validateFieldName("title", existing)).toMatch(/already exists/);
  });

  it("allows same name when uid matches (editing current field)", () => {
    expect(validateFieldName("title", existing, "f_1")).toBeNull();
  });
});

describe("field operations", () => {
  const a = makeField({ uid: "a", name: "a" });
  const b = makeField({ uid: "b", name: "b" });
  const c = makeField({ uid: "c", name: "c" });
  const fields = [a, b, c];

  it("addField appends by default", () => {
    const d = makeField({ uid: "d", name: "d" });
    const result = addField(fields, d);
    expect(result).toHaveLength(4);
    expect(result[3].uid).toBe("d");
  });

  it("addField inserts at position", () => {
    const d = makeField({ uid: "d", name: "d" });
    const result = addField(fields, d, 1);
    expect(result[1].uid).toBe("d");
  });

  it("updateField patches the matching field", () => {
    const result = updateField(fields, "b", { name: "beta" });
    expect(result[1].name).toBe("beta");
    expect(result[0].name).toBe("a");
  });

  it("removeField filters out the field", () => {
    const result = removeField(fields, "b");
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.uid)).toEqual(["a", "c"]);
  });

  it("moveFieldUp swaps with previous", () => {
    const result = moveFieldUp(fields, "b");
    expect(result.map((f) => f.uid)).toEqual(["b", "a", "c"]);
  });

  it("moveFieldUp on first element is no-op", () => {
    const result = moveFieldUp(fields, "a");
    expect(result.map((f) => f.uid)).toEqual(["a", "b", "c"]);
  });

  it("moveFieldDown swaps with next", () => {
    const result = moveFieldDown(fields, "b");
    expect(result.map((f) => f.uid)).toEqual(["a", "c", "b"]);
  });

  it("moveFieldDown on last element is no-op", () => {
    const result = moveFieldDown(fields, "c");
    expect(result.map((f) => f.uid)).toEqual(["a", "b", "c"]);
  });
});

describe("createFieldTemplate", () => {
  it("creates text field", () => {
    const f = createFieldTemplate("text");
    expect(f.type).toBe("text");
    expect(f.uid).toMatch(/^f_/);
    expect(f.name).toBe("");
    expect(f.required).toBe(false);
  });

  it("creates enum field with options config", () => {
    const f = createFieldTemplate("enum");
    expect(f.config?.options).toEqual([]);
  });

  it("creates repeater field with componentFields and validation", () => {
    const f = createFieldTemplate("repeater");
    expect(f.config?.componentFields).toEqual([]);
    expect(f.validation).toEqual({});
  });

  it("creates media field with defaults", () => {
    const f = createFieldTemplate("media");
    expect(f.config?.multiple).toBe(false);
    expect(f.config?.mediaSource).toBe("both");
  });
});

describe("schema format detection and migration", () => {
  it("createEmptySchema returns v2 format", () => {
    expect(createEmptySchema()).toEqual({ version: 2, fields: [] });
  });

  it("toSchemaJson wraps fields in v2 format", () => {
    const fields = [makeField()];
    const result = toSchemaJson(fields);
    expect(result.version).toBe(2);
    expect(result.fields).toBe(fields);
  });

  it("isV2Schema detects valid v2 schema", () => {
    expect(isV2Schema({ version: 2, fields: [] })).toBe(true);
  });

  it("isV2Schema rejects non-v2", () => {
    expect(isV2Schema({})).toBe(false);
    expect(isV2Schema(null)).toBe(false);
    expect(isV2Schema({ version: 1, fields: [] })).toBe(false);
  });

  it("isLegacySchema detects JSON-schema style", () => {
    const legacy: LegacySchema = {
      type: "object",
      properties: { title: { type: "string" } },
    };
    expect(isLegacySchema(legacy)).toBe(true);
  });

  it("isLegacySchema detects fields-object style", () => {
    const legacy: LegacySchema = {
      fields: { name: { type: "text" } },
    };
    expect(isLegacySchema(legacy)).toBe(true);
  });

  it("isLegacySchema returns false for v2", () => {
    expect(isLegacySchema({ version: 2, fields: [] })).toBe(false);
  });

  it("migrateLegacySchema converts to v2 with correct types", () => {
    const legacy: LegacySchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        count: { type: "integer" },
      },
      required: ["title"],
    };
    const result = migrateLegacySchema(legacy);
    expect(result.version).toBe(2);
    expect(result.fields).toHaveLength(2);

    const titleField = result.fields.find((f) => f.name === "title");
    expect(titleField?.type).toBe("text");
    expect(titleField?.required).toBe(true);

    const countField = result.fields.find((f) => f.name === "count");
    expect(countField?.type).toBe("integer");
    expect(countField?.required).toBe(false);
  });

  it("parseSchemaFields handles v2 schema", () => {
    const fields = [makeField()];
    expect(parseSchemaFields({ version: 2, fields })).toBe(fields);
  });

  it("parseSchemaFields handles legacy schema", () => {
    const result = parseSchemaFields({
      type: "object",
      properties: { name: { type: "text" } },
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("name");
  });

  it("parseSchemaFields returns empty for unknown format", () => {
    expect(parseSchemaFields(42)).toEqual([]);
    expect(parseSchemaFields(null)).toEqual([]);
  });
});

describe("display helpers", () => {
  it("getFieldLabel uses label if present", () => {
    expect(getFieldLabel(makeField({ label: "My Title" }))).toBe("My Title");
  });

  it("getFieldLabel falls back to formatted name", () => {
    expect(getFieldLabel(makeField({ name: "firstName" }))).toBe("First Name");
  });

  it("getFieldSummary includes key info", () => {
    const summary = getFieldSummary(
      makeField({ type: "text", required: true, validation: { minLength: 5 } })
    );
    expect(summary).toContain("text");
    expect(summary).toContain("required");
    expect(summary).toContain("min:5");
  });

  it("getStatusBadgeVariant maps statuses correctly", () => {
    expect(getStatusBadgeVariant("active")).toBe("default");
    expect(getStatusBadgeVariant("published")).toBe("default");
    expect(getStatusBadgeVariant("draft")).toBe("secondary");
    expect(getStatusBadgeVariant("deprecated")).toBe("outline");
    expect(getStatusBadgeVariant("archived")).toBe("outline");
    expect(getStatusBadgeVariant(null)).toBe("secondary");
    expect(getStatusBadgeVariant(undefined)).toBe("secondary");
  });
});
