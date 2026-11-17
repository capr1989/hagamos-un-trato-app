-- HUT phase 1. Apply only to the reviewed HUT development project after validation.
create table public.countries (

code text primary key check(code ~ '^[A-Z]{2}$'), name text not null check(length(trim(name)) between 1 and 120),
default_locale text not null check(length(default_locale) between 2 and 35), is_active boolean not null default false,
created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.countries enable row level security;
revoke all on public.countries from public, anon, authenticated;
create table public.locations (

id uuid primary key default gen_random_uuid(), country_code text not null references public.countries(code),
parent_id uuid, kind text not null check(kind in ('country','administrative_area','city','locality')),
name text not null check(length(trim(name)) between 1 and 160), slug text not null check (length(slug) between 1 and 180 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
official_code text check(length(official_code) <= 100), reference_url text check(reference_url is null or reference_url ~ '^https?://[^[:space:]]+$'),
is_active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
unique(country_code,id), foreign key(country_code,parent_id) references public.locations(country_code,id) deferrable initially immediate,
check(parent_id is distinct from id), check((kind = 'country') = (parent_id is null)),
unique nulls not distinct(country_code,parent_id,slug)
);
alter table public.locations enable row level security;
revoke all on public.locations from public, anon, authenticated;
create index locations_parent_idx on public.locations(country_code,parent_id);
create unique index locations_country_root_idx on public.locations(country_code) where kind = 'country';
create table public.directory_markets (

id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[a-z0-9_]+$'),
country_code text not null references public.countries(code), location_id uuid not null,
display_name text not null check(length(trim(display_name)) between 1 and 160), include_descendants boolean not null default false,
status text not null default 'draft' check(status in ('draft','active','paused')), launched_at timestamptz,
created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(country_code,location_id),
foreign key(country_code,location_id) references public.locations(country_code,id),
check(status <> 'active' or launched_at is not null)
);
alter table public.directory_markets enable row level security;
revoke all on public.directory_markets from public, anon, authenticated;
create index directory_markets_location_idx on public.directory_markets(country_code,location_id);
