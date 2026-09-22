import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { condominiumEdit } from '@/lib/catalog/developments';
import { getCondominiumEditor, saveCondominiumEditor } from '@/lib/queries/catalog-developments';
import { createSessionToken, sessionCookieName } from '@/lib/auth/session';
import { sql } from '@/lib/db';
import sharp from 'sharp';

async function main(){
  const id=randomUUID(),property=randomUUID();
  const value={id,version:'a'.repeat(32),name:' Nome ',description:' Descricao '};
  assert.equal(condominiumEdit.parse(value).name,'Nome');
  for(const bad of [{...value,name:' '},{...value,description:'x'.repeat(20001)},{...value,ativo:true},{...value,slug:'novo'},{...value,version:'x'}]) assert(!condominiumEdit.safeParse(bad).success);
  console.log('PASS: strict editorial fields and version');
  if(!process.argv.includes('--db'))return;
  const emails=['admin','cadastro','corretor'].map(role=>`${role}-${id}@imobiliariainglaterra.com.br`);
  const inactive=`inactive-${id}@imobiliariainglaterra.com.br`;
  const allEmails:string[]=[...emails,inactive];
  try{
    for(const [i,role] of ['admin','cadastro','corretor'].entries())await sql`insert into usuarios(email,role,ativo) values(${emails[i]},${role},true)`;
    await sql`insert into usuarios(email,role,ativo) values(${inactive},'cadastro',false)`;
    await sql`insert into condominios(id,nome,slug,ativo,endereco_privado) values(${id},'Condominio de teste',${id},true,${sql.json({street:'PRIVATE_SENTINEL'})})`;
    await sql`insert into unidades_publicacao(condominio_id,unidade,ativo) values(${id},'premium',true)`;
    await sql`insert into imoveis(id,codigo,origem,condominio_id,dados_origem,endereco_privado,source_hash)
      values(${property},${property},'manual',${id},${sql.json({publicLocation:{city:'Cidade teste',officialNeighborhood:'Bairro teste'}})},'{}',${'a'.repeat(64)})`;
    const [before]=await sql`select md5(to_jsonb(i)::text) as hash from imoveis i where id=${property}`;
    for(const [i,email] of emails.entries()){
      const editor=await getCondominiumEditor(email,id);assert(editor);
      assert.equal(editor.properties.length,1);assert(!JSON.stringify(editor).includes('PRIVATE_SENTINEL'));
      await saveCondominiumEditor(email,{...value,version:editor.version,name:`Nome ${i}`});
    }
    for(const email of [inactive,`missing-${id}@imobiliariainglaterra.com.br`]){
      await assert.rejects(()=>getCondominiumEditor(email,id),/CATALOG_FORBIDDEN/);
      await assert.rejects(()=>saveCondominiumEditor(email,value),/CATALOG_FORBIDDEN/);
    }
    const current=await getCondominiumEditor(emails[0],id);assert(current);
    const results=await Promise.allSettled(emails.slice(0,2).map(email=>saveCondominiumEditor(email,{...value,version:current.version})));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    await assert.rejects(()=>saveCondominiumEditor(emails[0],{...value,version:current.version}),/DEVELOPMENT_CONFLICT/);
    if(process.argv.includes('--browser')){
      const origin=process.env.CRM_TEST_ORIGIN||'http://localhost:3008';
      assert(/^http:\/\/localhost:\d+$/.test(origin));
      const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
      const browser=await chromium.launch({channel:'msedge',headless:true});
      try{
        const context=await browser.newContext({viewport:{width:1440,height:1000}});
        await context.addCookies([{name:sessionCookieName,value:createSessionToken({email:emails[2],role:'corretor'}),url:origin,httpOnly:true,sameSite:'Lax'}]);
        const page=await context.newPage();
        await page.goto(`${origin}/catalog/developments/${id}`);
        await page.getByLabel('Nome do condomínio').fill('Condomínio de teste revisado');
        await page.getByLabel('Descrição').fill('Descrição de teste.');
        await page.getByRole('button',{name:'Salvar alterações'}).click();
        await page.getByRole('status').filter({hasText:'Alterações salvas.'}).waitFor();
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.getByRole('heading',{name:'Editar condomínio',exact:true}).waitFor();
        assert.equal(await page.getByLabel('Nome do condomínio').inputValue(),'Condomínio de teste revisado');
        assert.equal(await page.getByLabel('Descrição').inputValue(),'Descrição de teste.');
        const png=await sharp({create:{width:320,height:240,channels:3,background:'#16816c'}}).png().toBuffer();
        await page.getByLabel('Arquivos de fotos').setInputFiles([{name:'area-comum-1.png',mimeType:'image/png',buffer:png},{name:'area-comum-2.png',mimeType:'image/png',buffer:png}]);
        await page.getByRole('heading',{name:'Fotos das áreas comuns (2)',exact:true}).waitFor();
        await page.getByRole('button',{name:'Definir foto 2 como principal',exact:true}).click();
        await page.getByRole('button',{name:'Mover foto 2 para antes',exact:true}).click();
        assert.equal(await page.getByRole('button',{name:'Definir foto 1 como principal',exact:true}).getAttribute('aria-pressed'),'true');
        assert(await page.locator('figure img').evaluateAll((images:HTMLImageElement[])=>images.length===2&&images.every(image=>image.complete&&image.naturalWidth>0)));
        for(const width of [1440,390]){
          await page.setViewportSize({width,height:1000});
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          await page.screenshot({path:join(tmpdir(),`condominium-editor-${width}.png`),fullPage:true});
        }
        assert.equal((await getCondominiumEditor(emails[2],id))?.gallery.images.length,0);
        await page.getByRole('button',{name:'Remover foto 2',exact:true}).click();
        await page.getByRole('button',{name:'Remover foto 1',exact:true}).click();
        await page.getByRole('button',{name:'Salvar alterações'}).click();
        await page.getByRole('status').filter({hasText:'Alterações salvas.'}).waitFor();
        const guest=await browser.newPage();await guest.goto(`${origin}/catalog/developments/${id}`);await guest.waitForURL('**/login');
        console.log('PASS: browser save/reload, multi-select preview/order/primary/removal, desktop/mobile and anonymous redirect; no photo uploaded');
      }finally{await browser.close();}
    }
    const [after]=await sql`select md5(to_jsonb(i)::text) as hash from imoveis i where id=${property}`;assert.equal(after.hash,before.hash);
    const [record]=await sql`select slug,ativo,endereco_privado from condominios where id=${id}`;
    assert.equal(record.slug,id);assert.equal(record.ativo,true);assert.equal(record.endereco_privado.street,'PRIVATE_SENTINEL');
    assert.equal((await sql`select ativo from unidades_publicacao where condominio_id=${id}`)[0].ativo,true);
    await sql`update usuarios set ativo=false where email=${emails[2]}`;
    await assert.rejects(()=>saveCondominiumEditor(emails[2],value),/CATALOG_FORBIDDEN/);
    assert.equal(await getCondominiumEditor(emails[0],randomUUID()),null);
    console.log('PASS: roles, stale/concurrent editing, private data, properties/slug/publication preserved');
  }finally{
    await sql`delete from imoveis where id=${property}`;
    await sql`delete from condominios where id=${id}`;
    await sql`delete from usuarios where email in ${sql(allEmails)}`;
    const [remaining]=await sql`select (select count(*) from imoveis where id=${property})+(select count(*) from condominios where id=${id})+(select count(*) from usuarios where email in ${sql(allEmails)})+(select count(*) from unidades_publicacao where condominio_id=${id}) as total`;
    assert.equal(Number(remaining.total),0);console.log('PASS: cleanup verified');
  }
}
main().catch(()=>{console.error('CONDOMINIUM_EDITOR_TEST_FAILED');process.exitCode=1;}).finally(async()=>{if(process.argv.includes('--db'))await sql.end();});
