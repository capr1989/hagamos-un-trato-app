// Real independent PostgreSQL connections. Never connects to a hosted database.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Client } from 'pg';
const connectionString=process.env.HUT_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const url=new URL(connectionString);
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.port!=='54322'||url.pathname!=='/postgres')throw new Error('Concurrency tests refuse non-local databases');
const hash=randomBytes(32).toString('hex');
const clients=Array.from({length:12},()=>new Client({connectionString}));
const operator=new Client({connectionString});
try {
  await operator.connect();await Promise.all(clients.map(c=>c.connect()));
  const outcomes=await Promise.all(clients.map(async client=>{
    await client.query('begin');
    try {await client.query('set local role service_role');await client.query('select private.consume_company_report_budget($1,$2)',[hash,randomUUID()]);await client.query('commit');return 'accepted';}
    catch(error){await client.query('rollback');assert.equal(error.message,'HUT_REPORT_RATE_LIMIT');return 'limited';}
  }));
  assert.equal(outcomes.filter(x=>x==='accepted').length,5);assert.equal(outcomes.filter(x=>x==='limited').length,7);
  console.log('PASS independent PostgreSQL connections atomically enforce five submissions per fixed window');
} finally {
  await operator.query('delete from private.company_report_rate_limits where subject_hash=$1',[hash]).catch(()=>{});
  await Promise.allSettled([...clients.map(c=>c.end()),operator.end()]);
}
