-- ============================================
-- shipos-app — billing tables (Phase 1, populated in Phase 5)
-- Source of truth for Polar subscriptions/orders. RLS-protected.
-- ============================================

-- ------------------------------------------------
-- polar_customers — 1:1 map auth.users → Polar customer
-- ------------------------------------------------
create table public.polar_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  polar_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create index polar_customers_org_idx on public.polar_customers (organization_id);

-- ------------------------------------------------
-- subscriptions
-- ------------------------------------------------
create table public.subscriptions (
  polar_subscription_id text primary key,
  polar_customer_id text not null references public.polar_customers(polar_customer_id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  product_id text not null,
  status public.subscription_status not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_customer_idx on public.subscriptions (polar_customer_id);
create index subscriptions_org_idx on public.subscriptions (organization_id);
create index subscriptions_status_idx on public.subscriptions (status);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------
-- orders
-- ------------------------------------------------
create table public.orders (
  polar_order_id text primary key,
  polar_customer_id text not null references public.polar_customers(polar_customer_id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  product_id text not null,
  amount integer not null,
  currency text not null default 'USD',
  paid_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index orders_customer_idx on public.orders (polar_customer_id);
create index orders_org_idx on public.orders (organization_id);
create index orders_paid_at_idx on public.orders (paid_at);
