import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { sql } from '@/lib/db';
import { condominiumEdit } from '@/lib/catalog/developments';
import { uploadCondominiumImage, uploadCatalogImage, cleanupCatalogImages } from '@/lib/catalog/image-service';
import type { ImageStorage } from '@/lib/catalog/image-storage';
import { canReadCatalogImage, getCatalogGallery, beginImageUpload, stageImageUpload, finishImageDeletion } from '@/lib/queries/catalog-images';
import { canReadPublicImage } from '@/lib/queries/catalog-public';
import { getCondominiumEditor, saveCondominiumEditor } from '@/lib/queries/catalog-developments';

async function main(){
  const id=randomUUID(),other=randomUUID(),property=randomUUID();
  const value={id,version:'a'.repeat(32),name:'Condominio teste',description:''};
  const empty={version:'d41d8cd98f00b204e9800998ecf8427e',ids:[],primaryId:null};
  assert(condominiumEdit.safeParse({...value,gallery:empty}).success);
  for(const draft of [{...empty,ids:[id,id],primaryId:id},{...empty,ids:[id]},{...empty,primaryId:id},{...empty,owner:'property'}])
    assert(!condominiumEdit.safeParse({...value,gallery:draft}).success);
  console.log('PASS: strict gallery draft, unique IDs and primary');
  if(!process.argv.includes('--db'))return;
  const emails=['admin','cadastro','corretor'].map(role=>`gallery-${role}-${id}@imobiliariainglaterra.com.br`);
  const inactive=`inactive-${id}@imobiliariainglaterra.com.br`;
  const allEmails=[...emails,inactive];
  const blobs=new Map<string,Buffer[]>();
  const storage:ImageStorage={async write(key,full,thumb){blobs.set(key,[full,thumb]);},async remove(key){blobs.delete(key);}};
  const png=await sharp({create:{width:80,height:60,channels:3,background:'#087b60'}}).png().toBuffer();
  const edit=async()=>{const row=await getCondominiumEditor(emails[0],id);assert(row);return row;};
  const save=async(ids:string[],primaryId:string|null,email=emails[0])=>{
    const row=await edit();
    return saveCondominiumEditor(email,{...value,version:row.version,gallery:{version:row.gallery.version,ids,primaryId}});
  };
  try{
    for(const [i,role] of ['admin','cadastro','corretor'].entries())await sql`insert into usuarios(email,role,ativo) values(${emails[i]},${role},true)`;
    await sql`insert into usuarios(email,role,ativo) values(${inactive},'cadastro',false)`;
    for(const key of [id,other])await sql`insert into condominios(id,nome,slug,endereco_privado) values(${key},'Galeria de teste',${key},'{"street":"PRIVATE_SENTINEL"}')`;
    await sql`insert into imoveis(id,codigo,origem,condominio_id,dados_origem,endereco_privado,source_hash)
      values(${property},${property},'manual',${id},'{"media":[]}','{}',${'a'.repeat(64)})`;
    const [before]=await sql`select md5(to_jsonb(i)::text) as hash from imoveis i where id=${property}`;
    const [protectedBefore]=await sql`select md5((to_jsonb(c)-'nome'-'sobre'-'updated_at')::text) as hash from condominios c where id=${id}`;
    const ids:string[]=[];
    for(const email of emails)ids.push(await uploadCondominiumImage(email,id,png,storage));
    assert.equal((await edit()).gallery.images.length,0);
    assert.equal(await canReadCatalogImage(emails[0],ids[0]),false);
    for(const email of [inactive,`absent-${id}@imobiliariainglaterra.com.br`]){
      await assert.rejects(()=>uploadCondominiumImage(email,id,png,storage),/CATALOG_FORBIDDEN/);
      await assert.rejects(()=>save(ids,ids[0],email),/CATALOG_FORBIDDEN/);
    }
    const foreign=await uploadCondominiumImage(emails[0],other,png,storage);
    const propertyImage=await uploadCatalogImage(emails[0],property,png,storage);
    assert.equal((await getCatalogGallery(emails[0],property)).images.length,1);
    const propertyDraft=await uploadCatalogImage(emails[0],property,png,storage,true);
    assert.equal(await canReadCatalogImage(emails[0],propertyDraft),false);
    for(const badId of [foreign,propertyImage,propertyDraft,randomUUID()]){
      const previous=await edit();
      await assert.rejects(()=>saveCondominiumEditor(emails[0],{...value,name:'Must rollback',version:previous.version,gallery:{...empty,ids:[badId],primaryId:badId}}),/IMAGE_UPLOAD_EXPIRED/);
      assert.equal((await edit()).version,previous.version);
    }
    const pending=randomUUID();
    await beginImageUpload(emails[0],id,pending,{width:80,height:60,bytes:100},'condominium');
    await assert.rejects(()=>stageImageUpload(emails[0],other,pending,'condominium'),/IMAGE_UPLOAD_EXPIRED/);
    await assert.rejects(()=>stageImageUpload(emails[0],property,pending),/IMAGE_UPLOAD_EXPIRED/);
    await assert.rejects(()=>save([pending],pending),/IMAGE_UPLOAD_EXPIRED/);
    await save(ids,ids[1],emails[2]);
    let current=await edit();
    assert.deepEqual(current.gallery.images.map(i=>i.id),ids);
    assert.equal(current.gallery.images.filter(i=>i.is_primary).length,1);
    assert.equal(current.gallery.images.find(i=>i.is_primary)?.id,ids[1]);
    assert.equal(await canReadCatalogImage(emails[0],ids[0]),true);
    assert.equal(await canReadPublicImage('premium',ids[0]),false);
    const stale=current;
    await save([...ids].reverse(),ids[0],emails[1]);
    current=await edit();
    await assert.rejects(()=>saveCondominiumEditor(emails[0],{...value,version:current.version,gallery:{version:stale.gallery.version,ids,primaryId:ids[0]}}),/GALLERY_CONFLICT/);
    const concurrent=await Promise.allSettled(emails.slice(0,2).map(email=>saveCondominiumEditor(email,{...value,version:current.version,gallery:{version:current.gallery.version,ids,primaryId:ids[1]}})));
    assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
    await save([ids[2]],ids[2]);
    assert.equal(await canReadCatalogImage(emails[0],ids[0]),false);
    assert.equal((await sql`select status from catalog_images where id=${ids[0]}`)[0].status,'deleting');
    // Only delete this test's blobs/rows; never claim the shared cleanup queue.
    await storage.remove(ids[0]);await finishImageDeletion(ids[0]);
    assert.equal((await sql`select id from catalog_images where id=${ids[0]}`).length,0);
    await save([],null);
    assert.equal((await edit()).gallery.images.length,0);
    await sql`update catalog_images set created_at=clock_timestamp()-interval '2 hours' where id=${pending}`;
    await cleanupCatalogImages(emails[0],storage,id);
    assert.equal((await sql`select id from catalog_images where condominio_id=${id}`).length,0);
    assert.equal((await sql`select id from catalog_images where id=${foreign}`).length,1);
    const failing:ImageStorage={async write(){throw new Error('fixture');},async remove(){}};
    await assert.rejects(()=>uploadCondominiumImage(emails[0],id,png,failing),/IMAGE_UPLOAD_FAILED/);
    const [after]=await sql`select md5(to_jsonb(i)::text) as hash from imoveis i where id=${property}`;
    const [protectedAfter]=await sql`select md5((to_jsonb(c)-'nome'-'sobre'-'updated_at')::text) as hash from condominios c where id=${id}`;
    assert.equal(after.hash,before.hash);assert.equal(protectedAfter.hash,protectedBefore.hash);
    assert.deepEqual((await getCatalogGallery(emails[0],property)).images.map(i=>i.id),[propertyImage]);
    for(const owners of [{imovel_id:null,condominio_id:null},{imovel_id:property,condominio_id:id}]){
      await assert.rejects(()=>sql`insert into catalog_images ${sql({id:randomUUID(),...owners,status:'pending',width:1,height:1,bytes:1})}`);
    }
    console.log('PASS: roles, staging, cross-owner isolation, atomic rollback, concurrency, primary/order/removal, private-only visibility and property regression');
  }finally{
    await sql`delete from catalog_images where condominio_id in (${id},${other}) or imovel_id=${property}`;
    await sql`delete from imoveis where id=${property}`;
    await sql`delete from condominios where id in (${id},${other})`;
    await sql`delete from usuarios where email in ${sql(allEmails)}`;
    const [remaining]=await sql`select (select count(*) from catalog_images where condominio_id in (${id},${other}) or imovel_id=${property})+(select count(*) from imoveis where id=${property})+(select count(*) from condominios where id in (${id},${other}))+(select count(*) from usuarios where email in ${sql(allEmails)}) as total`;
    assert.equal(Number(remaining.total),0);blobs.clear();console.log('PASS: temporary data removed; Blob simulated');
  }
}
main().catch(error=>{console.error('CONDOMINIUM_IMAGES_TEST_FAILED',error instanceof Error?error.name:'Unknown');process.exitCode=1;}).finally(async()=>{if(process.argv.includes('--db'))await sql.end();});
