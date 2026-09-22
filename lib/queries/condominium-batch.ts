import { randomUUID, createHash } from 'node:crypto';
import type postgres from 'postgres';
import { sql } from '@/lib/db';
import { matchingName, planCondominiumBatch, type CondominiumSourceRow, type CondominiumTarget } from '@/lib/catalog/condominium-batch';

async function snapshot(tx: postgres.TransactionSql) {
  const rows = await tx<CondominiumSourceRow[]>`select id,codigo,source_key,fonte_presente,condominio_id,
    coalesce(dados_origem #>> '{rawMetadata,nomeCondominio}','') as nome,
    coalesce(dados_origem #>> '{rawMetadata,nomeEdificio}','') as edificio,
    coalesce(curadoria #>> '{publicLocation,city}',dados_origem #>> '{publicLocation,city}','') as city,
    coalesce(curadoria #>> '{publicLocation,state}',dados_origem #>> '{publicLocation,state}','') as state,
    coalesce(curadoria #>> '{publicLocation,officialNeighborhood}',dados_origem #>> '{publicLocation,officialNeighborhood}','') as neighborhood,
    coalesce((endereco_privado || curadoria_privada)->>'street','') as street,
    coalesce((endereco_privado || curadoria_privada)->>'number','') as number,
    coalesce((endereco_privado || curadoria_privada)->>'complement','') as complement,
    coalesce((endereco_privado || curadoria_privada)->>'postalCode','') as postal_code,
    md5((to_jsonb(imoveis)-'condominio_id'-'updated_at')::text) as fingerprint
    from imoveis order by id`;
  const targets = await tx<CondominiumTarget[]>`select id,nome,ativo from condominios order by id`;
  return {rows:Array.from(rows),targets:Array.from(targets)};
}
function plan(data: Awaited<ReturnType<typeof snapshot>>) {
  // Manual properties never become candidates, but their links guard existing targets.
  return planCondominiumBatch(data.rows.filter(r=>r.source_key || r.condominio_id),data.targets);
}
function digest(data: unknown) { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }

// Operator-only resolution of an explicitly reviewed group, including city discrepancies.
export async function linkReviewedCondominium(codes: string[], name: string) {
  if(!codes.length || codes.length>25 || new Set(codes).size!==codes.length ||
    codes.some(code=>! /^[A-Z]{2}\d+$/.test(code)) || !name.trim() || name.length>200) throw new Error('BATCH_INVALID_REVIEW');
  return sql.begin(async tx=>{
    await tx`set local lock_timeout='10s'`;
    await tx`select pg_advisory_xact_lock(91491003)`;
    await tx`lock table imoveis,condominios in share row exclusive mode`;
    const before=await snapshot(tx);
    const members=before.rows.filter(row=>codes.includes(row.codigo));
    if(members.length!==codes.length || members.some(row=>!row.source_key || !row.fonte_presente ||
      matchingName(row.nome.trim()||row.edificio.trim())!==matchingName(name))) throw new Error('BATCH_REVIEW_CHANGED');
    const targets=before.targets.filter(t=>matchingName(t.nome)===matchingName(name));
    if(targets.length>1 || targets[0]?.ativo || members.some(row=>row.condominio_id && row.condominio_id!==targets[0]?.id)) throw new Error('BATCH_LINK_CONFLICT');
    const id=targets[0]?.id || randomUUID();
    if(!targets.length) await tx`insert into condominios(id,nome,slug,ativo) values(${id},${name.trim()},${`condominio-${id}`},false)`;
    const ids=members.filter(row=>!row.condominio_id).map(row=>row.id);
    if(ids.length) {
      const changed=await tx`update imoveis set condominio_id=${id},updated_at=clock_timestamp()
        where id in ${tx(ids)} and condominio_id is null and origem='external' returning id`;
      if(changed.length!==ids.length) throw new Error('BATCH_LINK_CONFLICT');
    }
    const after=await snapshot(tx);
    if(before.rows.length!==after.rows.length || before.rows.some((row,index)=>{
      const next=after.rows[index];
      return row.id!==next.id || row.fingerprint!==next.fingerprint ||
        (codes.includes(row.codigo)?next.condominio_id!==id:row.condominio_id!==next.condominio_id);
    })) throw new Error('BATCH_PRESERVATION_FAILED');
    return {linked:ids.length,created:!targets.length,preserved:true,codes};
  });
}

// Maintenance-only entry point. Not imported by any page, action or public API.
// Execution requires the operator's explicit --apply and an exact reviewed snapshot digest.
export async function runCondominiumBatch(expected?: string) {
  return sql.begin(async tx=>{
    if(expected) {
      await tx`set local lock_timeout='10s'`;
      await tx`select pg_advisory_xact_lock(91491003)`;
      await tx`lock table imoveis,condominios in share row exclusive mode`;
    } else await tx`set transaction isolation level repeatable read read only`;
    const before=await snapshot(tx);
    const proposed=plan(before);
    const hash=digest(before);
    if(!expected) return {hash,applied:false,plan:proposed,...before};
    if(expected!==hash) throw new Error('BATCH_SNAPSHOT_CHANGED');
    const newTargets: {id:string;nome:string;slug:string;ativo:boolean}[]=[];
    const links: {id:string;target:string}[]=[];
    for(const change of proposed.changes) {
      const id=change.targetId || randomUUID();
      if(!change.targetId) {
        newTargets.push({id,nome:change.name,slug:`condominio-${id}`,ativo:false});
      }
      links.push(...change.ids.map(propertyId=>({id:propertyId,target:id})));
    }
    if(newTargets.length) await tx`insert into condominios ${tx(newTargets,'id','nome','slug','ativo')}`;
    const result=await tx`update imoveis i set condominio_id=x.target,updated_at=clock_timestamp()
      from jsonb_to_recordset(${tx.json(links)}::jsonb) as x(id uuid,target uuid)
      where i.id=x.id and i.condominio_id is null and i.origem='external' and i.fonte_presente returning i.id`;
    if(result.length!==links.length) throw new Error('BATCH_LINK_CONFLICT');
    const after=await snapshot(tx);
    if(before.rows.length!==after.rows.length || before.rows.some((row,index)=>
      row.id!==after.rows[index].id || row.fingerprint!==after.rows[index].fingerprint ||
      (row.condominio_id && row.condominio_id!==after.rows[index].condominio_id))) throw new Error('BATCH_PRESERVATION_FAILED');
    return {hash,applied:true,linked:result.length,created:newTargets.length,plan:proposed,...after};
  });
}
