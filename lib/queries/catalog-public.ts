import { sql } from '@/lib/db';
import { publicationUnitSchema, publicCatalogItemSchema, type PublicCatalogItem, type PublicationUnit } from '@/lib/catalog/schemas';
import { projectPublicItem, publicCodeSchema, type PublicFilters, type ReadyPublicImage } from '@/lib/catalog/public-api';
import { catalogIdSchema } from '@/lib/catalog/editor';

function visible(unit: PublicationUnit) {
  publicationUnitSchema.parse(unit);
  return sql`i.ativo and i.status_publicacao='published' and (i.origem='manual' or i.fonte_presente)
    and exists(select 1 from unidades_publicacao u where u.imovel_id=i.id and u.unidade=${unit} and u.ativo)`;
}

function publicRows(unit: PublicationUnit) {
  // Private location, source identity, raw metadata and external media never leave SQL.
  return sql`select i.id,i.codigo,i.updated_at,
    coalesce(nullif(btrim(d #>> '{rawMetadata,nomeCondominio}'),''),nullif(btrim(d #>> '{rawMetadata,nomeEdificio}'),'')) as condominium_name,
    exists(select 1 from unidades_publicacao u where u.imovel_id=i.id and u.unidade=${unit} and u.inclusao_manual) as manual,
    jsonb_build_object('title',d->'title','description',d->'description','prices',d->'prices',
      'negotiation',d->'negotiation','usageCategory',d->'usageCategory','taxonomy',d->'taxonomy',
      'publicLocation',d->'publicLocation','areas',d->'areas','rooms',d->'rooms','features',d->'features') as data
    from imoveis i cross join lateral (select i.dados_origem || i.curadoria as d) merged
    where ${visible(unit)}`;
}

async function projectRows(rows: { id: string; codigo: string; data: unknown }[], unit: PublicationUnit) {
  if (!rows.length) return [];
  const images = await sql<(ReadyPublicImage & {imovel_id: string})[]>`select id,imovel_id,position,is_primary
    from catalog_images where imovel_id in ${sql(rows.map(row => row.id))} and status='ready' order by imovel_id,position,id`;
  return rows.map(row => projectPublicItem(row.codigo, unit, row.data, images.filter(image => image.imovel_id === row.id)));
}

export async function listPublicProperties(unit: PublicationUnit, filters: PublicFilters) {
  const price = filters.negocio === 'Alugar' ? sql`(data #>> '{prices,rent}')::numeric` : sql`(data #>> '{prices,sale}')::numeric`;
  const area = sql`coalesce((data #>> '{areas,usable}')::numeric,(data #>> '{areas,total}')::numeric)
    * case data #>> '{areas,unit}' when 'ha' then 10000 when 'm2' then 1 else null end`;
  const where = sql`${price} > 0
    and (${filters.bairro ?? null}::text is null or data #>> '{publicLocation,officialNeighborhood}'=${filters.bairro ?? null})
    and (${filters.cidade ?? null}::text is null or data #>> '{publicLocation,city}'=${filters.cidade ?? null})
    and (${filters.tipo ?? null}::text is null or data #>> '{taxonomy,normalizedType}'=${filters.tipo ?? null})
    and (${filters.condominio ?? null}::text is null or condominium_name=${filters.condominio ?? null})
    and (${filters.valorMinimo ?? null}::numeric is null or ${price} >= ${filters.valorMinimo ?? null}::numeric)
    and (${filters.valorMaximo ?? null}::numeric is null or ${price} <= ${filters.valorMaximo ?? null}::numeric)
    and (${filters.suitesMinimas ?? null}::int is null or coalesce((data #>> '{rooms,suites}')::int,0) >= ${filters.suitesMinimas ?? null})
    and (${filters.vagasMinimas ?? null}::int is null or coalesce((data #>> '{rooms,parkingSpaces}')::int,0) >= ${filters.vagasMinimas ?? null})
    and (${filters.quartosMinimos ?? null}::int is null or coalesce((data #>> '{rooms,bedrooms}')::int,0) >= ${filters.quartosMinimos ?? null})
    and (${filters.areaMinima ?? null}::numeric is null or ${area} >= ${filters.areaMinima ?? null}::numeric)
    and (${filters.areaMaxima ?? null}::numeric is null or ${area} <= ${filters.areaMaxima ?? null}::numeric)`;
  const order = filters.order === 'maior_valor' ? sql`${price} desc, id` : filters.order === 'menor_valor'
    ? sql`${price} asc, id` : filters.order === 'mais_recentes' ? sql`updated_at desc, id` : sql`manual desc, updated_at desc, id`;
  // One statement fixes the count and page to the same database snapshot.
  const [result] = await sql`with published as (${publicRows(unit)}), filtered as (select * from published where ${where}),
    page_rows as (select * from filtered order by ${order} limit ${filters.perPage} offset ${(filters.page-1)*filters.perPage})
    select (select count(*)::int from filtered) as total,
      coalesce((select jsonb_agg(jsonb_build_object('id',id,'codigo',codigo,'data',data) order by ${order}) from page_rows),'[]'::jsonb) as rows`;
  const items = await projectRows(result.rows,unit);
  return { items, total: Number(result.total), page: filters.page, perPage: filters.perPage,
    hasMore: filters.page*filters.perPage < Number(result.total) };
}

export async function getPublicProperty(unit: PublicationUnit, code: string): Promise<PublicCatalogItem | null> {
  publicCodeSchema.parse(code);
  const rows = await sql<{id:string;codigo:string;data:unknown}[]>`with published as (${publicRows(unit)}) select id,codigo,data from published where codigo=${code} limit 1`;
  return (await projectRows(rows,unit))[0] ?? null;
}

export async function getPublicFilterOptions(unit: PublicationUnit) {
  const rows = await sql`with published as (${publicRows(unit)})
    select distinct data #>> '{publicLocation,officialNeighborhood}' as bairro,
      data #>> '{publicLocation,city}' as cidade,data #>> '{publicLocation,state}' as estado,data #>> '{taxonomy,normalizedType}' as tipo,
      condominium_name as condominio
    from published order by bairro,cidade,tipo,condominio limit 1001`;
  if (rows.length > 1000) throw new Error('FILTER_OPTIONS_LIMIT');
  // Reuse the validated public string schemas, rather than returning raw SQL values.
  return rows.map(row => {
    const location = publicCatalogItemSchema.shape.location.parse({officialNeighborhood:row.bairro,neighborhoodAlias:null,city:row.cidade,state:row.estado});
    const type = publicCatalogItemSchema.shape.taxonomy.shape.normalizedType.parse(row.tipo);
    const condominium = row.condominio === null ? null : publicCatalogItemSchema.shape.title.max(120).parse(row.condominio);
    return {bairro:location.officialNeighborhood,cidade:location.city,estado:location.state,tipo:type,condominio:condominium};
  });
}

export async function canReadPublicImage(unit: PublicationUnit, id: string) {
  catalogIdSchema.parse(id);
  const rows = await sql`select c.id from catalog_images c join imoveis i on i.id=c.imovel_id
    where c.id=${id} and c.status='ready' and ${visible(unit)} limit 1`;
  return rows.length > 0;
}
