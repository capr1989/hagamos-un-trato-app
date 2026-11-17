-- HUT phase 1. Apply only to the reviewed HUT development project after validation.
create function private.has_staff_role(required_role text default null) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from private.staff_roles s
 where s.user_id = auth.uid() and s.status = 'active' and (required_role is null or s.role = required_role))
$$;

create function private.location_distance(child uuid, ancestor uuid) returns integer
language sql stable security definer set search_path = '' as $$
 with recursive chain as (
 select l.id,l.parent_id,0 as depth,array[l.id] as seen from public.locations l where l.id=child
 union all select l.id,l.parent_id,c.depth+1,c.seen||l.id from chain c join public.locations l on l.id=c.parent_id
 where not l.id=any(c.seen) and c.depth < 100)
 select min(depth)::integer from chain where id=ancestor
$$;

create function private.location_usable(loc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 with recursive chain as (
 select l.id,l.parent_id,l.country_code,l.is_active,array[l.id] as seen from public.locations l where l.id=loc
 union all select l.id,l.parent_id,l.country_code,l.is_active,c.seen||l.id from chain c join public.locations l on l.id=c.parent_id
 where not l.id=any(c.seen) and cardinality(c.seen)<100)
 select coalesce(bool_and(c.is_active and p.is_active),false) from chain c join public.countries p on p.code=c.country_code
$$;

create function private.market_active(mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.directory_markets m where m.id=mid and m.status='active' and private.location_usable(m.location_id))
$$;

create function private.category_active(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 with recursive chain as (
 select id,parent_id,is_active,array[id] as seen from public.categories where id=cid
 union all select p.id,p.parent_id,p.is_active,c.seen||p.id from chain c join public.categories p on p.id=c.parent_id
 where not p.id=any(c.seen) and cardinality(c.seen)<100)
 select coalesce(bool_and(is_active),false) from chain
$$;

create function private.evidence_ok(cid uuid, kind text, eid uuid, fields text[], review_after timestamptz default null) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (
 select 1 from private.company_sources e join private.data_sources s on s.id=e.source_id
 where e.company_id=cid and e.review_status='approved' and e.reuse_decision='allowed'
 and s.reuse_status in ('permitted','restricted') and e.reviewed_at is not null
 and (review_after is null or e.reviewed_at >= review_after)
 and (e.review_due_at is null or e.review_due_at>now()) and e.field_keys @> fields
 and case kind
 when 'company' then e.offering_id is null and e.coverage_id is null and e.branch_id is null and e.contact_id is null and cid=eid
 when 'offering' then e.offering_id=eid
 when 'coverage' then e.coverage_id=eid
 when 'branch' then e.branch_id=eid
 when 'contact' then e.contact_id=eid else false end
 and (not s.attribution_required or (
   nullif(trim(e.attribution_text),'') is not null and exists (
     select 1 from (
       select id,attribution_text,attribution_url from public.companies where kind='company'
       union all select id,attribution_text,attribution_url from public.company_offerings where kind='offering'
       union all select id,attribution_text,attribution_url from public.offering_coverage where kind='coverage'
       union all select id,attribution_text,attribution_url from public.company_branches where kind='branch'
       union all select id,attribution_text,attribution_url from public.company_contacts where kind='contact'
     ) a where a.id=eid and a.attribution_text=e.attribution_text and a.attribution_url is not distinct from e.attribution_url
   )
 ))
 )
$$;

create function private.offer_ready(oid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.company_offerings o where o.id=oid and o.publication_status='published'
 and private.category_active(o.category_id)
 and (o.service_id is null or exists(select 1 from public.services s where s.id=o.service_id and s.is_active and s.category_id=o.category_id))
 and private.evidence_ok(o.company_id,'offering',o.id,case when o.service_id is null then array['category_id'] else array['category_id','service_id'] end))
$$;

create function private.branch_ready(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.company_branches b where b.id=bid and b.publication_status='published'
 and b.presence_status='documented' and private.location_usable(b.location_id)
 and private.evidence_ok(b.company_id,'branch',b.id,array['location_id','presence_status'])
 and (b.public_address is null or private.evidence_ok(b.company_id,'branch',b.id,array['public_address'])))
$$;

create function private.has_presence(cid uuid,mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.company_branches b join public.directory_markets m on m.id=mid
 where b.company_id=cid and private.market_active(mid) and private.branch_ready(b.id)
 and (b.location_id=m.location_id or (m.include_descendants and private.location_distance(b.location_id,m.location_id) is not null)))
$$;

create function private.coverage_state(oid uuid,mid uuid) returns text
language sql stable security definer set search_path = '' as $$
 select coalesce((select c.coverage_status from public.offering_coverage c
 join public.company_offerings o on o.id=c.offering_id join public.directory_markets m on m.id=mid
 where o.id=oid and private.market_active(mid) and c.publication_status='published'
 and private.location_usable(c.location_id)
 and (c.location_id=m.location_id or (c.include_descendants and private.location_distance(m.location_id,c.location_id) is not null))
 and private.evidence_ok(o.company_id,'coverage',c.id,array['location_id','coverage_status'])
 order by private.location_distance(m.location_id,c.location_id) nulls last limit 1),'unconfirmed')
$$;

create function private.contact_ready(kid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.company_contacts k where k.id=kid and k.publication_status='published'
 and k.contact_status='active' and k.last_reviewed_at is not null and k.review_due_at>now()
 and (k.branch_id is null or private.branch_ready(k.branch_id))
 and private.evidence_ok(k.company_id,'contact',k.id,array['value','channel'],k.last_reviewed_at))
$$;

create function private.company_visible(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.companies c join private.company_editorial e on e.company_id=c.id
 where c.id=cid and c.publication_status='published' and e.publication_decision='approved' and e.duplicate_review_status='clear'
 and private.evidence_ok(c.id,'company',c.id,array['trade_name'])
 and (c.legal_name is null or private.evidence_ok(c.id,'company',c.id,array['legal_name']))
 and (c.description is null or private.evidence_ok(c.id,'company',c.id,array['description']))
 and exists(select 1 from public.company_offerings o where o.company_id=c.id and private.offer_ready(o.id))
 and (exists(select 1 from public.company_contacts k where k.company_id=c.id and private.contact_ready(k.id))
   or exists(select 1 from public.company_branches b where b.company_id=c.id and b.public_address is not null and private.branch_ready(b.id)))
 and exists(select 1 from public.directory_markets m where private.market_active(m.id)
 and (private.has_presence(c.id,m.id) or exists(select 1 from public.company_offerings o where o.company_id=c.id and private.offer_ready(o.id) and private.coverage_state(o.id,m.id)='confirmed'))))
$$;

-- Public predicates return only visibility/status of publishable records; no evidence or reasons.
create function private.public_presence(cid uuid,mid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.company_visible(cid) and private.has_presence(cid,mid)
$$;
create function private.public_coverage(oid uuid,mid uuid) returns text
language sql stable security definer set search_path = '' as $$
 select case when private.company_visible(o.company_id) and private.offer_ready(o.id) and private.market_active(mid)
 and (private.has_presence(o.company_id,mid) or private.coverage_state(oid,mid)='confirmed')
 then private.coverage_state(oid,mid) else null end from public.company_offerings o where o.id=oid
$$;
create function private.row_visible(kind text,eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select case kind
 when 'company' then private.company_visible(eid)
 when 'offering' then exists(select 1 from public.company_offerings o where o.id=eid and private.company_visible(o.company_id) and private.offer_ready(o.id)
   and exists(select 1 from public.directory_markets m where private.market_active(m.id) and (private.has_presence(o.company_id,m.id) or private.coverage_state(o.id,m.id)='confirmed')))
 when 'branch' then exists(select 1 from public.company_branches b where b.id=eid and private.company_visible(b.company_id) and private.branch_ready(b.id))
 when 'contact' then exists(select 1 from public.company_contacts k where k.id=eid and private.company_visible(k.company_id) and private.contact_ready(k.id))
 when 'coverage' then exists(select 1 from public.offering_coverage c join public.company_offerings o on o.id=c.offering_id
   where c.id=eid and private.company_visible(o.company_id) and private.offer_ready(o.id) and c.publication_status='published'
   and private.evidence_ok(o.company_id,'coverage',c.id,array['location_id','coverage_status'])
   and exists(select 1 from public.directory_markets m where private.market_active(m.id) and c.location_id=m.location_id))
 when 'page' then exists(select 1 from public.directory_pages p where p.id=eid and p.publication_status='published'
   and private.market_active(p.market_id) and private.category_active(p.category_id)
   and (p.service_id is null or exists(select 1 from public.services s where s.id=p.service_id and s.is_active)))
 else false end
$$;

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end $$;

create function private.guard_hierarchy() returns trigger language plpgsql security definer set search_path = '' as $$
declare found_cycle boolean;
begin
 perform pg_catalog.pg_advisory_xact_lock(730031);
 if tg_table_name='locations' then
   with recursive p as (select id,parent_id,array[id] as seen from public.locations where id=new.parent_id
     union all select l.id,l.parent_id,p.seen||l.id from p join public.locations l on l.id=p.parent_id where not l.id=any(p.seen))
   select exists(select 1 from p where id=new.id) into found_cycle;
 else
   with recursive p as (select id,parent_id,array[id] as seen from public.categories where id=new.parent_id
     union all select c.id,c.parent_id,p.seen||c.id from p join public.categories c on c.id=p.parent_id where not c.id=any(p.seen))
   select exists(select 1 from p where id=new.id) into found_cycle;
 end if;
 if found_cycle then raise exception using errcode='23514',message='Hierarchy cycle is forbidden'; end if;
 return new;
end $$;

create function private.check_evidence_company() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.coverage_id is not null and not exists(select 1 from public.offering_coverage c join public.company_offerings o on o.id=c.offering_id where c.id=new.coverage_id and o.company_id=new.company_id)
 then raise exception using errcode='23514',message='Coverage evidence must belong to its company'; end if;
 return new;
end $$;

create function private.check_catalog_links() returns trigger language plpgsql security definer set search_path = '' as $$
declare m public.directory_markets;
begin
 if tg_table_name='company_contacts' then
   if tg_op='UPDATE' then
     if new.value is distinct from old.value or new.channel is distinct from old.channel then
       raise exception using errcode='23514',message='Create a new contact instead of replacing its value';
     end if;
   end if;
 elsif tg_table_name='directory_pages' then
   select * into m from public.directory_markets where id=new.market_id;
   if new.location_id is not null and not (new.location_id=m.location_id or (m.include_descendants and private.location_distance(new.location_id,m.location_id) is not null)) then
     raise exception using errcode='23514',message='Page location must be inside its market';
   end if;
 end if;
 return new;
end $$;

create function private.check_canonical_links() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(730032);
 if exists(select 1 from private.company_editorial e join private.company_editorial t on t.company_id=e.canonical_company_id where e.publication_decision='merged' and t.publication_decision='merged') then
   raise exception using errcode='23514',message='Merged companies must point directly to a canonical company';
 end if;
 if exists(select 1 from public.company_url_aliases a join public.companies c on c.slug=a.alias_slug where c.publication_status='published')
 or exists(select 1 from public.company_url_aliases a join public.companies t on t.id=a.target_company_id where a.alias_slug=t.slug)
 or exists(select 1 from public.company_url_aliases a join private.company_editorial e on e.company_id=a.target_company_id where e.publication_decision='merged') then
   raise exception using errcode='23514',message='Alias must point directly to a canonical company without slug collision';
 end if;
 return null;
end $$;

create function private.guard_editorial() returns trigger language plpgsql security definer set search_path = '' as $$
declare sensitive boolean;
begin
 if tg_op='UPDATE' then
   sensitive=old.publication_decision in ('withdrawn','merged') or new.publication_decision in ('withdrawn','merged');
 else
   sensitive=new.publication_decision in ('withdrawn','merged');
 end if;
 if sensitive and not private.has_staff_role('admin') and current_setting('role',true) not in ('none','postgres') then
   raise exception using errcode='42501',message='Administrator required for withdrawal, merger or reactivation';
 end if;
 return new;
end $$;

create function private.coverage_evidence_integrity() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from private.company_sources e join public.offering_coverage c on c.id=e.coverage_id
   join public.company_offerings o on o.id=c.offering_id where e.company_id<>o.company_id) then
   raise exception using errcode='23514',message='Coverage evidence must retain its company after reparenting';
 end if;
 return null;
end $$;

create function private.sync_editorial() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.publication_decision in ('hold','withdrawn','merged') then
   update public.companies set publication_status=case when new.publication_decision='merged' then 'archived' else 'hidden' end where id=new.company_id and publication_status='published';
 end if;
 return new;
end $$;

create function private.invalidate_fact_evidence() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_fact jsonb; new_fact jsonb;
begin
 old_fact=to_jsonb(old)-array['publication_status','updated_at','published_at','information_reviewed_at','contact_status','last_reviewed_at','review_due_at','retired_at','sort_order'];
 new_fact=to_jsonb(new)-array['publication_status','updated_at','published_at','information_reviewed_at','contact_status','last_reviewed_at','review_due_at','retired_at','sort_order'];
 if old_fact is distinct from new_fact then
   update private.company_sources e set review_status='stale' where e.review_status='approved' and
     case tg_table_name when 'companies' then e.company_id=old.id and num_nonnulls(e.offering_id,e.coverage_id,e.branch_id,e.contact_id)=0
       when 'company_offerings' then e.offering_id=old.id when 'offering_coverage' then e.coverage_id=old.id
       when 'company_branches' then e.branch_id=old.id when 'company_contacts' then e.contact_id=old.id else false end;
 end if;
 return new;
end $$;

create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb; entity text;
begin
 r=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 entity=coalesce(r->>'id',r->>'company_id',r->>'user_id',r->>'code',r->>'alias_slug');
 insert into private.audit_log(actor_user_id,actor_kind,action,entity_type,entity_id,change_summary)
 values(auth.uid(),case when auth.uid() is null then 'system' else 'staff' end,lower(tg_op),tg_table_schema||'.'||tg_table_name,entity,jsonb_build_object('operation',tg_op));
 return case when tg_op='DELETE' then old else new end;
end $$;

-- Evidence of fact changes becomes stale; expiry and source withdrawal also fail closed in reads.
create trigger touch_updated_at before update on public.countries for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.countries for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.locations for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.locations for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.directory_markets for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.directory_markets for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.categories for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.categories for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.services for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.services for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.companies for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.companies for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.company_offerings for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.company_offerings for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.offering_coverage for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.offering_coverage for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.company_branches for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.company_branches for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.company_contacts for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.company_contacts for each row execute function private.audit_change();
create trigger touch_updated_at before update on public.directory_pages for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on public.directory_pages for each row execute function private.audit_change();
create trigger audit_change after insert or update or delete on public.company_url_aliases for each row execute function private.audit_change();
create trigger touch_updated_at before update on private.staff_roles for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on private.staff_roles for each row execute function private.audit_change();
create trigger touch_updated_at before update on private.data_sources for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on private.data_sources for each row execute function private.audit_change();
create trigger touch_updated_at before update on private.company_sources for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on private.company_sources for each row execute function private.audit_change();
create trigger touch_updated_at before update on private.company_editorial for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on private.company_editorial for each row execute function private.audit_change();
create trigger touch_updated_at before update on private.company_reports for each row execute function private.touch_updated_at();
create trigger audit_change after insert or update or delete on private.company_reports for each row execute function private.audit_change();
create trigger invalidate_fact_evidence after update on public.companies for each row execute function private.invalidate_fact_evidence();
create trigger invalidate_fact_evidence after update on public.company_offerings for each row execute function private.invalidate_fact_evidence();
create trigger invalidate_fact_evidence after update on public.offering_coverage for each row execute function private.invalidate_fact_evidence();
create trigger invalidate_fact_evidence after update on public.company_branches for each row execute function private.invalidate_fact_evidence();
create trigger invalidate_fact_evidence after update on public.company_contacts for each row execute function private.invalidate_fact_evidence();
create trigger guard_hierarchy before insert or update on public.locations for each row execute function private.guard_hierarchy();
create trigger guard_hierarchy before insert or update on public.categories for each row execute function private.guard_hierarchy();
create trigger check_catalog_links before insert or update on public.company_contacts for each row execute function private.check_catalog_links();
create trigger check_catalog_links before insert or update on public.directory_pages for each row execute function private.check_catalog_links();

create trigger check_evidence_company before insert or update on private.company_sources for each row execute function private.check_evidence_company();
create constraint trigger coverage_evidence_integrity after update on public.offering_coverage deferrable initially deferred for each row execute function private.coverage_evidence_integrity();
create constraint trigger coverage_evidence_integrity after update on public.company_offerings deferrable initially deferred for each row execute function private.coverage_evidence_integrity();
create trigger guard_editorial before insert or update on private.company_editorial for each row execute function private.guard_editorial();
create trigger sync_editorial after insert or update on private.company_editorial for each row execute function private.sync_editorial();
create constraint trigger check_canonical_links after insert or update on private.company_editorial deferrable initially deferred for each row execute function private.check_canonical_links();
create constraint trigger check_canonical_links after insert or update on public.company_url_aliases deferrable initially deferred for each row execute function private.check_canonical_links();
create constraint trigger check_canonical_links after insert or update on public.companies deferrable initially deferred for each row execute function private.check_canonical_links();

revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema public to anon,authenticated,service_role;
grant usage on schema private to anon,authenticated,service_role;
grant execute on function private.has_staff_role(text) to authenticated;
grant execute on function private.row_visible(text,uuid), private.company_visible(uuid), private.market_active(uuid),
 private.category_active(uuid), private.public_presence(uuid,uuid), private.public_coverage(uuid,uuid) to anon,authenticated;
grant select on public.countries to anon,authenticated;
create policy published_read on public.countries for select to anon,authenticated using (is_active);
create policy staff_read on public.countries for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.countries to authenticated;
create policy staff_insert on public.countries for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.countries for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.locations to anon,authenticated;
create policy published_read on public.locations for select to anon,authenticated using (is_active and exists(select 1 from public.countries c where c.code=country_code and c.is_active));
create policy staff_read on public.locations for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.locations to authenticated;
create policy staff_insert on public.locations for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.locations for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.directory_markets to anon,authenticated;
create policy published_read on public.directory_markets for select to anon,authenticated using (private.market_active(id));
create policy staff_read on public.directory_markets for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.directory_markets to authenticated;
create policy staff_insert on public.directory_markets for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.directory_markets for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.categories to anon,authenticated;
create policy published_read on public.categories for select to anon,authenticated using (private.category_active(id));
create policy staff_read on public.categories for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.categories to authenticated;
create policy staff_insert on public.categories for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.categories for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.services to anon,authenticated;
create policy published_read on public.services for select to anon,authenticated using (is_active and private.category_active(category_id));
create policy staff_read on public.services for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.services to authenticated;
create policy staff_insert on public.services for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.services for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.companies to anon,authenticated;
create policy published_read on public.companies for select to anon,authenticated using (private.row_visible('company',id));
create policy staff_read on public.companies for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.companies to authenticated;
create policy staff_insert on public.companies for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.companies for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.company_offerings to anon,authenticated;
create policy published_read on public.company_offerings for select to anon,authenticated using (private.row_visible('offering',id));
create policy staff_read on public.company_offerings for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.company_offerings to authenticated;
create policy staff_insert on public.company_offerings for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.company_offerings for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.offering_coverage to anon,authenticated;
create policy published_read on public.offering_coverage for select to anon,authenticated using (private.row_visible('coverage',id));
create policy staff_read on public.offering_coverage for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.offering_coverage to authenticated;
create policy staff_insert on public.offering_coverage for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.offering_coverage for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.company_branches to anon,authenticated;
create policy published_read on public.company_branches for select to anon,authenticated using (private.row_visible('branch',id));
create policy staff_read on public.company_branches for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.company_branches to authenticated;
create policy staff_insert on public.company_branches for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.company_branches for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.company_contacts to anon,authenticated;
create policy published_read on public.company_contacts for select to anon,authenticated using (private.row_visible('contact',id));
create policy staff_read on public.company_contacts for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.company_contacts to authenticated;
create policy staff_insert on public.company_contacts for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.company_contacts for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.directory_pages to anon,authenticated;
create policy published_read on public.directory_pages for select to anon,authenticated using (private.row_visible('page',id));
create policy staff_read on public.directory_pages for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.directory_pages to authenticated;
create policy staff_insert on public.directory_pages for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on public.directory_pages for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant select on public.company_url_aliases to anon,authenticated;
create policy published_read on public.company_url_aliases for select to anon,authenticated using (private.company_visible(target_company_id));
create policy staff_read on public.company_url_aliases for select to authenticated using ((select private.has_staff_role()));
grant insert,update on public.company_url_aliases to authenticated;
create policy staff_insert on public.company_url_aliases for insert to authenticated with check ((select private.has_staff_role('admin')));
create policy staff_update on public.company_url_aliases for update to authenticated using ((select private.has_staff_role('admin'))) with check ((select private.has_staff_role('admin')));
grant all on public.countries to service_role;
grant all on public.locations to service_role;
grant all on public.directory_markets to service_role;
grant all on public.categories to service_role;
grant all on public.services to service_role;
grant all on public.companies to service_role;
grant all on public.company_offerings to service_role;
grant all on public.offering_coverage to service_role;
grant all on public.company_branches to service_role;
grant all on public.company_contacts to service_role;
grant all on public.directory_pages to service_role;
grant all on public.company_url_aliases to service_role;
grant select on private.staff_roles to authenticated;
create policy staff_read on private.staff_roles for select to authenticated using ((select private.has_staff_role('admin')));
grant insert,update on private.staff_roles to authenticated;
create policy staff_insert on private.staff_roles for insert to authenticated with check ((select private.has_staff_role('admin')));
create policy staff_update on private.staff_roles for update to authenticated using ((select private.has_staff_role('admin'))) with check ((select private.has_staff_role('admin')));
grant all on private.staff_roles to service_role;
grant select on private.data_sources to authenticated;
create policy staff_read on private.data_sources for select to authenticated using ((select private.has_staff_role(null)));
grant insert,update on private.data_sources to authenticated;
create policy staff_insert on private.data_sources for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on private.data_sources for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant all on private.data_sources to service_role;
grant select on private.company_sources to authenticated;
create policy staff_read on private.company_sources for select to authenticated using ((select private.has_staff_role(null)));
grant insert,update on private.company_sources to authenticated;
create policy staff_insert on private.company_sources for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on private.company_sources for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant all on private.company_sources to service_role;
grant select on private.company_editorial to authenticated;
create policy staff_read on private.company_editorial for select to authenticated using ((select private.has_staff_role(null)));
grant insert,update on private.company_editorial to authenticated;
create policy staff_insert on private.company_editorial for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on private.company_editorial for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant all on private.company_editorial to service_role;
grant select on private.company_reports to authenticated;
create policy staff_read on private.company_reports for select to authenticated using ((select private.has_staff_role(null)));
grant insert,update on private.company_reports to authenticated;
create policy staff_insert on private.company_reports for insert to authenticated with check ((select private.has_staff_role(null)));
create policy staff_update on private.company_reports for update to authenticated using ((select private.has_staff_role(null))) with check ((select private.has_staff_role(null)));
grant all on private.company_reports to service_role;
grant select on private.audit_log to authenticated;
create policy staff_read on private.audit_log for select to authenticated using ((select private.has_staff_role(null)));
grant all on private.audit_log to service_role;

-- Invoker view: relational context is public, never raw evidence or report data.
create view public.directory_company_offerings with (security_invoker=true) as
 select c.id as company_id,c.trade_name,c.slug as company_slug,o.id as offering_id,o.category_id,o.service_id,
 m.id as market_id,m.code as market_code,
 private.public_presence(c.id,m.id) as has_documented_presence,
 private.public_coverage(o.id,m.id) as coverage_status,
 (private.public_coverage(o.id,m.id)='confirmed') as has_confirmed_coverage
 from public.companies c join public.company_offerings o on o.company_id=c.id
 cross join public.directory_markets m
 where m.status='active' and private.public_coverage(o.id,m.id) is not null;
grant select on public.directory_company_offerings to anon,authenticated;

create function public.search_directory(
 p_market_code text, p_category_id uuid default null, p_service_id uuid default null,
 p_query text default null, p_confirmed_only boolean default false, p_presence_only boolean default false,
 p_limit integer default 20, p_offset integer default 0
) returns table(company_id uuid,trade_name text,company_slug text,has_documented_presence boolean,has_confirmed_coverage boolean)
language sql stable security invoker set search_path = '' as $$
 select r.company_id,r.trade_name,r.company_slug,bool_or(r.has_documented_presence),bool_or(r.has_confirmed_coverage)
 from public.directory_company_offerings r join public.companies c on c.id=r.company_id
 where r.market_code=p_market_code and (p_category_id is null or r.category_id=p_category_id)
 and (p_service_id is null or (r.service_id=p_service_id and r.coverage_status not in ('not_served','disputed')))
 and (not p_confirmed_only or r.has_confirmed_coverage)
 and (not p_presence_only or r.has_documented_presence)
 and (p_query is null or length(trim(p_query))=0 or to_tsvector('spanish', c.trade_name||' '||coalesce(c.description,'')) @@ plainto_tsquery('spanish',left(p_query,200)))
 group by r.company_id,r.trade_name,r.company_slug order by lower(r.trade_name),r.company_id
 limit least(greatest(coalesce(p_limit,20),1),100) offset least(greatest(coalesce(p_offset,0),0),10000)
$$;
revoke all on function public.search_directory(text,uuid,uuid,text,boolean,boolean,integer,integer) from public;
grant execute on function public.search_directory(text,uuid,uuid,text,boolean,boolean,integer,integer) to anon,authenticated;
