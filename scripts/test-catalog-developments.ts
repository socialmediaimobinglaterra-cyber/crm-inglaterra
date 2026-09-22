import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { developmentSelection, developmentFilters } from '@/lib/catalog/developments';
import { listDevelopmentCandidates, confirmDevelopment } from '@/lib/queries/catalog-developments';
import { sql } from '@/lib/db';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSessionToken, sessionCookieName } from '@/lib/auth/session';

async function main() {
  const selection = {kind:'condominio',id:randomUUID(),existing:false,name:'Teste',properties:[{id:randomUUID(),version:'a'.repeat(32)}]};
  assert(developmentSelection.safeParse(selection).success);
  for (const bad of [{...selection,ativo:true},{...selection,kind:'imoveis'},{...selection,name:' '},
    {...selection,properties:[]},{...selection,properties:[...selection.properties,...selection.properties]},
    {...selection,properties:[{id:randomUUID(),version:'wrong'}]}]) assert(!developmentSelection.safeParse(bad).success);
  assert(!developmentFilters.safeParse({page:-1}).success);
  console.log('PASS: strict selection, duplicate IDs, versions and filters');
  if (!process.argv.includes('--db')) return;
  const run = randomUUID();
  const source = `review-${run}`;
  const emails = ['admin','cadastro','corretor'].map(role=>`${role}-${run}@imobiliariainglaterra.com.br`);
  const inactive = `inactive-${run}@imobiliariainglaterra.com.br`;
  const allEmails: string[] = [...emails,inactive];
  const ids = Array.from({length:5},()=>randomUUID());
  const entities = Array.from({length:6},()=>randomUUID());
  const origin = {rawMetadata:{nomeCondominio:`Review ${run}`,nomeEdificio:'Edificio teste',statusComercial:'Lancamento'},
    publicLocation:{city:'Cidade teste',state:'PR',officialNeighborhood:'Bairro teste'}, prices:{sale:'1000'}};
  try {
    await sql`insert into catalog_sources(key,adapter) values(${source},'property-xml-v1')`;
    for (const [i,role] of ['admin','cadastro','corretor'].entries()) await sql`insert into usuarios(email,role,ativo) values(${emails[i]},${role},true)`;
    await sql`insert into usuarios(email,role,ativo) values(${inactive},'cadastro',false)`;
    for (const id of ids) await sql`insert into imoveis(id,codigo,origem,source_key,external_id,dados_origem,endereco_privado,source_hash)
      values(${id},${id},'external',${source},${id},${sql.json(origin)},${sql.json({street:'PRIVATE_SENTINEL'})},${'a'.repeat(64)})`;
    const read = async()=>listDevelopmentCandidates(emails[0],{q:run});
    const initial = await read();
    assert.equal(initial.total,5);
    assert(!JSON.stringify(initial.items).includes('PRIVATE_SENTINEL'));
    const snapshot = (id:string, items=initial.items)=>({id,version:items.find(p=>p.id===id)!.version});
    const input = (index:number, propertyIndex:number)=>({...selection,id:entities[index],name:`Review ${run}`,properties:[snapshot(ids[propertyIndex])]});
    for (const email of [inactive,`missing-${run}@imobiliariainglaterra.com.br`]) {
      await assert.rejects(()=>listDevelopmentCandidates(email,{}),/CATALOG_FORBIDDEN/);
      await assert.rejects(()=>confirmDevelopment(email,input(0,0)),/CATALOG_FORBIDDEN/);
    }
    for (let i=0;i<3;i++) await confirmDevelopment(emails[i],input(i,i));
    await assert.rejects(()=>confirmDevelopment(emails[0],input(3,0)),/DEVELOPMENT_CONFLICT/);
    // Add a reviewed property to an existing draft, preserving all publication/source fields.
    await confirmDevelopment(emails[2],{...input(0,3),existing:true});
    const [entity] = await sql`select ativo,galeria,endereco_privado from condominios where id=${entities[0]}`;
    assert.equal(entity.ativo,false); assert.deepEqual(entity.galeria,[]); assert.deepEqual(entity.endereco_privado,{});
    const [property] = await sql`select dados_origem,endereco_privado,ativo,status_publicacao from imoveis where id=${ids[0]}`;
    assert.deepEqual(property.dados_origem,origin); assert.equal(property.endereco_privado.street,'PRIVATE_SENTINEL');
    assert.equal(property.ativo,false); assert.equal(property.status_publicacao,'pending_review');
    assert.equal((await sql`select id from unidades_publicacao where condominio_id in ${sql(entities)}`).length,0);
    await sql`update condominios set ativo=true where id=${entities[0]}`;
    await assert.rejects(()=>confirmDevelopment(emails[2],{...input(0,4),existing:true}),/DEVELOPMENT_CONFLICT/);
    await sql`update imoveis set curadoria=${sql.json({publicLocation:{city:'Outra cidade'}})} where id=${ids[4]}`;
    await assert.rejects(()=>confirmDevelopment(emails[0],input(3,4)),/DEVELOPMENT_CONFLICT/);
    assert.equal((await sql`select id from condominios where id=${entities[3]}`).length,0);
    const fresh = await read();
    const concurrent = await Promise.allSettled([4,5].map(index=>confirmDevelopment(emails[0],{...input(index,4),properties:[snapshot(ids[4],fresh.items)]})));
    assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
    const latest = await read();
    await confirmDevelopment(emails[1],{...input(3,0),kind:'lancamento',properties:[snapshot(ids[0],latest.items)]});
    const [linked] = await sql`select condominio_id,lancamento_id from imoveis where id=${ids[0]}`;
    assert.equal(linked.condominio_id,entities[0]); assert.equal(linked.lancamento_id,entities[3]);
    await sql`update usuarios set ativo=false where email=${emails[2]}`;
    await assert.rejects(()=>confirmDevelopment(emails[2],input(3,4)),/CATALOG_FORBIDDEN/);
    if (process.argv.includes('--browser')) {
      const require = createRequire(import.meta.url);
      const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
      const browser = await chromium.launch({channel:'msedge',headless:true});
      try {
        const context = await browser.newContext({viewport:{width:1440,height:1000}});
        await context.addCookies([{name:sessionCookieName,value:createSessionToken({email:emails[0],role:'admin'}),url:'http://localhost:3006',httpOnly:true,sameSite:'Lax'}]);
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        await page.goto(`http://localhost:3006/catalog/developments?q=${run}`);
        console.log('Browser: review page loaded');
        await page.getByRole('heading',{name:'Condomínios e lançamentos'}).waitFor();
        await page.getByLabel('Tipo de cadastro').selectOption('lancamento');
        await page.getByLabel(`Selecionar ${ids[1]}`,{exact:true}).check();
        await page.getByLabel('Destino').selectOption(entities[3]);
        await page.getByText('Confirmo que os 1 imóveis selecionados pertencem ao mesmo empreendimento.').click();
        await page.getByRole('button',{name:'Confirmar vínculos'}).click();
        console.log('Browser: review submitted');
        await page.getByRole('status').filter({hasText:'Cadastro e vínculos salvos'}).waitFor();
        assert.equal((await sql`select lancamento_id from imoveis where id=${ids[1]}`)[0].lancamento_id,entities[3]);
        await page.goto('http://localhost:3006/catalog/developments?q=Royal');
        await page.getByRole('heading',{name:'Condomínios e lançamentos'}).waitFor();
        for (const width of [1440,390]) {
          await page.setViewportSize({width,height:1000});
          assert(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth));
          const path = join(tmpdir(),`crm-development-review-${width}.png`);
          await page.screenshot({path,fullPage:true});
          console.log('UI screenshot:',path);
        }
        const anonymous = await browser.newContext();
        const guest = await anonymous.newPage();
        await guest.goto('http://localhost:3006/catalog/developments');
        await guest.waitForURL('**/login');
        console.log('PASS: authenticated browser save on fixture, real read-only listing, desktop/mobile layout and anonymous redirect');
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') console.error(error.message);
        throw error;
      } finally { await browser.close(); }
    }
    console.log('PASS: Neon roles, privacy, drafts, existing links, stale reviews, concurrency, rollback and publication preservation');
    const [counts] = await sql`select count(*)::int as total,
      count(*) filter(where nullif(trim(dados_origem #>> '{rawMetadata,nomeCondominio}'),'') is not null)::int as with_condominium,
      count(*) filter(where nullif(trim(dados_origem #>> '{rawMetadata,nomeEdificio}'),'') is not null)::int as with_building
      from imoveis where origem='external' and source_key<>${source}`;
    console.log('Read-only real catalog counts:',JSON.stringify(counts));
  } finally {
    await sql`delete from imoveis where id in ${sql(ids)}`;
    await sql`delete from condominios where id in ${sql(entities)}`;
    await sql`delete from lancamentos where id in ${sql(entities)}`;
    await sql`delete from usuarios where email in ${sql(allEmails)}`;
    await sql`delete from catalog_sources where key=${source}`;
    const [remaining] = await sql`select (select count(*) from imoveis where id in ${sql(ids)})+
      (select count(*) from condominios where id in ${sql(entities)})+(select count(*) from lancamentos where id in ${sql(entities)})+
      (select count(*) from usuarios where email in ${sql(allEmails)})+(select count(*) from catalog_sources where key=${source}) as total`;
    assert.equal(Number(remaining.total),0);
    console.log('PASS: temporary records removed and cleanup verified');
  }
}
main().catch(()=>{console.error('DEVELOPMENT_TEST_FAILED');process.exitCode=1;})
  .finally(async()=>{if(process.argv.includes('--db')) await sql.end();});
