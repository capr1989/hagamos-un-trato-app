-- HUT phase 1. Apply only to the reviewed HUT development project after validation.
create table public.categories (

id uuid primary key default gen_random_uuid(), parent_id uuid references public.categories(id) deferrable initially immediate,
code text not null unique check(code ~ '^[a-z0-9_]+$'), name text not null check(length(trim(name)) between 1 and 160),
slug text not null check (length(slug) between 1 and 180 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description text check(length(description) <= 3000), sort_order integer not null default 0 check(sort_order >= 0),
is_active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(parent_id is distinct from id), unique nulls not distinct(parent_id,slug)
);
alter table public.categories enable row level security;
revoke all on public.categories from public, anon, authenticated;
create index categories_parent_idx on public.categories(parent_id);
create table public.services (

id uuid primary key default gen_random_uuid(), category_id uuid not null references public.categories(id),
code text not null check(code ~ '^[a-z0-9_]+$'), name text not null check(length(trim(name)) between 1 and 160),
slug text not null check (length(slug) between 1 and 180 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), description text check(length(description) <= 3000), sort_order integer not null default 0 check(sort_order >= 0),
is_active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(category_id,code), unique(category_id,slug), unique(category_id,id)
);
alter table public.services enable row level security;
revoke all on public.services from public, anon, authenticated;
