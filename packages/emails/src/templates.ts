/**
 * The transactional template registry. Each entry is the DEFAULT (seed) content
 * for a template; at runtime the admin-edited version in the DB wins and these
 * are the fallback + the seed for the migration. Body is editable HTML with
 * `{{variable}}` merge tags; the branded chrome comes from <EmailLayout/>.
 */
import { APP_URL } from "./tokens";
import { code, cta, mutedPara, numberedSteps, panel, para, strong, terminal } from "./blocks";

export type EmailTemplateKey = "welcome" | "agentic" | "trial-ending";

export interface EmailVariable {
  /** Merge-tag name, referenced as `{{name}}`. */
  name: string;
  /** Human label shown in the editor's variable helper. */
  label: string;
  /** Sample value used for previews and test sends. */
  sample: string;
}

export interface EmailTemplateSeed {
  key: EmailTemplateKey;
  /** Display name in the admin list. */
  name: string;
  /** One-line description of when it sends. */
  description: string;
  /** Subject line (may contain merge tags). */
  subject: string;
  /** Hidden inbox preview text. */
  preview: string;
  /** Uppercase eyebrow label. */
  eyebrow: string;
  /** Display heading (may contain merge tags). */
  heading: string;
  /** Editable body HTML (may contain merge tags). */
  bodyHtml: string;
  /** Plain-text fallback (may contain merge tags). */
  text: string;
  /** Variables this template expects. */
  variables: EmailVariable[];
}

/** Layout chrome merge tags (present in every compiled email). */
export const ORG_LOGO_VARS: EmailVariable[] = [
  {
    name: "orgLogoUrl",
    label: "Organization logo URL",
    sample: "https://media.shipos.app/orgs/example/logo.png",
  },
  {
    name: "orgLogoDisplay",
    label: "Logo CSS display (none or inline-block)",
    sample: "inline-block",
  },
];

/** Values for layout logo slot when an org has (or lacks) a logo. */
export function orgLogoMergeVars(logoUrl: string | null | undefined): {
  orgLogoUrl: string;
  orgLogoDisplay: "none" | "inline-block";
} {
  if (logoUrl && logoUrl.length > 0) {
    return { orgLogoUrl: logoUrl, orgLogoDisplay: "inline-block" };
  }
  return { orgLogoUrl: "", orgLogoDisplay: "none" };
}

const TEXT_FOOTER =
  "\n\n---\nYou're getting this because you created a ShipOS account. It's a short 3-email onboarding series, then I'll leave your inbox alone. Reply any time, it lands in my actual inbox.";

const welcome: EmailTemplateSeed = {
  key: "welcome",
  name: "Welcome",
  description: "Day 0 — sent right after an org is created.",
  subject: "Welcome to ShipOS: your first flag is 5 minutes away",
  preview: "Create a flag, curl the edge, watch it flip. About 5 minutes.",
  eyebrow: "Welcome",
  heading: "Your first flag is 5 minutes away",
  bodyHtml: [
    para("Hey, Mehdi here. I built ShipOS."),
    para(`Thanks for creating ${strong("{{orgName}}")}. Here's the whole pitch in one line:`),
    panel(
      `<p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;font-weight:600;color:#171717;">Unlimited flags, seats and environments. One meter (evaluations). Served from the edge in under 50ms.</p><p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#737373;">No seat tax. No MAU bill.</p>`,
    ),
    para(
      "The fastest way to feel it: create a flag, curl the edge, watch it flip. The onboarding checklist walks you through it in about 5 minutes.",
    ),
    cta(`${APP_URL}/onboarding`, "Ship your first flag"),
    mutedPara(
      "Your 14-day trial is running: every feature, no card. If anything feels off, hit reply and tell me. I read all of it.",
    ),
    para("- Mehdi"),
  ].join("\n"),
  text: `Hey, Mehdi here. I built ShipOS.

Thanks for creating {{orgName}}. Here's the whole pitch in one line: unlimited flags, seats and environments, one meter (evaluations), served from the edge in under 50ms. No seat tax, no MAU bill.

The fastest way to feel it: create a flag, curl the edge, watch it flip. The onboarding checklist walks you through it in about 5 minutes.

Ship your first flag: ${APP_URL}/onboarding

Your 14-day trial is running: every feature, no card. If anything feels off, hit reply and tell me. I read all of it.

- Mehdi${TEXT_FOOTER}`,
  variables: [
    { name: "orgName", label: "Organization name", sample: "Acme Inc" },
    ...ORG_LOGO_VARS,
  ],
};

const agentic: EmailTemplateSeed = {
  key: "agentic",
  name: "Agentic setup",
  description: "Day 3 — the MCP / agent-key angle.",
  subject: "Let your agent manage your flags (this is the good part)",
  preview: "Point Claude Code or Cursor at mcp.shipos.app and let it ship.",
  eyebrow: "Agentic",
  heading: "Let your agent manage your flags",
  bodyHtml: [
    para("The thing that makes ShipOS different: your coding agent can drive it."),
    para(
      `Point Claude Code or Cursor at ${code("mcp.shipos.app")} with an agent key and it can create flags, set targeting, stage a 10% rollout, and kill a bad feature, all without you opening the dashboard. Every action lands in the audit log attributed to the agent, not mushed in with human changes.`,
    ),
    terminal(
      ".mcp.json",
      `<span style="color:#8b949e;">{</span><br />&nbsp;&nbsp;<span style="color:#79c0ff;">"mcpServers"</span>: {<br />&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"shipos"</span>: {<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"type"</span>: <span style="color:#00bc72;">"http"</span>,<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"url"</span>: <span style="color:#00bc72;">"https://mcp.shipos.app/mcp"</span>,<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"headers"</span>: { <span style="color:#79c0ff;">"Authorization"</span>: <span style="color:#00bc72;">"Bearer sos_agt_..."</span> }<br />&nbsp;&nbsp;&nbsp;&nbsp;}<br />&nbsp;&nbsp;}<br /><span style="color:#8b949e;">}</span>`,
    ),
    para(strong("Setup is one key and one config block:")),
    numberedSteps([
      `Mint an agent key in <a href="${APP_URL}/settings/keys" style="color:#171717;font-weight:600;text-decoration:underline;">Settings → Keys</a>`,
      "Add the MCP server to your agent's config",
      `Ask it to "create a flag and roll it out to 10%"`,
    ]),
    cta(`${APP_URL}/settings/keys`, "Mint an agent key"),
    mutedPara("Feature flags made easy, with unlimited seats on every plan."),
    para("- Mehdi"),
  ].join("\n"),
  text: `The thing that makes ShipOS different: your coding agent can drive it.

Point Claude Code or Cursor at mcp.shipos.app with an agent key and it can create flags, set targeting, stage a 10% rollout, and kill a bad feature, all without you opening the dashboard. Every action lands in the audit log attributed to the agent, not mushed in with human changes.

Setup is one key and one config block:

1. Mint an agent key in Settings → Keys: ${APP_URL}/settings/keys
2. Add the MCP server to your agent's config
3. Ask it to "create a flag and roll it out to 10%"

Feature flags made easy, with unlimited seats on every plan.

- Mehdi${TEXT_FOOTER}`,
  variables: [...ORG_LOGO_VARS],
};

const trialEnding: EmailTemplateSeed = {
  key: "trial-ending",
  name: "Trial ending",
  description: "Day 10 — only sent when the org has no active subscription.",
  subject: "Your ShipOS trial ends {{when}}",
  preview: "Your ShipOS trial ends {{when}}. Your flags keep serving either way.",
  eyebrow: "Trial",
  heading: "Your trial ends {{when}}",
  bodyHtml: [
    para(`Quick heads-up: your trial ends ${strong("{{when}}")}.`),
    panel(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top" width="18" style="padding:0 10px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#00bc72;">&#10003;</td><td valign="top" style="padding:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#171717;">Your flags <strong>keep serving from the edge</strong>. I will never break your production over billing.</td></tr><tr><td valign="top" width="18" style="padding:0 10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#737373;">&middot;</td><td valign="top" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#737373;">The dashboard and API go read-only until you pick a plan.</td></tr></table>`,
    ),
    para(
      'Plans start at $9.99/mo for 2M evaluations, and every tier has unlimited flags, seats and environments. Public pricing, no "contact sales".',
    ),
    cta(`${APP_URL}/settings`, "Pick a plan"),
    mutedPara(
      "Not convinced? Reply and tell me why: worst case you help me fix something, best case I change your mind.",
    ),
    para("- Mehdi"),
  ].join("\n"),
  text: `Quick heads-up: your trial ends {{when}}.

Here's what happens if you do nothing: your flags keep serving from the edge (I will never break your production over billing), but the dashboard and API go read-only until you pick a plan.

Plans start at $9.99/mo for 2M evaluations, and every tier has unlimited flags, seats and environments. Public pricing, no "contact sales".

Pick a plan: ${APP_URL}/settings

Not convinced? Reply and tell me why: worst case you help me fix something, best case I change your mind.

- Mehdi${TEXT_FOOTER}`,
  variables: [
    { name: "when", label: "When the trial ends", sample: "in 4 days" },
    ...ORG_LOGO_VARS,
  ],
};

export const TEMPLATE_SEEDS: Record<EmailTemplateKey, EmailTemplateSeed> = {
  welcome,
  agentic,
  "trial-ending": trialEnding,
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_SEEDS) as EmailTemplateKey[];
