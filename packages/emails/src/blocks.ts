/**
 * Brand-consistent body building blocks as HTML-string helpers. Used to seed
 * the editable body of each template and (eventually) exposed as insert/slash
 * commands in the admin editor, so hand edits stay on-brand. Body content is
 * stored as HTML, so these produce inline-styled, Gmail/Outlook-safe markup.
 */
import { FONT, MONO, TOKENS } from "./tokens";

export function para(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${TOKENS.ink};">${html}</p>`;
}

export function mutedPara(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${TOKENS.muted};">${html}</p>`;
}

export function code(text: string): string {
  return `<span style="font-family:${MONO};font-size:13px;background:${TOKENS.surface};border:1px solid ${TOKENS.line};padding:2px 6px;border-radius:6px;color:${TOKENS.ink};">${text}</span>`;
}

export function panel(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:${TOKENS.surface};border:1px solid ${TOKENS.line};border-radius:12px;padding:18px 20px;">${inner}</td></tr></table>`;
}

export function terminal(title: string, lines: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td style="background:${TOKENS.terminalBar};border-radius:12px 12px 0 0;padding:10px 16px;font-family:${MONO};font-size:12px;color:#9aa4b2;letter-spacing:0.02em;">${title}</td></tr><tr><td style="background:${TOKENS.terminalBody};border-radius:0 0 12px 12px;padding:16px 18px;font-family:${MONO};font-size:13px;line-height:1.7;color:#c9d1d9;">${lines}</td></tr></table>`;
}

export function cta(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;"><tr><td align="center" bgcolor="${TOKENS.orange}" style="border-radius:12px;"><a href="${href}" style="display:inline-block;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:12px;">${label} &rarr;</a></td></tr></table>`;
}

export function numberedSteps(steps: string[]): string {
  const rows = steps
    .map(
      (step, i) =>
        `<tr><td width="26" valign="top" style="padding:0 12px 12px 0;"><span style="display:inline-block;width:22px;height:22px;background:${TOKENS.surface};border:1px solid ${TOKENS.line};border-radius:9999px;font-family:${MONO};font-size:12px;font-weight:600;line-height:22px;text-align:center;color:${TOKENS.ink};">${i + 1}</span></td><td valign="top" style="padding:0 0 12px;font-family:${FONT};font-size:15px;line-height:1.5;color:${TOKENS.ink};">${step}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">${rows}</table>`;
}

export function strong(text: string): string {
  return `<strong style="color:${TOKENS.ink};">${text}</strong>`;
}
