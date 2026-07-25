/**
 * React-free runtime surface for the Cloudflare Workers that SEND email
 * (lifecycle, and any future sender). Deliberately imports nothing from React
 * or the render pipeline, so it stays cheap to bundle in a Worker. Workers read
 * the pre-compiled subject/html/text from the DB and only substitute variables.
 */
export { applyVars, extractVars, type ApplyVarsOptions } from "./vars";
export {
  TEMPLATE_SEEDS,
  TEMPLATE_KEYS,
  ORG_LOGO_VARS,
  orgLogoMergeVars,
  type EmailTemplateKey,
  type EmailTemplateSeed,
  type EmailVariable,
} from "./templates";

import { applyVars } from "./vars";

export interface CompiledRow {
  subject: string;
  html: string;
  text: string;
}

/** Substitute variables into a pre-compiled template row for one recipient. */
export function fillTemplate(
  row: CompiledRow,
  values: Record<string, string | number | null | undefined>,
): CompiledRow {
  return {
    subject: applyVars(row.subject, values, { escape: false }),
    html: applyVars(row.html, values, { escape: true }),
    text: applyVars(row.text, values, { escape: false }),
  };
}
