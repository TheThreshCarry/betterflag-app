-- ITR-186: close the cross-tenant write bypass on SECURITY DEFINER RPCs.
--
-- Postgres grants EXECUTE to PUBLIC by default. PostgREST exposes every
-- public-schema function to `anon` / `authenticated`, so any dashboard JWT
-- could POST /rest/v1/rpc/kill_flag against another org's UUID.
--
-- 1. Defense in depth: if a user JWT is present (auth.uid() not null), the
--    caller must be an org member. Service-role calls have a null uid and
--    pass (the control plane is the only intended caller).
-- 2. REVOKE EXECUTE on the five mutators from public/anon/authenticated.
--    service_role keeps EXECUTE. Do NOT revoke is_org_member / org_of_project:
--    RLS policies need those for authenticated SELECTs.
--
-- Rollback: see docs/RUNBOOK.md (ITR-186).

create or replace function public.require_org_member(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_org_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

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
language plpgsql security definer
set search_path = public
as $$
begin
  perform public.require_org_member(p_org);
  insert into public.audit_log
    (org_id, project_id, actor_type, actor_id, actor_key_prefix, action, subject, before, after)
  values
    (p_org, p_project, p_actor_type, p_actor_id, p_actor_key_prefix, p_action, p_subject, p_before, p_after);
end;
$$;

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
  perform public.require_org_member(p_org);

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
  perform public.require_org_member(v_org);

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
  perform public.require_org_member(v_org);

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
  perform public.require_org_member(v_org);

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

revoke execute on function public.require_org_member(uuid) from public, anon, authenticated;
revoke execute on function public.record_audit(uuid, uuid, public.actor_type, uuid, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.create_project_with_envs(uuid, text, text, public.actor_type, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_flag_with_configs(uuid, text, text, text, public.flag_kind, jsonb, public.actor_type, uuid, text) from public, anon, authenticated;
revoke execute on function public.update_flag_config(uuid, uuid, boolean, integer, jsonb, jsonb, jsonb, boolean, integer, public.actor_type, uuid, text) from public, anon, authenticated;
revoke execute on function public.kill_flag(uuid, uuid, public.actor_type, uuid, text) from public, anon, authenticated;

grant execute on function public.require_org_member(uuid) to service_role;
grant execute on function public.record_audit(uuid, uuid, public.actor_type, uuid, text, text, text, jsonb, jsonb) to service_role;
grant execute on function public.create_project_with_envs(uuid, text, text, public.actor_type, uuid, text) to service_role;
grant execute on function public.create_flag_with_configs(uuid, text, text, text, public.flag_kind, jsonb, public.actor_type, uuid, text) to service_role;
grant execute on function public.update_flag_config(uuid, uuid, boolean, integer, jsonb, jsonb, jsonb, boolean, integer, public.actor_type, uuid, text) to service_role;
grant execute on function public.kill_flag(uuid, uuid, public.actor_type, uuid, text) to service_role;
