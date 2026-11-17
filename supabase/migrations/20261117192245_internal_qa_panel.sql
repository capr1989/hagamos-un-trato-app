-- Temporary HUT development QA interface. No policy is broadened; CRUD stays SECURITY INVOKER.
alter table public.companies add column qa_test_batch uuid;
alter table public.companies add constraint qa_test_never_published
 check (qa_test_batch is null or (publication_status <> 'published' and trade_name like 'QA TEST %'));
create function private.guard_qa_test_marker() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_op='UPDATE' and new.qa_test_batch is distinct from old.qa_test_batch then
   raise exception using errcode='23514',message='QA test marker is immutable';
 end if;
 if new.trade_name like 'QA TEST %' and new.qa_test_batch is null then
   raise exception using errcode='23514',message='QA TEST companies require a permanent test marker';
 end if;
 return new;
end $$;
create trigger guard_qa_test_marker before insert or update on public.companies
 for each row execute function private.guard_qa_test_marker();
revoke all on function private.guard_qa_test_marker() from public,anon,authenticated;

create function private.qa_relation(entity text) returns text
language sql immutable security invoker set search_path = '' as $$
 select case when entity in ('countries','locations','directory_markets','categories','services','companies',
 'company_offerings','offering_coverage','company_branches','company_contacts','directory_pages','company_url_aliases') then 'public.'||entity
 when entity in ('data_sources','company_sources','company_editorial','company_reports','staff_roles','audit_log') then 'private.'||entity end
$$;
revoke all on function private.qa_relation(text) from public,anon,authenticated;
grant execute on function private.qa_relation(text) to authenticated;

create function public.qa_staff_context() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('user_id',auth.uid(),'role',case when private.has_staff_role('admin') then 'admin'
 when private.has_staff_role('editor') then 'editor' else null end)
$$;

create function public.qa_records(p_entity text,p_company_id uuid default null,p_limit integer default 100,p_offset integer default 0) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare rel text; predicate text := 'true'; result jsonb; ordering text;
begin
 if not private.has_staff_role() then raise exception using errcode='42501',message='Active HUT staff required'; end if;
 if p_entity='staff_roles' and not private.has_staff_role('admin') then raise exception using errcode='42501',message='Administrator required'; end if;
 rel := private.qa_relation(p_entity);
 if rel is null then raise exception using errcode='22023',message='Unsupported entity'; end if;
 if p_company_id is not null then
   if p_entity='companies' then predicate:='t.id=$1';
   elsif p_entity in ('company_offerings','company_branches','company_contacts','company_editorial','company_sources','company_reports') then predicate:='t.company_id=$1';
   elsif p_entity='offering_coverage' then predicate:='exists(select 1 from public.company_offerings o where o.id=t.offering_id and o.company_id=$1)';
   elsif p_entity='audit_log' then predicate:='t.entity_id=$1::text'; end if;
 end if;
 ordering:=case when p_entity='audit_log' then 't.occurred_at desc,t.id' when p_entity='countries' then 't.code' when p_entity='company_url_aliases' then 't.alias_slug' else 't.created_at desc' end;
 execute format('select coalesce(jsonb_agg(x.row),''[]''::jsonb) from (select to_jsonb(t) as row from %s t where %s order by %s limit $2 offset $3) x',rel,predicate,ordering)
 into result using p_company_id,least(greatest(coalesce(p_limit,100),1),200),least(greatest(coalesce(p_offset,0),0),10000);
 return result;
end $$;

create function public.qa_save(p_entity text,p_data jsonb,p_id text default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare rel text; allowed text[]; cols text; expressions text; pk text; result jsonb;
begin
 if not private.has_staff_role() then raise exception using errcode='42501',message='Active HUT staff required'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb or octet_length(p_data::text)>32000 then raise exception using errcode='22023',message='Expected a bounded nonempty object'; end if;
 if p_entity in ('countries','locations','directory_markets','staff_roles','company_url_aliases') and not private.has_staff_role('admin') then
   raise exception using errcode='42501',message='Administrator required for configuration and roles'; end if;
 allowed:=case p_entity
 when 'countries' then array['code','name','default_locale','is_active']
 when 'locations' then array['country_code','parent_id','kind','name','slug','official_code','reference_url','is_active']
 when 'directory_markets' then array['code','country_code','location_id','display_name','include_descendants','status']
 when 'companies' then array['trade_name','legal_name','slug','description','publication_status','information_reviewed_at','attribution_text','attribution_url','qa_test_batch']
 when 'company_offerings' then array['company_id','category_id','service_id','publication_status','attribution_text','attribution_url']
 when 'offering_coverage' then array['offering_id','location_id','coverage_status','include_descendants','publication_status','attribution_text','attribution_url']
 when 'company_branches' then array['company_id','name','location_id','public_address','presence_status','publication_status','attribution_text','attribution_url']
 when 'company_contacts' then array['company_id','branch_id','channel','value','label','sort_order','contact_status','last_reviewed_at','review_due_at','retired_at','publication_status','attribution_text','attribution_url']
 when 'data_sources' then array['name','source_type','base_url','terms_url','license_name','reuse_status','permitted_uses','restrictions','attribution_required']
 when 'company_sources' then array['company_id','source_id','source_url','external_record_id','offering_id','coverage_id','branch_id','contact_id','field_keys','evidence_note','obtained_at','review_status','reuse_decision','reuse_notes','attribution_text','attribution_url','review_due_at']
 when 'company_editorial' then array['company_id','duplicate_review_status','publication_decision','decision_reason','canonical_company_id']
 when 'company_reports' then array['company_id','contact_id','duplicate_of_company_id','report_type','message','reply_email','privacy_notice_version','status','assigned_to','resolution_action','resolution_summary','personal_data_delete_after']
 when 'staff_roles' then array['user_id','role','status']
 when 'company_url_aliases' then array['alias_slug','target_company_id'] end;
 if allowed is null or exists(select 1 from jsonb_object_keys(p_data) k where not k=any(allowed)) then
   raise exception using errcode='22023',message='Unsupported entity or field'; end if;
 if p_entity='staff_roles' then
   if coalesce(p_id,p_data->>'user_id')=auth.uid()::text then raise exception using errcode='42501',message='Self assignment or modification is forbidden'; end if;
   p_data:=p_data||jsonb_build_object('granted_by',auth.uid());
 end if;
 if p_entity='companies' then
   if p_data->>'publication_status'='published' then raise exception using errcode='23514',message='Use the reviewed publication action'; end if;
   if p_id is not null and p_data ? 'qa_test_batch' then raise exception using errcode='23514',message='Test marker cannot be changed'; end if;
 end if;
 if p_entity='locations' and p_id is null and nullif(trim(p_data->>'reference_url'),'') is null then
   raise exception using errcode='23514',message='Documentary reference URL is required'; end if;
 if p_entity='directory_markets' then
   if (p_id is null and coalesce(p_data->>'status','draft')<>'draft') or p_data->>'status'='active' then
     raise exception using errcode='23514',message='Create markets in draft; use reviewed activation'; end if;
 end if;
 if p_entity='data_sources' and p_data->>'reuse_status' in ('permitted','restricted') then
   p_data:=p_data||jsonb_build_object('reviewed_at',now(),'reviewed_by',auth.uid()); end if;
 if p_entity='company_sources' and p_data->>'review_status'='approved' then
   p_data:=p_data||jsonb_build_object('reviewed_at',now(),'reviewed_by',auth.uid()); end if;
 if p_entity='company_editorial' then
   if p_data->>'duplicate_review_status'='clear' then p_data:=p_data||jsonb_build_object('duplicate_reviewed_at',now(),'duplicate_reviewed_by',auth.uid()); end if;
   if p_data->>'publication_decision' is not null and p_data->>'publication_decision'<>'pending' then
     p_data:=p_data||jsonb_build_object('decided_at',now(),'decided_by',auth.uid()); end if;
 end if;
 if p_entity='company_reports' and p_data ? 'status' then
   p_data:=p_data||jsonb_build_object('resolved_at',case when p_data->>'status' in ('resolved','dismissed') then to_jsonb(now()) else 'null'::jsonb end); end if;
 rel:=private.qa_relation(p_entity);
 pk:=case p_entity when 'countries' then 'code' when 'company_editorial' then 'company_id' when 'staff_roles' then 'user_id' when 'company_url_aliases' then 'alias_slug' else 'id' end;
 if p_id is not null and p_data ? pk and p_data->>pk is distinct from p_id then raise exception using errcode='23514',message='Primary key is immutable'; end if;
 select string_agg(format('%I',k),',' order by k),string_agg(format('r.%I',k),',' order by k)
 into cols,expressions from jsonb_object_keys(p_data) k;
 if p_id is null then
   execute format('insert into %s as t (%s) select %s from jsonb_populate_record(null::%s,$1) r returning to_jsonb(t)',rel,cols,expressions,rel) into result using p_data;
 else
   execute format('update %s as t set (%s)=(select %s from jsonb_populate_record(null::%s,$1) r) where t.%I::text=$2 returning to_jsonb(t)',rel,cols,expressions,rel,pk) into result using p_data,p_id;
 end if;
 if result is null then raise exception using errcode='42501',message='No writable row; check identity and permissions'; end if;
 return result;
end $$;

-- This private helper deliberately computes existing internal publication predicates.
-- It is not a bypass for CRUD: every caller must be real active HUT staff.
create function private.qa_publication_check(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.companies; reasons text[]:=array[]::text[];
begin
 if auth.uid() is null or not private.has_staff_role() then raise exception using errcode='42501',message='Active HUT staff required'; end if;
 select * into c from public.companies where id=cid;
 if not found then raise exception using errcode='22023',message='Company not found'; end if;
 if c.qa_test_batch is not null then reasons:=array_append(reasons,'Empresa QA TEST: publicación pública prohibida permanentemente'); end if;
 if not private.evidence_ok(cid,'company',cid,array['trade_name']) then reasons:=array_append(reasons,'Identidad: falta evidencia vigente aprobada y reutilización permitida'); end if;
 if c.legal_name is not null and not private.evidence_ok(cid,'company',cid,array['legal_name']) then reasons:=array_append(reasons,'Razón social sin respaldo publicable'); end if;
 if c.description is not null and not private.evidence_ok(cid,'company',cid,array['description']) then reasons:=array_append(reasons,'Descripción sin respaldo publicable'); end if;
 if not exists(select 1 from private.company_editorial e where e.company_id=cid and e.duplicate_review_status='clear' and e.publication_decision='approved') then
   reasons:=array_append(reasons,'Revisión de duplicados y decisión editorial aprobada pendientes'); end if;
 if not exists(select 1 from public.company_offerings o where o.company_id=cid and private.offer_ready(o.id)) then reasons:=array_append(reasons,'Falta al menos una oferta publicada con categoría/servicio activos y evidencia'); end if;
 if not exists(select 1 from public.company_contacts k where k.company_id=cid and private.contact_ready(k.id))
 and not exists(select 1 from public.company_branches b where b.company_id=cid and b.public_address is not null and private.branch_ready(b.id)) then
   reasons:=array_append(reasons,'Sin contacto vigente publicable ni dirección física útil respaldada'); end if;
 if not exists(select 1 from public.directory_markets m where private.market_active(m.id) and
   (private.has_presence(cid,m.id) or exists(select 1 from public.company_offerings o where o.company_id=cid and private.offer_ready(o.id) and private.coverage_state(o.id,m.id)='confirmed'))) then
   reasons:=array_append(reasons,'Sin mercado activo con presencia documentada o cobertura confirmada aplicable'); end if;
 return jsonb_build_object('company_id',cid,'can_publish',cardinality(reasons)=0,'reasons',to_jsonb(reasons),'currently_public',private.company_visible(cid),'is_test',c.qa_test_batch is not null);
end $$;
revoke all on function private.qa_publication_check(uuid) from public,anon,authenticated;
grant execute on function private.qa_publication_check(uuid) to authenticated;
create function public.qa_publication_check(p_company_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.qa_publication_check(p_company_id) $$;
create function public.qa_publish_company(p_company_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
 perform 1 from public.companies where id=p_company_id for update;
 result:=private.qa_publication_check(p_company_id);
 if not (result->>'can_publish')::boolean then raise exception using errcode='23514',message='Publication blocked',detail=(result->'reasons')::text; end if;
 update public.companies set publication_status='published',published_at=coalesce(published_at,now()) where id=p_company_id;
 return private.qa_publication_check(p_company_id);
end $$;

create function public.qa_duplicate_candidates(p_company_id uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
 if not private.has_staff_role() then raise exception using errcode='42501',message='Active HUT staff required'; end if;
 with candidates as (
 select c.id,c.trade_name,array_remove(array[
 case when c.name_normalized=t.name_normalized then 'nombre' end,
 case when exists(select 1 from public.company_contacts a join public.company_contacts b on b.value=a.value and b.channel=a.channel where a.company_id=t.id and b.company_id=c.id) then 'contacto/dominio' end,
 case when exists(select 1 from public.company_contacts a join public.company_contacts b on b.channel='website' and regexp_replace(regexp_replace(lower(b.value),'^https?://([^/:?#]+).*$', '\1'),'^www\.', '')=regexp_replace(regexp_replace(lower(a.value),'^https?://([^/:?#]+).*$', '\1'),'^www\.', '') where a.channel='website' and a.company_id=t.id and b.company_id=c.id) then 'dominio' end,
 case when exists(select 1 from public.company_branches a join public.company_branches b on lower(b.public_address)=lower(a.public_address) and b.location_id=a.location_id where a.company_id=t.id and b.company_id=c.id and a.public_address is not null) then 'dirección' end,
 case when exists(select 1 from private.company_sources a join private.company_sources b on b.source_id=a.source_id and b.external_record_id=a.external_record_id where a.company_id=t.id and b.company_id=c.id and nullif(a.external_record_id,'') is not null) then 'procedencia' end
 ],null) as signals from public.companies c cross join public.companies t where t.id=p_company_id and c.id<>t.id)
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from(select * from candidates where cardinality(signals)>0 order by trade_name,id limit 50)x;
 return result;
end $$;

create function public.qa_archive_test_company(p_company_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
 if not private.has_staff_role('admin') then raise exception using errcode='42501',message='Administrator required'; end if;
 perform 1 from public.companies where id=p_company_id and qa_test_batch is not null for update;
 if not found then raise exception using errcode='23514',message='Cleanup accepts exactly one marked QA test company'; end if;
 update public.company_contacts set publication_status='archived',contact_status='retired',retired_at=coalesce(retired_at,now()) where company_id=p_company_id;
 update public.company_branches set publication_status='archived' where company_id=p_company_id;
 update public.offering_coverage set publication_status='archived' where offering_id in (select id from public.company_offerings where company_id=p_company_id);
 update public.company_offerings set publication_status='archived' where company_id=p_company_id;
 update private.company_editorial set publication_decision='hold',decided_at=now(),decided_by=auth.uid(),decision_reason='QA test archived by administrator' where company_id=p_company_id;
 update public.companies set publication_status='archived' where id=p_company_id;
 return jsonb_build_object('archived',p_company_id,'physical_deletion',false);
end $$;

create function public.qa_set_market_status(p_market_id uuid,p_status text,p_documentation_confirmed boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare m public.directory_markets; loc public.locations; result jsonb;
begin
 if not private.has_staff_role('admin') then raise exception using errcode='42501',message='Administrator required'; end if;
 if p_status not in ('draft','active','paused') then raise exception using errcode='22023',message='Invalid market state'; end if;
 select * into m from public.directory_markets where id=p_market_id for update;
 if not found then raise exception using errcode='22023',message='Market not found'; end if;
 select * into loc from public.locations where id=m.location_id;
 if p_status='active' then
   if not coalesce(p_documentation_confirmed,false) or nullif(trim(loc.reference_url),'') is null or loc.kind<>'city'
    or m.country_code<>'PA' or m.code<>'pa_ciudad_panama' then raise exception using errcode='23514',message='Only the documented initial Panama City market may be activated after explicit review'; end if;
   if not exists(select 1 from public.countries where code=m.country_code and is_active) or exists(
    with recursive chain as(select id,parent_id,is_active from public.locations where id=loc.id union all select p.id,p.parent_id,p.is_active from public.locations p join chain c on p.id=c.parent_id)
    select 1 from chain where not is_active) then raise exception using errcode='23514',message='Country and full geographic hierarchy must be active'; end if;
 end if;
 update public.directory_markets set status=p_status,launched_at=case when p_status='active' then coalesce(launched_at,now()) else launched_at end where id=p_market_id returning to_jsonb(directory_markets) into result;
 return result;
end $$;

-- One-use operator bootstrap; never callable by visitors or authenticated app users.
create function public.qa_bootstrap_status() returns boolean
language plpgsql stable security invoker set search_path = '' as $$
begin
 if current_user not in ('service_role','postgres') then raise exception using errcode='42501',message='Operator credentials required'; end if;
 return not exists(select 1 from private.staff_roles);
end $$;
create function public.qa_bootstrap_admin(p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
 if current_user not in ('service_role','postgres') then raise exception using errcode='42501',message='Operator credentials required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(730033);
 if exists(select 1 from private.staff_roles) then raise exception using errcode='42501',message='Bootstrap already consumed'; end if;
 insert into private.staff_roles(user_id,role,status) values(p_user_id,'admin','active');
 return jsonb_build_object('user_id',p_user_id,'role','admin','bootstrap_consumed',true);
end $$;

revoke all on function public.qa_staff_context(),public.qa_records(text,uuid,integer,integer),public.qa_save(text,jsonb,text),
 public.qa_publication_check(uuid),public.qa_publish_company(uuid),public.qa_duplicate_candidates(uuid),
 public.qa_archive_test_company(uuid),public.qa_set_market_status(uuid,text,boolean),public.qa_bootstrap_status(),public.qa_bootstrap_admin(uuid) from public,anon,authenticated;
grant execute on function public.qa_staff_context(),public.qa_records(text,uuid,integer,integer),public.qa_save(text,jsonb,text),
 public.qa_publication_check(uuid),public.qa_publish_company(uuid),public.qa_duplicate_candidates(uuid),
 public.qa_archive_test_company(uuid),public.qa_set_market_status(uuid,text,boolean) to authenticated;
grant execute on function public.qa_bootstrap_status(),public.qa_bootstrap_admin(uuid) to service_role;
