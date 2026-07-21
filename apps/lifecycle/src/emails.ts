/**
 * Welcome-sequence email templates. Pure functions (unit-tested), founder
 * voice per the ShipOS positioning: personal "I", no corporate polish, the
 * product speaks through concrete things you can do.
 *
 * Design: mirrors the ShipOS dashboard system. Warm paper canvas (#f4f3f1),
 * a white card panel (24px radius, #e8e4de hairline) as the protagonist,
 * charcoal ink (#171717) / muted (#737373) type, and orange (#ff5a1a) used
 * exactly once per email as the CTA. Table-based and inline-styled so it
 * survives Gmail/Outlook; no external images, so nothing to block or load.
 */

import { formatEvals, UPSELL_TIERS, type TierRecommendation } from "./sequence";

/** Included evaluations on the entry (Starter) tier, from the live catalog. */
const STARTER_EVALS = UPSELL_TIERS[0].includedEvalsPerMonth;

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export const FROM_ADDRESS = { email: "hi@shipos.app", name: "Mehdi from ShipOS" } as const;

const APP_URL = "https://app.shipos.app";

// Design tokens (kept in sync with apps/dashboard/app/globals.css).
const INK = "#171717";
const MUTED = "#737373";
const LINE = "#e8e4de";
const CANVAS = "#f4f3f1";
const SURFACE = "#f6f5f3";
const ORANGE = "#ff5a1a";
const BADGE_DARK = "#222222";
const TERMINAL_BAR = "#21252b";
const TERMINAL_BODY = "#16181d";
const GREEN = "#00bc72";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

/** Hidden inbox-preview text (preheader). */
function preheader(text: string): string {
  return `<div style="display:none;overflow:hidden;line-height:1px;max-height:0;max-width:0;opacity:0;">${text}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`;
}

/** The dark monogram badge + wordmark, drawn without images. */
function brandLockup(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="34" valign="middle" align="center" height="34" bgcolor="${BADGE_DARK}" style="width:34px;height:34px;border-radius:9px;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;line-height:34px;text-align:center;">S</td>
    <td width="10" style="width:10px;">&nbsp;</td>
    <td valign="middle" style="font-family:${FONT};font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${INK};">ShipOS</td>
  </tr></table>`;
}

/** Eyebrow: 12px uppercase, tracked, orange. */
function eyebrow(label: string): string {
  return `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.09em;text-transform:uppercase;color:${ORANGE};">${label}</p>`;
}

/** Display headline: weight 600, negative tracking. */
function heading(text: string): string {
  return `<h1 style="margin:0 0 20px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${INK};">${text}</h1>`;
}

function para(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${INK};">${html}</p>`;
}

function mutedPara(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${MUTED};">${html}</p>`;
}

/** Inline code chip. */
function code(text: string): string {
  return `<span style="font-family:${MONO};font-size:13px;background:${SURFACE};border:1px solid ${LINE};padding:2px 6px;border-radius:6px;color:${INK};">${text}</span>`;
}

/** Warm surface callout panel. */
function panel(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>
    <td style="background:${SURFACE};border:1px solid ${LINE};border-radius:12px;padding:18px 20px;">${inner}</td>
  </tr></table>`;
}

/** Dark terminal / config panel. */
function terminal(title: string, lines: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>
    <td style="background:${TERMINAL_BAR};border-radius:12px 12px 0 0;padding:10px 16px;font-family:${MONO};font-size:12px;color:#9aa4b2;letter-spacing:0.02em;">${title}</td>
  </tr><tr>
    <td style="background:${TERMINAL_BODY};border-radius:0 0 12px 12px;padding:16px 18px;font-family:${MONO};font-size:13px;line-height:1.7;color:#c9d1d9;">${lines}</td>
  </tr></table>`;
}

/** Bulletproof orange CTA button. */
function cta(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;"><tr>
    <td align="center" bgcolor="${ORANGE}" style="border-radius:12px;">
      <a href="${href}" style="display:inline-block;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:12px;">${label} &rarr;</a>
    </td>
  </tr></table>`;
}

interface LayoutOpts {
  preview: string;
  eyebrow: string;
  heading: string;
  body: string;
}

function layout(opts: LayoutOpts): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
  </head>
  <body style="margin:0;padding:0;background:${CANVAS};-webkit-font-smoothing:antialiased;">
    ${preheader(opts.preview)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:0 4px 20px;">${brandLockup()}</td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid ${LINE};border-radius:24px;padding:40px 36px;">
                ${eyebrow(opts.eyebrow)}
                ${heading(opts.heading)}
                ${opts.body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 0;">
                <p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
                  You're getting this because you created a ShipOS account. It's a short 3-email onboarding series, then I'll leave your inbox alone. Reply any time, it lands in my actual inbox.
                </p>
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#a3a3a3;">
                  ShipOS &middot; Feature flags with no seat tax and no MAU bill.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const TEXT_FOOTER =
  "\n\n---\nYou're getting this because you created a ShipOS account. It's a short 3-email onboarding series, then I'll leave your inbox alone. Reply any time, it lands in my actual inbox.";

/** Day 0 - welcome, sent right after org creation. */
export function welcomeEmail(orgName: string): EmailContent {
  const subject = "Welcome to ShipOS: your first flag is 5 minutes away";
  const body = `
    ${para("Hey, Mehdi here. I built ShipOS.")}
    ${para(`Thanks for creating <strong style="color:${INK};">${escapeHtml(orgName)}</strong>. Here's the whole pitch in one line:`)}
    ${panel(
      `<p style="margin:0 0 10px;font-family:${FONT};font-size:15px;line-height:1.55;font-weight:600;color:${INK};">Unlimited flags, seats and environments. One meter (evaluations). Served from the edge in under 50ms.</p>
       <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${MUTED};">No seat tax. No MAU bill.</p>`,
    )}
    ${para(
      "The fastest way to feel it: create a flag, curl the edge, watch it flip. The onboarding checklist walks you through it in about 5 minutes.",
    )}
    ${cta(`${APP_URL}/onboarding`, "Ship your first flag")}
    ${mutedPara(
      "Your 14-day trial is running: every feature, no card. If anything feels off, hit reply and tell me. I read all of it.",
    )}
    ${para("- Mehdi")}`;
  const html = layout({
    preview: "Create a flag, curl the edge, watch it flip. About 5 minutes.",
    eyebrow: "Welcome",
    heading: "Your first flag is 5 minutes away",
    body,
  });
  const text = `Hey, Mehdi here. I built ShipOS.

Thanks for creating ${orgName}. Here's the whole pitch in one line: unlimited flags, seats and environments, one meter (evaluations), served from the edge in under 50ms. No seat tax, no MAU bill.

The fastest way to feel it: create a flag, curl the edge, watch it flip. The onboarding checklist walks you through it in about 5 minutes.

Ship your first flag: ${APP_URL}/onboarding

Your 14-day trial is running: every feature, no card. If anything feels off, hit reply and tell me. I read all of it.

- Mehdi${TEXT_FOOTER}`;
  return { subject, html, text };
}

/** Day 3 - the agentic angle: MCP server, agent keys, audit trail. */
export function agenticEmail(): EmailContent {
  const subject = "Let your agent manage your flags (this is the good part)";
  const steps = [
    `Mint an agent key on the <a href="${APP_URL}/keys" style="color:${INK};font-weight:600;text-decoration:underline;">Keys page</a>`,
    "Add the MCP server to your agent's config",
    `Ask it to "create a flag and roll it out to 10%"`,
  ]
    .map(
      (step, i) =>
        `<tr>
          <td width="26" valign="top" style="padding:0 12px 12px 0;">
            <span style="display:inline-block;width:22px;height:22px;background:${SURFACE};border:1px solid ${LINE};border-radius:9999px;font-family:${MONO};font-size:12px;font-weight:600;line-height:22px;text-align:center;color:${INK};">${i + 1}</span>
          </td>
          <td valign="top" style="padding:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.5;color:${INK};">${step}</td>
        </tr>`,
    )
    .join("");
  const body = `
    ${para("The thing that makes ShipOS different: your coding agent can drive it.")}
    ${para(
      `Point Claude Code or Cursor at ${code("mcp.shipos.app")} with an agent key and it can create flags, set targeting, stage a 10% rollout, and kill a bad feature, all without you opening the dashboard. Every action lands in the audit log attributed to the agent, not mushed in with human changes.`,
    )}
    ${terminal(
      ".mcp.json",
      `<span style="color:#8b949e;">{</span><br />
&nbsp;&nbsp;<span style="color:#79c0ff;">"mcpServers"</span>: {<br />
&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"shipos"</span>: {<br />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"type"</span>: <span style="color:${GREEN};">"http"</span>,<br />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"url"</span>: <span style="color:${GREEN};">"https://mcp.shipos.app/mcp"</span>,<br />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#79c0ff;">"headers"</span>: { <span style="color:#79c0ff;">"Authorization"</span>: <span style="color:${GREEN};">"Bearer sos_agt_..."</span> }<br />
&nbsp;&nbsp;&nbsp;&nbsp;}<br />
&nbsp;&nbsp;}<br />
<span style="color:#8b949e;">}</span>`,
    )}
    ${para(`<strong style="color:${INK};">Setup is one key and one config block:</strong>`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${steps}</table>
    ${cta(`${APP_URL}/keys`, "Mint an agent key")}
    ${mutedPara("Feature flags made easy, with unlimited seats on every plan.")}
    ${para("- Mehdi")}`;
  const html = layout({
    preview: "Point Claude Code or Cursor at mcp.shipos.app and let it ship.",
    eyebrow: "Agentic",
    heading: "Let your agent manage your flags",
    body,
  });
  const text = `The thing that makes ShipOS different: your coding agent can drive it.

Point Claude Code or Cursor at mcp.shipos.app with an agent key and it can create flags, set targeting, stage a 10% rollout, and kill a bad feature, all without you opening the dashboard. Every action lands in the audit log attributed to the agent, not mushed in with human changes.

Setup is one key and one config block:

1. Mint an agent key on the Keys page: ${APP_URL}/keys
2. Add the MCP server to your agent's config
3. Ask it to "create a flag and roll it out to 10%"

Feature flags made easy, with unlimited seats on every plan.

- Mehdi${TEXT_FOOTER}`;
  return { subject, html, text };
}

/** Day 10 - trial ending; only sent when the org has no active subscription. */
export function trialEndingEmail(daysLeft: number): EmailContent {
  const days = Math.max(daysLeft, 0);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const subject = `Your ShipOS trial ends ${when}`;
  const body = `
    ${para(`Quick heads-up: your trial ends <strong style="color:${INK};">${when}</strong>.`)}
    ${panel(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="top" width="18" style="padding:0 10px 8px 0;font-family:${FONT};font-size:14px;color:${GREEN};">&#10003;</td>
          <td valign="top" style="padding:0 0 8px;font-family:${FONT};font-size:14px;line-height:1.5;color:${INK};">Your flags <strong>keep serving from the edge</strong>. I will never break your production over billing.</td>
        </tr>
        <tr>
          <td valign="top" width="18" style="padding:0 10px 0 0;font-family:${FONT};font-size:14px;color:${MUTED};">&middot;</td>
          <td valign="top" style="font-family:${FONT};font-size:14px;line-height:1.5;color:${MUTED};">The dashboard and API go read-only until you pick a plan.</td>
        </tr>
      </table>`,
    )}
    ${para(
      "Plans start at $9.99/mo for 2M evaluations, and every tier has unlimited flags, seats and environments. Public pricing, no \"contact sales\".",
    )}
    ${cta(`${APP_URL}/settings`, "Pick a plan")}
    ${mutedPara(
      "Not convinced? Reply and tell me why: worst case you help me fix something, best case I change your mind.",
    )}
    ${para("- Mehdi")}`;
  const html = layout({
    preview: `Your ShipOS trial ends ${when}. Your flags keep serving either way.`,
    eyebrow: "Trial",
    heading: `Your trial ends ${when}`,
    body,
  });
  const text = `Quick heads-up: your trial ends ${when}.

Here's what happens if you do nothing: your flags keep serving from the edge (I will never break your production over billing), but the dashboard and API go read-only until you pick a plan.

Plans start at $9.99/mo for 2M evaluations, and every tier has unlimited flags, seats and environments. Public pricing, no "contact sales".

Pick a plan: ${APP_URL}/settings

Not convinced? Reply and tell me why: worst case you help me fix something, best case I change your mind.

- Mehdi${TEXT_FOOTER}`;
  return { subject, html, text };
}

/**
 * Day 10 - trial ending, usage-aware variant. Sent instead of the generic
 * trial-ending email when the org's trial usage pro-rates past the Starter
 * tier: it names the projected monthly usage and offers the tier that fits
 * (Launch, Scale, or a volume conversation past Scale). Only sent for orgs
 * with no active subscription, same gate as `trialEndingEmail`.
 */
export function trialEndingUpsellEmail(daysLeft: number, rec: TierRecommendation): EmailContent {
  const days = Math.max(daysLeft, 0);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const projected = formatEvals(rec.projectedMonthlyEvals);
  const subject = rec.exceedsTopTier
    ? `You're running ${projected} evaluations a month, let's talk`
    : `Your usage is past Starter, ${rec.tier.name} is the fit`;

  const recRow = rec.exceedsTopTier
    ? `<p style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:1.55;font-weight:600;color:${INK};">You're past even Scale's ${formatEvals(rec.tier.includedEvalsPerMonth)}/mo.</p>
       <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${MUTED};">Reply to this email and I'll set you up with volume pricing that fits.</p>`
    : `<p style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:1.55;font-weight:600;color:${INK};">${rec.tier.name} covers ${formatEvals(rec.tier.includedEvalsPerMonth)} evaluations / mo at ${rec.tier.price}/mo.</p>
       <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${MUTED};">Unlimited flags, seats and environments, same as every plan. You only move up the one meter.</p>`;

  const ctaBlock = rec.exceedsTopTier
    ? cta(`${APP_URL}/settings`, "See your plans")
    : cta(`${APP_URL}/settings`, `Pick ${rec.tier.name}`);

  const body = `
    ${para(`Quick heads-up: your trial ends <strong style="color:${INK};">${when}</strong>, and you've been busy.`)}
    ${para(
      `At your current pace you're on track for about <strong style="color:${INK};">${projected} evaluations a month</strong>. That's past the Starter tier (${formatEvals(STARTER_EVALS)}/mo), so Starter would run into overage on day one.`,
    )}
    ${panel(recRow)}
    ${para(
      "Nothing breaks in the meantime: your flags keep serving from the edge, I will never take down your production over billing. The dashboard and API just go read-only until you pick a plan.",
    )}
    ${ctaBlock}
    ${mutedPara(
      "Numbers look off, or you expected a spike that won't repeat? Reply and tell me, I'll help you land on the right plan.",
    )}
    ${para("- Mehdi")}`;
  const html = layout({
    preview: `You're on track for ~${projected} evaluations a month. Here's the plan that fits.`,
    eyebrow: "Trial",
    heading: rec.exceedsTopTier ? `You've outgrown self-serve` : `You've outgrown Starter`,
    body,
  });

  const textRec = rec.exceedsTopTier
    ? `You're past even Scale's ${formatEvals(rec.tier.includedEvalsPerMonth)}/mo. Reply to this email and I'll set you up with volume pricing that fits.`
    : `${rec.tier.name} covers ${formatEvals(rec.tier.includedEvalsPerMonth)} evaluations/mo at ${rec.tier.price}/mo, with unlimited flags, seats and environments like every plan.`;
  const text = `Quick heads-up: your trial ends ${when}, and you've been busy.

At your current pace you're on track for about ${projected} evaluations a month. That's past the Starter tier (${formatEvals(STARTER_EVALS)}/mo), so Starter would run into overage on day one.

${textRec}

Nothing breaks in the meantime: your flags keep serving from the edge (I will never take down your production over billing). The dashboard and API just go read-only until you pick a plan.

Pick a plan: ${APP_URL}/settings

Numbers look off, or you expected a spike that won't repeat? Reply and tell me, I'll help you land on the right plan.

- Mehdi${TEXT_FOOTER}`;
  return { subject, html, text };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
