-- ============================================
-- shipos-app — Custom Access Token Hook + profile trigger
-- Stamps `organization_id` + `role` into the JWT so RLS can key on them.
-- Register in Supabase Studio: Auth → Hooks → Custom Access Token
-- (points at `public.custom_access_token_hook`). Also declared in
-- supabase/config.toml for local dev.
-- ============================================

-- ------------------------------------------------
-- On auth.users insert → create a matching profiles row.
-- Raw user meta ("name", "username") is copied from signup.
-- ------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'username'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------
-- custom_access_token_hook
-- Called by GoTrue on every token mint/refresh.
-- Adds `organization_id` + `role` claims based on profiles.active_organization_id
-- and the user's role in organization_members. Falls back to first org if
-- no active org is set.
-- ------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := (event -> 'user_id')::uuid;
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  org_id uuid;
  member_role public.member_role;
  is_super boolean;
begin
  select p.active_organization_id, p.is_super_admin
    into org_id, is_super
    from public.profiles p
   where p.id = uid;

  -- If no active org selected, fall back to the first membership.
  if org_id is null then
    select om.organization_id
      into org_id
      from public.organization_members om
     where om.user_id = uid
     order by om.created_at asc
     limit 1;
  end if;

  if org_id is not null then
    select om.role
      into member_role
      from public.organization_members om
     where om.user_id = uid
       and om.organization_id = org_id
     limit 1;

    claims := jsonb_set(claims, '{organization_id}', to_jsonb(org_id::text));
    claims := jsonb_set(
      claims,
      '{organization_role}',
      to_jsonb(coalesce(member_role::text, 'member'))
    );
  end if;

  if is_super then
    claims := jsonb_set(claims, '{is_super_admin}', 'true'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grant the auth schema role permission to call the hook.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- ------------------------------------------------
-- Helpers: read claims from the current JWT.
-- ------------------------------------------------
create or replace function public.current_organization_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'organization_id', '')::uuid;
$$;

create or replace function public.current_organization_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'organization_role', 'member');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_super_admin')::boolean, false);
$$;

-- Convenience: check membership in a specific org (used by policies
-- that need to gate cross-org reads on org-scoped tables where the
-- JWT's active org might not match the row's org).
create or replace function public.is_member_of(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
     where user_id = auth.uid()
       and organization_id = org
  );
$$;
