/**
 * @betterflag/emails — the single source of truth for Betterflag transactional email.
 *
 * - <EmailLayout/>: the branded React Email shell (design system as code).
 * - templates: default (seed) content for each transactional email, with an
 *   editable body (HTML + {{merge tags}}) and a variable spec.
 * - render/compile: wrap a body in the layout to produce storable HTML.
 * - vars: merge-tag substitution shared with the workers.
 *
 * Node consumers (admin, seed script) import from here. Workers import the
 * lean, React-free surface from "@betterflag/emails/runtime".
 */
export { EmailLayout, type EmailLayoutProps } from "./layout";
export * from "./blocks";
export * from "./tokens";
export * from "./vars";
export * from "./templates";
export * from "./render";
// Merge-tag substitution helper (also available React-free via "./runtime").
export { fillTemplate, type CompiledRow } from "./runtime";
