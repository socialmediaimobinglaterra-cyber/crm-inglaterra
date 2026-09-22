import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { propertyXmlAdapter } from "@/lib/catalog/import/adapters/property-xml";
import { importCatalog } from "@/lib/catalog/import/run";
import { sql } from "@/lib/db";
import { replaceImportedNeighborhoods } from '@/lib/queries/catalog-neighborhoods';

const sourceKey = `test-feed-${randomUUID()}`;
const city = `Fixture-${randomUUID()}`;
function property(id: string, price = "100000.25") {
  return `<Imovel><CodigoImovel>${id}</CodigoImovel><TituloImovel>Imovel de teste</TituloImovel>
    <TipoImovel>Casa</TipoImovel><SubTipoImovel>Casa Residencial</SubTipoImovel><Finalidade>Residencial</Finalidade>
    <PrecoVenda>${price}</PrecoVenda><BairroOficial>Bairro de teste</BairroOficial><Bairro>Alias de teste</Bairro>
    <Cidade>${city}</Cidade><Estado>PR</Estado><UnidadeMetrica>M2</UnidadeMetrica><AreaTotal>120.50</AreaTotal>
    <Numero>0</Numero><latitude>0</latitude><longitude>0</longitude><QtdDormitorios>0</QtdDormitorios>
    <DataCadastro>2026-01-01</DataCadastro><Publicar>1</Publicar><TipoOferta>1</TipoOferta>
    <Observacao><![CDATA[Descricao anonima]]></Observacao><Piscina>1</Piscina>
    <corretor><nome>IGNORED_PRIVATE_PERSON</nome><email>ignored@example.invalid</email></corretor>
    <Fotos><Foto><URLArquivo>http://images.example.invalid/photo.jpg</URLArquivo><Principal>1</Principal></Foto></Fotos>
  </Imovel>`;
}
function xml(...items: string[]) { return `<Carga><Imoveis>${items.join("")}</Imoveis></Carga>`; }
async function* chunks(value: string) {
  for (let offset = 0; offset < value.length; offset += 17) yield value.slice(offset, offset + 17);
}

async function main() {
  const document = xml(property("001"), property("002"));
  const snapshot = await propertyXmlAdapter.read(chunks(document), sourceKey);
  assert.equal(snapshot.items.length, 2);
  assert.equal(snapshot.items[0].prices.sale, "100000.25");
  assert.equal(snapshot.items[0].privateLocation.coordinates, null);
  assert.equal(snapshot.items[0].rooms.bedrooms, 0);
  assert.deepEqual(snapshot.items[0].publicationUnits, []);
  assert.equal(snapshot.items[0].media[0].migration.status, "pending_blob");
  assert.equal(JSON.stringify(snapshot).includes("IGNORED_PRIVATE_PERSON"), false);
  assert.equal(JSON.stringify(snapshot).includes("ignored@example.invalid"), false);
  assert.equal(snapshot.items[0].source.sourceCreatedAt, null);
  assert.equal(snapshot.items[0].rawMetadata.dataCadastroOrigem, "2026-01-01");
  assert.equal(snapshot.items[0].publicLocation.officialNeighborhood,"Alias de teste");
  assert.equal(snapshot.items[0].rawMetadata.bairroOficialOrigem,"Bairro de teste");
  assert.equal(snapshot.items[0].rawMetadata.bairroOrigem,"Alias de teste");
  for(const replacement of ['<Bairro/>','<Bairro>   </Bairro>','']) {
    const fallback=await propertyXmlAdapter.read(chunks(xml(property('001').replace('<Bairro>Alias de teste</Bairro>',replacement))),sourceKey);
    assert.equal(fallback.summary.rejected,0);
    assert.equal(fallback.items[0].publicLocation.officialNeighborhood,'Bairro de teste');
  }
  const commercialOnly=await propertyXmlAdapter.read(chunks(xml(property('001').replace('<BairroOficial>Bairro de teste</BairroOficial>',''))),sourceKey);
  assert.equal(commercialOnly.summary.rejected,0);
  assert.equal(commercialOnly.items[0].publicLocation.officialNeighborhood,'Alias de teste');
  const neither=await propertyXmlAdapter.read(chunks(xml(property('001').replace('<BairroOficial>Bairro de teste</BairroOficial><Bairro>Alias de teste</Bairro>',''))),sourceKey);
  assert.equal(neither.summary.rejected,1);
  for (const invalid of ["<Carga><Imoveis>", xml(), '<!DOCTYPE Carga [<!ENTITY x "test">]>' + document]) {
    await assert.rejects(() => propertyXmlAdapter.read(chunks(invalid), sourceKey));
  }
  const duplicate = await propertyXmlAdapter.read(chunks(xml(property("001"), property("001"))), sourceKey);
  assert.equal(duplicate.summary.rejected, 1);
  const invalidPrice = await propertyXmlAdapter.read(chunks(xml(property("001", "-1"))), sourceKey);
  assert.equal(invalidPrice.summary.rejected, 1);
  const unsafeTitle = await propertyXmlAdapter.read(chunks(xml(property("001").replace("Imovel de teste", "person@example.invalid"))), sourceKey);
  assert.equal(unsafeTitle.items[0].title, null);
  console.log("XML adapter, privacy and incomplete input tests passed");

  if (!process.argv.includes("--db")) return;
  try {
    const first = await importCatalog(propertyXmlAdapter, chunks(document), sourceKey);
    assert.equal(first.result.inserted, 2);
    const second = await importCatalog(propertyXmlAdapter, chunks(document), sourceKey);
    assert.equal(second.result.inserted, 0);
    assert.equal(second.result.updated, 0);
    assert.equal(second.result.unchanged, 2);
    await sql`update imoveis set curadoria = '{"title":"Curadoria preservada"}'::jsonb where source_key = ${sourceKey} and external_id = '001'`;
    await sql`
      insert into unidades_publicacao (imovel_id, unidade, ativo, inclusao_manual)
      select id, 'premium', true, true from imoveis where source_key = ${sourceKey} and external_id = '001'
    `;
    await sql`update imoveis set origem = 'manual' where source_key = ${sourceKey} and external_id = '002'`;
    const changed = await importCatalog(propertyXmlAdapter, chunks(xml(property("001", "200000.50"), property("002", "200000.50"))), sourceKey);
    assert.equal(changed.result.updated, 1);
    assert.equal(changed.result.protected, 1);
    const preserved = await sql<{ price: string; title: string; active: boolean }[]>`
      select i.preco_venda::text as price, i.curadoria->>'title' as title, u.ativo as active
      from imoveis i left join unidades_publicacao u on u.imovel_id = i.id
      where i.source_key = ${sourceKey} order by i.external_id
    `;
    assert.equal(preserved[0].title, "Curadoria preservada");
    assert.equal(preserved[0].active, true);
    assert.equal(preserved[1].price, "100000.25");
    for (const broken of [document.slice(0, -10), xml(), xml(property("001", "-1")), xml(property("001"), property("001"))]) {
      await assert.rejects(() => importCatalog(propertyXmlAdapter, chunks(broken), sourceKey));
    }
    const afterFailure = await sql<{ price: string; count: number }[]>`
      select preco_venda::text as price, count(*) over ()::int as count from imoveis
      where source_key = ${sourceKey} order by external_id
    `;
    assert.equal(afterFailure[0].price, "200000.50");
    assert.equal(afterFailure[0].count, 2);
    const concurrent = await Promise.allSettled([0, 1].map(() => importCatalog(propertyXmlAdapter, chunks(document), sourceKey)));
    assert.ok(concurrent.some((result) => result.status === "fulfilled"));
    for (const result of concurrent) {
      if (result.status === "rejected") assert.equal(result.reason.code, "STALE_IMPORT");
    }
    const counts = await sql<{ count: number }[]>`select count(*)::int as count from imoveis where source_key = ${sourceKey}`;
    assert.equal(counts[0].count, 2);
    await sql`update imoveis set dados_origem=jsonb_set(dados_origem,
      '{publicLocation,officialNeighborhood}','"Bairro de teste"'),fonte_presente=false where source_key=${sourceKey} and origem='external'`;
    const [beforeBackfill]=await sql`select md5((to_jsonb(i)-'bairro_id'-'dados_origem'-'source_hash'-'updated_at')::text) as protected_hash,
      source_hash from imoveis i where source_key=${sourceKey} and origem='external'`;
    const preview=await replaceImportedNeighborhoods(sourceKey);assert.equal(preview.changed,1);assert.equal(preview.applied,false);
    const backfill=await replaceImportedNeighborhoods(sourceKey,true);assert.equal(backfill.changed,1);assert.equal(backfill.applied,true);
    assert.equal((await replaceImportedNeighborhoods(sourceKey,true)).pending,0);
    const [afterBackfill]=await sql`select md5((to_jsonb(i)-'bairro_id'-'dados_origem'-'source_hash'-'updated_at')::text) as protected_hash,
      source_hash,dados_origem #>> '{publicLocation,officialNeighborhood}' as neighborhood,
      dados_origem #>> '{rawMetadata,bairroOficialOrigem}' as original,(select nome from bairros b where b.id=i.bairro_id) as district
      from imoveis i where source_key=${sourceKey} and origem='external'`;
    assert.equal(afterBackfill.protected_hash,beforeBackfill.protected_hash);
    assert.notEqual(afterBackfill.source_hash,beforeBackfill.source_hash);
    assert.equal(afterBackfill.neighborhood,'Alias de teste');assert.equal(afterBackfill.district,'Alias de teste');
    assert.equal(afterBackfill.original,'Bairro de teste');
    console.log("Database import, idempotency, protected edits, rollback and concurrent import tests passed");
    console.log('Neighborhood backfill: dry-run, absent source record, manual protection, original retained and repeat-safe verified');
  } finally {
    await sql`delete from catalog_code_reservations where owner_id in (select id from imoveis where source_key = ${sourceKey})`;
    await sql`delete from imoveis where source_key = ${sourceKey}`;
    await sql`delete from sincronizacoes_log where source_key = ${sourceKey}`;
    await sql`delete from catalog_sources where key = ${sourceKey}`;
    await sql`delete from bairros where cidade = ${city} and not exists (select 1 from imoveis where bairro_id = bairros.id)`;
    const remaining = await sql<{ count: number }[]>`select count(*)::int as count from catalog_sources where key = ${sourceKey}`;
    assert.equal(remaining[0].count, 0);
    console.log("Temporary import test data removed");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof assert.AssertionError ? "CATALOG_IMPORT_ASSERTION_FAILED" : "CATALOG_IMPORT_TEST_FAILED");
  const cause = error instanceof Error && error.cause ? error.cause : error;
  if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string" && /^[A-Z0-9_]{1,40}$/.test(cause.code)) {
    console.error(`Database error code: ${cause.code}`);
    if ("constraint_name" in cause && typeof cause.constraint_name === "string" && /^[a-z0-9_]+$/.test(cause.constraint_name)) console.error(`Constraint: ${cause.constraint_name}`);
  }
  process.exitCode = 1;
}).finally(async () => { if (process.argv.includes("--db")) await sql.end(); });
