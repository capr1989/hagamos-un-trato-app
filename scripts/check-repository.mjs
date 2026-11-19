import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=(p)=>readFile(path.join(root,p),'utf8');
const files=(await readdir(path.join(root,'supabase/migrations'))).filter(f=>f.endsWith('.sql')).sort();
assert.equal(files.length,11);
assert.equal(new Set(files.map(f=>f.slice(0,14))).size,files.length,'Migration versions must be unique');
const migrations=(await Promise.all(files.map(f=>read('supabase/migrations/'+f)))).join('\n');
const tables=[...migrations.matchAll(/create table (public|private)\.([a-z_]+)/g)].map(m=>m[1]+'.'+m[2]);
assert.equal(tables.length,19); // 18 business tables + private, ephemeral abuse counters.
for(const table of tables) assert.ok(migrations.includes('alter table '+table+' enable row level security;'),table+' needs RLS');
for(const future of ['customers','service_requests','lead_assignments','matching_runs','subscriptions','payments','company_members','company_claims']) assert.ok(!tables.some(t=>t.endsWith('.'+future)),future+' is out of phase 1');
const cfg=await read('supabase/config.toml');
assert.ok(cfg.includes('schemas = ["public"]'));
assert.ok(cfg.includes('auto_expose_new_tables = false'));
assert.ok(cfg.includes('enable_anonymous_sign_ins = false'));
const ignore=await read('.gitignore');
assert.ok(ignore.includes('.env*')&&ignore.includes('!.env.example'));
const pkg=JSON.parse(await read('package.json'));
for(const versions of [pkg.dependencies,pkg.devDependencies]) for(const version of Object.values(versions)) assert.match(version,/^\d+\.\d+\.\d+(-[\w.]+)?$/,'Dependencies must be pinned');
for(const script of Object.values(pkg.scripts)) assert.ok(!/--remote|supabase link|supabase db push/.test(script),'npm scripts must not operate hosted Supabase');
const excluded=new Set(['node_modules','.next','.git','.migration-payloads','.temp']);
let checked=0;
async function scan(dir='') {
  for(const entry of await readdir(path.join(root,dir),{withFileTypes:true})) {
    if(excluded.has(entry.name))continue;
    const rel=path.join(dir,entry.name);
    if(entry.isDirectory()){await scan(rel);continue;}
    // .env.local is an ignored local runtime file, never a publication candidate.
    if(entry.name==='.env.local')continue;
    assert.ok(!/^\.env/.test(entry.name)||entry.name==='.env.example','Real environment files must not be published');
    if(!/\.(sql|mjs|json|toml|md|ts|tsx|yml)$/.test(entry.name)&&entry.name!=='.env.example')continue;
    const content=await read(rel);checked++;
    assert.ok(!/sb_secret_[A-Za-z0-9]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}/.test(content),'Possible secret in '+rel);
  }
}
await scan();
console.log(JSON.stringify({check:'repository',migrations:files.length,tables:tables.length,filesScanned:checked,phase1Only:true,secretsDetected:false}));
