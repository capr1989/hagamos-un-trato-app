-- HUT phase 1. Apply only to the reviewed HUT development project after validation.
create table public.companies (

id uuid primary key default gen_random_uuid(), trade_name text not null check(length(trim(trade_name)) between 1 and 180),
name_normalized text generated always as (lower(regexp_replace(trim(trade_name), '\s+', ' ', 'g'))) stored,
legal_name text check(length(legal_name) <= 250), slug text not null check (length(slug) between 1 and 180 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') unique,
description text check(length(description) <= 5000), publication_status text not null default 'draft' check (publication_status in ('draft','published','hidden','archived')), published_at timestamptz, information_reviewed_at timestamptz,
attribution_text text check(length(attribution_text) <= 1000), attribution_url text check(attribution_url is null or attribution_url ~ '^https?://[^[:space:]]+$'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(publication_status <> 'published' or published_at is not null)
);
alter table public.companies enable row level security;
revoke all on public.companies from public, anon, authenticated;
create index companies_name_normalized_idx on public.companies(name_normalized);
create index companies_search_idx on public.companies using gin(to_tsvector('spanish', trade_name || ' ' || coalesce(description,'')));
create table public.company_offerings (

id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
category_id uuid not null references public.categories(id), service_id uuid, publication_status text not null default 'draft' check (publication_status in ('draft','published','hidden','archived')), attribution_text text check(length(attribution_text) <= 1000), attribution_url text check(attribution_url is null or attribution_url ~ '^https?://[^[:space:]]+$'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
unique(company_id,id), foreign key(category_id,service_id) references public.services(category_id,id),
unique nulls not distinct(company_id,category_id,service_id)
);
alter table public.company_offerings enable row level security;
revoke all on public.company_offerings from public, anon, authenticated;
create index company_offerings_category_idx on public.company_offerings(category_id,service_id,company_id);
create table public.offering_coverage (

id uuid primary key default gen_random_uuid(), offering_id uuid not null references public.company_offerings(id),
location_id uuid not null references public.locations(id),
coverage_status text not null check(coverage_status in ('confirmed','not_served','disputed')),
include_descendants boolean not null default false, publication_status text not null default 'draft' check (publication_status in ('draft','published','hidden','archived')), attribution_text text check(length(attribution_text) <= 1000), attribution_url text check(attribution_url is null or attribution_url ~ '^https?://[^[:space:]]+$'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(offering_id,location_id)
);
alter table public.offering_coverage enable row level security;
revoke all on public.offering_coverage from public, anon, authenticated;
create index offering_coverage_location_idx on public.offering_coverage(location_id,offering_id);
create table public.company_branches (

id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
name text check(length(name) <= 180), location_id uuid not null references public.locations(id),
public_address text check(public_address is null or length(trim(public_address)) between 5 and 500),
presence_status text not null default 'unconfirmed' check(presence_status in ('unconfirmed','documented','closed')),
publication_status text not null default 'draft' check (publication_status in ('draft','published','hidden','archived')), attribution_text text check(length(attribution_text) <= 1000), attribution_url text check(attribution_url is null or attribution_url ~ '^https?://[^[:space:]]+$'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,id)
);
alter table public.company_branches enable row level security;
revoke all on public.company_branches from public, anon, authenticated;
create index company_branches_location_idx on public.company_branches(location_id,company_id);
