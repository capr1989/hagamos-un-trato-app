-- HUT phase 1. Apply only to the reviewed HUT development project after validation.
create table public.company_contacts (

id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), branch_id uuid,
channel text not null check(channel in ('phone','whatsapp','email','website')), value text not null check(length(value) between 3 and 500),
label text check(length(label) <= 120), sort_order integer not null default 0 check(sort_order >= 0),
contact_status text not null default 'needs_review' check(contact_status in ('needs_review','active','invalid','disputed','retired')),
last_reviewed_at timestamptz, review_due_at timestamptz, retired_at timestamptz,
publication_status text not null default 'draft' check (publication_status in ('draft','published','hidden','archived')), attribution_text text check(length(attribution_text) <= 1000), attribution_url text check(attribution_url is null or attribution_url ~ '^https?://[^[:space:]]+$'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,id),
foreign key(company_id,branch_id) references public.company_branches(company_id,id),
check((channel in ('phone','whatsapp') and value ~ '^\+[1-9][0-9]{6,14}$')
   or (channel = 'email' and value = lower(value) and value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   or (channel = 'website' and value ~ '^https?://[^[:space:]/]+[^[:space:]]*$')),
check(contact_status <> 'active' or (last_reviewed_at is not null and review_due_at is not null and review_due_at > last_reviewed_at)),
check(contact_status <> 'retired' or retired_at is not null)
);
alter table public.company_contacts enable row level security;
revoke all on public.company_contacts from public, anon, authenticated;
create unique index company_contacts_active_unique_idx on public.company_contacts(company_id,branch_id,channel,value) nulls not distinct where contact_status = 'active';
create index company_contacts_branch_idx on public.company_contacts(company_id,branch_id);
create index company_contacts_review_due_idx on public.company_contacts(review_due_at) where contact_status = 'active';
create table public.directory_pages (

id uuid primary key default gen_random_uuid(), market_id uuid not null references public.directory_markets(id),
category_id uuid not null references public.categories(id), service_id uuid, location_id uuid references public.locations(id),
path text not null unique check(path ~ '^/[a-z0-9/-]+$' and path not like '%//%' and path not like '%/../%'),
title text not null check(length(trim(title)) between 1 and 180), meta_description text check(length(meta_description) <= 320),
introduction text check(length(introduction) <= 10000), publication_status text not null default 'draft' check (publication_status in ('draft','published','hidden','archived')),
indexation_status text not null default 'noindex' check(indexation_status in ('noindex','indexable')), published_at timestamptz,
created_at timestamptz not null default now(), updated_at timestamptz not null default now(), foreign key(category_id,service_id) references public.services(category_id,id),
unique nulls not distinct(market_id,category_id,service_id,location_id),
check(publication_status <> 'published' or published_at is not null)
);
alter table public.directory_pages enable row level security;
revoke all on public.directory_pages from public, anon, authenticated;
create index directory_pages_location_idx on public.directory_pages(location_id);
create index directory_pages_category_idx on public.directory_pages(category_id,service_id);
create table public.company_url_aliases (

alias_slug text primary key check(length(alias_slug) between 1 and 180 and alias_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
target_company_id uuid not null references public.companies(id), created_at timestamptz not null default now()
);
alter table public.company_url_aliases enable row level security;
revoke all on public.company_url_aliases from public, anon, authenticated;
create index company_url_aliases_target_idx on public.company_url_aliases(target_company_id);
