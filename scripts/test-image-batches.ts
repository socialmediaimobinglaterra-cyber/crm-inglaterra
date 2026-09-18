import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { sql } from '@/lib/db';
import { imageBatchSchema } from '@/lib/catalog/image-batches';
import { createImageBatch, getImageBatchStatus, claimBatchImage, listImageBatches } from '@/lib/queries/catalog-image-batches';
import { migrateBatchImage } from '@/lib/catalog/image-batch-service';
import { migratePilotImage } from '@/lib/catalog/image-pilot-service';
import { uploadCatalogImage } from '@/lib/catalog/image-service';
import { getCatalogGallery, mutateGallery, finishImageDeletion } from '@/lib/queries/catalog-images';
import type { ImageStorage } from '@/lib/catalog/image-storage';

async function main() {
  for(const change of [{limit:0},{limit:11},{limit:1.5},{code:'../secret'},{id:'invalid'},{actor:'admin'}]) {
    assert.equal(imageBatchSchema.safeParse({id:randomUUID(),code:'AP1234',limit:10,...change}).success,false);
  }
  assert.equal(imageBatchSchema.parse({id:randomUUID(),code:' ap1234 ',limit:'5'}).code,'AP1234');
  console.log('PASS: strict IDs, property codes and batch limits');
  if(!process.argv.includes('--db')) return;
  const run=randomUUID(),property=randomUUID();
  const code=`ZZ${(BigInt('0x'+run.replaceAll('-',''))%BigInt('1000000000000')).toString().padStart(12,'0')}`;
  const admin=`batch-admin-${run}@imobiliariainglaterra.com.br`;
  const broker=`batch-broker-${run}@imobiliariainglaterra.com.br`;
  const inactive=`batch-inactive-${run}@imobiliariainglaterra.com.br`;
  const cadastro=`batch-cadastro-${run}@imobiliariainglaterra.com.br`;
  const emails=[admin,broker,inactive,cadastro];
  const files=new Map<string,Buffer>();
  const storage:ImageStorage={async write(id,full,thumb){files.set(id,full);files.set(id+'-thumb',thumb);},async remove(id){files.delete(id);files.delete(id+'-thumb');}};
  const png=await sharp({create:{width:64,height:48,channels:3,background:'#118855'}}).png().toBuffer();
  let downloads=0;
  const download=async()=>{downloads++;return png;};
  try {
    await sql`insert into usuarios(email,role,ativo) values(${admin},'admin',true),(${broker},'corretor',true),(${inactive},'admin',false),(${cadastro},'cadastro',true)`;
    const media=[...Array.from({length:15},(_,n)=>n),0].map((n,order)=>({kind:'photo',order,externalUrl:`https://lh3.googleusercontent.com/fixture-${run}-${n}`}));
    await sql`insert into imoveis(id,codigo,origem,dados_origem,endereco_privado,source_hash) values(${property},${code},'manual',${sql.json({media})},'{}',${'b'.repeat(64)})`;
    const manual=await uploadCatalogImage(admin,property,png,storage);
    for(let n=0;n<3;n++) assert.equal((await migratePilotImage(admin,property,storage,download)).status,'done');
    const input={id:randomUUID(),code,limit:10};
    for(const email of [broker,inactive,cadastro,`missing-${run}@imobiliariainglaterra.com.br`]) {
      await assert.rejects(()=>createImageBatch(email,input),/PILOT_FORBIDDEN/);
      await assert.rejects(()=>listImageBatches(email),/PILOT_FORBIDDEN/);
    }
    const created=await Promise.all([createImageBatch(admin,input),createImageBatch(admin,{...input,id:randomUUID()})]);
    assert.equal(created[0],created[1]);
    const batch=created[0];
    assert.equal(await createImageBatch(admin,input),batch);
    const initial=await getImageBatchStatus(admin,batch);
    assert.equal(initial.total,10);assert.equal(initial.done,0);assert.equal(downloads,3);
    for(const email of [broker,inactive,cadastro]) await assert.rejects(()=>migrateBatchImage(email,batch,storage,download),/PILOT_FORBIDDEN/);
    let enter!:()=>void,release!:()=>void;
    const entered=new Promise<void>(r=>{enter=r;}),hold=new Promise<void>(r=>{release=r;});
    const first=migrateBatchImage(admin,batch,storage,async()=>{enter();await hold;return download();});
    try {
      await entered;
      assert.equal((await migrateBatchImage(admin,batch,storage,download)).status,'idle');
    } finally {release();}
    assert.equal((await first).status,'done');
    assert.equal((await getImageBatchStatus(admin,batch)).done,1);
    const failing:ImageStorage={async write(id,full){files.set(id,full);throw new Error('simulated');},remove:storage.remove};
    assert.equal((await migrateBatchImage(admin,batch,failing,download)).status,'failed');
    assert.equal((await getImageBatchStatus(admin,batch)).items[1].reason,'storage');
    for(let n=0;n<9;n++) assert.equal((await migrateBatchImage(admin,batch,storage,download)).status,'done');
    const done=await getImageBatchStatus(admin,batch);
    assert.equal(done.done,10);assert.equal(done.remaining,0);assert.equal(done.attempts,11);
    assert.equal(done.downloadedBytes,11*png.length);assert(done.storedBytes>0);
    const before=downloads;
    assert.equal((await migrateBatchImage(admin,batch,storage,download)).status,'idle');assert.equal(downloads,before);
    const gallery=await getCatalogGallery(admin,property);
    assert.equal(gallery.images.length,14);assert.equal(gallery.images[0].id,manual);assert(gallery.images[0].is_primary);
    const removed=gallery.images[1].id;
    await mutateGallery(admin,property,removed,gallery.version,'remove');
    await storage.remove(removed);await finishImageDeletion(removed);
    const next=await createImageBatch(admin,{id:randomUUID(),code,limit:10});
    assert.equal((await getImageBatchStatus(admin,next)).total,2);
    const stale=await claimBatchImage(admin,next);
    assert(stale.job);
    await sql`update catalog_image_pilot set claimed_at=clock_timestamp()-interval '11 minutes' where imovel_id=${property} and slot=${stale.job.slot}`;
    assert.equal((await getImageBatchStatus(admin,next)).items[0].status,'interrupted');
    assert.equal((await migrateBatchImage(admin,next,storage,download)).status,'done');
    const badDownload=async()=>{throw new Error('simulated');};
    for(let n=0;n<3;n++) assert.equal((await migrateBatchImage(admin,next,storage,badDownload)).status,'failed');
    assert.equal((await migrateBatchImage(admin,next,storage,download)).status,'idle');
    assert.equal((await getImageBatchStatus(admin,next)).remaining,0);
    await assert.rejects(()=>createImageBatch(admin,{id:randomUUID(),code,limit:10}),/NO_PENDING_IMAGES/);
    const [unchanged]=await sql`select ativo,status_publicacao,dados_origem from imoveis where id=${property}`;
    assert.equal(unchanged.ativo,false);assert.equal(unchanged.status_publicacao,'pending_review');assert.equal(unchanged.dados_origem.media.length,16);
    const publicState=JSON.stringify(done);
    for(const forbidden of ['externalUrl','source_hash','fixture-',admin,run]) assert(!publicState.includes(forbidden));
    console.log('PASS: admin authorization, idempotent bounded selection, pilot reuse, concurrency, resume, partial failure, retry cap, lease recovery, byte counters, gallery/publication preserved and safe status');
  } finally {
    await sql`delete from catalog_image_batch_items where imovel_id=${property}`;
    await sql`delete from catalog_image_batches where imovel_id=${property}`;
    await sql`delete from catalog_image_pilot where imovel_id=${property}`;
    await sql`delete from catalog_images where imovel_id=${property}`;
    await sql`delete from imoveis where id=${property}`;
    await sql`delete from usuarios where email in ${sql(emails)}`;
    const [left]=await sql`select
      (select count(*) from catalog_image_batches where imovel_id=${property})+
      (select count(*) from catalog_image_batch_items where imovel_id=${property})+
      (select count(*) from catalog_image_pilot where imovel_id=${property})+
      (select count(*) from catalog_images where imovel_id=${property})+
      (select count(*) from imoveis where id=${property})+
      (select count(*) from usuarios where email in ${sql(emails)}) as total`;
    assert.equal(Number(left.total),0);files.clear();console.log('PASS: exclusive fixtures removed; no real download or Blob operation');
  }
}
main().catch(()=>{console.error('IMAGE_BATCH_TEST_FAILED');process.exitCode=1;}).finally(async()=>{if(process.argv.includes('--db'))await sql.end();});
