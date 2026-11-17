import assert from 'node:assert/strict';
import { qaConfig } from '../src/lib/qa/policy.ts';
const {origin}=qaConfig(process.env);
const base=origin+'/internal/qa';
const results=[];
async function check(name,run){try{await run();results.push({name,status:'PASS'});}catch(error){results.push({name,status:'FAIL',detail:error.message});}}
await check('login page renders without session or admin data',async()=>{const r=await fetch(base);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('Iniciar sesión'));assert.ok(!html.includes('sb_secret_'));});
await check('session endpoint returns unauthenticated identity',async()=>{const r=await fetch(base+'/api?action=session');assert.equal(r.status,200);assert.equal((await r.json()).identity,null);assert.match(r.headers.get('cache-control'),/no-store/);});
await check('administrative data requires a session',async()=>assert.equal((await fetch(base+'/api?action=overview')).status,401));
const post=(body,headers={})=>fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
await check('mutation without Origin is forbidden',async()=>assert.equal((await post({action:'save'})).status,403));
await check('mutation with foreign Origin is forbidden',async()=>assert.equal((await post({action:'save'},{Origin:'https://evil.invalid'})).status,403));
await check('same-origin mutation still requires a session',async()=>assert.equal((await post({action:'save'},{Origin:origin})).status,401));
await check('invalid login fields are rejected before Auth call',async()=>assert.equal((await post({action:'login'},{Origin:origin})).status,400));
await check('oversized request body is rejected',async()=>assert.equal((await post('x'.repeat(33000),{Origin:origin})).status,413));
await check('logout clears HttpOnly SameSite Strict cookies',async()=>{const r=await post({action:'logout'},{Origin:origin});assert.equal(r.status,200);const value=r.headers.get('set-cookie');assert.match(value,/HttpOnly/i);assert.match(value,/SameSite=Strict/i);assert.equal((await r.json()).identity,null);});
console.log(JSON.stringify({context:'local HTTP only; no real user session or remote mutations',results}));
if(results.some(row=>row.status!=='PASS'))process.exitCode=1;
