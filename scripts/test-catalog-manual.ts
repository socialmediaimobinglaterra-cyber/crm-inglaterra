import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import { catalogEditSchema } from '@/lib/catalog/editor';
import { createManualCatalog, getCatalogEditor, saveCatalogEdit, listCatalog } from '@/lib/queries/catalog';
import { importCatalog } from '@/lib/catalog/import/run';
import { propertyXmlAdapter } from '@/lib/catalog/import/adapters/property-xml';

const run = randomUUID();
const source = `test-manual-${run}`;
const email = `manual-${run}@imobiliariainglaterra.com.br`;
const ids = [randomUUID(), randomUUID(), randomUUID()];
const city = `Fixture-${run}`;
const values = catalogEditSchema.parse({
  title: 'Casa de teste', description: 'Descricao de teste',
  prices: { sale: '150000.25', rent: null, condominium: null, iptu: null },
  areas: { unit: 'm2', total: '120', usable: null, private: null },
  rooms: { bedrooms: 0, suites: null, bathrooms: 1, parkingSpaces: 0, livingRooms: null },
  taxonomy: { normalizedType: 'casa', normalizedSubtype: 'residencial' }, usageCategory: 'residencial',
  publicLocation: { officialNeighborhood: 'Bairro teste', neighborhoodAlias: null, city, state: 'PR' },
  privateLocation: { street: 'Logradouro de teste', number: '0', complement: null, postalCode: null, coordinates: null },
});
async function* document(code: string) {
  yield `<Carga><Imoveis><Imovel><CodigoImovel>${code}</CodigoImovel><TituloImovel>Casa teste externa</TituloImovel><TipoImovel>Casa</TipoImovel><Finalidade>Residencial</Finalidade><PrecoVenda>150000.25</PrecoVenda><BairroOficial>Bairro teste</BairroOficial><Cidade>${city}</Cidade><Estado>PR</Estado></Imovel></Imoveis></Carga>`;
}
async function main() {
  try {
    const role = process.argv.includes('--corretor') ? 'corretor' : 'cadastro';
    await sql`insert into usuarios(email,role,ativo) values(${email},${role},true)`;
    await Promise.all(ids.map(id => createManualCatalog(email,id,values)));
    const manual = await sql`select id,codigo,ativo,origem,endereco_privado from imoveis where id in ${sql(ids)} order by codigo`;
    assert.equal(new Set(manual.map(row=>row.codigo)).size,3);
    assert(manual.every(row=>/^CA\d{4,}$/.test(row.codigo) && !row.ativo && row.origem==='manual' && row.endereco_privado.number === null));
    const code = String(manual[0].codigo);
    await createManualCatalog(email,ids[0],values);
    const [total] = await sql`select count(*)::int as n from imoveis where id in ${sql(ids)}`;
    assert.equal(total.n,3);
    await importCatalog(propertyXmlAdapter,document(code),source);
    const [external] = await sql`select codigo,dados_origem from imoveis where source_key=${source}`;
    assert.notEqual(external.codigo,code);
    assert.match(external.codigo,/^CA\d{4,}$/);
    assert.equal(external.dados_origem.rawMetadata.sourcePublicCode,code);
    assert.equal(external.dados_origem.publicCode,external.codigo);
    const repeated = await importCatalog(propertyXmlAdapter,document(code),source);
    assert.equal(repeated.result.unchanged,1);
    assert.equal(repeated.result.inserted,0);
    const editor = await getCatalogEditor(email,ids[0]); assert(editor);
    await saveCatalogEdit(email,ids[0],editor.version,{...editor.values,
      taxonomy:{normalizedType:'apartamento', normalizedSubtype:null},
      publicLocation:{...values.publicLocation!,city:`Updated-${run}`},
      privateLocation:{...values.privateLocation!,number:'42'},
    });
    const changed = await getCatalogEditor(email,ids[0]); assert(changed);
    assert.equal(changed.codigo,editor.codigo);
    assert.equal(changed.values.taxonomy?.normalizedType,'apartamento');
    assert.equal(changed.values.privateLocation?.number,'42');
    assert.equal((await listCatalog(email,{q:`Updated-${run}`})).total,1);
    const [privacy] = await sql`select curadoria ? 'privateLocation' as leaked from imoveis where id=${ids[0]}`;
    assert.equal(privacy.leaked,false);
    await sql`update usuarios set ativo=false where email=${email}`;
    await assert.rejects(()=>createManualCatalog(email,ids[0],values),/CATALOG_FORBIDDEN/);
    console.log('PASS: manual concurrency, retry, imported collision, stable reimport, immutable code, location/taxonomy edits, privacy and authorization');
  } finally {
    await sql`delete from catalog_code_reservations where owner_id in (select id from imoveis where id in ${sql(ids)} or source_key=${source})`;
    await sql`delete from imoveis where id in ${sql(ids)} or source_key=${source}`;
    await sql`delete from sincronizacoes_log where source_key=${source}`;
    await sql`delete from catalog_sources where key=${source}`;
    await sql`delete from bairros where cidade=${city}`;
    await sql`delete from usuarios where email=${email}`;
    const [left] = await sql`select (select count(*) from imoveis where id in ${sql(ids)} or source_key=${source}) + (select count(*) from usuarios where email=${email}) + (select count(*) from catalog_sources where key=${source}) as n`;
    assert.equal(Number(left.n),0);
    console.log('Temporary fixtures removed; consumed sequence numbers are not reused');
  }
}
main().catch(error=>{console.error('MANUAL_TEST_FAILED',error instanceof Error ? error.name : 'Unknown');process.exitCode=1;}).finally(()=>sql.end());
