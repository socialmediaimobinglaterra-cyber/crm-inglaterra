import type postgres from 'postgres';
import { sql } from '@/lib/db';
import { catalogIdSchema, catalogVersionSchema } from '@/lib/catalog/editor';
import { galleryDraftSchema, type GalleryDraft } from '@/lib/catalog/gallery-draft';

type Tx = postgres.TransactionSql<Record<string, never>>;
export type ImageOwner = 'property' | 'condominium';
function ownerColumn(owner:ImageOwner) {
  if(owner==='property') return 'imovel_id';
  if(owner==='condominium') return 'condominio_id';
  throw new Error('IMAGE_INVALID_OWNER');
}
export type GalleryImage = { id:string; position:number; is_primary:boolean; width:number; height:number };
async function authorize(tx:Tx,email:string) {
  const rows=await tx`select id from usuarios where email=${email.trim().toLowerCase()} and ativo and role in ('admin','cadastro','corretor') for share`;
  if (!rows.length) throw new Error('CATALOG_FORBIDDEN');
}
async function lockProperty(tx:Tx,email:string,id:string,owner:ImageOwner='property') {
  catalogIdSchema.parse(id);
  await authorize(tx,email);
  const table=ownerColumn(owner)==='imovel_id'?'imoveis':'condominios';
  const rows=await tx`select id from ${tx(table)} where id=${id} for update`;
  if (!rows.length) throw new Error('CATALOG_NOT_FOUND');
}
// Caller holds the authorized owner row lock, including when reading a snapshot.
export async function gallery(tx:Tx,id:string,owner:ImageOwner='property') {
  const column=ownerColumn(owner);
  const images=await tx<GalleryImage[]>`select id,position,is_primary,width,height from catalog_images where ${tx(column)}=${id} and status='ready' order by position,id`;
  const [revision]=await tx`select md5(coalesce(string_agg(id::text || ':' || position::text || ':' || is_primary::text, ',' order by position,id),'')) as version from catalog_images where ${tx(column)}=${id} and status='ready'`;
  return {images:Array.from(images),version:String(revision.version)};
}
export async function getCatalogGallery(email:string,id:string) {
  catalogIdSchema.parse(id);
  return sql.begin(async tx=>{
    // A consistent snapshot of rows and revision, also shared with all mutations.
    await lockProperty(tx,email,id);
    const result=await gallery(tx,id);
    const [counts]=await tx`select jsonb_array_length(coalesce(dados_origem->'media','[]'))::int as external_count from imoveis where id=${id}`;
    return {...result,externalCount:Number(counts.external_count)};
  });
}
export async function beginImageUpload(email:string,propertyId:string,imageId:string,info:{width:number;height:number;bytes:number},owner:ImageOwner='property') {
  const column=ownerColumn(owner);
  catalogIdSchema.parse(imageId);
  if (![info.width,info.height,info.bytes].every(value=>Number.isSafeInteger(value)&&value>0)) throw new Error('IMAGE_INVALID');
  await sql.begin(async tx=>{
    await lockProperty(tx,email,propertyId,owner);
    const [count]=await tx`select count(*)::int as total, count(*) filter(where status='pending')::int as pending from catalog_images where ${tx(column)}=${propertyId} and status<>'deleting'`;
    if (count.total>=1000 || count.pending>=5) throw new Error('IMAGE_LIMIT');
    await tx`insert into catalog_images(id,${tx(column)},status,width,height,bytes) values(${imageId},${propertyId},'pending',${info.width},${info.height},${info.bytes})`;
  });
}
export async function completeImageUpload(email:string,propertyId:string,id:string) {
  catalogIdSchema.parse(id);
  await sql.begin(async tx=>{
    await lockProperty(tx,email,propertyId);
    const [current]=await tx`select coalesce(max(position),-1)+1 as next, count(*) filter(where is_primary)::int as primaries from catalog_images where imovel_id=${propertyId} and status='ready'`;
    const rows=await tx`update catalog_images set status='ready',position=${current.next},is_primary=${current.primaries===0} where id=${id} and imovel_id=${propertyId} and status='pending' returning id`;
    if (!rows.length) throw new Error('IMAGE_UPLOAD_EXPIRED');
  });
}
export async function stageImageUpload(email:string,propertyId:string,id:string,owner:ImageOwner='property') {
  const column=ownerColumn(owner);
  catalogIdSchema.parse(id);
  await sql.begin(async tx => {
    await lockProperty(tx,email,propertyId,owner);
    const rows = await tx`update catalog_images set status='staged' where id=${id} and ${tx(column)}=${propertyId} and status='pending' returning id`;
    if (!rows.length) throw new Error('IMAGE_UPLOAD_EXPIRED');
  });
}

// The caller holds the authorized save transaction and owner row lock.
export async function saveGalleryDraft(tx:Tx,propertyId:string,input:GalleryDraft,owner:ImageOwner='property') {
  const column=ownerColumn(owner);
  const draft=galleryDraftSchema.parse(input);
  const current=await gallery(tx,propertyId,owner);
  if(current.version!==draft.version) throw new Error('GALLERY_CONFLICT');
  const rows=await tx<{id:string;status:string}[]>`select id,status from catalog_images where ${tx(column)}=${propertyId} order by id for update`;
  for(const id of draft.ids) {
    const row=rows.find(row=>row.id===id);
    if(!row || !['ready','staged'].includes(row.status)) throw new Error('IMAGE_UPLOAD_EXPIRED');
  }
  await tx`update catalog_images set is_primary=false where ${tx(column)}=${propertyId} and is_primary`;
  for(const row of current.images) {
    if(!draft.ids.includes(row.id)) await tx`update catalog_images set status='deleting',position=null,cleanup_at=null where id=${row.id}`;
  }
  for(const [position,id] of draft.ids.entries()) {
    await tx`update catalog_images set status='ready',position=${position},is_primary=${id===draft.primaryId} where id=${id} and ${tx(column)}=${propertyId}`;
  }
}

export async function failImageUpload(id:string) {
  catalogIdSchema.parse(id);
  const rows=await sql`update catalog_images set status='deleting',cleanup_at=null where id=${id} and status='pending' returning id`;
  return rows.length===1;
}
export async function finishImageDeletion(id:string) {
  catalogIdSchema.parse(id);
  await sql`delete from catalog_images where id=${id} and status='deleting'`;
}
export async function claimImageCleanup(email:string,condominiumId?:string) {
  if(condominiumId!==undefined) catalogIdSchema.parse(condominiumId);
  return sql.begin(async tx=>{
    await authorize(tx,email);
    const scope=condominiumId===undefined?tx`true`:tx`condominio_id=${condominiumId}`;
    return tx<{id:string}[]>`with candidates as (
      select id from catalog_images where
        ${scope} and (status='deleting' or (status in ('pending','staged') and created_at<clock_timestamp()-interval '1 hour'))
        and (cleanup_at is null or cleanup_at<clock_timestamp()-interval '5 minutes')
      order by created_at limit 5 for update skip locked
    ) update catalog_images i set status='deleting',cleanup_at=clock_timestamp()
      from candidates c where i.id=c.id returning i.id`;
  });
}
export async function mutateGallery(email:string,propertyId:string,id:string,version:string,command:'primary'|'earlier'|'later'|'remove') {
  catalogIdSchema.parse(id); catalogVersionSchema.parse(version);
  if (!['primary','earlier','later','remove'].includes(command)) throw new Error('INVALID_INPUT');
  await sql.begin(async tx=>{
    await lockProperty(tx,email,propertyId);
    const current=await gallery(tx,propertyId);
    if (version!==current.version) throw new Error('GALLERY_CONFLICT');
    const index=current.images.findIndex(image=>image.id===id);
    if(index<0) throw new Error('IMAGE_NOT_FOUND');
    if(command==='primary') {
      await tx`update catalog_images set is_primary=false where imovel_id=${propertyId} and is_primary`;
      await tx`update catalog_images set is_primary=true where id=${id}`;
    } else if(command==='remove') {
      await tx`update catalog_images set status='deleting',position=null,is_primary=false,cleanup_at=null where id=${id}`;
      const remaining=current.images.filter(image=>image.id!==id);
      if(current.images[index].is_primary && remaining.length) await tx`update catalog_images set is_primary=true where id=${remaining[0].id}`;
    } else {
      const target=current.images[index+(command==='earlier'?-1:1)];
      if(!target) return;
      await tx`update catalog_images set position=case when id=${id} then ${target.position} else ${current.images[index].position} end where id in (${id},${target.id})`;
    }
  });
}
export async function canReadCatalogImage(email:string,id:string) {
  catalogIdSchema.parse(id);
  return sql.begin(async tx=>{
    await authorize(tx,email);
    const rows=await tx`select id from catalog_images where id=${id} and status='ready'`;
    return rows.length===1;
  });
}
