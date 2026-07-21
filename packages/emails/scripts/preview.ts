/**
 * Render every template via React Email and:
 *   1. write a combined HTML preview (visual parity check),
 *   2. emit compiled-template JSON (subject/html/text with {{tags}} intact)
 *      used to seed the email_templates migration.
 *
 * Run: bun run preview   (or: npx tsx scripts/preview.ts)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { compileTemplate } from "../src/render";
import { TEMPLATE_SEEDS, TEMPLATE_KEYS } from "../src/templates";
import { fillTemplate } from "../src/runtime";

async function main() {
  const outDir = process.argv[2] ?? resolve(import.meta.dirname, "..");
  const compiled: Record<string, { subject: string; html: string; text: string }> = {};
  const sections: string[] = [];

  for (const key of TEMPLATE_KEYS) {
    const seed = TEMPLATE_SEEDS[key];
    const c = await compileTemplate(seed);
    compiled[key] = c;

    // Preview with sample variable values filled in.
    const sampleVars = Object.fromEntries(seed.variables.map((v) => [v.name, v.sample]));
    const filled = fillTemplate(c, sampleVars);
    sections.push(
      `<section><div class="meta"><span class="k">${key}</span><span class="n">${seed.name}</span></div>` +
        `<div class="subj"><span>Subject</span>${filled.subject}</div>` +
        `<iframe title="${key}" srcdoc="${filled.html.replace(/"/g, "&quot;")}"></iframe></section>`,
    );
  }

  const page = `<!doctype html><html><head><meta charset="utf-8"/><title>ShipOS emails (React Email)</title>
<style>
  body{margin:0;background:#e9e7e3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;}
  header{max-width:720px;margin:0 auto;padding:32px 24px 8px;} h1{font-size:22px;margin:0 0 4px;letter-spacing:-0.02em;}
  header p{margin:0;color:#737373;font-size:14px;}
  section{max-width:720px;margin:24px auto;padding:0 24px;}
  .meta{display:flex;gap:10px;align-items:center;margin-bottom:8px;}
  .k{font-family:ui-monospace,monospace;font-size:12px;background:#171717;color:#fff;border-radius:6px;padding:3px 8px;}
  .n{font-size:14px;font-weight:600;}
  .subj{font-size:13px;background:#fff;border:1px solid #e8e4de;border-radius:10px;padding:10px 14px;margin-bottom:10px;}
  .subj span{color:#a3a3a3;text-transform:uppercase;font-size:11px;letter-spacing:.06em;margin-right:8px;}
  iframe{width:100%;height:900px;border:1px solid #e8e4de;border-radius:14px;background:#f4f3f1;}
</style></head><body>
<header><h1>ShipOS transactional emails</h1><p>Rendered from the @shipos/emails React Email templates, sample variables filled.</p></header>
${sections.join("\n")}
</body></html>`;

  writeFileSync(resolve(outDir, "emails-react-preview.html"), page);
  writeFileSync(resolve(outDir, "compiled-templates.json"), JSON.stringify(compiled, null, 2));
  console.log(`wrote emails-react-preview.html and compiled-templates.json (${TEMPLATE_KEYS.length} templates)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
