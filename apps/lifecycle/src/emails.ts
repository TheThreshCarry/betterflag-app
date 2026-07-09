/**
 * Welcome-sequence email templates. Pure functions (unit-tested), founder
 * voice per the ShipOS positioning: personal "I", no corporate polish, the
 * product speaks through concrete things you can do.
 *
 * Palette: white canvas, ink #1F1E1C, muted #6F6A63, hairline #e8e4de,
 * orange #FF5A1A used once per email (the CTA). No images, so nothing to
 * block and nothing to load.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export const FROM_ADDRESS = { email: "hi@shipos.app", name: "Mehdi from ShipOS" } as const;

const APP_URL = "https://app.shipos.app";

function layout(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1F1E1C;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 28px;font-size:14px;font-weight:600;letter-spacing:-0.01em;">ShipOS</p>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #e8e4de;margin:32px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#6F6A63;">
        You're getting this because you created a ShipOS account.
        This is a short 3-email onboarding series, then I'll leave your inbox alone.
        Reply any time — it lands in my actual inbox.
      </p>
    </div>
  </body>
</html>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#FF5A1A;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px;">${label}</a></p>`;
}

const TEXT_FOOTER =
  "\n\n—\nYou're getting this because you created a ShipOS account. This is a short 3-email onboarding series, then I'll leave your inbox alone. Reply any time — it lands in my actual inbox.";

/** Day 0 — welcome, sent right after org creation. */
export function welcomeEmail(orgName: string): EmailContent {
  const subject = "Welcome to ShipOS — your first flag is 5 minutes away";
  const html = layout(`
      <p style="margin:0 0 16px;">Hey, Mehdi here — I built ShipOS.</p>
      <p style="margin:0 0 16px;">Thanks for creating <strong>${escapeHtml(orgName)}</strong>. Here's the whole pitch in one line: unlimited flags, seats and environments, one meter (evaluations), served from Cloudflare's edge in under 50ms. No seat tax, no MAU bill.</p>
      <p style="margin:0 0 16px;">The fastest way to feel it: create a flag, curl the edge, watch it flip. The onboarding checklist walks you through it in about 5 minutes.</p>
      ${cta(`${APP_URL}/onboarding`, "Ship your first flag")}
      <p style="margin:0 0 16px;">Your 14-day trial is running — every feature, no card. If anything feels off, hit reply and tell me. I read all of it.</p>
      <p style="margin:0;">— Mehdi</p>`);
  const text = `Hey, Mehdi here — I built ShipOS.

Thanks for creating ${orgName}. Here's the whole pitch in one line: unlimited flags, seats and environments, one meter (evaluations), served from Cloudflare's edge in under 50ms. No seat tax, no MAU bill.

The fastest way to feel it: create a flag, curl the edge, watch it flip. The onboarding checklist walks you through it in about 5 minutes.

Ship your first flag: ${APP_URL}/onboarding

Your 14-day trial is running — every feature, no card. If anything feels off, hit reply and tell me. I read all of it.

— Mehdi${TEXT_FOOTER}`;
  return { subject, html, text };
}

/** Day 3 — the agentic angle: MCP server, agent keys, audit trail. */
export function agenticEmail(): EmailContent {
  const subject = "Let your agent manage your flags (this is the good part)";
  const html = layout(`
      <p style="margin:0 0 16px;">The thing that makes ShipOS different: your coding agent can drive it.</p>
      <p style="margin:0 0 16px;">Point Claude Code or Cursor at <code style="font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#F6F5F3;padding:2px 6px;border-radius:4px;">mcp.shipos.app</code> with an agent key and it can create flags, set targeting, stage a 10% rollout, and kill a bad feature — without you opening the dashboard. Every action lands in the audit log attributed to the agent, not mushed in with human changes.</p>
      <p style="margin:0 0 16px;">Setup is one key and one config block:</p>
      <ol style="margin:0 0 16px;padding-left:20px;">
        <li style="margin-bottom:6px;">Mint an agent key on the <a href="${APP_URL}/keys" style="color:#1F1E1C;">Keys page</a></li>
        <li style="margin-bottom:6px;">Add the MCP server to your agent's config</li>
        <li>Ask it to "create a flag and roll it out to 10%"</li>
      </ol>
      ${cta(`${APP_URL}/keys`, "Mint an agent key")}
      <p style="margin:0 0 16px;">Agents don't buy seats — which is exactly why we don't sell seats.</p>
      <p style="margin:0;">— Mehdi</p>`);
  const text = `The thing that makes ShipOS different: your coding agent can drive it.

Point Claude Code or Cursor at mcp.shipos.app with an agent key and it can create flags, set targeting, stage a 10% rollout, and kill a bad feature — without you opening the dashboard. Every action lands in the audit log attributed to the agent, not mushed in with human changes.

Setup is one key and one config block:

1. Mint an agent key on the Keys page: ${APP_URL}/keys
2. Add the MCP server to your agent's config
3. Ask it to "create a flag and roll it out to 10%"

Agents don't buy seats — which is exactly why we don't sell seats.

— Mehdi${TEXT_FOOTER}`;
  return { subject, html, text };
}

/** Day 10 — trial ending; only sent when the org has no active subscription. */
export function trialEndingEmail(daysLeft: number): EmailContent {
  const days = Math.max(daysLeft, 0);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const subject = `Your ShipOS trial ends ${when}`;
  const html = layout(`
      <p style="margin:0 0 16px;">Quick heads-up: your trial ends <strong>${when}</strong>.</p>
      <p style="margin:0 0 16px;">Here's what happens if you do nothing: your flags <em>keep serving from the edge</em> — I will never break your production over billing — but the dashboard and API go read-only until you pick a plan.</p>
      <p style="margin:0 0 16px;">Plans start at $9.99/mo for 2M evaluations, and every tier has unlimited flags, seats and environments. Public pricing, no "contact sales".</p>
      ${cta(`${APP_URL}/settings`, "Pick a plan")}
      <p style="margin:0 0 16px;">Not convinced? Reply and tell me why — worst case you help me fix something, best case I change your mind.</p>
      <p style="margin:0;">— Mehdi</p>`);
  const text = `Quick heads-up: your trial ends ${when}.

Here's what happens if you do nothing: your flags keep serving from the edge — I will never break your production over billing — but the dashboard and API go read-only until you pick a plan.

Plans start at $9.99/mo for 2M evaluations, and every tier has unlimited flags, seats and environments. Public pricing, no "contact sales".

Pick a plan: ${APP_URL}/settings

Not convinced? Reply and tell me why — worst case you help me fix something, best case I change your mind.

— Mehdi${TEXT_FOOTER}`;
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
