import { COUNTRY_CENTROIDS } from "@/lib/country-centroids";

/**
 * Preset targeting attributes shown in the dashboard condition autocomplete.
 *
 * Evaluate special-cases only `userId` (top-level context). Everything else is
 * `context.attributes[attribute]`. `country` is injected at the edge from
 * Cloudflare `request.cf.country` (uppercase ISO 3166-1 alpha-2) when absent.
 */
export const TARGETING_ATTRIBUTES = [
  { key: "userId", hint: "Context userId" },
  { key: "country", hint: "ISO 3166-1 alpha-2, uppercase" },
  { key: "email", hint: "User email" },
  { key: "appVersion", hint: "Client semver" },
  { key: "plan", hint: "Plan or tier" },
  { key: "region", hint: "Region or state" },
  { key: "city", hint: "City name" },
  { key: "signupAt", hint: "Signup timestamp" },
] as const;

export type TargetingAttribute = (typeof TARGETING_ATTRIBUTES)[number];

export const TARGETING_ATTRIBUTE_KEYS: readonly string[] = TARGETING_ATTRIBUTES.map(
  (attribute) => attribute.key,
);

const PRESET_KEYS = new Set<string>(TARGETING_ATTRIBUTE_KEYS);

const ISO_CODE_RE = /^[A-Z]{2}$/;

const regionNames =
  typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

export type CountryOption = { code: string; name: string };

export function countryDisplayName(code: string): string {
  const upper = code.toUpperCase();
  if (!ISO_CODE_RE.test(upper)) return upper;
  try {
    return regionNames?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

export const COUNTRY_OPTIONS: CountryOption[] = Object.keys(COUNTRY_CENTROIDS)
  .sort()
  .map((code) => ({ code, name: countryDisplayName(code) }));

const COUNTRY_BY_CODE = new Map(COUNTRY_OPTIONS.map((country) => [country.code, country]));

export function isPresetAttribute(name: string): boolean {
  return PRESET_KEYS.has(name.trim());
}

export function isCountryAttribute(name: string): boolean {
  return name.trim() === "country";
}

export function isListOperator(op: string): boolean {
  return op === "in" || op === "not_in";
}

export function countryOption(code: string): CountryOption {
  const upper = code.toUpperCase();
  return COUNTRY_BY_CODE.get(upper) ?? { code: upper, name: countryDisplayName(upper) };
}

export function normalizeCountryCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return ISO_CODE_RE.test(code) ? code : null;
}

/** Single-value country fields: store the uppercase ISO code, e.g. `FR`. */
export function parseSingleCountryCode(valueText: string): string | null {
  const trimmed = valueText.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") return normalizeCountryCode(parsed);
    return null;
  } catch {
    return normalizeCountryCode(trimmed);
  }
}

/** `in` / `not_in` country fields: JSON array of uppercase ISO codes. */
export function parseCountryCodeList(valueText: string): string[] {
  const trimmed = valueText.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") {
      const code = normalizeCountryCode(parsed);
      return code ? [code] : [];
    }
    if (Array.isArray(parsed)) {
      const codes: string[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        if (typeof item !== "string") continue;
        const code = normalizeCountryCode(item);
        if (!code || seen.has(code)) continue;
        seen.add(code);
        codes.push(code);
      }
      return codes;
    }
    return [];
  } catch {
    const code = normalizeCountryCode(trimmed);
    return code ? [code] : [];
  }
}

export function serializeCountryCodes(codes: string[], multiple: boolean): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of codes) {
    const code = normalizeCountryCode(raw);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    unique.push(code);
  }
  if (multiple) return JSON.stringify(unique);
  return unique[0] ?? "";
}
