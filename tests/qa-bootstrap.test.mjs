import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const run=extra=>{
  const env={...process.env,...extra};
  for(const key of ['SUPABASE_SECRET_KEY','HUT_QA_BOOTSTRAP'])if(extra[key]===undefined)delete env[key];
  return spawnSync(process.execPath,['scripts/qa-bootstrap.mjs'],{env,encoding:'utf8',timeout:3000});
};
test('bootstrap refuses to run without explicit operator opt-in',()=>{const r=run({});assert.equal(r.status,1);assert.match(r.stderr,/HUT_QA_BOOTSTRAP/);});
test('bootstrap refuses another project before contacting Auth',()=>{const r=run({HUT_QA_BOOTSTRAP:'I_AUTHORIZE_HUT_DEV_BOOTSTRAP',NEXT_PUBLIC_SUPABASE_URL:'https://wrong.supabase.co'});assert.equal(r.status,1);assert.match(r.stderr,/Destino incorrecto/);});
test('bootstrap refuses missing operator key without printing a credential',()=>{const r=run({HUT_QA_BOOTSTRAP:'I_AUTHORIZE_HUT_DEV_BOOTSTRAP',NEXT_PUBLIC_SUPABASE_URL:'https://lewlduoqmsdnmxfichus.supabase.co'});assert.equal(r.status,1);assert.match(r.stderr,/Falta SUPABASE_SECRET_KEY/);});
