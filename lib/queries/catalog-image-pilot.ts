import { createHash, randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { sql } from '@/lib/db';
import { catalogIdSchema } from '@/lib/catalog/editor';
import { externalImageUrl } from '@/lib/catalog/external-image';

type Tx = postgres.TransactionSql<Record<string, never>>;

export async function getImagePilotStatus(email:string,id:string) {
  return sql.begin(async tx=>{
    await lock(tx,email,id);
    const [property]=await tx`select codigo from imoveis where id=${id}`;
    const rows=await tx<{slot:number;status:string;attempts:number}[]>`select slot,status,attempts from catalog_image_pilot where imovel_id=${id} and slot<=3 order by slot`;
    return {code:String(property.codigo),items:Array.from(rows)};
  });
}
export async function lockImageMigrationProperty(tx: Tx, email: string, id: string) {
  catalogIdSchema.parse(id);
  const users = await tx`select id from usuarios where email=${email.trim().toLowerCase()} and ativo and role='admin' for share`;
  if (!users.length) throw new Error('PILOT_FORBIDDEN');
  const [property] = await tx`select dados_origem from imoveis where id=${id} for update`;
  if (!property) throw new Error('PILOT_NOT_FOUND');
  return property;
}
const lock = lockImageMigrationProperty;

export async function claimPilotImage(email: string, id: string) {
  return sql.begin(async tx => {
    const property = await lock(tx,email,id);
    const existing = await tx`select slot from catalog_image_pilot where imovel_id=${id}`;
    if (!existing.length) {
      const photos = (Array.isArray(property.dados_origem.media) ? property.dados_origem.media : []) as {kind?:string;externalUrl?:string;order?:number}[];
      const urls = new Set<string>();
      for (const photo of [...photos].sort((a,b)=>(a.order??0)-(b.order??0))) {
        if(photo.kind!=='photo'||typeof photo.externalUrl!=='string') continue;
        // Reject an unsupported source, rather than silently selecting different photos.
        const url=externalImageUrl(photo.externalUrl).href;
        if(urls.has(url)) continue;
        urls.add(url);
        await tx`insert into catalog_image_pilot(imovel_id,slot,source_url,source_hash) values(${id},${urls.size},${url},${createHash('sha256').update(url).digest('hex')})`;
        if(urls.size===3) break;
      }
    }
    return claimSelectedImage(tx,id,[1,2,3]);
  });
}

// Caller holds the authorized property lock. Receipt writes follow image writes.
export async function claimSelectedImage(tx:Tx,id:string,slots:number[]) {
    const [working] = await tx`select slot from catalog_image_pilot where imovel_id=${id} and status='working' and claimed_at>clock_timestamp()-interval '10 minutes'`;
    if(working) return null;
    if(!slots.length) return null;
    const [job] = await tx`select slot,source_url,image_id from catalog_image_pilot where imovel_id=${id} and slot in ${tx(slots)} and status<>'done' and attempts<3 order by slot limit 1`;
    if(!job) return null;
    // Stale attempts retain their own paths in the existing cleanup queue.
    if(job.image_id) await tx`update catalog_images set status='deleting',cleanup_at=null where id=${job.image_id} and status='pending'`;
    const attempt=randomUUID();
    await tx`update catalog_image_pilot set status='working',attempt_id=${attempt},attempts=attempts+1,claimed_at=clock_timestamp(),image_id=null,last_error=null where imovel_id=${id} and slot=${job.slot}`;
    return {slot:Number(job.slot),url:String(job.source_url),attempt};
}

export async function beginPilotUpload(email:string,propertyId:string,slot:number,attempt:string,info:{width:number;height:number;bytes:number}) {
  return sql.begin(async tx=>{
    await lock(tx,email,propertyId);
    const [job]=await tx`select slot from catalog_image_pilot where imovel_id=${propertyId} and slot=${slot} and attempt_id=${attempt} and status='working' for update`;
    if(!job) throw new Error('PILOT_EXPIRED');
    const [count]=await tx`select count(*)::int as total from catalog_images where imovel_id=${propertyId} and status<>'deleting'`;
    if(count.total>=1000) throw new Error('IMAGE_LIMIT');
    const id=randomUUID();
    await tx`insert into catalog_images(id,imovel_id,status,width,height,bytes) values(${id},${propertyId},'pending',${info.width},${info.height},${info.bytes})`;
    await tx`update catalog_image_pilot set image_id=${id} where imovel_id=${propertyId} and slot=${slot}`;
    return id;
  });
}

export async function completePilotImage(email:string,propertyId:string,slot:number,attempt:string,id:string,storedBytes=0) {
  await sql.begin(async tx=>{
    await lock(tx,email,propertyId);
    // Parent lock serializes completions; image precedes receipt writes, as in cleanup's FK update.
    const [job]=await tx`select slot from catalog_image_pilot where imovel_id=${propertyId} and slot=${slot} and attempt_id=${attempt} and image_id=${id} and status='working'`;
    if(!job) throw new Error('PILOT_EXPIRED');
    const [current]=await tx`select coalesce(max(position),-1)+1 as position,count(*) filter(where is_primary)::int as primaries from catalog_images where imovel_id=${propertyId} and status='ready'`;
    const rows=await tx`update catalog_images set status='ready',position=${current.position},is_primary=${current.primaries===0} where id=${id} and status='pending' returning id`;
    if(!rows.length) throw new Error('PILOT_EXPIRED');
    await tx`update catalog_image_pilot set status='done',stored_bytes=${storedBytes},last_error=null where imovel_id=${propertyId} and slot=${slot}`;
  });
}

export async function failPilotImage(propertyId:string,slot:number,attempt:string,reason:'download'|'image'|'storage'|'finalize'='finalize') {
  await sql`update catalog_image_pilot set status='failed',last_error=${reason} where imovel_id=${propertyId} and slot=${slot} and attempt_id=${attempt} and status='working'`;
}

export async function recordImageDownload(propertyId:string,slot:number,attempt:string,bytes:number) {
  const rows=await sql`update catalog_image_pilot set downloaded_bytes=downloaded_bytes+${bytes}
    where imovel_id=${propertyId} and slot=${slot} and attempt_id=${attempt} and status='working' returning slot`;
  if(!rows.length) throw new Error('PILOT_EXPIRED');
}
