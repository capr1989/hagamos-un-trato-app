import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReportHandler, reportConfig } from '../../src/lib/company-reports/handler.ts';

export function registerReportTests({test,q,scalar,count,role,rejected,uid,a,b,draft,held,admin,editor,outsider}) {
  const hash=s=>createHash('sha256').update(s).digest('hex');
  const args=(overrides={})=>Object.values({company:a.companyId,type:'bad_service',message:'TEST ONLY private quality report',email:null,version:'test-v1',origin:hash('origin'),fingerprint:hash('message'),challenge:hash('challenge'),...overrides});
  const sql='select public.submit_company_report($1,$2,$3,$4,$5,$6,$7,$8)';
  const submit=overrides=>scalar(sql,args(overrides));
  test('Report migration preserves all 64 existing policies and grants no anonymous private table writes',async()=>{
    assert.equal(await count("select count(*) as n from pg_policies where schemaname in ('public','private')"),64);
    for(const table of ['company_reports','company_report_rate_limits'])for(const privilege of ['SELECT','INSERT','UPDATE'])assert.equal(await scalar('select has_table_privilege($1,$2,$3)',['anon','private.'+table,privilege]),false);
  });
  test('Public anonymous HTTP handler persists one private report through controlled service RPC',async()=>{
    await role('service_role');const config=reportConfig({HUT_REPORTS_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://lewlduoqmsdnmxfichus.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TEST_ONLY_NOT_A_CREDENTIAL',HUT_REPORTS_ORIGIN_SECRET:'TEST_ONLY_32_CHARACTERS_FOR_HASHING',TURNSTILE_SECRET_KEY:'TEST_ONLY',HUT_REPORTS_PRIVACY_NOTICE_VERSION:'TEST-v1',HUT_REPORTS_ALLOWED_ORIGINS:'https://hut.example.invalid',HUT_REPORTS_ALLOWED_HOSTNAMES:'hut.example.invalid',HUT_REPORTS_IP_SOURCE:'vercel',VERCEL:'1'});
    const handler=createReportHandler({config:()=>config,verify:async()=>{},write:async v=>{await scalar(sql,[v.p_company_id,v.p_report_type,v.p_message,v.p_reply_email,v.p_privacy_notice_version,v.p_origin_hash,v.p_fingerprint,v.p_challenge_hash]);}});
    const response=await handler(new Request('https://hut.example.invalid/api/company-reports',{method:'POST',headers:{host:'hut.example.invalid',origin:'https://hut.example.invalid','x-vercel-forwarded-for':'192.0.2.1','content-type':'application/json'},body:JSON.stringify({company_id:a.companyId,report_type:'suspected_fraud',message:'TEST ONLY unverified issue',reply_email:'test@example.invalid',turnstile_token:'TEST_ONLY_STUB_PROOF'})}));
    assert.equal(response.status,202);assert.deepEqual(await response.json(),{accepted:true,message:'Solicitud recibida para revisión.'});
    const report=(await q('select * from private.company_reports where company_id=$1',[a.companyId]))[0];assert.equal(report.status,'new');assert.equal(report.assigned_to,null);assert.equal(report.resolution_action,null);assert.equal(report.reply_email,'test@example.invalid');
    await role('anon');assert.equal(await count('select count(*) as n from public.companies where id=$1',[a.companyId]),1);
  });
  test('All old and new report types are accepted; unknown ones fail both ingress and table constraint',async()=>{
    await role('service_role');for(const type of ['correction','outdated_contact','closure','removal','duplicate','bad_service','no_response','suspected_fraud','other_problem'])assert.equal(await submit({type,origin:hash(type),fingerprint:hash(type),challenge:hash('proof:'+type)}),true);
    await rejected(sql,args({type:'ranking'}),['22023']);await rejected("insert into private.company_reports(company_id,report_type,message,privacy_notice_version) values($1,'ranking','TEST ONLY','test')",[a.companyId]);
  });
  test('Anonymous cannot read, alter or directly submit reports or call ingress/maintenance/moderation',async()=>{
    await role('service_role');await submit();await role('anon');
    for(const statement of ['select * from private.company_reports',"update private.company_reports set status='dismissed'",'select * from private.company_report_rate_limits','select public.maintain_company_report_ingress()','select public.qa_company_reports()','select public.qa_purge_due_company_reports()'])await rejected(statement,[],['42501']);
    await rejected(sql,args(),['42501']);await rejected("update public.companies set publication_status='hidden' where id=$1",[a.companyId],['42501']);await rejected("insert into private.staff_roles(user_id,role) values($1,'admin')",[outsider],['42501']);
  });
  test('Authenticated outsiders and staff cannot invoke service-only ingress or counter maintenance',async()=>{
    for(const user of [outsider,editor,admin]){await role('authenticated',user);await rejected(sql,args(),['42501']);await rejected('select public.maintain_company_report_ingress()',[],['42501']);await rejected('select * from private.company_report_rate_limits',[],['42501']);}
    await role('authenticated',outsider);await rejected("select public.qa_records('company_reports')",[],['42501']);
  });
  test('Draft, held and missing companies cannot receive anonymous reports',async()=>{
    await role('service_role');for(const company of [draft.companyId,held.companyId,uid(999999)])await rejected(sql,args({company}),['22023']);
  });
  test('SQL validates description, email, type, privacy and technical hashes even for operator',async()=>{
    await role('service_role');for(const overrides of [{message:'short'},{message:'x'.repeat(4001)},{message:'bad\u0001control character'},{email:'bad-email'},{email:'a'.repeat(255)+'@example.invalid'},{version:''},{origin:'not-hash'},{fingerprint:null},{challenge:'not-hash'}])await rejected(sql,args(overrides),['22023']);
  });
  test('Same-origin duplicate is suppressed; cross-origin identical signal is linked without changing publication',async()=>{
    await role('service_role');await submit();await submit({challenge:hash('proof2')});assert.equal(await count('select count(*) as n from private.company_reports'),1);
    const first=(await q('select * from private.company_reports'))[0];assert.equal(first.duplicate_submission_count,1);assert.ok(first.last_repeated_at);
    await submit({origin:hash('other-origin'),challenge:hash('proof3')});const linked=(await q('select * from private.company_reports where similar_report_id=$1',[first.id]))[0];assert.equal(linked.status,'new');
    await role('anon');assert.equal(await count('select count(*) as n from public.companies where id=$1',[a.companyId]),1);
  });
  test('CAPTCHA proof cannot be replayed from the same or a different origin',async()=>{
    await role('service_role');await submit();for(const origin of [hash('origin'),hash('other')])await rejected(sql,args({origin}),['P0001']);assert.equal(await count('select count(*) as n from private.company_reports'),1);
  });
  test('Shared quotas cap same-company at three/hour and all companies at five/ten minutes',async()=>{
    await role('service_role');for(let n=0;n<3;n++)await submit({challenge:hash('proof'+n)});
    await rejected(sql,args({challenge:hash('blocked')}),['P0001']);for(let n=0;n<2;n++)await submit({company:b.companyId,challenge:hash('b-proof'+n)});
    await rejected(sql,args({company:b.companyId,challenge:hash('sixth')}),['P0001']);assert.equal(await scalar("select max(request_count) from private.company_report_rate_limits where scope='all' and window_seconds=600"),5);
  });
  test('Daily quota refuses the twenty-first accepted request regardless of other windows',async()=>{
    await role('service_role');await q("insert into private.company_report_rate_limits(subject_hash,scope,window_seconds,window_start,request_count,expires_at) values($1,'all',86400,to_timestamp(floor(extract(epoch from now())/86400)*86400),20,now()+interval '1 day')",[hash('origin')]);await rejected(sql,args(),['P0001']);
  });
  test('Staff report filters return history, repeats and pagination without origin/fingerprint',async()=>{
    await role('service_role');await submit();await submit({challenge:hash('repeat')});await submit({type:'no_response',origin:hash('another'),fingerprint:hash('another'),challenge:hash('another')});
    await role('authenticated',editor);const result=await scalar("select public.qa_company_reports($1,'bad_service','new',true,1,0)",[a.companyId]);assert.equal(result.rows.length,1);assert.equal(result.rows[0].report_type,'bad_service');assert.equal('submission_origin_hash' in result.rows[0],false);assert.equal('content_fingerprint' in result.rows[0],false);
    assert.equal((await scalar('select public.qa_company_reports($1,null,null,false,1,1)',[a.companyId])).rows.length,1);
    await rejected("select public.qa_company_reports(null,'stars')",[],['22023']);
  });
  test('Editor reviews and dismisses reports with resolution; admin separately authorizes withdrawal',async()=>{
    await role('service_role');await submit();const id=await scalar('select id from private.company_reports');await role('authenticated',editor);
    await q("select public.qa_save('company_reports',$1::jsonb,$2)",[JSON.stringify({status:'in_review',assigned_to:editor}),id]);
    await q("select public.qa_save('company_reports',$1::jsonb,$2)",[JSON.stringify({status:'dismissed',resolution_action:'no_change',resolution_summary:'TEST ONLY insufficient basis; no company action'}),id]);
    assert.equal(await scalar('select private.company_visible($1)',[a.companyId]),true);
    await rejected("select public.qa_save('company_editorial',$1::jsonb,$2)",[JSON.stringify({publication_decision:'withdrawn',decision_reason:'TEST ONLY human reviewed decision'}),a.companyId],['42501']);
    await role('authenticated',admin);await q("select public.qa_save('company_editorial',$1::jsonb,$2)",[JSON.stringify({publication_decision:'withdrawn',decision_reason:'TEST ONLY authorized human decision'}),a.companyId]);
    await role('anon');assert.equal(await count('select count(*) as n from public.companies where id=$1',[a.companyId]),0);
  });
  test('Admin purges only closed cases with approved due dates and preserves minimal audit',async()=>{
    await role('service_role');await submit({email:'private@example.invalid'});const id=await scalar('select id from private.company_reports');
    await q("update private.company_reports set status='dismissed',resolution_action='no_change',resolution_summary='Minimal investigation outcome',resolved_at=now()-interval '2 days',personal_data_delete_after=now()-interval '1 day' where id=$1",[id]);
    await role('authenticated',editor);await rejected('select public.qa_purge_due_company_reports()',[],['42501']);
    await role('authenticated',admin);assert.equal((await scalar('select public.qa_purge_due_company_reports()')).purged_reports,1);const r=(await q('select * from private.company_reports'))[0];for(const key of ['message','reply_email','submission_origin_hash','content_fingerprint'])assert.equal(r[key],null);assert.ok(r.personal_data_purged_at);assert.equal(r.resolution_summary,'Minimal investigation outcome');
    assert.equal(await count("select count(*) as n from private.audit_log where entity_id=$1 and (change_summary::text like '%private@example.invalid%' or change_summary::text like '%private quality%')",[id]),0);
  });
  test('Open and future-due cases are not purged; expired abuse hashes and counters are cleaned separately',async()=>{
    await role('service_role');await submit();await submit({company:b.companyId,origin:hash('b'),fingerprint:hash('b'),challenge:hash('b')});
    await q("update private.company_reports set status='resolved',resolution_action='no_change',resolution_summary='TEST ONLY',resolved_at=now(),personal_data_delete_after=now()+interval '1 day' where company_id=$1",[b.companyId]);
    await q("update private.company_reports set abuse_data_expires_at=now()-interval '1 second'");await q("update private.company_report_rate_limits set expires_at=now()-interval '1 second'");
    const stats=await scalar('select public.maintain_company_report_ingress(100)');assert.ok(stats.expired_counters_removed>0);assert.equal(stats.expired_hashes_cleared,2);assert.equal(await count('select count(*) as n from private.company_reports where submission_origin_hash is not null'),0);
    await role('authenticated',admin);assert.equal((await scalar('select public.qa_purge_due_company_reports()')).purged_reports,0);assert.equal(await count('select count(*) as n from private.company_reports where message is not null'),2);
  });
}
