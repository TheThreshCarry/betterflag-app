-- ITR-189: email_templates DDL in the canonical packages/db migration tree.
-- Previously lived only in a gitignored root supabase/ directory, so a clone
-- or disaster-recovery rebuild could not recreate the table.
--
-- compiled_html may be empty: the lifecycle worker falls back to the built-in
-- @betterflag/emails seeds when compiled_html is missing. Saving a template
-- in betterflag-admin compiles the branded layout into compiled_html.
--
-- Rollback: see docs/RUNBOOK.md (ITR-189).

create table if not exists public.email_templates (
  key text primary key
    check (key in ('welcome', 'agentic', 'trial-ending')),
  subject text not null,
  preview text not null default '',
  eyebrow text not null default '',
  heading text not null default '',
  body_html text not null default '',
  text text not null default '',
  compiled_html text not null default '',
  version integer not null default 1,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

insert into public.email_templates (key, subject, preview, eyebrow, heading, body_html, text, compiled_html)
values
  (
    'welcome',
    'Welcome to Betterflag: your first flag is 5 minutes away',
    'Create a flag, curl the edge, watch it flip. About 5 minutes.',
    'Welcome',
    'Your first flag is 5 minutes away',
    '',
    '',
    ''
  ),
  (
    'agentic',
    'Let your agent manage your flags (this is the good part)',
    'Point Claude Code or Cursor at mcp.betterflag.app and let it ship.',
    'Agentic',
    'Let your agent manage your flags',
    '',
    '',
    ''
  ),
  (
    'trial-ending',
    'Your Betterflag trial ends {{when}}',
    'Your Betterflag trial ends {{when}}. Your flags keep serving either way.',
    'Trial',
    'Your trial ends {{when}}',
    '',
    '',
    ''
  )
on conflict (key) do nothing;
