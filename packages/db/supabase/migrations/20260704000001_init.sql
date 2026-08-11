-- Betterflag control plane schema (flags-only pivot).
-- Source of truth for orgs/projects/flags; the data plane reads only KV
-- snapshots derived from these tables, never these tables directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.org_plan as enum ('trial', 'starter', 'launch', 'scale');
create type public.org_role as enum ('owner', 'admin', 'member');
create type public.flag_kind as enum ('boolean', 'string', 'number', 'json');
create type public.api_key_kind as enum ('sdk', 'agent', 'admin');
create type public.approval_status as enum ('pending', 'approved', 'rejected');
create type public.actor_type as enum ('user', 'agent');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  plan public.org_plan not null default 'trial',
  stripe_customer_id text,
  trial_ends_at timestamptz not null default now() + interval '14 days',
  -- Refreshed nightly from ClickHouse for the dashboard usage bar; never
  -- authoritative for billing.
  usage_cache jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,30}$'),
  created_at timestamptz not null default now(),
  unique (project_id, slug)
);

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null check (key ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$'),
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '',
  kind public.flag_kind not null default 'boolean',
  default_value jsonb not null default 'false'::jsonb,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, key)
);

create table public.flag_configs (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references public.flags (id) on delete cascade,
  environment_id uuid not null references public.environments (id) on delete cascade,
  enabled boolean not null default false,
  -- Kill switch: an emergency OFF that survives `enabled` edits and is only
  -- cleared explicitly. Evaluation precedence: killed > disabled > rules.
  killed boolean not null default false,
  rollout_pct integer not null default 0 check (rollout_pct between 0 and 100),
  rules jsonb not null default '[]'::jsonb,
  value_on jsonb,
  value_off jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  updated_by_key_prefix text,
  unique (flag_id, environment_id)
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  environment_id uuid references public.environments (id) on delete cascade,
  kind public.api_key_kind not null,
  name text not null check (char_length(name) between 1 and 120),
  -- SHA-256 hex of the full key; the plaintext is shown once at creation.
  hash text not null unique,
  -- e.g. "bf_agt_ab12cd34", safe to display and to attribute audit rows.
  prefix text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- SDK keys evaluate one (project, environment); admin/agent keys are
  -- org-wide unless scoped to a project.
  constraint sdk_keys_scoped check (kind <> 'sdk' or (project_id is not null and environment_id is not null))
);

create table public.guardrails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  environment_id uuid references public.environments (id) on delete cascade,
  -- e.g. 'kill_switch', 'rollout_100', 'toggle_prod'
  action text not null,
  requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, environment_id, action)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  requested_by_key text not null,
  -- The staged mutation, replayed verbatim on approval:
  -- { "action": "kill_flag", "flagId": ..., "environmentId": ..., ... }
  action jsonb not null,
  status public.approval_status not null default 'pending',
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  actor_type public.actor_type not null,
  actor_id uuid,
  actor_key_prefix text,
  action text not null,
  subject text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index org_members_user_idx on public.org_members (user_id);
create index projects_org_idx on public.projects (org_id);
create index environments_project_idx on public.environments (project_id);
create index flags_project_idx on public.flags (project_id) where archived_at is null;
create index flag_configs_env_idx on public.flag_configs (environment_id);
create index api_keys_org_idx on public.api_keys (org_id) where revoked_at is null;
create index approvals_org_pending_idx on public.approvals (org_id, created_at desc) where status = 'pending';
create index audit_log_org_idx on public.audit_log (org_id, created_at desc);
create index audit_log_actor_type_idx on public.audit_log (org_id, actor_type, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(check_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = check_org and user_id = auth.uid()
  );
$$;

create or replace function public.org_of_project(p_project uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select org_id from public.projects where id = p_project;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger flag_configs_touch
  before update on public.flag_configs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Audit: one function used by EVERY mutation path (REST, dashboard, MCP),
-- so "which agent flipped this flag" is always answerable.
-- ---------------------------------------------------------------------------

create or replace function public.record_audit(
  p_org uuid,
  p_project uuid,
  p_actor_type public.actor_type,
  p_actor_id uuid,
  p_actor_key_prefix text,
  p_action text,
  p_subject text,
  p_before jsonb,
  p_after jsonb
) returns void
language sql security definer
set search_path = public
as $$
  insert into public.audit_log
    (org_id, project_id, actor_type, actor_id, actor_key_prefix, action, subject, before, after)
  values
    (p_org, p_project, p_actor_type, p_actor_id, p_actor_key_prefix, p_action, p_subject, p_before, p_after);
$$;

-- ---------------------------------------------------------------------------
-- Atomic mutations (mutation + version bump + audit in one transaction).
-- Called with the service role from the control plane API only.
-- ---------------------------------------------------------------------------

create or replace function public.create_project_with_envs(
  p_org uuid,
  p_name text,
  p_slug text,
  p_actor_type public.actor_type,
  p_actor_id uuid,
  p_actor_key_prefix text
) returns public.projects
language plpgsql security definer
set search_path = public
as $$
declare
  v_project public.projects;
begin
  insert into public.projects (org_id, name, slug)
  values (p_org, p_name, p_slug)
  returning * into v_project;

  insert into public.environments (project_id, name, slug) values
    (v_project.id, 'Development', 'dev'),
    (v_project.id, 'Staging', 'staging'),
    (v_project.id, 'Production', 'prod');

  perform public.record_audit(
    p_org, v_project.id, p_actor_type, p_actor_id, p_actor_key_prefix,
    'project.create', 'project:' || v_project.slug, null, to_jsonb(v_project));

  return v_project;
end;
$$;

create or replace function public.create_flag_with_configs(
  p_project uuid,
  p_key text,
  p_name text,
  p_description text,
  p_kind public.flag_kind,
  p_default_value jsonb,
  p_actor_type public.actor_type,
  p_actor_id uuid,
  p_actor_key_prefix text
) returns public.flags
language plpgsql security definer
set search_path = public
as $$
declare
  v_flag public.flags;
  v_org uuid;
begin
  select org_id into v_org from public.projects where id = p_project;
  if v_org is null then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  insert into public.flags (project_id, key, name, description, kind, default_value, created_by)
  values (
    p_project, p_key, p_name, coalesce(p_description, ''), p_kind, p_default_value,
    case when p_actor_type = 'user' then p_actor_id else null end)
  returning * into v_flag;

  insert into public.flag_configs (flag_id, environment_id)
  select v_flag.id, e.id from public.environments e where e.project_id = p_project;

  perform public.record_audit(
    v_org, p_project, p_actor_type, p_actor_id, p_actor_key_prefix,
    'flag.create', 'flag:' || v_flag.key, null, to_jsonb(v_flag));

  return v_flag;
end;
$$;

-- Partial update: null parameters leave the current value untouched
-- (p_clear_kill explicitly lifts a kill because "killed := null" is not
-- expressible otherwise). Optimistic concurrency via p_expected_version.
create or replace function public.update_flag_config(
  p_flag uuid,
  p_environment uuid,
  p_enabled boolean,
  p_rollout_pct integer,
  p_rules jsonb,
  p_value_on jsonb,
  p_value_off jsonb,
  p_clear_kill boolean,
  p_expected_version integer,
  p_actor_type public.actor_type,
  p_actor_id uuid,
  p_actor_key_prefix text
) returns public.flag_configs
language plpgsql security definer
set search_path = public
as $$
declare
  v_before public.flag_configs;
  v_after public.flag_configs;
  v_org uuid;
  v_project uuid;
  v_key text;
begin
  select f.project_id, f.key, p.org_id into v_project, v_key, v_org
  from public.flags f join public.projects p on p.id = f.project_id
  where f.id = p_flag;
  if v_org is null then
    raise exception 'flag not found' using errcode = 'P0002';
  end if;

  select * into v_before from public.flag_configs
  where flag_id = p_flag and environment_id = p_environment
  for update;
  if v_before.id is null then
    raise exception 'flag config not found' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and v_before.version <> p_expected_version then
    raise exception 'version conflict: expected %, found %', p_expected_version, v_before.version
      using errcode = '40001';
  end if;

  update public.flag_configs set
    enabled = coalesce(p_enabled, enabled),
    rollout_pct = coalesce(p_rollout_pct, rollout_pct),
    rules = coalesce(p_rules, rules),
    value_on = coalesce(p_value_on, value_on),
    value_off = coalesce(p_value_off, value_off),
    killed = case when coalesce(p_clear_kill, false) then false else killed end,
    version = version + 1,
    updated_by = case when p_actor_type = 'user' then p_actor_id else null end,
    updated_by_key_prefix = p_actor_key_prefix
  where id = v_before.id
  returning * into v_after;

  perform public.record_audit(
    v_org, v_project, p_actor_type, p_actor_id, p_actor_key_prefix,
    'flag.config.update', 'flag:' || v_key, to_jsonb(v_before), to_jsonb(v_after));

  return v_after;
end;
$$;

create or replace function public.kill_flag(
  p_flag uuid,
  p_environment uuid,
  p_actor_type public.actor_type,
  p_actor_id uuid,
  p_actor_key_prefix text
) returns public.flag_configs
language plpgsql security definer
set search_path = public
as $$
declare
  v_before public.flag_configs;
  v_after public.flag_configs;
  v_org uuid;
  v_project uuid;
  v_key text;
begin
  select f.project_id, f.key, p.org_id into v_project, v_key, v_org
  from public.flags f join public.projects p on p.id = f.project_id
  where f.id = p_flag;
  if v_org is null then
    raise exception 'flag not found' using errcode = 'P0002';
  end if;

  select * into v_before from public.flag_configs
  where flag_id = p_flag and environment_id = p_environment
  for update;
  if v_before.id is null then
    raise exception 'flag config not found' using errcode = 'P0002';
  end if;

  update public.flag_configs set
    killed = true,
    version = version + 1,
    updated_by = case when p_actor_type = 'user' then p_actor_id else null end,
    updated_by_key_prefix = p_actor_key_prefix
  where id = v_before.id
  returning * into v_after;

  perform public.record_audit(
    v_org, v_project, p_actor_type, p_actor_id, p_actor_key_prefix,
    'flag.kill', 'flag:' || v_key, to_jsonb(v_before), to_jsonb(v_after));

  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- Reads: org members can SELECT their org's rows (dashboard client reads).
-- Writes: none for authenticated users, every mutation goes through the
-- control plane API with the service role so audit + guardrails + config
-- sync cannot be bypassed.
-- ---------------------------------------------------------------------------

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.projects enable row level security;
alter table public.environments enable row level security;
alter table public.flags enable row level security;
alter table public.flag_configs enable row level security;
alter table public.api_keys enable row level security;
alter table public.guardrails enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_log enable row level security;

create policy orgs_select on public.orgs
  for select using (public.is_org_member(id));

create policy org_members_select on public.org_members
  for select using (user_id = auth.uid() or public.is_org_member(org_id));

create policy projects_select on public.projects
  for select using (public.is_org_member(org_id));

create policy environments_select on public.environments
  for select using (public.is_org_member(public.org_of_project(project_id)));

create policy flags_select on public.flags
  for select using (public.is_org_member(public.org_of_project(project_id)));

create policy flag_configs_select on public.flag_configs
  for select using (
    public.is_org_member(public.org_of_project(
      (select project_id from public.flags where id = flag_id))));

create policy api_keys_select on public.api_keys
  for select using (public.is_org_member(org_id));

create policy guardrails_select on public.guardrails
  for select using (public.is_org_member(org_id));

create policy approvals_select on public.approvals
  for select using (public.is_org_member(org_id));

create policy audit_log_select on public.audit_log
  for select using (public.is_org_member(org_id));
