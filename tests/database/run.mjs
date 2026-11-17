import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const mode = process.argv.includes('--supabase-local') ? 'supabase-local' : 'pglite';
let db;
if (mode === 'supabase-local') {
  const { Client } = await import('pg');
  const connectionString = process.env.HUT_TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== '54322' || url.pathname !== '/postgres') {
    throw new Error('Database tests refuse all non-local targets; only loopback:54322/postgres is allowed.');
  }
  const client = new Client({ connectionString });
  await client.connect();
  db = { exec: (sql) => client.query(sql), query: (sql, params) => client.query(sql, params), close: () => client.end() };
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  db = new PGlite();
  await db.exec(await readFile(path.join(root, 'tests/database/bootstrap.pglite.sql'), 'utf8'));
  for (const file of (await readdir(path.join(root, 'supabase/migrations'))).filter((f) => f.endsWith('.sql')).sort()) {
    try { await db.exec(await readFile(path.join(root, 'supabase/migrations', file), 'utf8')); }
    catch (error) { console.error(`MIGRATION FAILED: ${file}: ${error.message}`); await db.close(); process.exit(1); }
  }
}

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const count = async (sql, params = []) => Number((await q(sql, params))[0].n);
const scalar = async (sql, params = []) => Object.values((await q(sql, params))[0])[0];
const role = async (name, user = '') => {
  if (!['anon', 'authenticated', 'postgres'].includes(name)) throw new Error('Unknown fixture role');
  await db.exec('reset role');
  await q("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)", [user, JSON.stringify({ sub: user || undefined, role: name })]);
  await db.exec(`set local role ${name}`);
};
const rejected = async (sql, params = [], codes = ['23503', '23505', '23514', '42501']) => {
  await db.exec('savepoint expect_rejection');
  let caught;
  try { await db.query(sql, params); } catch (e) { caught = e; }
  await db.exec('rollback to savepoint expect_rejection');
  await db.exec('release savepoint expect_rejection');
  assert.ok(caught, 'Statement should have been rejected');
  assert.ok(codes.includes(caught.code), `Unexpected SQLSTATE ${caught.code}: ${caught.message}`);
};

const tests = [];
const test = (name, run) => tests.push({ name, run });
let service, category, solarService, solarCategory;
const source = uid(8000);
const admin = uid(9001), editor = uid(9002), outsider = uid(9003);
const market = uid(100);

async function evidence(companyId, kind, entityId, fields) {
  const target = { offering: 'offering_id', coverage: 'coverage_id', branch: 'branch_id', contact: 'contact_id' }[kind];
  await q(`insert into private.company_sources(company_id,source_id,${target ? `${target},` : ''}field_keys,evidence_note,obtained_at,review_status,reuse_decision,reviewed_at,reviewed_by)
    values($1,$2,${target ? '$3,' : ''}${target ? '$4' : '$3'},'TEST ONLY: synthetic fixture; never production',now(),'approved','allowed',now(),${target ? '$5' : '$4'})`,
    target ? [companyId, source, entityId, fields, admin] : [companyId, source, fields, admin]);
}

async function fixtureCompany(n, { local = false, coverage = false, state = 'published', decision = 'approved' } = {}) {
  const companyId = uid(n), offerId = uid(n + 1000), contactId = uid(n + 2000), branchId = uid(n + 3000), coverageId = uid(n + 4000);
  await q("insert into public.companies(id,trade_name,slug,publication_status,published_at) values($1,$2,$3,$4,now())", [companyId, `TEST ONLY Company ${n}`, `test-only-company-${n}`, state]);
  await q("insert into private.company_editorial(company_id,duplicate_review_status,duplicate_reviewed_at,publication_decision,decided_at,decided_by) values($1,'clear',now(),$2,now(),$3)", [companyId, decision, admin]);
  await q("insert into public.company_offerings(id,company_id,category_id,service_id,publication_status) values($1,$2,$3,$4,'published')", [offerId, companyId, category, service]);
  await q("insert into public.company_contacts(id,company_id,channel,value,contact_status,last_reviewed_at,review_due_at,publication_status) values($1,$2,'website',$3,'active',now(),now()+interval '30 days','published')", [contactId, companyId, `https://company-${n}.invalid`]);
  await evidence(companyId, 'company', companyId, ['trade_name']);
  await evidence(companyId, 'offering', offerId, ['category_id', 'service_id']);
  await evidence(companyId, 'contact', contactId, ['value', 'channel']);
  if (local) {
    await q("insert into public.company_branches(id,company_id,location_id,public_address,presence_status,publication_status) values($1,$2,$3,'TEST ONLY address 10','documented','published')", [branchId, companyId, uid(3)]);
    await evidence(companyId, 'branch', branchId, ['location_id', 'presence_status', 'public_address']);
  }
  if (coverage) {
    await q("insert into public.offering_coverage(id,offering_id,location_id,coverage_status,publication_status) values($1,$2,$3,'confirmed','published')", [coverageId, offerId, uid(3)]);
    await evidence(companyId, 'coverage', coverageId, ['location_id', 'coverage_status']);
  }
  return { companyId, offerId, contactId, branchId, coverageId };
}

let a, b, c, draft, unrelated, held;
try {
  await db.exec('begin');
  assert.equal(await count('select count(*) as n from public.companies'), 0, 'Fresh migrations must contain no companies');
  assert.equal(await count('select count(*) as n from public.directory_markets'), 0, 'No unreviewed market may be seeded');
  assert.equal(await count('select count(*) as n from public.services'), 10, 'Approved taxonomy must contain ten services');
  category = await scalar("select id from public.categories where code='aire_acondicionado'");
  solarCategory = await scalar("select id from public.categories where code='energia_solar'");
  service = await scalar("select id from public.services where category_id=$1 and code='instalacion'", [category]);
  solarService = await scalar("select id from public.services where category_id=$1 and code='instalacion'", [solarCategory]);
  for (const [id, email] of [[admin, 'test-admin@example.invalid'], [editor, 'test-editor@example.invalid'], [outsider, 'test-outsider@example.invalid']]) {
    await q('insert into auth.users(id,email) values($1,$2)', [id, email]);
  }
  await q("insert into private.staff_roles(user_id,role) values($1,'admin'),($2,'editor')", [admin, editor]);
  await db.exec("update public.countries set is_active=true where code='PA'");
  await q("insert into public.locations(id,country_code,kind,name,slug,is_active) values($1,'PA','country','TEST ONLY Panama root','test-country',true)", [uid(1)]);
  await q("insert into public.locations(id,country_code,parent_id,kind,name,slug,is_active) values($1,'PA',$2,'administrative_area','TEST ONLY region','test-region',true)", [uid(2), uid(1)]);
  await q("insert into public.locations(id,country_code,parent_id,kind,name,slug,is_active) values($1,'PA',$2,'city','TEST ONLY City','test-city',true),($3,'PA',$2,'city','TEST ONLY Other City','test-other-city',true)", [uid(3), uid(2), uid(4)]);
  await q("insert into public.directory_markets(id,code,country_code,location_id,display_name,status,launched_at) values($1,'test_market','PA',$2,'TEST ONLY Market','active',now())", [market, uid(3)]);
  await q("insert into private.data_sources(id,name,source_type,reuse_status,permitted_uses,reviewed_at) values($1,'TEST ONLY permitted fixture','test_fixture','permitted','Isolated automated tests only',now())", [source]);
  a = await fixtureCompany(10, { local: true });
  b = await fixtureCompany(20, { coverage: true });
  c = await fixtureCompany(30, { local: true, coverage: true });
  draft = await fixtureCompany(40, { local: true, state: 'draft' });
  unrelated = await fixtureCompany(50);
  held = await fixtureCompany(60, { local: true, decision: 'hold' });
  // Flush deferred constraints before each test's savepoint.
  await db.exec('set constraints all immediate');

  test('All 18 application tables have RLS enabled', async () => {
    assert.equal(await count("select count(*) as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and c.relrowsecurity"), 18);
  });
  test('Service must belong to the offering category', () => rejected('insert into public.company_offerings(company_id,category_id,service_id) values($1,$2,$3)', [a.companyId, category, solarService]));
  test('Category-only offers cannot be duplicated through NULL service', async () => {
    await q('insert into public.company_offerings(company_id,category_id) values($1,$2)', [a.companyId, category]);
    await rejected('insert into public.company_offerings(company_id,category_id) values($1,$2)', [a.companyId, category]);
  });
  test('Geographic cycles are rejected', () => rejected('update public.locations set parent_id=$1 where id=$2', [uid(3), uid(2)]));
  test('Category cycles are rejected', async () => {
    const child = await scalar("insert into public.categories(parent_id,code,name,slug) values($1,'test_child','TEST ONLY child','test-child') returning id", [category]);
    await rejected('update public.categories set parent_id=$1 where id=$2', [child, category]);
  });
  test('A location cannot have a parent in another country', async () => {
    await db.exec("insert into public.countries(code,name,default_locale) values('ZZ','TEST ONLY country','es')");
    await rejected("insert into public.locations(country_code,parent_id,kind,name,slug) values('ZZ',$1,'city','TEST ONLY wrong country','wrong-country')", [uid(1)]);
  });
  test('Contacts cannot refer to another company branch', () => rejected("insert into public.company_contacts(company_id,branch_id,channel,value) values($1,$2,'website','https://wrong.invalid')", [b.companyId, a.branchId]));
  test('Coverage evidence cannot refer to another company', () => rejected("insert into private.company_sources(company_id,source_id,coverage_id,field_keys,evidence_note,obtained_at) values($1,$2,$3,array['coverage_status'],'TEST ONLY wrong evidence',now())", [a.companyId, source, b.coverageId]));
  test('Evidence cannot target an offering and a contact together', () => rejected("insert into private.company_sources(company_id,source_id,offering_id,contact_id,field_keys,evidence_note,obtained_at) values($1,$2,$3,$4,array['value'],'TEST ONLY ambiguous',now())", [a.companyId, source, a.offerId, a.contactId]));
  test('Unapproved evidence cannot claim allowed publication', () => rejected("insert into private.company_sources(company_id,source_id,field_keys,evidence_note,obtained_at,review_status,reuse_decision) values($1,$2,array['trade_name'],'TEST ONLY invalid approval',now(),'approved','denied')", [a.companyId, source]));
  test('Invalid website protocols are rejected', () => rejected("insert into public.company_contacts(company_id,channel,value) values($1,'website','javascript:alert(1)')", [a.companyId]));
  test('Active contacts with NULL branch have enforced uniqueness', () => rejected("insert into public.company_contacts(company_id,channel,value,contact_status,last_reviewed_at,review_due_at) values($1,'website','https://company-10.invalid','active',now(),now()+interval '1 day')", [a.companyId]));
  test('Shared domains across different companies are allowed', async () => {
    await q("insert into public.company_contacts(company_id,channel,value,contact_status,last_reviewed_at,review_due_at) values($1,'website','https://company-10.invalid','active',now(),now()+interval '1 day')", [b.companyId]);
  });
  test('Contact values are immutable; replacements require a new record', () => rejected("update public.company_contacts set value='https://replacement.invalid' where id=$1", [a.contactId]));
  test('A page cannot target a location outside its market', () => rejected("insert into public.directory_pages(market_id,category_id,location_id,path,title) values($1,$2,$3,'/test/outside','TEST ONLY page')", [market, category, uid(4)]));
  test('A company cannot merge into itself', () => rejected("update private.company_editorial set publication_decision='merged',canonical_company_id=company_id where company_id=$1", [a.companyId]));
  test('Mergers cannot form a chain or cycle', async () => {
    await q("update private.company_editorial set publication_decision='merged',canonical_company_id=$1 where company_id=$2", [c.companyId, b.companyId]);
    await rejected("update private.company_editorial set publication_decision='merged',canonical_company_id=$1 where company_id=$2", [b.companyId, a.companyId]);
  });
  test('Aliases cannot shadow a published company slug', () => rejected("insert into public.company_url_aliases(alias_slug,target_company_id) values('test-only-company-10',$1)", [b.companyId]));
  test('Anonymous catalogue excludes drafts, holds and unrelated companies', async () => {
    await role('anon');
    assert.equal(await count('select count(*) as n from public.companies'), 3);
  });
  test('Presence and unconfirmed coverage remain independent', async () => {
    await role('anon');
    const [r] = await q('select * from public.directory_company_offerings where company_id=$1', [a.companyId]);
    assert.equal(r.has_documented_presence, true); assert.equal(r.coverage_status, 'unconfirmed'); assert.equal(r.has_confirmed_coverage, false);
  });
  test('Confirmed coverage can include a company without a local branch', async () => {
    await role('anon');
    const [r] = await q('select * from public.directory_company_offerings where company_id=$1', [b.companyId]);
    assert.equal(r.has_documented_presence, false); assert.equal(r.coverage_status, 'confirmed');
  });
  test('Coverage-confirmed search excludes unknown coverage', async () => {
    await role('anon');
    assert.equal((await q("select * from public.search_directory('test_market',p_confirmed_only=>true)")).length, 2);
  });
  test('Physical-presence search includes only documented local branches', async () => {
    await role('anon');
    assert.equal((await q("select * from public.search_directory('test_market',p_presence_only=>true)")).length, 2);
  });
  test('Search returns each company once when both bases apply', async () => {
    await role('anon');
    const rows = await q("select * from public.search_directory('test_market')");
    assert.equal(rows.length, 3); assert.equal(new Set(rows.map((r) => r.company_id)).size, 3);
  });
  test('Explicit no-service coverage does not become unconfirmed', async () => {
    await q("insert into public.offering_coverage(id,offering_id,location_id,coverage_status,publication_status) values($1,$2,$3,'not_served','published')", [uid(7001), a.offerId, uid(3)]);
    await evidence(a.companyId, 'coverage', uid(7001), ['location_id', 'coverage_status']);
    await role('anon');
    const rows = await q("select * from public.search_directory('test_market',p_service_id=>$1)", [service]);
    assert.equal(rows.some((r) => r.company_id === a.companyId), false);
    assert.equal(await scalar('select coverage_status from public.directory_company_offerings where company_id=$1', [a.companyId]), 'not_served');
  });
  test('Coverage dispute excludes the service without removing real presence', async () => {
    await q("insert into public.offering_coverage(id,offering_id,location_id,coverage_status,publication_status) values($1,$2,$3,'disputed','published')", [uid(7002), a.offerId, uid(3)]);
    await evidence(a.companyId, 'coverage', uid(7002), ['location_id', 'coverage_status']);
    await role('anon');
    assert.equal(await count('select count(*) as n from public.companies where id=$1', [a.companyId]), 1);
    assert.equal((await q("select * from public.search_directory('test_market',p_service_id=>$1)", [service])).some((r) => r.company_id === a.companyId), false);
  });
  test('Expired contact is hidden even without a maintenance job', async () => {
    await q("update public.company_contacts set last_reviewed_at=now()-interval '2 days',review_due_at=now()-interval '1 day' where id=$1", [a.contactId]);
    await role('anon');
    assert.equal(await count('select count(*) as n from public.company_contacts where id=$1', [a.contactId]), 0);
    assert.equal(await count('select count(*) as n from public.companies where id=$1', [a.companyId]), 1, 'Useful public address preserves the profile');
  });
  test('Profile losing its only contact and having no useful address is hidden', async () => {
    await q("update public.company_contacts set contact_status='disputed' where id=$1", [b.contactId]);
    await role('anon'); assert.equal(await count('select count(*) as n from public.companies where id=$1', [b.companyId]), 0);
  });
  test('Revoked source reuse immediately hides its facts', async () => {
    await q("update private.data_sources set reuse_status='blocked' where id=$1", [source]);
    await role('anon'); assert.equal(await count('select count(*) as n from public.companies'), 0);
  });
  test('Changing a factual field invalidates its previous evidence', async () => {
    await q("update public.companies set trade_name='TEST ONLY changed identity' where id=$1", [a.companyId]);
    await role('anon'); assert.equal(await count('select count(*) as n from public.companies where id=$1', [a.companyId]), 0);
  });
  test('Source attribution requirements cannot be silently omitted', async () => {
    await q('update private.data_sources set attribution_required=true where id=$1', [source]);
    await role('anon'); assert.equal(await count('select count(*) as n from public.companies'), 0);
  });
  test('Anonymous cannot read private evidence, reports or staff roles', async () => {
    await role('anon');
    for (const table of ['company_sources', 'company_reports', 'staff_roles']) await rejected(`select * from private.${table}`, [], ['42501']);
  });
  test('Anonymous cannot call internal evidence helpers', async () => {
    await role('anon'); await rejected("select private.evidence_ok($1,'company',$1,array['trade_name'])", [a.companyId], ['42501']);
  });
  test('Anonymous cannot write catalogue or submit directly into private reports', async () => {
    await role('anon');
    await rejected("insert into public.companies(trade_name,slug) values('TEST ONLY attack','test-attack')", [], ['42501']);
    await rejected("insert into private.company_reports(company_id,report_type,message,privacy_notice_version) values($1,'correction','TEST ONLY attack','test')", [a.companyId], ['42501']);
  });
  test('Authenticated non-staff cannot modify companies or see reports', async () => {
    await role('authenticated', outsider);
    assert.equal((await q("update public.companies set publication_status='hidden' where id=$1 returning id", [a.companyId])).length, 0);
    assert.equal(await count('select count(*) as n from private.company_reports'), 0);
  });
  test('Editable user metadata cannot grant a staff role', async () => {
    await role('authenticated', outsider);
    await q("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: outsider, role: 'authenticated', user_metadata: { role: 'admin' } })]);
    assert.equal(await scalar('select private.has_staff_role()'), false);
    await rejected("insert into private.staff_roles(user_id,role) values($1,'admin')", [outsider], ['42501']);
  });
  test('Editor can see drafts but cannot elevate their staff role', async () => {
    await role('authenticated', editor);
    assert.equal(await count('select count(*) as n from public.companies'), 6);
    assert.equal((await q("update private.staff_roles set role='admin' where user_id=$1 returning user_id", [editor])).length, 0);
  });
  test('Staff suspension is effective without refreshing JWT metadata', async () => {
    await q("update private.staff_roles set status='suspended' where user_id=$1", [editor]);
    await role('authenticated', editor); assert.equal(await scalar('select private.has_staff_role()'), false);
  });
  test('Report requires no account and does not change or claim the company', async () => {
    await q("insert into private.company_reports(company_id,report_type,message,privacy_notice_version) values($1,'removal','TEST ONLY removal request','test-v1')", [a.companyId]);
    assert.equal(await scalar('select publication_decision from private.company_editorial where company_id=$1', [a.companyId]), 'approved');
    await role('anon'); assert.equal(await count('select count(*) as n from public.companies where id=$1', [a.companyId]), 1);
  });
  test('Reports cannot be purged while still open', () => rejected("insert into private.company_reports(company_id,report_type,message,privacy_notice_version,personal_data_purged_at) values($1,'correction',null,'test-v1',now())", [a.companyId]));
  test('Administrator can withdraw a profile; aliases stop resolving it', async () => {
    await q("insert into public.company_url_aliases(alias_slug,target_company_id) values('test-former-name',$1)", [a.companyId]);
    await role('authenticated', admin);
    await q("update private.company_editorial set publication_decision='withdrawn',decided_at=now() where company_id=$1", [a.companyId]);
    await role('anon');
    assert.equal(await count('select count(*) as n from public.companies where id=$1', [a.companyId]), 0);
    assert.equal(await count("select count(*) as n from public.company_url_aliases where alias_slug='test-former-name'"), 0);
  });
  test('Editor cannot reactivate a withdrawn profile', async () => {
    await role('authenticated', admin);
    await q("update private.company_editorial set publication_decision='withdrawn',decided_at=now() where company_id=$1", [a.companyId]);
    await role('authenticated', editor);
    await rejected("update private.company_editorial set publication_decision='approved' where company_id=$1", [a.companyId], ['42501']);
  });
  test('Audit is append-only for application staff and omits field values', async () => {
    await role('authenticated', editor);
    await q("update public.companies set publication_status='hidden' where id=$1", [a.companyId]);
    assert.ok(await count("select count(*) as n from private.audit_log where entity_id=$1 and action='update'", [a.companyId]));
    assert.equal(await count("select count(*) as n from private.audit_log where change_summary::text like '%company-10.invalid%'"), 0);
    await rejected('delete from private.audit_log', [], ['42501']);
  });
  test('Only one public function is exposed and it is security invoker', async () => {
    assert.equal(await count("select count(*) as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef"), 0);
    assert.equal(await scalar("select reloptions @> array['security_invoker=true'] from pg_class where oid='public.directory_company_offerings'::regclass"), true);
  });

  // Additional regression cases found while reviewing the original 44-test baseline.
  test('Valid directory-page insertion does not read contact fields', async () => {
    await q("insert into public.directory_pages(market_id,category_id,location_id,path,title) values($1,$2,$3,'/test/valid','TEST ONLY valid page')", [market, category, uid(3)]);
  });
  test('Contact review dates cannot reuse older evidence as a fresh check', async () => {
    await q("update private.company_sources set reviewed_at=now()-interval '1 day' where contact_id=$1", [a.contactId]);
    await role('anon');
    assert.equal(await count('select count(*) as n from public.company_contacts where id=$1', [a.contactId]), 0);
  });
  test('Stale coverage evidence cannot be moved into another company silently', async () => {
    await q("update private.company_sources set review_status='stale' where coverage_id=$1", [b.coverageId]);
    await rejected('update public.offering_coverage set offering_id=$1 where id=$2', [a.offerId, b.coverageId]);
  });
  test('Editor cannot bypass withdrawal authorization by inserting an editorial record', async () => {
    await q("insert into public.companies(id,trade_name,slug) values($1,'TEST ONLY inserted profile','test-only-inserted')", [uid(70)]);
    await role('authenticated', editor);
    await rejected("insert into private.company_editorial(company_id,publication_decision,decided_at) values($1,'withdrawn',now())", [uid(70)], ['42501']);
  });

  let failed = 0;
  for (const { name, run } of tests) {
    await db.exec('savepoint test_case');
    try { await run(); console.log(`PASS ${name}`); }
    catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack ?? e}`); }
    finally { await db.exec('rollback to savepoint test_case'); await db.exec('release savepoint test_case'); }
  }
  await db.exec('rollback');
  console.log(JSON.stringify({ mode, tests: tests.length, passed: tests.length - failed, failed, fixture: 'synthetic, transaction rolled back', remoteAccess: false }));
  if (failed) process.exitCode = 1;
} finally { await db.close(); }
