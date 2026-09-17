import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { normalizeCatalogItem, sourceIdentificationSchema } from "@/lib/catalog/schemas";
import { CatalogImportError, type CatalogSnapshot, type ImportSummary } from "@/lib/catalog/import/types";

type Run = { id: string; source_key: string; iniciada_em: Date };
export type ApplyResult = { inserted: number; updated: number; unchanged: number; missing: number; protected: number };

export async function startCatalogImport(sourceKey: string, adapter: string): Promise<Run> {
  sourceIdentificationSchema.shape.sourceKey.parse(sourceKey);
  return sql.begin(async (tx) => {
    await tx`insert into catalog_sources (key, adapter) values (${sourceKey}, ${adapter}) on conflict (key) do nothing`;
    const rows = await tx<Run[]>`
      insert into sincronizacoes_log (source_key, status) values (${sourceKey}, 'running')
      returning id, source_key, iniciada_em
    `;
    return rows[0];
  });
}

export async function failCatalogImport(runId: string, failureCode: string, summary?: ImportSummary) {
  const code = /^[A-Z_]{1,80}$/.test(failureCode) ? failureCode : "IMPORT_FAILED";
  await sql`
    update sincronizacoes_log set status = 'failed', finalizada_em = clock_timestamp(),
      failure_code = ${code}, total_xml = ${summary?.total ?? 0}, resumo = ${sql.json(summary ?? {})}
    where id = ${runId} and status = 'running'
  `;
}

export async function applyCatalogSnapshot(run: Run, snapshot: CatalogSnapshot): Promise<ApplyResult> {
  if (!snapshot.items.length || snapshot.summary.rejected || snapshot.items.length !== snapshot.summary.total) {
    throw new CatalogImportError("SNAPSHOT_INCOMPLETE");
  }
  const seen = new Set<string>();
  const rows = snapshot.items.map((input) => {
    const item = normalizeCatalogItem(input);
    if (item.origin !== "external" || item.source.sourceKey !== run.source_key) throw new CatalogImportError("SOURCE_MISMATCH");
    if (seen.has(item.source.externalId)) throw new CatalogImportError("DUPLICATE_EXTERNAL_ID");
    seen.add(item.source.externalId);
    const { privateLocation, ...data } = item;
    // Capture times are stored in the run, not in the content fingerprint.
    data.source = { ...data.source, importedAt: null };
    data.publicationUnits = [];
    data.publication = { status: "pending_review", available: false };
    const hash = createHash("sha256").update(JSON.stringify({ data, privateLocation })).digest("hex");
    return { external_id: item.source.externalId, codigo: item.publicCode, data, private_location: privateLocation, hash };
  });

  return sql.begin(async (tx) => {
    await tx`set local lock_timeout = '10s'`;
    await tx`set local statement_timeout = '60s'`;
    await tx`select pg_advisory_xact_lock(91491002)`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${'catalog-import:' + run.source_key}, 0))`;
    const validRun = await tx<{ id: string }[]>`
      select r.id from sincronizacoes_log r join catalog_sources s on s.key = r.source_key
      where r.id = ${run.id} and r.source_key = ${run.source_key} and r.status = 'running'
        and (s.last_success_started_at is null or r.iniciada_em > s.last_success_started_at)
      for update of r, s
    `;
    if (!validRun.length) throw new CatalogImportError("STALE_IMPORT");
    await tx`
      create temporary table catalog_stage (
        external_id text primary key, codigo text, data jsonb, private_location jsonb, hash text
      ) on commit drop
    `;
    for (let offset = 0; offset < rows.length; offset += 100) {
      await tx`
        insert into catalog_stage
        select * from jsonb_to_recordset(${tx.json(rows.slice(offset, offset + 100))}::jsonb)
          as x(external_id text, codigo text, data jsonb, private_location jsonb, hash text)
      `;
    }
    await tx`alter table catalog_stage add column owner_id uuid, add column assigned_code text`;
    await tx`update catalog_stage s set owner_id = coalesce(
      (select i.id from imoveis i where i.source_key = ${run.source_key} and i.external_id = s.external_id), gen_random_uuid())`;
    // Reserve every free source code before allocating replacements for collisions.
    await tx`insert into catalog_code_reservations(codigo, owner_id)
      select upper(codigo), owner_id from catalog_stage order by external_id
      on conflict do nothing`;
    await tx`insert into catalog_code_counters(prefix,last_number)
      select left(codigo,2), max(substring(codigo from '([0-9]+)$')::bigint)
      from catalog_code_reservations where codigo ~ '^[A-Z]{2}[0-9]{1,15}$' group by 1
      on conflict(prefix) do update set last_number=greatest(catalog_code_counters.last_number,excluded.last_number)`;
    await tx`update catalog_stage set assigned_code = reserve_catalog_code(owner_id, codigo, substring(upper(codigo) from '^([A-Z]{2})[0-9]+$'))`;
    await tx`update catalog_stage set
      data = jsonb_set(jsonb_set(data, '{publicCode}', to_jsonb(assigned_code)), '{rawMetadata,sourcePublicCode}', to_jsonb(codigo)),
      hash = encode(sha256(convert_to(hash || ':' || assigned_code, 'UTF8')), 'hex'), codigo = assigned_code
      where assigned_code <> codigo`;
    const counts = await tx<{ inserted: number; updated: number; unchanged: number; protected: number }[]>`
      select
        count(*) filter (where i.id is null)::int as inserted,
        count(*) filter (where i.origem = 'external' and i.source_hash <> s.hash)::int as updated,
        count(*) filter (where i.origem = 'external' and i.source_hash = s.hash)::int as unchanged,
        count(*) filter (where i.origem = 'manual')::int as protected
      from catalog_stage s left join imoveis i on i.source_key = ${run.source_key} and i.external_id = s.external_id
    `;
    await tx`
      insert into bairros (nome, cidade, estado)
      select distinct data #>> '{publicLocation,officialNeighborhood}', data #>> '{publicLocation,city}', data #>> '{publicLocation,state}'
      from catalog_stage on conflict (nome, cidade, estado) do nothing
    `;
    await tx`
      insert into imoveis (id, codigo, origem, source_key, external_id, bairro_id, dados_origem, endereco_privado, source_hash, last_seen_run)
      select s.owner_id, s.codigo, 'external', ${run.source_key}, s.external_id, b.id, s.data, s.private_location, s.hash, ${run.id}
      from catalog_stage s join bairros b on b.nome = s.data #>> '{publicLocation,officialNeighborhood}'
        and b.cidade = s.data #>> '{publicLocation,city}' and b.estado = s.data #>> '{publicLocation,state}'
      on conflict (source_key, external_id) do update set
        codigo = excluded.codigo, bairro_id = excluded.bairro_id,
        dados_origem = excluded.dados_origem, endereco_privado = excluded.endereco_privado,
        source_hash = excluded.source_hash, last_seen_run = excluded.last_seen_run,
        fonte_presente = true,
        updated_at = case when imoveis.source_hash <> excluded.source_hash then clock_timestamp() else imoveis.updated_at end
      where imoveis.origem = 'external'
    `;
    // Absence is diagnostic only: never delete, deactivate or rewrite curators' choices.
    const missing = await tx<{ id: string }[]>`
      update imoveis set fonte_presente = false
      where source_key = ${run.source_key} and origem = 'external'
        and not exists (select 1 from catalog_stage s where s.external_id = imoveis.external_id)
      returning id
    `;
    const result = { ...counts[0], missing: missing.length };
    await tx`
      update sincronizacoes_log set status = 'success', finalizada_em = clock_timestamp(),
        total_xml = ${snapshot.summary.total}, entraram = ${result.inserted}, atualizados = ${result.updated},
        inalterados = ${result.unchanged}, ausentes = ${result.missing}, protegidos = ${result.protected},
        resumo = ${tx.json(snapshot.summary)}
      where id = ${run.id}
    `;
    await tx`update catalog_sources set last_success_started_at = ${run.iniciada_em} where key = ${run.source_key}`;
    return result;
  });
}
