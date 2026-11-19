import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportHandler, reportConfig, reportOrigin, reportHashes, verifyTurnstile } from '../src/lib/company-reports/handler.ts';
import { reportInput, ReportError, REPORT_TYPES } from '../src/lib/company-reports/contract.ts';
const env={HUT_REPORTS_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://lewlduoqmsdnmxfichus.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_TEST_FIXTURE_ONLY_NOT_A_KEY',HUT_REPORTS_ORIGIN_SECRET:'test-only-ephemeral-hmac-fixture-32-chars',TURNSTILE_SECRET_KEY:'test-only',HUT_REPORTS_PRIVACY_NOTICE_VERSION:'TEST-ONLY-v1',HUT_REPORTS_ALLOWED_ORIGINS:'https://hut.example.invalid',HUT_REPORTS_ALLOWED_HOSTNAMES:'hut.example.invalid',HUT_REPORTS_IP_SOURCE:'vercel',VERCEL:'1',NODE_ENV:'production'};
const config=reportConfig(env);
const body={company_id:'00000000-0000-4000-8000-000000000010',report_type:'bad_service',message:'TEST ONLY private description',turnstile_token:'TEST_ONLY_TOKEN'};
const request=(value=body,headers={})=>new Request('https://hut.example.invalid/api/company-reports',{method:'POST',headers:{host:'hut.example.invalid',origin:'https://hut.example.invalid','x-vercel-forwarded-for':'192.0.2.1','content-type':'application/json',...headers},body:typeof value==='string'?value:JSON.stringify(value)});
const handler=(changes={})=>createReportHandler({config:()=>config,verify:async()=>{},write:async()=>{},...changes});
test('anonymous endpoint accepts all nine types without a user session; only server fields reach writer',async()=>{
  for(const type of REPORT_TYPES){let args;const response=await handler({write:async value=>{args=value;}})(request({...body,report_type:type,reply_email:' Visitor@Example.invalid '}));
    assert.equal(response.status,202);assert.equal(args.p_reply_email,'visitor@example.invalid');assert.equal(args.p_privacy_notice_version,'TEST-ONLY-v1');
    assert.deepEqual(Object.keys(args).sort(),['p_challenge_hash','p_company_id','p_fingerprint','p_message','p_origin_hash','p_privacy_notice_version','p_reply_email','p_report_type'].sort());assert.match(args.p_origin_hash,/^[a-f0-9]{64}$/);}
});
test('reply email is optional, empty and null are equivalent',()=>{for(const email of [undefined,'',null])assert.equal(reportInput({...body,reply_email:email}).reply_email,null);});
test('unknown type and internal state, roles, assignment or editorial fields are rejected',async()=>{
  for(const field of ['status','assigned_to','resolution_action','role','publication_status','privacy_notice_version','p_origin_hash'])assert.equal((await handler()(request({...body,[field]:'forged'}))).status,400);
  assert.equal((await handler()(request({...body,report_type:'stars'}))).status,400);
});
test('strict descriptions, UUIDs, email, token, honeypot and JSON types',()=>{
  for(const bad of [null,[],{...body,company_id:'not-uuid'},{...body,message:'short'},{...body,message:'x'.repeat(4001)},{...body,message:'invalid\u0000content'},{...body,reply_email:'a\r\nb@c.invalid'},{...body,reply_email:'x'.repeat(255)+'@a.invalid'},{...body,reply_email:15},{...body,turnstile_token:''},{...body,turnstile_token:'x'.repeat(2049)},{...body,website:false}])assert.throws(()=>reportInput(bad),ReportError);
  assert.equal(reportInput({...body,message:'description\nwith lines and\ttabs'}).message,'description\nwith lines and\ttabs');
});
test('honeypot silently returns generic receipt without CAPTCHA or storage',async()=>{
  const response=await handler({verify:async()=>assert.fail('no verification'),write:async()=>assert.fail('no storage')})(request({...body,website:'bot.invalid'}));assert.equal(response.status,202);assert.deepEqual(await response.json(),{accepted:true,message:'Solicitud recibida para revisión.'});
});
test('request media type, malformed JSON and actual streamed body length are enforced',async()=>{
  assert.equal((await handler()(request(body,{'content-type':'text/plain'}))).status,415);
  assert.equal((await handler()(request('{'))).status,400);
  assert.equal((await handler()(request('x'.repeat(32769),{'content-length':'2'}))).status,413);
});
test('origin, missing Origin and external Host are rejected even when Request URL is internal',async()=>{
  for(const headers of [{origin:'https://evil.invalid'},{origin:''},{host:'evil.invalid'}])assert.equal((await handler()(request(body,headers))).status,403);
});
test('untrusted forwarding headers cannot choose the origin budget',async()=>{
  assert.equal(reportOrigin(request(body,{'x-forwarded-for':'198.51.100.2'}),config),'192.0.2.1');
  for(const ip of ['', '192.0.2.1,198.51.100.2','invalid'])assert.equal((await handler()(request(body,{'x-vercel-forwarded-for':ip}))).status,503);
  assert.equal(reportOrigin(request(body,{'x-vercel-forwarded-for':'2001:0db8:0:0:0:0:0:1'}),config),reportOrigin(request(body,{'x-vercel-forwarded-for':'2001:db8::1'}),config));
});
test('local QA ignores spoofed IP and production refuses loopback mode',()=>{
  const local=reportConfig({...env,NODE_ENV:'development',HUT_QA_ENABLED:'true',HUT_REPORTS_IP_SOURCE:'loopback',HUT_REPORTS_ALLOWED_ORIGINS:'http://127.0.0.1:3000',HUT_REPORTS_ALLOWED_HOSTNAMES:'localhost'});
  assert.equal(reportOrigin(new Request('http://localhost/api/company-reports',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','x-vercel-forwarded-for':'198.51.100.9'}}),local),'127.0.0.1');
  assert.throws(()=>reportConfig({...env,HUT_REPORTS_IP_SOURCE:'loopback'}),ReportError);
});
test('configuration fails closed without each required dependency or trusted deployment',()=>{
  for(const field of ['HUT_REPORTS_ENABLED','SUPABASE_SECRET_KEY','TURNSTILE_SECRET_KEY','HUT_REPORTS_ORIGIN_SECRET','HUT_REPORTS_PRIVACY_NOTICE_VERSION','HUT_REPORTS_ALLOWED_ORIGINS','HUT_REPORTS_ALLOWED_HOSTNAMES','VERCEL'])assert.throws(()=>reportConfig({...env,[field]:undefined}),ReportError);
  assert.throws(()=>reportConfig({...env,SUPABASE_SECRET_KEY:'sb_publishable_test_fixture'}),ReportError);
  assert.throws(()=>reportConfig({...env,NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'}),ReportError);
  assert.throws(()=>reportConfig({...env,HUT_REPORTS_ALLOWED_ORIGINS:'https://hut.example.invalid/path'}),ReportError);
});
test('hashes rotate origin daily, normalize content and never contain email/IP/token',()=>{
  const input=reportInput(body), d=new Date('2026-11-19T12:00:00Z');const a=reportHashes(input,'192.0.2.1',config,d);
  assert.notEqual(a.p_origin_hash,reportHashes(input,'192.0.2.1',config,new Date('2026-11-20T12:00:00Z')).p_origin_hash);
  assert.equal(a.p_fingerprint,reportHashes({...input,message:input.message.toUpperCase(),reply_email:'different@example.invalid'},'198.51.100.2',config,d).p_fingerprint);
  assert.equal(JSON.stringify(a).includes('192.0.2'),false);assert.equal(JSON.stringify(a).includes(body.turnstile_token),false);
});
test('Turnstile validates action, hostname, freshness and provider response',async()=>{
  const now=new Date();const valid={success:true,action:'company_report',hostname:'hut.example.invalid',challenge_ts:now.toISOString()};
  const fetcher=value=>async(url,options)=>{assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(options.body.has('remoteip'),false);return Response.json(value);};
  await verifyTurnstile(body.turnstile_token,config,fetcher(valid),now);
  for(const bad of [{success:false},{...valid,action:'login'},{...valid,hostname:'evil.invalid'},{...valid,challenge_ts:new Date(now.getTime()-301000).toISOString()},{...valid,challenge_ts:'invalid'}])await assert.rejects(()=>verifyTurnstile(body.turnstile_token,config,fetcher(bad),now),e=>e.status===403);
  for(const failure of [async()=>{throw new Error('private provider failure');},async()=>new Response('error',{status:500}),fetcher({})])await assert.rejects(()=>verifyTurnstile(body.turnstile_token,config,failure,now),e=>e.status===503);
});
test('CAPTCHA or storage failures never leak private values or falsely acknowledge storage',async()=>{
  for(const status of [403,404,429,503]){
    const response=await handler({write:async()=>{throw new ReportError(status);}})(request());assert.equal(response.status,status);const text=await response.text();assert.equal(text.includes(body.message),false);assert.equal(text.includes('TEST_ONLY'),false);assert.equal(response.headers.get('Cache-Control'),'no-store, private');if(status===429)assert.equal(response.headers.get('Retry-After'),'600');
  }
  const response=await handler({verify:async()=>{throw new Error('private email@example.invalid');},write:async()=>assert.fail('no storage')})(request());assert.equal(response.status,503);assert.equal((await response.text()).includes('@'),false);
});
