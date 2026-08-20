import { describe, expect, it } from "vitest";

import {
  TARGETING_ATTRIBUTE_KEYS,
  isCountryAttribute,
  isListOperator,
  isPresetAttribute,
  parseCountryCodeList,
  parseSingleCountryCode,
  serializeCountryCodes,
} from "@/lib/targeting-attributes";

describe("targeting attribute presets", () => {
  it("includes evaluate/docs attributes", () => {
    expect(TARGETING_ATTRIBUTE_KEYS).toEqual([
      "userId",
      "country",
      "email",
      "appVersion",
      "plan",
      "region",
      "city",
      "signupAt",
    ]);
  });

  it("matches preset keys exactly", () => {
    expect(isPresetAttribute("country")).toBe(true);
    expect(isPresetAttribute(" userId ")).toBe(true);
    expect(isPresetAttribute("Country")).toBe(false);
    expect(isPresetAttribute("countryCode")).toBe(false);
  });

  it("treats only country as the geo value picker", () => {
    expect(isCountryAttribute("country")).toBe(true);
    expect(isCountryAttribute(" region ")).toBe(false);
    expect(isListOperator("in")).toBe(true);
    expect(isListOperator("eq")).toBe(false);
  });
});

describe("country code parse/serialize", () => {
  it("stores uppercase ISO 3166-1 alpha-2", () => {
    expect(parseSingleCountryCode("FR")).toBe("FR");
    expect(parseSingleCountryCode("fr")).toBe("FR");
    expect(parseSingleCountryCode('"FR"')).toBe("FR");
    expect(parseSingleCountryCode("  es ")).toBe("ES");
    expect(serializeCountryCodes(["fr"], false)).toBe("FR");
  });

  it("rejects non-codes on single-value fields", () => {
    expect(parseSingleCountryCode("")).toBeNull();
    expect(parseSingleCountryCode("France")).toBeNull();
    expect(parseSingleCountryCode('["FR"]')).toBeNull();
  });

  it("serializes in/not_in as a JSON array of uppercase codes", () => {
    expect(parseCountryCodeList('["fr","ES","fr"]')).toEqual(["FR", "ES"]);
    expect(parseCountryCodeList("FR")).toEqual(["FR"]);
    expect(serializeCountryCodes(["fr", "es", "FR"], true)).toBe('["FR","ES"]');
    expect(serializeCountryCodes([], true)).toBe("[]");
  });
});
