import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { sql } from '@/lib/db';
import { prepareCatalogImage, maxImageBytes } from '@/lib/catalog/image-validation';
import { imagePath, type ImageStorage } from '@/lib/catalog/image-storage';
import { uploadCatalogImage, cleanupCatalogImages } from '@/lib/catalog/image-service';
import { getCatalogGallery, mutateGallery, canReadCatalogImage, beginImageUpload, failImageUpload } from '@/lib/queries/catalog-images';

async function main() {
  const png=await sharp({create:{width:80,height:60,channels:3,background:{r:40,g:120,b:80}}}).withMetadata({exif:{IFD0:{Copyright:'fixture-only'}}}).png().toBuffer();
  const prepared=await prepareCatalogImage(png);
  const result=await sharp(prepared.full).metadata();
  assert.equal(result.format,'webp'); assert.equal(result.exif,undefined); assert.equal(result.width,80);
  assert((await sharp(prepared.thumbnail).metadata()).width!<=480);
  for(const input of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),Buffer.from([255,216,255,0]),png.subarray(0,12),Buffer.alloc(maxImageBytes+1)]) await assert.rejects(()=>prepareCatalogImage(input));
  for(const format of ['jpeg','webp'] as const) assert((await prepareCatalogImage(await sharp(png)[format]().toBuffer())).bytes>0);
  assert.throws(()=>imagePath('../../secret'));
  console.log('PASS: pixel decoding, magic bytes, corrupt/oversize/SVG rejection, metadata removal, thumbnail and generated paths');
  if(!process.argv.includes('--db')) return;
  const run=randomUUID(); const property=randomUUID(); const other=randomUUID(); const pending=randomUUID();
  const email=`images-${run}@imobiliariainglaterra.com.br`;
  const blobs=new Map<string,Buffer>();
  const storage:ImageStorage={ async write(id,full,thumb){blobs.set(imagePath(id),full);blobs.set(imagePath(id,true),thumb);},async remove(id){blobs.delete(imagePath(id));blobs.delete(imagePath(id,true));} };
  try {
    await sql`insert into usuarios(email,role,ativo) values(${email},'cadastro',true)`;
    for(const id of [property,other]) await sql`insert into imoveis(id,codigo,origem,dados_origem,endereco_privado,source_hash) values(${id},${id},'manual','{"media":[]}','{}',${'a'.repeat(64)})`;
    const first=await uploadCatalogImage(email,property,png,storage);
    const second=await uploadCatalogImage(email,property,png,storage);
    let gallery=await getCatalogGallery(email,property);
    assert.equal(gallery.images.length,2); assert.equal(gallery.images.filter(image=>image.is_primary).length,1);
    assert.equal(gallery.images[0].id,first); assert.equal(blobs.size,4);
    assert.equal(await canReadCatalogImage(email,first),true);
    assert.equal(Object.hasOwn(gallery.images[0],'pathname'),false);
    const race=await Promise.allSettled([
      mutateGallery(email,property,second,gallery.version,'primary'),
      mutateGallery(email,property,first,gallery.version,'later'),
    ]);
    assert.equal(race.filter(result=>result.status==='fulfilled').length,1);
    gallery=await getCatalogGallery(email,property);
    assert.equal(gallery.images.filter(image=>image.is_primary).length,1);
    await assert.rejects(()=>mutateGallery(email,other,first,'d41d8cd98f00b204e9800998ecf8427e','remove'));
    const main=gallery.images.find(image=>image.is_primary)!;
    assert.equal(await failImageUpload(main.id),false);
    await mutateGallery(email,property,main.id,gallery.version,'remove');
    assert.equal(await canReadCatalogImage(email,main.id),false);
    await cleanupCatalogImages(email,storage);
    gallery=await getCatalogGallery(email,property);
    assert.equal(gallery.images.length,1); assert(gallery.images[0].is_primary);
    const failedStorage:ImageStorage={async write(id,full){blobs.set(imagePath(id),full);throw new Error('fixture');},async remove(){throw new Error('fixture');}};
    await assert.rejects(()=>uploadCatalogImage(email,property,png,failedStorage));
    assert.equal((await getCatalogGallery(email,property)).images.length,1);
    await beginImageUpload(email,property,pending,prepared);
    await cleanupCatalogImages(email,storage);
    const [fresh]=await sql`select status from catalog_images where id=${pending}`; assert.equal(fresh.status,'pending');
    await sql`update catalog_images set created_at=clock_timestamp()-interval '2 hours' where id=${pending}`;
    await cleanupCatalogImages(email,storage);
    assert.equal((await sql`select id from catalog_images where id=${pending}`).length,0);
    assert.equal((await getCatalogGallery(email,property)).images.length,1);
    await sql`update usuarios set ativo=false where email=${email}`;
    await assert.rejects(()=>getCatalogGallery(email,property),/CATALOG_FORBIDDEN/);
    await assert.rejects(()=>canReadCatalogImage(email,first),/CATALOG_FORBIDDEN/);
    await assert.rejects(()=>uploadCatalogImage(email,property,png,storage),/CATALOG_FORBIDDEN/);
    console.log('PASS: Neon authorization, ready-only visibility, primary/order race, cross-property rejection, removal, partial upload cleanup and stale pending cleanup');
  } finally {
    await sql`delete from catalog_images where imovel_id in (${property},${other})`;
    await sql`delete from imoveis where id in (${property},${other})`;
    await sql`delete from usuarios where email=${email}`;
    const [left]=await sql`select (select count(*) from catalog_images where imovel_id in (${property},${other}))+(select count(*) from imoveis where id in (${property},${other}))+(select count(*) from usuarios where email=${email}) as n`;
    assert.equal(Number(left.n),0); blobs.clear();
    console.log('Temporary Neon fixtures and simulated blobs removed. Real Blob/OIDC NOT tested.');
  }
}
main().catch(error=>{console.error('CATALOG_IMAGES_TEST_FAILED',error instanceof Error?error.name:'Unknown');process.exitCode=1;}).finally(async()=>{if(process.argv.includes('--db')) await sql.end();});
