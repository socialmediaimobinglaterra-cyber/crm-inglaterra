import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import { catalogEditSchema } from '@/lib/catalog/editor';
import { publicationDraftSchema } from '@/lib/catalog/publication';
import { getCatalogEditor, saveCatalogEdit } from '@/lib/queries/catalog';
import { getCatalogPublication } from '@/lib/queries/catalog-publication';

const run=randomUUID(), id=randomUUID();
const email=(role:string)=>`publication-${role}-${run}@imobiliariainglaterra.com.br`;
const emails=['admin','cadastro','corretor','inactive'].map(email);
const values=catalogEditSchema.parse({title:'Imovel sintetico',description:null,
  prices:{sale:'100000',rent:null,condominium:null,iptu:null},
  areas:{unit:'m2',total:'100',usable:null,private:null},
  rooms:{bedrooms:0,suites:0,bathrooms:1,livingRooms:null,parkingSpaces:0}});

async function main(){
  for(const units of [['unknown'],['premium','premium']]) assert.equal(publicationDraftSchema.safeParse({version:'a'.repeat(32),units}).success,false);
  assert.equal(publicationDraftSchema.safeParse({version:'a'.repeat(32),units:[],role:'admin'}).success,false);
  try {
    for(const role of ['admin','cadastro','corretor','inactive']) await sql`insert into usuarios(email,role,ativo) values(${email(role)},${role==='inactive'?'admin':role},${role!=='inactive'})`;
    await sql`insert into imoveis(id,codigo,origem,dados_origem,endereco_privado,source_hash) values(${id},${id},'manual',${sql.json(values)},'{}',${'a'.repeat(64)})`;
    let editor=await getCatalogEditor(email('admin'),id); assert(editor);
    let publication=await getCatalogPublication(email('admin'),id);
    for(const role of ['corretor','inactive','missing']) {
      await assert.rejects(()=>saveCatalogEdit(email(role),id,editor!.version,values,undefined,{...publication,units:['premium']}),/FORBIDDEN/);
    }
    assert.deepEqual((await getCatalogPublication(email('admin'),id)).units,[]);
    await saveCatalogEdit(email('cadastro'),id,editor.version,values,undefined,{...publication,units:['premium']});
    assert.deepEqual((await getCatalogPublication(email('admin'),id)).units,['premium']);
    await assert.rejects(()=>saveCatalogEdit(email('admin'),id,editor!.version,values,undefined,{...publication,units:['matriz']}),/PUBLICATION_CONFLICT/);
    editor=await getCatalogEditor(email('admin'),id); assert(editor);
    publication=await getCatalogPublication(email('admin'),id);
    // A gallery failure rolls back both the edit and the requested publication change.
    await assert.rejects(()=>saveCatalogEdit(email('admin'),id,editor!.version,{...values,title:'Nao deve persistir'},
      {version:'0'.repeat(32),ids:[],primaryId:null},{...publication,units:['premium','matriz']}));
    assert.equal((await getCatalogEditor(email('admin'),id))?.values.title,values.title);
    assert.deepEqual((await getCatalogPublication(email('admin'),id)).units,['premium']);
    await saveCatalogEdit(email('admin'),id,editor.version,values,undefined,{...publication,units:['premium','matriz']});
    editor=await getCatalogEditor(email('admin'),id); assert(editor);
    publication=await getCatalogPublication(email('admin'),id);
    assert.deepEqual(publication.units,['matriz','premium']);
    const race=await Promise.allSettled(['admin','cadastro'].map(role=>saveCatalogEdit(email(role),id,editor!.version,values,undefined,{...publication,units:['matriz']})));
    assert.equal(race.filter(result=>result.status==='fulfilled').length,1);
    assert.deepEqual((await getCatalogPublication(email('admin'),id)).units,['matriz']);
    editor=await getCatalogEditor(email('corretor'),id); assert(editor);
    await saveCatalogEdit(email('corretor'),id,editor.version,{...values,title:'Editado pelo corretor'});
    assert.deepEqual((await getCatalogPublication(email('admin'),id)).units,['matriz']);
    publication=await getCatalogPublication(email('admin'),id);
    editor=await getCatalogEditor(email('admin'),id); assert(editor);
    await sql`update usuarios set role='corretor' where email=${email('cadastro')}`;
    await assert.rejects(()=>saveCatalogEdit(email('cadastro'),id,editor!.version,values,undefined,{...publication,units:[]}),/PUBLICATION_FORBIDDEN/);
    await saveCatalogEdit(email('admin'),id,editor.version,values,undefined,{...publication,units:[]});
    const [row]=await sql`select ativo,status_publicacao,dados_origem from imoveis where id=${id}`;
    assert.equal(row.ativo,false); assert.equal(row.status_publicacao,'unpublished');
    assert.equal(row.dados_origem.title,values.title);
    const units=await sql`select ativo,inclusao_manual,elegivel_filtro_automatico from unidades_publicacao where imovel_id=${id}`;
    assert.equal(units.length,2); assert(units.every(unit=>!unit.ativo&&!unit.inclusao_manual&&!unit.elegivel_filtro_automatico));
    console.log('PASS: publication by unit, database authorization, stale role, strict inputs, concurrent conflict, rollback and unpublishing');
  } finally {
    await sql`delete from imoveis where id=${id}`;
    await sql`delete from usuarios where email in ${sql(emails)}`;
    const [left]=await sql`select (select count(*) from imoveis where id=${id})+(select count(*) from unidades_publicacao where imovel_id=${id})+(select count(*) from usuarios where email in ${sql(emails)}) as total`;
    assert.equal(Number(left.total),0);
    console.log('Temporary fixtures removed; no real property published');
  }
}
main().catch(()=>{console.error('CATALOG_PUBLICATION_TEST_FAILED');process.exitCode=1;}).finally(()=>sql.end());
