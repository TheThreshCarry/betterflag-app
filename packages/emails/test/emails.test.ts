import { describe, expect, it } from "vitest";

import {
  applyVars,
  compileTemplate,
  extractVars,
  fillTemplate,
  TEMPLATE_KEYS,
  TEMPLATE_SEEDS,
} from "../src/index";

describe("merge tags", () => {
  it("extracts distinct variable names in first-seen order", () => {
    expect(extractVars("Hi {{orgName}}, {{orgName}} and {{when}}")).toEqual(["orgName", "when"]);
    expect(extractVars("no tags here")).toEqual([]);
  });

  it("substitutes and HTML-escapes by default", () => {
    expect(applyVars("Hi {{orgName}}", { orgName: "<b>A&B</b>" })).toBe(
      "Hi &lt;b&gt;A&amp;B&lt;/b&gt;",
    );
  });

  it("can skip escaping for plain text and subjects", () => {
    expect(applyVars("ends {{when}}", { when: "in 4 days" }, { escape: false })).toBe(
      "ends in 4 days",
    );
  });

  it("renders empty (or a fallback) for missing values", () => {
    expect(applyVars("Hi {{orgName}}", {})).toBe("Hi ");
    expect(applyVars("Hi {{orgName}}", {}, { fallback: (n) => `[${n}]` })).toBe("Hi [orgName]");
  });

  it("fills a compiled row across subject, html and text", () => {
    const filled = fillTemplate(
      { subject: "Welcome {{orgName}}", html: "<p>{{orgName}}</p>", text: "Welcome {{orgName}}" },
      { orgName: "Acme" },
    );
    expect(filled.subject).toBe("Welcome Acme");
    expect(filled.html).toBe("<p>Acme</p>");
    expect(filled.text).toBe("Welcome Acme");
  });
});

describe("template registry", () => {
  it("exposes the three transactional templates", () => {
    expect(TEMPLATE_KEYS).toEqual(["welcome", "agentic", "trial-ending"]);
  });

  it("declares the variables each template uses", () => {
    expect(TEMPLATE_SEEDS.welcome.variables.map((v) => v.name)).toContain("orgName");
    expect(TEMPLATE_SEEDS.welcome.variables.map((v) => v.name)).toContain("orgLogoUrl");
    expect(TEMPLATE_SEEDS["trial-ending"].variables.map((v) => v.name)).toContain("when");
    expect(TEMPLATE_SEEDS.agentic.variables.map((v) => v.name)).toContain("orgLogoUrl");
  });

  it("keeps every {{tag}} in the body backed by a declared variable", () => {
    for (const key of TEMPLATE_KEYS) {
      const seed = TEMPLATE_SEEDS[key];
      const declared = new Set(seed.variables.map((v) => v.name));
      for (const used of [
        ...extractVars(seed.subject),
        ...extractVars(seed.heading),
        ...extractVars(seed.bodyHtml),
      ]) {
        expect(declared.has(used)).toBe(true);
      }
    }
  });
});

describe("compile (React Email layout)", () => {
  it("wraps the body in the branded layout and preserves merge tags", async () => {
    const compiled = await compileTemplate(TEMPLATE_SEEDS.welcome);
    expect(compiled.subject).toContain("Welcome to Betterflag");
    expect(compiled.html).toContain("Betterflag"); // brand lockup + footer
    expect(compiled.html).toContain("{{orgName}}"); // tag survives rendering
    expect(compiled.html).toContain("{{orgLogoUrl}}");
    expect(compiled.html).toContain("{{orgLogoDisplay}}");
    expect(compiled.html).toContain("#ff5a1a"); // orange CTA
  });
});
