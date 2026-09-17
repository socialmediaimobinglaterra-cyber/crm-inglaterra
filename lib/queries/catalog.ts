import type postgres from "postgres";
import { createHash } from "node:crypto";
import { normalizeCatalogItem } from "@/lib/catalog/schemas";
import { propertyTypes } from "@/lib/catalog/property-types";
import { sql } from "@/lib/db";
import { catalogEditSchema, catalogFiltersSchema, catalogIdSchema, catalogVersionSchema, type CatalogEdit } from "@/lib/catalog/editor";

type Tx = postgres.TransactionSql<Record<string, never>>;
async function authorize(tx: Tx, email: string) {
  const rows = await tx`select id from usuarios where email = ${email.trim().toLowerCase()}
    and ativo and role in ('admin', 'cadastro') for share`;
  if (!rows.length) throw new Error("CATALOG_FORBIDDEN");
}

export type CatalogRow = {
  id: string; codigo: string; status_publicacao: string; origem: string;
  title: string | null; city: string; neighborhood: string; sale: string | null; rent: string | null;
};
export async function listCatalog(email: string, input: unknown) {
  const filters = catalogFiltersSchema.parse(input);
  return sql.begin(async tx => {
    await authorize(tx, email);
    const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    const condition = tx`
      (${filters.q} = '' or codigo ilike ${pattern} or
        (case when curadoria ? 'title' then curadoria->>'title' else dados_origem->>'title' end) ilike ${pattern} or
        coalesce(curadoria #>> '{publicLocation,officialNeighborhood}', dados_origem #>> '{publicLocation,officialNeighborhood}') ilike ${pattern} or
        coalesce(curadoria #>> '{publicLocation,city}', dados_origem #>> '{publicLocation,city}') ilike ${pattern})
      and (${filters.status} = '' or status_publicacao = ${filters.status})
      and (${filters.negotiation} = '' or coalesce(curadoria->>'negotiation', dados_origem->>'negotiation') = ${filters.negotiation})`;
    const [count] = await tx`select count(*)::int as total from imoveis where ${condition}`;
    const total = Number(count!.total);
    const pages = Math.max(1, Math.ceil(total / 25));
    const page = Math.min(filters.page, pages);
    const items = await tx<CatalogRow[]>`select id, codigo, status_publicacao, origem,
      case when curadoria ? 'title' then curadoria->>'title' else dados_origem->>'title' end as title,
      coalesce(curadoria #>> '{publicLocation,city}', dados_origem #>> '{publicLocation,city}') as city,
      coalesce(curadoria #>> '{publicLocation,officialNeighborhood}', dados_origem #>> '{publicLocation,officialNeighborhood}') as neighborhood,
      case when curadoria ? 'prices' then curadoria #>> '{prices,sale}' else dados_origem #>> '{prices,sale}' end as sale,
      case when curadoria ? 'prices' then curadoria #>> '{prices,rent}' else dados_origem #>> '{prices,rent}' end as rent
      from imoveis where ${condition} order by codigo, id limit 25 offset ${(page - 1) * 25}`;
    return { items: Array.from(items), total, page, pages };
  });
}

export async function getCatalogEditor(email: string, id: string) {
  catalogIdSchema.parse(id);
  return sql.begin(async tx => {
    await authorize(tx, email);
    const [row] = await tx`select codigo, dados_origem, curadoria, endereco_privado, curadoria_privada,
      md5(curadoria::text || curadoria_privada::text || source_hash) as version from imoveis where id = ${id}`;
    if (!row) return null;
    const merged = { ...row.dados_origem, ...row.curadoria };
    const values = catalogEditSchema.parse({ title: merged.title, description: merged.description,
      prices: merged.prices, areas: merged.areas, rooms: merged.rooms,
      ...(merged.publicLocation?.state ? { publicLocation: merged.publicLocation } : {}),
      ...(merged.taxonomy ? { taxonomy: { normalizedType: merged.taxonomy.normalizedType, normalizedSubtype: merged.taxonomy.normalizedSubtype } } : {}),
      ...(row.endereco_privado && Object.hasOwn(row.endereco_privado, 'street') ? { privateLocation: { ...row.endereco_privado, ...row.curadoria_privada } } : {}),
      usageCategory: merged.usageCategory });
    return { codigo: String(row.codigo), version: String(row.version), values };
  });
}

export async function saveCatalogEdit(email: string, id: string, version: string, input: CatalogEdit) {
  catalogIdSchema.parse(id);
  catalogVersionSchema.parse(version);
  const values = catalogEditSchema.parse(input);
  const negotiation = values.prices.sale ? (values.prices.rent ? "venda_locacao" : "venda") : "locacao";
  await sql.begin(async tx => {
    await authorize(tx, email);
    const { privateLocation, ...publicValues } = values;
    const result = await tx`update imoveis set curadoria = curadoria || ${tx.json({ ...publicValues, negotiation })}::jsonb,
      curadoria_privada = curadoria_privada || ${tx.json(privateLocation ?? {})}::jsonb,
      updated_at = clock_timestamp()
      where id = ${id} and md5(curadoria::text || curadoria_privada::text || source_hash) = ${version} returning id`;
    if (!result.length) throw new Error("CATALOG_CONFLICT");
  });
}

export async function createManualCatalog(email: string, id: string, input: CatalogEdit) {
  catalogIdSchema.parse(id);
  const values = catalogEditSchema.parse(input);
  const type = propertyTypes.find(type => type.key === values.taxonomy?.normalizedType);
  if (!type || !values.publicLocation || !values.privateLocation || !values.title || !values.usageCategory) throw new Error("INVALID_INPUT");
  return sql.begin(async tx => {
    await authorize(tx, email);
    await tx`select pg_advisory_xact_lock(91491002)`;
    const [existing] = await tx`select origem from imoveis where id=${id}`;
    if (existing) {
      if (existing.origem !== 'manual') throw new Error("INVALID_INPUT");
      return id;
    }
    const [reserved] = await tx`select reserve_catalog_code(${id},null,${type.prefix}) as codigo`;
    const item = normalizeCatalogItem({ ...values,
      source: { sourceKey: 'manual', externalId: id, importedAt: null, sourceCreatedAt: null, sourceUpdatedAt: null },
      origin: 'manual', publicCode: reserved.codigo, publicationUnits: [], publication: { status: 'pending_review', available: false },
      negotiation: values.prices.sale ? (values.prices.rent ? 'venda_locacao' : 'venda') : 'locacao',
      taxonomy: { ...values.taxonomy, originalType: type.label, originalSubtype: values.taxonomy!.normalizedSubtype },
      media: [], features: [], rawMetadata: {}, alerts: [],
    });
    const { privateLocation, ...data } = item;
    const hash = createHash('sha256').update(JSON.stringify(item)).digest('hex');
    await tx`insert into imoveis(id,codigo,origem,dados_origem,endereco_privado,source_hash)
      values(${id},${item.publicCode},'manual',${tx.json(data)},${tx.json(privateLocation)},${hash})`;
    return id;
  });
}
