-- ============================================
-- shipos-app — Row Level Security (Rule 4)
-- Pattern: every tenant table gates by current_organization_id()
-- OR cross-org membership via is_member_of(row.organization_id).
-- Service role bypasses RLS implicitly.
-- ============================================

-- ------------------------------------------------
-- Enable RLS on every tenant-scoped table.
-- ------------------------------------------------
alter table public.organizations                 enable row level security;
alter table public.profiles                      enable row level security;
alter table public.organization_members          enable row level security;
alter table public.invitations                   enable row level security;
alter table public.api_keys                      enable row level security;
alter table public.feature_flags                 enable row level security;
alter table public.global_configs                enable row level security;
alter table public.customers                     enable row level security;
alter table public.changelogs                    enable row level security;
alter table public.changelog_labels              enable row level security;
alter table public.changelog_label_assignments   enable row level security;
alter table public.changelog_subscriptions       enable row level security;
alter table public.media_assets                  enable row level security;
alter table public.media_folders                 enable row level security;
alter table public.content_types                 enable row level security;
alter table public.entries                       enable row level security;
alter table public.entry_relations               enable row level security;
alter table public.cms_media                     enable row level security;
alter table public.schema_migrations             enable row level security;
alter table public.polar_customers               enable row level security;
alter table public.subscriptions                 enable row level security;
alter table public.orders                        enable row level security;
alter table public.kv_sync_retries               enable row level security;

-- ------------------------------------------------
-- organizations — visible only to members; writes require admin+
-- ------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_member_of(id) or public.is_super_admin());

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (true);

create policy organizations_update on public.organizations
  for update to authenticated
  using (
    (id = public.current_organization_id()
     and public.current_organization_role() in ('owner', 'admin'))
    or public.is_super_admin()
  );

create policy organizations_delete on public.organizations
  for delete to authenticated
  using (
    (id = public.current_organization_id()
     and public.current_organization_role() = 'owner')
    or public.is_super_admin()
  );

-- ------------------------------------------------
-- profiles — a user sees their own profile; updates own profile
-- ------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------
-- organization_members — members see their org's roster; owners/admins manage
-- ------------------------------------------------
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (
    public.is_member_of(organization_id) or public.is_super_admin()
  );

create policy organization_members_insert on public.organization_members
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  );

create policy organization_members_update on public.organization_members
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  );

create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  );

-- ------------------------------------------------
-- invitations — members read; admins/owners write
-- ------------------------------------------------
create policy invitations_select on public.invitations
  for select to authenticated
  using (
    public.is_member_of(organization_id) or public.is_super_admin()
  );

create policy invitations_write on public.invitations
  for all to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  );

-- ------------------------------------------------
-- api_keys — admins/owners only
-- ------------------------------------------------
create policy api_keys_select on public.api_keys
  for select to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  );

create policy api_keys_write on public.api_keys
  for all to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.current_organization_role() in ('owner', 'admin')
  );

-- ------------------------------------------------
-- Tenant data: pattern macro applied to every org-scoped table.
-- select: any member. insert/update/delete: any member role.
-- ------------------------------------------------
do $$
declare
  tenant_table text;
  tenant_tables text[] := array[
    'feature_flags',
    'global_configs',
    'customers',
    'changelogs',
    'changelog_labels',
    'changelog_subscriptions',
    'media_assets',
    'media_folders',
    'content_types',
    'entries',
    'entry_relations',
    'cms_media',
    'schema_migrations'
  ];
begin
  foreach tenant_table in array tenant_tables loop
    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using (organization_id = public.current_organization_id()
               or public.is_super_admin());
    $f$, tenant_table || '_select', tenant_table);

    execute format($f$
      create policy %I on public.%I
        for insert to authenticated
        with check (organization_id = public.current_organization_id());
    $f$, tenant_table || '_insert', tenant_table);

    execute format($f$
      create policy %I on public.%I
        for update to authenticated
        using (organization_id = public.current_organization_id())
        with check (organization_id = public.current_organization_id());
    $f$, tenant_table || '_update', tenant_table);

    execute format($f$
      create policy %I on public.%I
        for delete to authenticated
        using (organization_id = public.current_organization_id()
               and public.current_organization_role() in ('owner', 'admin'));
    $f$, tenant_table || '_delete', tenant_table);
  end loop;
end $$;

-- ------------------------------------------------
-- changelog_label_assignments — gated via parent changelog org
-- ------------------------------------------------
create policy cla_select on public.changelog_label_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.changelogs c
       where c.id = changelog_id
         and (c.organization_id = public.current_organization_id()
              or public.is_super_admin())
    )
  );

create policy cla_write on public.changelog_label_assignments
  for all to authenticated
  using (
    exists (
      select 1 from public.changelogs c
       where c.id = changelog_id
         and c.organization_id = public.current_organization_id()
    )
  )
  with check (
    exists (
      select 1 from public.changelogs c
       where c.id = changelog_id
         and c.organization_id = public.current_organization_id()
    )
  );

-- ------------------------------------------------
-- Billing tables: read-only from the dashboard, writes via service role only
-- (Polar webhook handler uses service-role key).
-- ------------------------------------------------
create policy polar_customers_select on public.polar_customers
  for select to authenticated
  using (
    user_id = auth.uid()
    or (organization_id is not null
        and organization_id = public.current_organization_id()
        and public.current_organization_role() in ('owner', 'admin'))
    or public.is_super_admin()
  );

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (
    (organization_id is not null
     and organization_id = public.current_organization_id()
     and public.current_organization_role() in ('owner', 'admin'))
    or public.is_super_admin()
  );

create policy orders_select on public.orders
  for select to authenticated
  using (
    (organization_id is not null
     and organization_id = public.current_organization_id()
     and public.current_organization_role() in ('owner', 'admin'))
    or public.is_super_admin()
  );

-- ------------------------------------------------
-- kv_sync_retries — service role only (no user policies → deny all for authenticated)
-- Leave RLS enabled with no policies so only service-role can access.
-- ------------------------------------------------
