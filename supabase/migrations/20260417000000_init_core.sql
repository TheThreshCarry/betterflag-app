-- ============================================
-- shipos-app — core schema (Phase 1)
-- Tenancy model: `organization_id` on every tenant-scoped table.
-- Active organization_id is stamped into the access token JWT via
-- custom_access_token_hook (see subsequent migration).
-- ============================================

-- UUID defaults use gen_random_uuid() (built-in PG 13+). Avoid uuid-ossp:
-- on Supabase it lives in `extensions` schema and is not on search_path.
create extension if not exists "pgcrypto";

-- ------------------------------------------------
-- Enums
-- ------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.content_type_status as enum ('draft', 'active', 'deprecated');
create type public.entry_status as enum ('draft', 'published', 'archived');
create type public.schema_migration_status as enum ('pending', 'done', 'error');
create type public.subscription_status as enum (
  'incomplete', 'trialing', 'active', 'past_due',
  'canceled', 'unpaid', 'paused'
);

-- ------------------------------------------------
-- organizations (the "tenant" — `organization_id` is our `tenant_id`)
-- ------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_slug_idx on public.organizations (slug);

-- ------------------------------------------------
-- profiles — extends auth.users
-- ------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  username text unique,
  display_username text,
  image text,
  active_organization_id uuid references public.organizations(id) on delete set null,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_active_org_idx on public.profiles (active_organization_id);

-- ------------------------------------------------
-- organization_members
-- ------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_org_idx on public.organization_members (organization_id);
create index organization_members_user_idx on public.organization_members (user_id);

-- ------------------------------------------------
-- invitations
-- ------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'member',
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index invitations_org_idx on public.invitations (organization_id);
create index invitations_email_idx on public.invitations (email);

-- ------------------------------------------------
-- api_keys — SDK auth (hashed, never raw)
-- ------------------------------------------------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text,
  prefix text not null,
  start text,
  key_hash text not null unique,
  enabled boolean not null default true,
  environment text not null default 'production',
  permissions jsonb default '[]'::jsonb,
  rate_limit_enabled boolean not null default true,
  rate_limit_time_window integer not null default 86400000,
  rate_limit_max integer not null default 10,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index api_keys_org_idx on public.api_keys (organization_id);
create index api_keys_key_hash_idx on public.api_keys (key_hash);

-- ------------------------------------------------
-- Timestamp helper: auto-update `updated_at`
-- ------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger api_keys_set_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();
