-- ============================================
-- shipos-app — app tables (Phase 1)
-- Every table scoped by `organization_id`.
-- ============================================

-- ------------------------------------------------
-- Feature Flags
-- ------------------------------------------------
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key varchar(255) not null,
  name varchar(255) not null,
  description text,
  enabled boolean not null default false,
  environment varchar(50) not null default 'production',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key, environment)
);

create index feature_flags_key_env_idx on public.feature_flags (key, environment);
create index feature_flags_org_idx on public.feature_flags (organization_id);

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- Global Configs
-- ------------------------------------------------
create table public.global_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug varchar(255) not null,
  name varchar(255) not null,
  description text,
  data jsonb not null default '{}'::jsonb,
  environment varchar(50) not null default 'production',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug, environment)
);

create index global_configs_slug_env_idx on public.global_configs (slug, environment);
create index global_configs_org_idx on public.global_configs (organization_id);

create trigger global_configs_set_updated_at
  before update on public.global_configs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- Customers
-- ------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email varchar(255),
  name varchar(255),
  external_id varchar(255),
  metadata jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_email_idx on public.customers (email);
create index customers_org_idx on public.customers (organization_id);
create index customers_external_id_idx on public.customers (external_id);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- Changelogs
-- ------------------------------------------------
create table public.changelogs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title varchar(255) not null,
  slug varchar(255) not null,
  version varchar(50),
  content jsonb,
  summary text,
  status varchar(20) not null default 'draft',
  published_at timestamptz,
  deployed_at timestamptz,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index changelogs_slug_idx on public.changelogs (slug);
create index changelogs_org_idx on public.changelogs (organization_id);
create index changelogs_status_idx on public.changelogs (status);

create trigger changelogs_set_updated_at
  before update on public.changelogs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- Changelog Labels
-- ------------------------------------------------
create table public.changelog_labels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name varchar(100) not null,
  color varchar(7) not null,
  created_at timestamptz not null default now()
);

create index changelog_labels_org_idx on public.changelog_labels (organization_id);

-- ------------------------------------------------
-- Changelog Label Assignments
-- ------------------------------------------------
create table public.changelog_label_assignments (
  id uuid primary key default gen_random_uuid(),
  changelog_id uuid not null references public.changelogs(id) on delete cascade,
  label_id uuid not null references public.changelog_labels(id) on delete cascade,
  unique (changelog_id, label_id)
);

create index cla_changelog_idx on public.changelog_label_assignments (changelog_id);
create index cla_label_idx on public.changelog_label_assignments (label_id);

-- ------------------------------------------------
-- Changelog Subscriptions
-- ------------------------------------------------
create table public.changelog_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index changelog_subs_customer_idx on public.changelog_subscriptions (customer_id);
create index changelog_subs_org_idx on public.changelog_subscriptions (organization_id);

-- ------------------------------------------------
-- Media Assets
-- ------------------------------------------------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name varchar(255) not null,
  key varchar(512) not null,
  url text not null,
  folder varchar(512) not null default '/',
  type varchar(20) not null,
  mime_type varchar(100) not null,
  size integer not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index media_assets_org_idx on public.media_assets (organization_id);
create index media_assets_type_idx on public.media_assets (type);
create index media_assets_folder_idx on public.media_assets (organization_id, folder);

create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- Media Folders
-- ------------------------------------------------
create table public.media_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name varchar(255) not null,
  path varchar(512) not null,
  parent_path varchar(512) not null default '/',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index media_folders_org_parent_idx on public.media_folders (organization_id, parent_path);
create index media_folders_org_path_idx on public.media_folders (organization_id, path);

-- ------------------------------------------------
-- Content Types
-- ------------------------------------------------
create table public.content_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name varchar(255) not null,
  slug varchar(255) not null,
  version integer not null default 1,
  status public.content_type_status default 'draft',
  schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index content_types_org_idx on public.content_types (organization_id);
create index content_types_org_name_idx on public.content_types (organization_id, name);

create trigger content_types_set_updated_at
  before update on public.content_types
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- Entries
-- ------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type_id uuid not null references public.content_types(id) on delete cascade,
  slug varchar(255) not null,
  status public.entry_status default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, content_type_id, slug)
);

create index entries_org_idx on public.entries (organization_id);
create index entries_org_ct_idx on public.entries (organization_id, content_type_id);
create index entries_status_idx on public.entries (status);

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- Entry Relations
-- ------------------------------------------------
create table public.entry_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  type varchar(100) not null,
  value varchar(512) not null,
  created_at timestamptz not null default now()
);

create index entry_relations_org_idx on public.entry_relations (organization_id);
create index entry_relations_org_entry_idx on public.entry_relations (organization_id, entry_id);
create index entry_relations_org_type_value_idx on public.entry_relations (organization_id, type, value);

-- ------------------------------------------------
-- CMS Media
-- ------------------------------------------------
create table public.cms_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug varchar(255) not null,
  mime_type varchar(100) not null,
  size integer not null,
  metadata jsonb default '{}'::jsonb,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  url text,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index cms_media_org_idx on public.cms_media (organization_id);
create index cms_media_mime_type_idx on public.cms_media (mime_type);

-- ------------------------------------------------
-- Schema Migrations (CMS content type versioning)
-- ------------------------------------------------
create table public.schema_migrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type_id uuid not null references public.content_types(id),
  from_version integer not null,
  to_version integer not null,
  changes jsonb not null,
  status public.schema_migration_status default 'pending',
  created_at timestamptz not null default now()
);

create index schema_migrations_org_idx on public.schema_migrations (organization_id);
create index schema_migrations_org_ct_idx on public.schema_migrations (organization_id, content_type_id);
create index schema_migrations_status_idx on public.schema_migrations (status);
create index schema_migrations_org_ct_version_idx on public.schema_migrations (organization_id, content_type_id, to_version);

-- ------------------------------------------------
-- KV Sync Retry Queue (for Phase 2 — write-path failures)
-- ------------------------------------------------
create table public.kv_sync_retries (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  payload jsonb,
  operation text not null check (operation in ('put', 'delete')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kv_sync_retries_created_idx on public.kv_sync_retries (created_at);
create trigger kv_sync_retries_set_updated_at
  before update on public.kv_sync_retries
  for each row execute function public.set_updated_at();
