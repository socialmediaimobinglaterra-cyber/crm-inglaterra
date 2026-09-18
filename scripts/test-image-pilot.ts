import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { sql } from '@/lib/db';
import { externalImageUrl } from '@/lib/catalog/external-image';
import { migratePilotImage } from '@/lib/catalog/image-pilot-service';
import { getImagePilotStatus } from '@/lib/queries/catalog-image-pilot';
import { getCatalogGallery, mutateGallery } from '@/lib/queries/catalog-images';
import { uploadCatalogImage, cleanupCatalogImages } from '@/lib/catalog/image-service';
import type { ImageStorage } from '@/lib/catalog/image-storage';

async function main(){
  for(const url of ['https://localhost/a','https://127.0.0.1/a','https://lh3.googleusercontent.com.evil.invalid/a','https://user:pass@lh3.googleusercontent.com/a','https://lh3.googleusercontent.com:444/a','file:///a','broken']) assert.throws(()=>externalImageUrl(url));
  assert.equal(externalImageUrl('http://lh3.googleusercontent.com/a').protocol,'https:');
  console.log('PASS: exact host, credentials, ports, schemes and HTTPS upgrade');
  if(!process.argv.includes('--db')) return;
  const run=randomUUID(),id=randomUUID();
  const admin=`pilot-admin-${run}@imobiliariainglaterra.com.br`,broker=`pilot-broker-${run}@imobiliariainglaterra.com.br`;
  const files=new Map<string,Buffer>();
  const storage:ImageStorage={async write(id,full,thumb){files.set(id,full);files.set(id+'-thumb',thumb);},async remove(id){files.delete(id);files.delete(id+'-thumb');}};
  const png=await sharp({create:{width:60,height:40,channels:3,background:'#005a45'}}).png().toBuffer();
  let downloads=0;
  const download=async()=>{downloads++;return png;};
  try{
    await sql`insert into usuarios(email,role,ativo) values(${admin},'admin',true),(${broker},'corretor',true)`;
    const media=[0,0,1,2,3].map((n,order)=>({kind:'photo',order,externalUrl:`https://lh3.googleusercontent.com/fixture-${run}-${n}`}));
    await sql`insert into imoveis(id,codigo,origem,dados_origem,endereco_privado,source_hash) values(${id},${id},'manual',${sql.json({media})},'{}',${'a'.repeat(64)})`;
    const manual=await uploadCatalogImage(admin,id,png,storage);
    await assert.rejects(()=>migratePilotImage(broker,id,storage,download),/PILOT_FORBIDDEN/);
    assert.equal(downloads,0);
    const concurrent=await Promise.all([migratePilotImage(admin,id,storage,download),migratePilotImage(admin,id,storage,download)]);
    assert.equal(concurrent.filter(r=>r.status==='done').length,1);
    const failedStorage:ImageStorage={async write(id,full){files.set(id,full);throw new Error('fixture');},remove:storage.remove};
    assert.equal((await migratePilotImage(admin,id,failedStorage,download)).status,'failed');
    assert.equal((await migratePilotImage(admin,id,storage,download)).status,'done');
    assert.equal((await migratePilotImage(admin,id,storage,download)).status,'done');
    const before=downloads;
    assert.equal((await migratePilotImage(admin,id,storage,download)).status,'idle');
    assert.equal(downloads,before);
    const gallery=await getCatalogGallery(admin,id);
    assert.equal(gallery.images.length,4);assert.equal(gallery.images[0].id,manual);assert(gallery.images[0].is_primary);
    await mutateGallery(admin,id,gallery.images[1].id,gallery.version,'remove');
    await cleanupCatalogImages(admin,storage);
    assert.equal((await migratePilotImage(admin,id,storage,download)).status,'idle');
    const status=await getImagePilotStatus(admin,id);
    assert.equal(status.items.length,3);assert(status.items.every(item=>item.status==='done'));
    const [property]=await sql`select ativo,status_publicacao,dados_origem from imoveis where id=${id}`;
    assert.equal(property.ativo,false);assert.equal(property.status_publicacao,'pending_review');assert.equal(property.dados_origem.media.length,5);
    console.log('PASS: admin-only, concurrency, three unique photos, failed upload retry, manual gallery/primary preserved, no reimport after removal, publication/source preserved');
  }finally{
    await sql`delete from catalog_image_pilot where imovel_id=${id}`;
    await sql`delete from catalog_images where imovel_id=${id}`;
    await sql`delete from imoveis where id=${id}`;
    await sql`delete from usuarios where email in (${admin},${broker})`;
    const [left]=await sql`select (select count(*) from catalog_image_pilot where imovel_id=${id})+(select count(*) from catalog_images where imovel_id=${id})+(select count(*) from imoveis where id=${id})+(select count(*) from usuarios where email in (${admin},${broker})) as total`;
    assert.equal(Number(left.total),0);files.clear();console.log('Fixtures removed; downloads and Blob simulated');
  }
}
main().catch(()=>{console.error('IMAGE_PILOT_TEST_FAILED');process.exitCode=1;}).finally(async()=>{if(process.argv.includes('--db'))await sql.end();});
