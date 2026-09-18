import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { parsePublicQuery, projectPublicItem } from '@/lib/catalog/public-api';
import { createPublicHandlers } from '@/lib/catalog/public-http';
import { createPublicDataCache } from '@/lib/catalog/public-cache';
import { listPublicProperties, getPublicProperty, getPublicFilterOptions, canReadPublicImage } from '@/lib/queries/catalog-public';
import { consumeApiLimit, apiIdentifier } from '@/lib/queries/catalog-api-rate-limit';
import { sql } from '@/lib/db';

const imageId = randomUUID();
const data = {
  title:'Imovel sintetico', description:null, negotiation:'venda_locacao',
  prices:{sale:'1234567.89',rent:'2000.01',condominium:null,iptu:null},
  usageCategory:'residencial', taxonomy:{normalizedType:'apartamento',normalizedSubtype:null,originalType:'Origem',originalSubtype:null},
  publicLocation:{officialNeighborhood:'Bairro sintetico',neighborhoodAlias:null,city:'Cidade sintetica',state:'PR'},
  areas:{unit:'ha',total:'2',usable:null,private:null},
  rooms:{bedrooms:0,suites:0,bathrooms:1,livingRooms:null,parkingSpaces:0},
  features:[{key:'pool',label:'Piscina',value:true,visibility:'public',originalKey:'Pool',originalValue:'S'},
    {key:'internal',label:null,value:'PRIVATE_SENTINEL',visibility:'private'}],
  rawMetadata:{internal:'PRIVATE_SENTINEL'},privateLocation:{street:'PRIVATE_SENTINEL'},
  source:{externalId:'PRIVATE_SENTINEL'},media:[{externalUrl:'http://example.invalid/PRIVATE_SENTINEL'}],
};

function noLeak(value: unknown) {
  if (Array.isArray(value)) {value.forEach(noLeak);return;}
  if (value && typeof value === 'object') for (const [key,item] of Object.entries(value)) {
    assert(!/^(street|number|complement|postalCode|coordinates|rawMetadata|source|externalUrl|originalKey|originalValue|originalType|privateLocation|email|phone|corretor)$/i.test(key));
    noLeak(item);
  }
  if (typeof value === 'string') assert(!value.includes('PRIVATE_SENTINEL'));
}

async function local() {
  for (const query of ['page=0','page=1.5','perPage=49','valorMinimo=-1','valorMinimo=1e5','areaMinima=NaN',
    'valorMinimo=10&valorMaximo=1','areaMinima=2&areaMaxima=1','areaMaxima=-1','areaMaxima=1e5',
    'condominio=','condominio='+ 'a'.repeat(121),'condominio=A&condominio=B',
    'page=1&page=2','role=admin','__proto__=x','quartosMinimos=-1','negocio=venda']) {
    assert.throws(()=>parsePublicQuery(new URLSearchParams(query)));
  }
  const filters = parsePublicQuery(new URLSearchParams('valorMinimo=900719925474099.1&valorMaximo=900719925474099.2&quartosMinimos=0'));
  assert.equal(filters.valorMinimo,'900719925474099.1');
  assert.equal(parsePublicQuery(new URLSearchParams('condominio=Teste&areaMaxima=0.000001')).areaMaxima,'0.000001');
  const item=projectPublicItem('AP9999','premium',data,[{id:imageId,position:0,is_primary:true}]);
  noLeak(item); assert.equal(item.prices.sale,'1234567.89'); assert.equal(item.rooms.bedrooms,0);
  assert(item.media[0].url?.startsWith('https://admin.inglaterrapremium.com.br/api/blob-image/public/premium/'));
  assert.throws(()=>projectPublicItem('AP9999','premium',{...data,negotiation:'venda'},[]));
  let calls=0, reads=0, allowed=true, visible=true;
  const deps = {
    identifier:()=> 'a'.repeat(64), limit:async()=>allowed,
    list:async()=>{calls++;return {items:[item],total:1,page:1,perPage:24,hasMore:false};},
    detail:async()=>visible ? item : null, filters:async()=>[],
    imageAllowed:async()=>visible,
    image:async()=>{reads++;return {statusCode:200,stream:new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array([1,2,3]));c.close();}})};},
  };
  const handlers=createPublicHandlers(deps);
  const request=(query='',method='GET',origin?:string)=>new Request(`https://crm.example/api/catalog/premium/properties${query}`,{method,headers:origin?{origin}:{}});
  for (const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS']) {
    assert.equal((await handlers.catalog(request('',method),'premium',['properties'])).status,405);
    assert.equal((await handlers.image(request('',method),'premium',imageId)).status,405);
  }
  assert.equal(calls,0); assert.equal(reads,0);
  assert.equal((await handlers.catalog(request('','GET','https://evil.example'),'premium',['properties'])).status,403);
  const success=await handlers.catalog(request('','GET','https://inglaterrapremium.vercel.app'),'premium',['properties']);
  assert.equal(success.status,200); assert.equal(success.headers.get('access-control-allow-origin'),'https://inglaterrapremium.vercel.app');
  assert.equal(success.headers.get('cache-control'),'no-store'); noLeak(await success.json());
  assert.equal((await handlers.catalog(request('?page=0'),'premium',['properties'])).status,400);
  assert.equal((await handlers.catalog(request(),'unknown',['properties'])).status,404);
  visible=false;
  assert.equal((await handlers.catalog(request(),'premium',['properties','AP9999'])).status,404);
  assert.equal((await handlers.image(request(),'premium',imageId)).status,404); assert.equal(reads,0);
  visible=true;
  const photo=await handlers.image(request('?size=thumb'),'premium',imageId);
  assert.equal(photo.status,200); assert.equal(photo.headers.get('content-type'),'image/webp'); await photo.arrayBuffer();
  assert.equal((await handlers.image(request('?url=https://evil.example'),'premium',imageId)).status,400);
  allowed=false;
  const limited=await handlers.catalog(request(),'premium',['properties']); assert.equal(limited.status,429); assert.equal(limited.headers.get('retry-after'),'60');
  const failed=createPublicHandlers({...deps,limit:async()=>{throw new Error('PRIVATE_SENTINEL');}});
  const failure=await failed.catalog(request(),'premium',['properties']); assert.equal(failure.status,503); noLeak(await failure.json());
  let clock=0, limits=0, details=0, filterReads=0;
  allowed=true; visible=true; calls=0;
  const cachedHandlers=createPublicHandlers({...deps,
    limit:async()=>{limits++;return allowed;},
    detail:async()=>{details++;return visible ? item : null;},
    filters:async()=>{filterReads++;return [];},
  },()=>clock);
  const list=()=>cachedHandlers.catalog(request(),'premium',['properties']);
  const detail=()=>cachedHandlers.catalog(request(),'premium',['properties','AP9999']);
  const options=()=>cachedHandlers.catalog(request(),'premium',['filters']);
  await list(); await list(); assert.equal(calls,1); assert.equal(limits,2);
  const withoutOrigin=await list(); assert.equal(withoutOrigin.headers.get('access-control-allow-origin'),null);
  const withOrigin=await cachedHandlers.catalog(request('','GET','https://inglaterrapremium.vercel.app'),'premium',['properties']);
  assert.equal(withOrigin.headers.get('access-control-allow-origin'),'https://inglaterrapremium.vercel.app');
  for (const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control']) assert.equal(withOrigin.headers.get(header),'no-store');
  assert.equal((await cachedHandlers.catalog(request('','GET','https://evil.example'),'premium',['properties'])).status,403);
  assert.equal((await cachedHandlers.catalog(request('','POST'),'premium',['properties'])).status,405);
  allowed=false; assert.equal((await list()).status,429); allowed=true;
  await cachedHandlers.catalog(request('?page=1'),'premium',['properties']); assert.equal(calls,1);
  await cachedHandlers.catalog(request('?page=2'),'premium',['properties']);
  await cachedHandlers.catalog(request(),'matriz',['properties']); assert.equal(calls,3);
  await detail(); await detail(); assert.equal(details,1);
  await options(); await options(); assert.equal(filterReads,1);
  const before=reads;
  assert.equal((await cachedHandlers.image(request(),'premium',imageId)).status,200);
  visible=false; clock=59_999;
  assert.equal((await detail()).status,200);
  assert.equal((await cachedHandlers.image(request(),'premium',imageId)).status,404);
  assert.equal(reads,before+1);
  await list(); await options(); assert.equal(calls,3); assert.equal(filterReads,1);
  clock=60_000;
  assert.equal((await detail()).status,404); assert.equal(details,2);
  await list(); await options(); assert.equal(calls,4); assert.equal(filterReads,2);
  visible=true; assert.equal((await detail()).status,200); assert.equal(details,3);
  process.env.ADMIN_SESSION_SECRET ??= 'synthetic-local-test-secret-not-a-real-credential';
  const old=process.env.VERCEL; process.env.VERCEL='1';
  assert.equal(apiIdentifier(new Headers({'x-forwarded-for':'192.0.2.1'})),apiIdentifier(new Headers({'x-forwarded-for':'192.0.2.2'})));
  assert.notEqual(apiIdentifier(new Headers({'x-vercel-forwarded-for':'192.0.2.1'})),apiIdentifier(new Headers({'x-vercel-forwarded-for':'192.0.2.2'})));
  if(old===undefined) delete process.env.VERCEL; else process.env.VERCEL=old;
  console.log('PASS: strict query, decimal precision, recursive privacy, GET-only, CORS, rate errors, safe image gate and no-store');
}

async function cacheBoundaries() {
  let clock=0, calls=0;
  const cached=createPublicDataCache(()=>clock);
  const load=async()=>{calls++;return {version:calls};};
  assert.equal(await cached('key',load),'{"version":1}');
  clock=60_000;
  await assert.rejects(cached('key',async()=>{throw new Error('synthetic');}));
  assert.equal(await cached('key',load),'{"version":2}');
  await assert.rejects(cached('slow',async()=>{clock+=60_000;return {}; }));
  assert.equal(await cached('slow',load),'{"version":3}');
  for(let i=0;i<101;i++) await cached(`entry-${i}`,load);
  const count=calls; await cached('entry-0',load); assert.equal(calls,count+1);
  const oversized=async()=>{calls++;return 'x'.repeat(10*1024*1024);};
  await cached('large',oversized); await cached('large',oversized); assert.equal(calls,count+3);
  let finish: (value: unknown) => void = () => {throw new Error('not started');};
  const old=cached('race',()=>new Promise(resolve=>{finish=resolve;}));
  clock+=1; await cached('race',async()=>({version:'new'}));
  finish({version:'old'}); await old;
  assert.equal(await cached('race',load),'{"version":"new"}');
  console.log('PASS: 60s hard expiry, guards on hits, unit/query isolation, fresh CORS, immediate image gate, no cached errors, bounded memory and concurrent loads');
}

async function database() {
  const ids=Array.from({length:4},()=>randomUUID());
  const images=Array.from({length:3},()=>randomUUID());
  const code=`AP${Date.now().toString().slice(-12)}`;
  const city=`Fixture-${randomUUID()}`;
  const identifier=createHash('sha256').update(randomUUID()).digest('hex');
  try {
    for(let index=0;index<ids.length;index++) {
      await sql`insert into imoveis(id,codigo,origem,dados_origem,endereco_privado,source_hash,ativo,status_publicacao)
        values(${ids[index]},${index===0?code:randomUUID()},'manual',${sql.json({...data,publicLocation:{...data.publicLocation,city}})},
        ${sql.json({street:'PRIVATE_SENTINEL'})},${'a'.repeat(64)},${index!==2},${index===3?'pending_review':'published'})`;
      await sql`insert into unidades_publicacao(imovel_id,unidade,ativo,inclusao_manual) values(${ids[index]},${index===1?'matriz':'premium'},true,true)`;
    }
    for(let index=0;index<images.length;index++) await sql`insert into catalog_images(id,imovel_id,status,position,is_primary,width,height,bytes)
      values(${images[index]},${ids[0]},${index===0?'ready':index===1?'staged':'deleting'},${index===0?0:null},${index===0},10,10,10)`;
    let list=await listPublicProperties('premium',parsePublicQuery(new URLSearchParams({cidade:city})));
    assert.equal(list.total,1); assert.equal(list.items.length,1); assert.equal(list.items[0].media.length,1); noLeak(list);
    assert(await getPublicProperty('premium',code)); assert.equal(await getPublicProperty('matriz',code),null);
    assert(await canReadPublicImage('premium',images[0])); assert(!await canReadPublicImage('matriz',images[0]));
    assert(!await canReadPublicImage('premium',images[1])); assert(!await canReadPublicImage('premium',images[2]));
    list=await listPublicProperties('premium',parsePublicQuery(new URLSearchParams({cidade:city,negocio:'Alugar',areaMinima:'19999',quartosMinimos:'0'})));
    assert.equal(list.total,1);
    assert.equal((await listPublicProperties('premium',parsePublicQuery(new URLSearchParams({cidade:city,areaMinima:'20001'})))).total,0);
    const count = async (extra: Record<string,string>) => (await listPublicProperties('premium',parsePublicQuery(new URLSearchParams({cidade:city,...extra})))).total;
    assert.equal(await count({areaMaxima:'19999.999999'}),0);
    assert.equal(await count({areaMinima:'20000',areaMaxima:'20000'}),1);
    await sql`update imoveis set curadoria=${sql.json({rawMetadata:{nomeCondominio:'  Condominio sintetico  ',nomeEdificio:'Edificio alternativo'}})} where id=${ids[0]}`;
    assert.equal(await count({condominio:'Condominio sintetico'}),1);
    assert.equal(await count({condominio:'Edificio alternativo'}),0);
    let options=(await getPublicFilterOptions('premium')).filter(option=>option.cidade===city);
    assert.deepEqual(options.map(option=>option.condominio),['Condominio sintetico']); noLeak(options);
    await sql`update imoveis set curadoria=${sql.json({rawMetadata:{nomeCondominio:' ',nomeEdificio:'Edificio alternativo'},areas:{unit:'m2',usable:'0.000001',total:'20',private:null}})} where id=${ids[0]}`;
    assert.equal(await count({condominio:'Edificio alternativo',areaMinima:'0.000001',areaMaxima:'0.000001'}),1);
    assert.equal(await count({areaMaxima:'0'}),0);
    await sql`update imoveis set curadoria=${sql.json({areas:{unit:'m2',usable:null,total:null,private:null}})} where id=${ids[0]}`;
    assert.equal(await count({areaMinima:'0'}),0);
    assert.equal(await count({areaMaxima:'20000'}),0);
    assert.equal(await count({}),1);
    await sql`update imoveis set curadoria=${sql.json({prices:{sale:'555.55',rent:null,condominium:null,iptu:null},negotiation:'venda',title:'Titulo revisado'})} where id=${ids[0]}`;
    const detail=await getPublicProperty('premium',code); assert(detail); assert.equal(detail.prices.sale,'555.55'); assert.equal(detail.title,'Titulo revisado');
    assert.equal((await listPublicProperties('premium',parsePublicQuery(new URLSearchParams({cidade:city,negocio:'Alugar'})))).total,0);
    const page=await listPublicProperties('premium',parsePublicQuery(new URLSearchParams({cidade:city,page:'2',perPage:'1'})));
    assert.equal(page.total,1); assert.equal(page.items.length,0); assert.equal(page.hasMore,false);
    assert((await getPublicFilterOptions('premium')).some(option=>option.cidade===city));
    await sql`update unidades_publicacao set ativo=false where imovel_id=${ids[0]}`;
    assert.equal(await getPublicProperty('premium',code),null); assert(!await canReadPublicImage('premium',images[0]));
    assert(!(await getPublicFilterOptions('premium')).some(option=>option.cidade===city));
    await sql`insert into catalog_api_rate_limits(identifier_hash,scope,window_start,attempts) values(${identifier},'json',date_trunc('minute',now()),119)`;
    const race=await Promise.all(Array.from({length:5},()=>consumeApiLimit(identifier,'json')));
    assert.equal(race.filter(Boolean).length,1);
    assert(await consumeApiLimit(identifier,'image'));
    await sql`update catalog_api_rate_limits set window_start=now()-interval '2 minutes' where identifier_hash=${identifier}`;
    assert(await consumeApiLimit(identifier,'json'));
    console.log('PASS: PostgreSQL visibility/units, curation, filters, hectares, pagination, private gallery, unpublishing and concurrent distributed limiter');
  } finally {
    await sql`delete from catalog_images where id in ${sql(images)}`;
    await sql`delete from imoveis where id in ${sql(ids)}`;
    await sql`delete from catalog_api_rate_limits where identifier_hash=${identifier}`;
    const [left]=await sql`select (select count(*) from imoveis where id in ${sql(ids)})+
      (select count(*) from catalog_images where id in ${sql(images)})+
      (select count(*) from unidades_publicacao where imovel_id in ${sql(ids)})+
      (select count(*) from catalog_api_rate_limits where identifier_hash=${identifier}) as total`;
    assert.equal(Number(left.total),0); console.log('Temporary fixtures removed; no real property or Blob modified');
  }
}

local().then(cacheBoundaries).then(async()=>{if(process.argv.includes('--db')) await database();})
  .catch(error=>{console.error(error instanceof assert.AssertionError ? error.message : 'CATALOG_API_TEST_FAILED');process.exitCode=1;})
  .finally(async()=>{if(process.argv.includes('--db')) await sql.end();});
