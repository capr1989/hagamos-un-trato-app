// Production Next HTTP smoke in a loopback child process. No remote calls or credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
const port=listener.address().port;await new Promise((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,HUT_REPORTS_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore',windowsHide:true});
try {
  let response;
  for(let attempt=0;attempt<40;attempt++){
    if(server.exitCode!==null)throw new Error('Next exited before HTTP smoke');
    try {response=await fetch(`http://127.0.0.1:${port}/api/company-reports`,{method:'POST',headers:{Origin:`http://127.0.0.1:${port}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(1000)});break;}
    catch {await new Promise(resolve=>setTimeout(resolve,250));}
  }
  assert.ok(response,'Local Next did not start');assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:'No se pudo recibir la solicitud.'});assert.equal(response.headers.get('cache-control'),'no-store, private');
  console.log('PASS production Next HTTP route fails closed with reports disabled; no remote call or private response');
} finally {if(server.exitCode===null&&server.signalCode===null){const stopped=once(server,'exit');server.kill();await stopped.catch(()=>{});}}
