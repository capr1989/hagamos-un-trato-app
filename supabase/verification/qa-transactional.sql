-- Run only through DIRECT Supabase MCP after verifying lewlduoqmsdnmxfichus.
-- Synthetic development fixtures are uncommitted and always rolled back.
begin;
do $hut$
declare admin_id uuid:=gen_random_uuid(); editor_id uuid:=gen_random_uuid(); company jsonb; report jsonb;
begin
 insert into auth.users(id,email) values(admin_id,admin_id::text||'@qa.invalid'),(editor_id,editor_id::text||'@qa.invalid');
 insert into private.staff_roles(user_id,role) values(admin_id,'admin'),(editor_id,'editor');
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 company:=public.qa_save('companies',jsonb_build_object('trade_name','QA TEST transactional MCP','slug','qa-test-'||gen_random_uuid(),'qa_test_batch',gen_random_uuid()));
 perform public.qa_save('company_editorial',jsonb_build_object('company_id',company->>'id','duplicate_review_status','clear','publication_decision','approved'));
 if not exists(select 1 from private.audit_log where entity_id=company->>'id' and action='editorial_decision' and change_summary->>'decision'='approved') then raise exception 'Editorial decision history missing'; end if;
 perform set_config('hut.qa_fixture_company',company->>'id',true);
 report:=public.qa_publication_check((company->>'id')::uuid);
 if not (report->>'is_test')::boolean or (report->>'can_publish')::boolean then raise exception 'QA publication check failed'; end if;
 begin
  perform public.qa_publish_company((company->>'id')::uuid);
  raise exception 'Unexpected test publication';
 exception when check_violation then null; end;
 begin
  update public.companies set qa_test_batch=null where id=(company->>'id')::uuid;
  raise exception 'Unexpected marker removal';
 exception when check_violation then null; end;
 begin
  perform public.qa_save('staff_roles',jsonb_build_object('role','editor'),admin_id::text);
  raise exception 'Unexpected self-role modification';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',editor_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',editor_id,'role','authenticated','user_metadata',jsonb_build_object('role','admin'))::text,true);
 if public.qa_staff_context()->>'role'<>'editor' then raise exception 'Editor context failed'; end if;
 begin
  perform public.qa_save('staff_roles',jsonb_build_object('role','admin'),editor_id::text);
  raise exception 'Unexpected editor escalation';
 exception when insufficient_privilege then null; end;
 begin
  perform public.qa_archive_test_company((company->>'id')::uuid);
  raise exception 'Unexpected editor cleanup';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 report:=public.qa_archive_test_company((company->>'id')::uuid);
 if (report->>'physical_deletion')::boolean then raise exception 'Unexpected deletion'; end if;
 if not exists(select 1 from private.audit_log where entity_id=company->>'id') then raise exception 'Missing audit'; end if;
end $hut$;
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $hut$
begin
 if exists(select 1 from public.companies where id=current_setting('hut.qa_fixture_company')::uuid) then raise exception 'QA test leaked publicly'; end if;
 begin perform public.qa_records('company_sources'); raise exception 'Unexpected bridge access'; exception when insufficient_privilege then null; end;
 begin perform public.qa_bootstrap_admin(gen_random_uuid()); raise exception 'Unexpected anonymous bootstrap'; exception when insufficient_privilege then null; end;
end $hut$;
reset role;
select 'PASS: QA CRUD, role separation, immutable marker, publication block, safe archive, audit and anonymous denials; fixtures rolled back' as result;
rollback;
