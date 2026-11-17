-- HUT phase 1. Apply only to the reviewed HUT development project after validation.
create table private.staff_roles (

user_id uuid primary key references auth.users(id), role text not null check(role in ('editor','admin')),
status text not null default 'active' check(status in ('active','suspended')), granted_by uuid references auth.users(id) on delete set null,
created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.staff_roles enable row level security;
revoke all on private.staff_roles from public, anon, authenticated;
create table private.data_sources (

id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 180),
source_type text not null check(length(source_type) between 1 and 64), base_url text, terms_url text,
license_name text check(length(license_name) <= 250), reuse_status text not null default 'pending' check(reuse_status in ('pending','permitted','restricted','blocked')),
permitted_uses text check(length(permitted_uses) <= 4000), restrictions text check(length(restrictions) <= 4000),
attribution_required boolean not null default false, reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(reuse_status not in ('permitted','restricted') or (reviewed_at is not null and nullif(trim(permitted_uses),'') is not null)),
check(base_url is null or base_url ~ '^https?://[^[:space:]]+$'), check(terms_url is null or terms_url ~ '^https?://[^[:space:]]+$')
);
alter table private.data_sources enable row level security;
revoke all on private.data_sources from public, anon, authenticated;
create table private.company_sources (

id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
source_id uuid not null references private.data_sources(id), source_url text check(source_url is null or source_url ~ '^https?://[^[:space:]]+$'),
external_record_id text check(length(external_record_id) <= 250), offering_id uuid, coverage_id uuid references public.offering_coverage(id), branch_id uuid, contact_id uuid,
field_keys text[] not null check(cardinality(field_keys) between 1 and 20 and array_position(field_keys,null) is null),
evidence_note text not null check(length(trim(evidence_note)) between 1 and 2000), obtained_at timestamptz not null,
review_status text not null default 'pending' check(review_status in ('pending','approved','rejected','stale')),
reuse_decision text not null default 'pending' check(reuse_decision in ('pending','allowed','denied')),
reuse_notes text check(length(reuse_notes) <= 3000), attribution_text text check(length(attribution_text) <= 1000), attribution_url text,
reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null, review_due_at timestamptz,
created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(num_nonnulls(offering_id,coverage_id,branch_id,contact_id) <= 1),
foreign key(company_id,offering_id) references public.company_offerings(company_id,id) deferrable initially immediate,
foreign key(company_id,branch_id) references public.company_branches(company_id,id) deferrable initially immediate,
foreign key(company_id,contact_id) references public.company_contacts(company_id,id) deferrable initially immediate,
check(review_status <> 'approved' or (reviewed_at is not null and reuse_decision = 'allowed')),
check(review_due_at is null or reviewed_at is null or review_due_at > reviewed_at)
);
alter table private.company_sources enable row level security;
revoke all on private.company_sources from public, anon, authenticated;
create index company_sources_source_id_idx on private.company_sources(source_id);
create index company_sources_offering_id_idx on private.company_sources(offering_id);
create index company_sources_coverage_id_idx on private.company_sources(coverage_id);
create index company_sources_branch_id_idx on private.company_sources(branch_id);
create index company_sources_contact_id_idx on private.company_sources(contact_id);
create index company_sources_company_idx on private.company_sources(company_id);
create index company_sources_external_idx on private.company_sources(source_id,external_record_id);
create table private.company_editorial (

company_id uuid primary key references public.companies(id),
duplicate_review_status text not null default 'pending' check(duplicate_review_status in ('pending','clear','possible_duplicate')),
duplicate_reviewed_at timestamptz, duplicate_reviewed_by uuid references auth.users(id) on delete set null,
publication_decision text not null default 'pending' check(publication_decision in ('pending','approved','hold','withdrawn','merged')),
decision_reason text check(length(decision_reason) <= 2000), decided_at timestamptz, decided_by uuid references auth.users(id) on delete set null,
canonical_company_id uuid references public.companies(id) deferrable initially immediate, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
check((publication_decision = 'merged') = (canonical_company_id is not null)), check(canonical_company_id is distinct from company_id),
check(publication_decision <> 'approved' or (duplicate_review_status = 'clear' and duplicate_reviewed_at is not null)),
check(publication_decision = 'pending' or decided_at is not null)
);
alter table private.company_editorial enable row level security;
revoke all on private.company_editorial from public, anon, authenticated;
create index company_editorial_canonical_idx on private.company_editorial(canonical_company_id);
create table private.company_reports (

id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), contact_id uuid,
duplicate_of_company_id uuid references public.companies(id),
report_type text not null check(report_type in ('correction','outdated_contact','closure','removal','duplicate')),
message text check(length(trim(message)) between 1 and 4000), reply_email text check(reply_email is null or (length(reply_email) <= 254 and reply_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
privacy_notice_version text not null check(length(privacy_notice_version) between 1 and 100),
status text not null default 'new' check(status in ('new','in_review','awaiting_info','resolved','dismissed')),
assigned_to uuid references auth.users(id) on delete set null,
resolution_action text check(resolution_action in ('corrected','partially_corrected','hidden','withdrawn','merged','no_change')),
resolution_summary text check(length(resolution_summary) <= 2000), resolved_at timestamptz,
personal_data_delete_after timestamptz, personal_data_purged_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
foreign key(company_id,contact_id) references public.company_contacts(company_id,id),
check(duplicate_of_company_id is distinct from company_id),
check(message is not null or personal_data_purged_at is not null),
check(personal_data_purged_at is null or (message is null and reply_email is null)),
check((status in ('resolved','dismissed')) = (resolved_at is not null)),
check(status not in ('resolved','dismissed') or (resolution_action is not null and nullif(trim(resolution_summary),'') is not null)),
check(personal_data_delete_after is null or (resolved_at is not null and personal_data_delete_after >= resolved_at)),
check(personal_data_purged_at is null or (resolved_at is not null and personal_data_purged_at >= resolved_at))
);
alter table private.company_reports enable row level security;
revoke all on private.company_reports from public, anon, authenticated;
create index company_reports_company_id_idx on private.company_reports(company_id);
create index company_reports_contact_id_idx on private.company_reports(contact_id);
create index company_reports_duplicate_of_company_id_idx on private.company_reports(duplicate_of_company_id);
create index company_reports_assigned_to_idx on private.company_reports(assigned_to);
create index company_reports_queue_idx on private.company_reports(status,created_at);
create table private.audit_log (

id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id) on delete set null,
actor_kind text not null check(actor_kind in ('staff','system')), action text not null check(length(action) between 1 and 120),
entity_type text not null check(length(entity_type) between 1 and 120), entity_id text not null check(length(entity_id) between 1 and 180),
occurred_at timestamptz not null default now(), change_summary jsonb check(change_summary is null or jsonb_typeof(change_summary) = 'object')
);
alter table private.audit_log enable row level security;
revoke all on private.audit_log from public, anon, authenticated;
create index audit_log_entity_idx on private.audit_log(entity_type,entity_id,occurred_at desc);
create index audit_log_actor_idx on private.audit_log(actor_user_id);
