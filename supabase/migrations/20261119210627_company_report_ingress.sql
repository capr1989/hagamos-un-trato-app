-- Phase 1: private quality reports, not public reviews. Existing rows and policies retained.
alter table private.company_reports drop constraint company_reports_report_type_check;
alter table private.company_reports add constraint company_reports_report_type_check check(report_type in
 ('correction','outdated_contact','closure','removal','duplicate','bad_service','no_response','suspected_fraud','other_problem'));
alter table private.company_reports
 add column submission_origin_hash text check(submission_origin_hash is null or submission_origin_hash ~ '^[0-9a-f]{64}$'),
 add column content_fingerprint text check(content_fingerprint is null or content_fingerprint ~ '^[0-9a-f]{64}$'),
 add column abuse_data_expires_at timestamptz,
 add column duplicate_submission_count integer not null default 0 check(duplicate_submission_count>=0),
 add column last_repeated_at timestamptz,
 add column similar_report_id uuid references private.company_reports(id),
 add constraint company_report_not_self_similar check(similar_report_id is distinct from id);
create index company_reports_ingress_dedupe_idx on private.company_reports(submission_origin_hash,content_fingerprint,created_at desc);
create index company_reports_fingerprint_idx on private.company_reports(company_id,content_fingerprint,created_at desc);
create index company_reports_similar_idx on private.company_reports(similar_report_id);
create index company_reports_abuse_expiry_idx on private.company_reports(abuse_data_expires_at) where submission_origin_hash is not null;
create index company_reports_purge_due_idx on private.company_reports(personal_data_delete_after) where personal_data_purged_at is null;

-- Infrastructure only: shared fixed-window counters; no raw IP, message, email or visitor account.
create table private.company_report_rate_limits (
 subject_hash text not null check(subject_hash ~ '^[0-9a-f]{64}$'),
 scope text not null check(length(scope) between 1 and 60),
 window_seconds integer not null check(window_seconds in (600,3600,86400)),
 window_start timestamptz not null,
 request_count integer not null check(request_count>0),
 expires_at timestamptz not null,
 primary key(subject_hash,scope,window_seconds,window_start)
);
alter table private.company_report_rate_limits enable row level security;
revoke all on private.company_report_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on private.company_report_rate_limits to service_role;
create index company_report_rate_limits_expiry_idx on private.company_report_rate_limits(expires_at);

create function private.consume_company_report_budget(origin_hash text,company uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare s text; seconds integer; maximum integer; starts timestamptz; accepted boolean;
begin
 if current_user not in ('postgres','service_role') then raise exception using errcode='42501',message='Report ingress only'; end if;
 for s,seconds,maximum in select * from (values('all',600,5),('all',86400,20),('company:'||company::text,3600,3)) limits(scope,seconds,maximum) loop
   starts:=to_timestamp(floor(extract(epoch from now())/seconds)*seconds);
   accepted:=false;
   insert into private.company_report_rate_limits as r(subject_hash,scope,window_seconds,window_start,request_count,expires_at)
   values(origin_hash,s,seconds,starts,1,starts+make_interval(secs=>seconds)+interval '24 hours')
   on conflict on constraint company_report_rate_limits_pkey do update set request_count=r.request_count+1
     where r.request_count<maximum returning true into accepted;
   if not coalesce(accepted,false) then raise exception using errcode='P0001',message='HUT_REPORT_RATE_LIMIT'; end if;
 end loop;
end $$;
revoke all on function private.consume_company_report_budget(text,uuid) from public,anon,authenticated;
grant execute on function private.consume_company_report_budget(text,uuid) to service_role;
grant execute on function private.company_visible(uuid) to service_role;

create function public.maintain_company_report_ingress(p_limit integer default 200) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare removed integer; cleared integer; cap integer:=least(greatest(coalesce(p_limit,200),1),500);
begin
 if current_user not in ('postgres','service_role') then raise exception using errcode='42501',message='Report ingress only'; end if;
 with expired as(select subject_hash,scope,window_seconds,window_start from private.company_report_rate_limits where expires_at<=now() order by expires_at limit cap for update skip locked)
 delete from private.company_report_rate_limits r using expired x where (r.subject_hash,r.scope,r.window_seconds,r.window_start)=(x.subject_hash,x.scope,x.window_seconds,x.window_start);
 get diagnostics removed=row_count;
 with expired as(select id from private.company_reports where abuse_data_expires_at<=now() and (submission_origin_hash is not null or content_fingerprint is not null) order by abuse_data_expires_at limit cap for update skip locked)
 update private.company_reports r set submission_origin_hash=null,content_fingerprint=null from expired x where r.id=x.id;
 get diagnostics cleared=row_count;
 return jsonb_build_object('expired_counters_removed',removed,'expired_hashes_cleared',cleared);
end $$;

-- Not granted to anon/authenticated. Only the controlled Next.js server calls this RPC.
create function public.submit_company_report(
 p_company_id uuid,p_report_type text,p_message text,p_reply_email text,
 p_privacy_notice_version text,p_origin_hash text,p_fingerprint text,p_challenge_hash text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare normalized_message text:=btrim(p_message); email text:=nullif(lower(btrim(p_reply_email)),'');
 existing_id uuid; related_id uuid; challenge_accepted boolean;
begin
 if current_user not in ('postgres','service_role') then raise exception using errcode='42501',message='Report ingress only'; end if;
 if p_report_type is null or p_report_type not in ('correction','outdated_contact','closure','removal','duplicate','bad_service','no_response','suspected_fraud','other_problem')
 or normalized_message is null or length(normalized_message) not between 10 and 4000
 or regexp_replace(normalized_message,E'[\n\r\t]','','g') ~ '[[:cntrl:]]'
 or p_privacy_notice_version is null or length(btrim(p_privacy_notice_version)) not between 1 and 100
 or p_origin_hash is null or p_origin_hash !~ '^[0-9a-f]{64}$' or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
 or p_challenge_hash is null or p_challenge_hash !~ '^[0-9a-f]{64}$'
 or (email is not null and (length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then
   raise exception using errcode='22023',message='HUT_REPORT_INVALID'; end if;
 if not private.company_visible(p_company_id) then raise exception using errcode='22023',message='HUT_REPORT_UNAVAILABLE'; end if;
 -- Serialize the two dedupe scopes across all server instances; no in-memory quota.
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('hut-report-origin:'||p_origin_hash,0));
 perform private.consume_company_report_budget(p_origin_hash,p_company_id);
 -- A proof can be consumed only once, including simultaneous requests on different instances.
 insert into private.company_report_rate_limits(subject_hash,scope,window_seconds,window_start,request_count,expires_at)
 values(p_challenge_hash,'challenge',600,to_timestamp(0),1,now()+interval '10 minutes')
 on conflict do nothing returning true into challenge_accepted;
 if not coalesce(challenge_accepted,false) then raise exception using errcode='P0001',message='HUT_REPORT_AUTOMATED'; end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended('hut-report-content:'||p_fingerprint,0));
 perform public.maintain_company_report_ingress(100);
 select id into existing_id from private.company_reports where company_id=p_company_id and submission_origin_hash=p_origin_hash
  and content_fingerprint=p_fingerprint and created_at>now()-interval '15 minutes'
  and personal_data_purged_at is null order by created_at,id limit 1 for update;
 if existing_id is not null then
   update private.company_reports set duplicate_submission_count=duplicate_submission_count+1,last_repeated_at=now() where id=existing_id;
   return true;
 end if;
 select coalesce(similar_report_id,id) into related_id from private.company_reports where company_id=p_company_id and content_fingerprint=p_fingerprint
  and created_at>now()-interval '24 hours' and personal_data_purged_at is null order by created_at,id limit 1;
 insert into private.company_reports(company_id,report_type,message,reply_email,privacy_notice_version,
  submission_origin_hash,content_fingerprint,abuse_data_expires_at,similar_report_id)
 values(p_company_id,p_report_type,normalized_message,email,btrim(p_privacy_notice_version),p_origin_hash,p_fingerprint,now()+interval '48 hours',related_id);
 return true;
end $$;

create function public.qa_company_reports(
 p_company_id uuid default null,p_type text default null,p_status text default null,
 p_repeated_only boolean default false,p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb; cap integer:=least(greatest(coalesce(p_limit,50),1),100); off integer:=least(greatest(coalesce(p_offset,0),0),10000);
begin
 if not private.has_staff_role() then raise exception using errcode='42501',message='Active HUT staff required'; end if;
 if p_type is not null and p_type not in ('correction','outdated_contact','closure','removal','duplicate','bad_service','no_response','suspected_fraud','other_problem')
 or p_status is not null and p_status not in ('new','in_review','awaiting_info','resolved','dismissed') then raise exception using errcode='22023',message='Invalid report filter'; end if;
 select coalesce(jsonb_agg(x.row),'[]'::jsonb) into result from(
  select to_jsonb(r)-array['submission_origin_hash','content_fingerprint'] as row from private.company_reports r
  where (p_company_id is null or r.company_id=p_company_id) and (p_type is null or r.report_type=p_type) and (p_status is null or r.status=p_status)
   and (not coalesce(p_repeated_only,false) or r.duplicate_submission_count>0 or r.similar_report_id is not null
    or exists(select 1 from private.company_reports linked where linked.similar_report_id=r.id))
  order by r.created_at desc,r.id limit cap offset off)x;
 return jsonb_build_object('rows',result,'limit',cap,'offset',off);
end $$;

-- A due date is a human-approved per-case policy. No automatic 90-day assumption.
create function public.qa_purge_due_company_reports(p_limit integer default 100) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare purged integer;
begin
 if not private.has_staff_role('admin') then raise exception using errcode='42501',message='Administrator required'; end if;
 with due as(select id from private.company_reports where status in ('resolved','dismissed') and personal_data_delete_after<=now()
  and personal_data_purged_at is null order by personal_data_delete_after,id limit least(greatest(coalesce(p_limit,100),1),100) for update skip locked)
 update private.company_reports r set message=null,reply_email=null,submission_origin_hash=null,content_fingerprint=null,personal_data_purged_at=now()
 from due where r.id=due.id;
 get diagnostics purged=row_count;
 return jsonb_build_object('purged_reports',purged);
end $$;

revoke all on function public.submit_company_report(uuid,text,text,text,text,text,text,text),public.maintain_company_report_ingress(integer),
 public.qa_company_reports(uuid,text,text,boolean,integer,integer),public.qa_purge_due_company_reports(integer) from public,anon,authenticated;
grant execute on function public.submit_company_report(uuid,text,text,text,text,text,text,text),public.maintain_company_report_ingress(integer) to service_role;
grant execute on function public.qa_company_reports(uuid,text,text,boolean,integer,integer),public.qa_purge_due_company_reports(integer) to authenticated;
