import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleScheduledImport } from '@/lib/catalog/import/scheduled';
import * as route from '@/app/internal/cron/catalog-sync/route';

async function main(){
  const secret='synthetic-cron-secret-used-only-for-tests';
  let calls=0;
  const result={inserted:1,updated:2,unchanged:3,missing:4,protected:5};
  const deps={secret,environment:'production',run:async()=>{calls++;return result;}};
  const request=(method='GET',authorization:string|undefined=`Bearer ${secret}`,query='')=>new Request(`https://crm.example/internal/cron/catalog-sync${query}`,{method,headers:authorization===undefined?{}:{authorization}});
  for(const method of ['HEAD','OPTIONS','POST','PUT','PATCH','DELETE']){
    assert.equal((await handleScheduledImport(request(method),deps)).status,405);
  }
  for(const secret of [undefined,'','short','contains spaces and is otherwise long enough']){
    assert.equal((await handleScheduledImport(request(),{...deps,secret})).status,503);
  }
  for(const environment of [undefined,'preview','development']){
    assert.equal((await handleScheduledImport(request(),{...deps,environment})).status,404);
  }
  for(const authorization of ['', 'Bearer undefined','Bearer wrong',secret,`bearer ${secret}`]){
    assert.equal((await handleScheduledImport(request('GET',authorization),deps)).status,401);
  }
  assert.equal((await handleScheduledImport(new Request('https://crm.example/internal/cron/catalog-sync'),deps)).status,401);
  assert.equal((await handleScheduledImport(request('GET',`Bearer ${secret}`,'?feed=https://example.invalid'),deps)).status,400);
  assert.equal(calls,0);
  const response=await handleScheduledImport(request(),deps);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,result});assert.equal(calls,1);
  for(const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.equal(response.headers.get(header),'no-store');
  const failure=await handleScheduledImport(request(),{...deps,run:async()=>{throw new Error('PRIVATE_SENTINEL');}});
  assert.equal(failure.status,503);assert(!(await failure.text()).includes('PRIVATE_SENTINEL'));
  for(const method of ['HEAD','OPTIONS','POST','PUT','PATCH','DELETE'] as const){
    assert.equal((await route[method](request(method))).status,405);
  }
  assert.equal(route.maxDuration,300);
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.deepEqual(config.crons,[{path:'/internal/cron/catalog-sync',schedule:'0 6 * * *'}]);
  for(const date of ['2026-01-15T06:00:00Z','2026-07-15T06:00:00Z']){
    assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(new Date(date)),'03');
  }
  console.log('PASS: production-only, fail-closed secret, bearer validation, GET-only, no query override, no-store, safe failure, route methods and 03h schedule');
}
main().catch(()=>{console.error('SCHEDULED_IMPORT_TEST_FAILED');process.exitCode=1;});
