import { sql } from '@/lib/db';
import { condominiumEdit, developmentFilters, developmentSelection, type DevelopmentCandidate, type DevelopmentRecord } from '@/lib/catalog/developments';
import { z } from 'zod';
import type postgres from 'postgres';
import { gallery, saveGalleryDraft } from './catalog-images';

async function authorize(tx: postgres.TransactionSql, email: string) {
  const rows = await tx`select id from usuarios where email=${email.trim().toLowerCase()}
    and ativo and role in ('admin','cadastro','corretor') for share`;
  if (!rows.length) throw new Error('CATALOG_FORBIDDEN');
}

// Include both links and curated location so a stale review cannot replace a newer decision.
const versionExpression = `(md5(dados_origem::text || curadoria::text || coalesce(condominio_id::text,'') || coalesce(lancamento_id::text,'')))`;

export async function getCondominiumEditor(email: string, id: string) {
  z.uuid().parse(id);
  return sql.begin(async tx=>{
    await authorize(tx,email);
    const [record]=await tx`select id,nome,sobre,ativo,md5(to_jsonb(c)::text) as version from condominios c where id=${id} for update`;
    if(!record) return null;
    const properties=await tx<{id:string;codigo:string;city:string;neighborhood:string}[]>`select id,codigo,
      coalesce(curadoria #>> '{publicLocation,city}',dados_origem #>> '{publicLocation,city}','') as city,
      coalesce(curadoria #>> '{publicLocation,officialNeighborhood}',dados_origem #>> '{publicLocation,officialNeighborhood}','') as neighborhood
      from imoveis where condominio_id=${id} order by codigo,id`;
    return {id:String(record.id),name:String(record.nome),description:String(record.sobre||''),active:Boolean(record.ativo),version:String(record.version),properties:Array.from(properties),gallery:await gallery(tx,id,'condominium')};
  });
}

export async function saveCondominiumEditor(email: string, input: unknown) {
  const value=condominiumEdit.parse(input);
  return sql.begin(async tx=>{
    await authorize(tx,email);
    // Same lock as grouping, so renaming cannot race with a name-based association.
    await tx`select pg_advisory_xact_lock(91491003)`;
    const rows=await tx`update condominios c set nome=${value.name},sobre=${value.description || null},updated_at=clock_timestamp()
      where id=${value.id} and md5(to_jsonb(c)::text)=${value.version} returning id`;
    if(!rows.length) throw new Error('DEVELOPMENT_CONFLICT');
    if(value.gallery) await saveGalleryDraft(tx,value.id,value.gallery,'condominium');
    const [record]=await tx`select md5(to_jsonb(c)::text) as version from condominios c where id=${value.id}`;
    return {version:String(record.version),name:value.name,description:value.description,gallery:await gallery(tx,value.id,'condominium')};
  });
}

export async function listDevelopmentCandidates(email: string, input: unknown) {
  const filters = developmentFilters.parse(input);
  return sql.begin(async tx => {
    await authorize(tx, email);
    const pattern = `%${filters.q.replace(/[\\%_]/g, '\\$&')}%`;
    const condition = tx`origem='external' and fonte_presente and (
      nullif(trim(dados_origem #>> '{rawMetadata,nomeCondominio}'),'') is not null or
      nullif(trim(dados_origem #>> '{rawMetadata,nomeEdificio}'),'') is not null or
      dados_origem #>> '{rawMetadata,statusComercial}' in ('Lancamento','Futuro lancamento'))
      and (${filters.q}='' or codigo ilike ${pattern} or dados_origem #>> '{rawMetadata,nomeCondominio}' ilike ${pattern}
      or dados_origem #>> '{rawMetadata,nomeEdificio}' ilike ${pattern}
      or coalesce(curadoria #>> '{publicLocation,city}',dados_origem #>> '{publicLocation,city}') ilike ${pattern})`;
    const [count] = await tx`select count(*)::int as total from imoveis where ${condition}`;
    const pages = Math.max(1, Math.ceil(count.total / 25));
    const page = Math.min(filters.page, pages);
    const rows = await tx<DevelopmentCandidate[]>`select id,codigo,condominio_id,lancamento_id,
      coalesce(dados_origem #>> '{rawMetadata,nomeCondominio}','') as condominium,
      coalesce(dados_origem #>> '{rawMetadata,nomeEdificio}','') as building,
      coalesce(dados_origem #>> '{rawMetadata,statusComercial}','') as commercial,
      coalesce(curadoria #>> '{publicLocation,city}',dados_origem #>> '{publicLocation,city}','') as city,
      coalesce(curadoria #>> '{publicLocation,state}',dados_origem #>> '{publicLocation,state}','') as state,
      coalesce(curadoria #>> '{publicLocation,officialNeighborhood}',dados_origem #>> '{publicLocation,officialNeighborhood}','') as neighborhood,
      ${tx.unsafe(versionExpression)} as version
      from imoveis where ${condition} order by condominium,building,city,state,codigo,id limit 25 offset ${(page-1)*25}`;
    const records = await tx<DevelopmentRecord[]>`select c.id,c.nome,c.ativo,'condominio' as kind,count(i.id)::int as total
      from condominios c left join imoveis i on i.condominio_id=c.id group by c.id
      union all select c.id,c.nome,c.ativo,'lancamento' as kind,count(i.id)::int as total
      from lancamentos c left join imoveis i on i.lancamento_id=c.id group by c.id order by nome,id`;
    return { items: Array.from(rows), records: Array.from(records), total: Number(count.total), page, pages };
  });
}

export async function confirmDevelopment(email: string, input: unknown) {
  const value = developmentSelection.parse(input);
  const table = value.kind === 'condominio' ? 'condominios' : 'lancamentos';
  const column = value.kind === 'condominio' ? 'condominio_id' : 'lancamento_id';
  return sql.begin(async tx => {
    await authorize(tx, email);
    // Serialize target creation/review; property locks are always acquired in ID order.
    await tx`select pg_advisory_xact_lock(91491003)`;
    const ids = value.properties.map(p => p.id).sort();
    const rows = await tx`select id,${tx(column)} as linked,${tx.unsafe(versionExpression)} as version
      from imoveis where id in ${tx(ids)} and origem='external' and fonte_presente order by id for update`;
    if (rows.length !== ids.length || rows.some(row => row.version !== value.properties.find(p => p.id === row.id)?.version || row.linked)) {
      throw new Error('DEVELOPMENT_CONFLICT');
    }
    if (value.existing) {
      const [record] = await tx`select nome,ativo from ${tx(table)} where id=${value.id} for update`;
      if (!record || record.ativo || record.nome !== value.name) throw new Error('DEVELOPMENT_CONFLICT');
    } else {
      const existing = await tx`select id from ${tx(table)} where id=${value.id}`;
      if (existing.length) throw new Error('DEVELOPMENT_CONFLICT');
      await tx`insert into ${tx(table)}(id,nome,slug,ativo) values(${value.id},${value.name},${`${value.kind}-${value.id}`},false)`;
    }
    await tx`update imoveis set ${tx(column)}=${value.id},updated_at=clock_timestamp() where id in ${tx(ids)}`;
    return value.id;
  });
}
