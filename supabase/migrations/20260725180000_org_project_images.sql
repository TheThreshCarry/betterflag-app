-- Public branding assets (served from media.betterflag.app / R2).
-- Full public URL with optional cache-bust query, e.g.
-- https://media.betterflag.app/orgs/{id}/logo.png?v=1721…

alter table public.orgs
  add column if not exists logo_url text;

alter table public.projects
  add column if not exists picture_url text;
