import { sql } from '@/lib/db';
import { sourceIdentificationSchema } from '@/lib/catalog/schemas';

// Use the retained XML Bairro, falling back to BairroOficial. No HTTP action.
export async function replaceImportedNeighborhoods(sourceKey:string,apply=false) {
  sourceIdentificationSchema.shape.sourceKey.parse(sourceKey);
  return sql.begin(async tx=>{
    await tx`set local lock_timeout='10s'`;
    await tx`set local statement_timeout='60s'`;
    await tx`select pg_advisory_xact_lock(91491002)`;
    await tx`select id from imoveis where origem='external' and source_key=${sourceKey} order by id for update`;
    await tx`create temporary table neighborhood_changes on commit drop as
      select id,bairro_id,source_hash,
        dados_origem as original_data,
        dados_origem #>> '{publicLocation,officialNeighborhood}' as original,
        coalesce(nullif(btrim(dados_origem #>> '{rawMetadata,bairroOrigem}'),''),
          dados_origem #>> '{rawMetadata,bairroOficialOrigem}') as chosen,
        dados_origem #>> '{publicLocation,city}' as city,dados_origem #>> '{publicLocation,state}' as state,
        md5((to_jsonb(i)-'bairro_id'-'dados_origem'-'source_hash'-'updated_at')::text) as protected_hash
      from imoveis i where origem='external' and source_key=${sourceKey}
        and coalesce(dados_origem->'rawMetadata','{}') ? 'bairroOficialOrigem'
        and dados_origem #>> '{publicLocation,officialNeighborhood}' is distinct from
          coalesce(nullif(btrim(dados_origem #>> '{rawMetadata,bairroOrigem}'),''),
            dados_origem #>> '{rawMetadata,bairroOficialOrigem}')`;
    const [summary]=await tx<{pending:number;changed:number}[]>`select count(*)::int as pending,
      count(*) filter(where chosen is distinct from original)::int as changed from neighborhood_changes`;
    if(!apply||!summary.pending)return {...summary,applied:false};
    const [invalid]=await tx`select count(*)::int as n from neighborhood_changes where nullif(btrim(chosen),'') is null or city is null or state is null`;
    if(invalid.n)throw new Error('NEIGHBORHOOD_SOURCE_INVALID');
    await tx`insert into bairros(nome,cidade,estado) select distinct chosen,city,state from neighborhood_changes on conflict(nome,cidade,estado) do nothing`;
    await tx`update imoveis i set
      dados_origem=jsonb_set(i.dados_origem,'{publicLocation,officialNeighborhood}',to_jsonb(n.chosen)),
      bairro_id=b.id,
      source_hash=encode(sha256(convert_to(i.source_hash||':commercial-neighborhood-v1:'||n.chosen,'UTF8')),'hex'),
      updated_at=clock_timestamp()
      from neighborhood_changes n join bairros b on b.nome=n.chosen and b.cidade=n.city and b.estado=n.state
      where i.id=n.id`;
    // Reject the entire update if anything outside the requested source fields changed.
    const [check]=await tx`select count(*)::int as n from neighborhood_changes n join imoveis i on i.id=n.id
      where md5((to_jsonb(i)-'bairro_id'-'dados_origem'-'source_hash'-'updated_at')::text)<>n.protected_hash
      or i.dados_origem #>> '{publicLocation,officialNeighborhood}' is distinct from n.chosen
      or (i.dados_origem #- '{publicLocation,officialNeighborhood}')
        is distinct from (n.original_data #- '{publicLocation,officialNeighborhood}')`;
    if(check.n)throw new Error('NEIGHBORHOOD_PRESERVATION_FAILED');
    return {...summary,applied:true};
  });
}
