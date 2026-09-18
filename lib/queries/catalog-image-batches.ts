import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { sql } from '@/lib/db';
import { catalogIdSchema } from '@/lib/catalog/editor';
import { imageBatchSchema, type ImageBatchInput } from '@/lib/catalog/image-batches';
import { externalImageUrl } from '@/lib/catalog/external-image';
import { lockImageMigrationProperty, claimSelectedImage } from './catalog-image-pilot';

type Tx = postgres.TransactionSql<Record<string, never>>;
async function authorize(tx:Tx,email:string) {
  const [user]=await tx`select id from usuarios where email=${email.trim().toLowerCase()} and ativo and role='admin' for share`;
  if(!user) throw new Error('PILOT_FORBIDDEN');
  return String(user.id);
}

export async function createImageBatch(email:string,input:ImageBatchInput) {
  const data=imageBatchSchema.parse(input);
  return sql.begin(async tx=>{
    const actor=await authorize(tx,email);
    const [property]=await tx`select id from imoveis where upper(codigo)=${data.code}`;
    if(!property) throw new Error('PROPERTY_NOT_FOUND');
    const id=String(property.id);
    const locked=await lockImageMigrationProperty(tx,email,id);
    const [repeated]=await tx`select id,imovel_id,created_by,photo_limit from catalog_image_batches where id=${data.id}`;
    if(repeated) {
      if(repeated.imovel_id!==id||repeated.created_by!==actor||repeated.photo_limit!==data.limit) throw new Error('BATCH_CONFLICT');
      return String(repeated.id);
    }
    // Double submissions resume the existing unfinished selection, even with another request ID.
    const [unfinished]=await tx`select b.id from catalog_image_batches b
      join catalog_image_batch_items i on i.batch_id=b.id
      join catalog_image_pilot p on p.imovel_id=i.imovel_id and p.slot=i.slot
      where b.imovel_id=${id} and p.status<>'done' and
        (p.attempts<3 or (p.status='working' and p.claimed_at>clock_timestamp()-interval '10 minutes'))
      order by b.created_at,b.id limit 1`;
    if(unfinished) return String(unfinished.id);
    const receipts=await tx<{slot:number;source_hash:string;status:string;attempts:number;assigned:boolean}[]>`
      select p.slot,p.source_hash,p.status,p.attempts,exists(
        select 1 from catalog_image_batch_items i where i.imovel_id=p.imovel_id and i.slot=p.slot) as assigned
      from catalog_image_pilot p where p.imovel_id=${id} order by p.slot`;
    const known=new Map(receipts.map(row=>[row.source_hash,row]));
    let slot=receipts.reduce((max,row)=>Math.max(max,row.slot),0);
    const selected:number[]=[];
    const media:unknown=locked.dados_origem.media;
    const photos=(Array.isArray(media)?media:[]) as {kind?:string;externalUrl?:string;order?:number}[];
    const seen=new Set<string>();
    for(const photo of [...photos].sort((a,b)=>(a.order??0)-(b.order??0))) {
      if(photo.kind!=='photo'||typeof photo.externalUrl!=='string') continue;
      const url=externalImageUrl(photo.externalUrl).href;
      const hash=createHash('sha256').update(url).digest('hex');
      if(seen.has(hash)) continue;
      seen.add(hash);
      const receipt=known.get(hash);
      if(receipt) {
        if(receipt.status==='done'||receipt.attempts>=3||receipt.assigned) continue;
        selected.push(receipt.slot);
      } else {
        if(slot>=1000) throw new Error('IMAGE_LIMIT');
        slot++;
        await tx`insert into catalog_image_pilot(imovel_id,slot,source_url,source_hash) values(${id},${slot},${url},${hash})`;
        selected.push(slot);
      }
      if(selected.length===data.limit) break;
    }
    if(!selected.length) throw new Error('NO_PENDING_IMAGES');
    await tx`insert into catalog_image_batches(id,imovel_id,created_by,photo_limit) values(${data.id},${id},${actor},${data.limit})`;
    for(const value of selected) await tx`insert into catalog_image_batch_items(batch_id,imovel_id,slot) values(${data.id},${id},${value})`;
    return data.id;
  });
}

export async function claimBatchImage(email:string,batchId:string) {
  catalogIdSchema.parse(batchId);
  return sql.begin(async tx=>{
    await authorize(tx,email);
    const [batch]=await tx`select imovel_id from catalog_image_batches where id=${batchId}`;
    if(!batch) throw new Error('BATCH_NOT_FOUND');
    const id=String(batch.imovel_id);
    await lockImageMigrationProperty(tx,email,id);
    const rows=await tx<{slot:number}[]>`select slot from catalog_image_batch_items where batch_id=${batchId} order by slot`;
    return {propertyId:id,job:await claimSelectedImage(tx,id,rows.map(row=>row.slot))};
  });
}

export type ImageBatchStatus = {
  id:string; propertyId:string; code:string; total:number; done:number; failed:number;
  working:number; remaining:number; attempts:number; downloadedBytes:number; storedBytes:number;
  items:{slot:number;status:string;attempts:number;reason:string|null}[];
};
export async function getImageBatchStatus(email:string,batchId:string):Promise<ImageBatchStatus> {
  catalogIdSchema.parse(batchId);
  return sql.begin(async tx=>{
    await authorize(tx,email);
    const [batch]=await tx`select b.id,b.imovel_id,p.codigo from catalog_image_batches b join imoveis p on p.id=b.imovel_id where b.id=${batchId}`;
    if(!batch) throw new Error('BATCH_NOT_FOUND');
    const rows=await tx<{slot:number;status:string;attempts:number;last_error:string|null;downloaded_bytes:string;stored_bytes:string;leased:boolean}[]>`
      select p.slot,p.status,p.attempts,p.last_error,p.downloaded_bytes,p.stored_bytes,
        coalesce(p.status='working' and p.claimed_at>clock_timestamp()-interval '10 minutes',false) as leased
      from catalog_image_batch_items i join catalog_image_pilot p on p.imovel_id=i.imovel_id and p.slot=i.slot
      where i.batch_id=${batchId} order by p.slot`;
    return {
      id:batchId,propertyId:String(batch.imovel_id),code:String(batch.codigo),total:rows.length,
      done:rows.filter(r=>r.status==='done').length,failed:rows.filter(r=>r.status==='failed'||r.status==='working'&&!r.leased).length,
      working:rows.filter(r=>r.leased).length,remaining:rows.filter(r=>r.status!=='done'&&(r.attempts<3||r.leased)).length,
      attempts:rows.reduce((n,r)=>n+r.attempts,0),
      downloadedBytes:rows.reduce((n,r)=>n+Number(r.downloaded_bytes),0),storedBytes:rows.reduce((n,r)=>n+Number(r.stored_bytes),0),
      items:rows.map(r=>({slot:r.slot,status:r.status==='working'&&!r.leased?'interrupted':r.status,attempts:r.attempts,reason:r.last_error})),
    };
  });
}

export async function listImageBatches(email:string) {
  return sql.begin(async tx=>{
    await authorize(tx,email);
    const rows=await tx<{id:string;code:string}[]>`select b.id,p.codigo as code from catalog_image_batches b
      join imoveis p on p.id=b.imovel_id order by b.created_at desc,b.id limit 20`;
    return Array.from(rows);
  });
}
