import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { catalogEditSchema, readCatalogEdit, formatCatalogPrice } from "@/lib/catalog/editor";
import { getCatalogEditor, listCatalog, saveCatalogEdit } from "@/lib/queries/catalog";

const values = catalogEditSchema.parse({ title: "Casa de teste", description: null,
  prices: { sale: "100000.25", rent: null, condominium: null, iptu: null },
  areas: { total: "100.5", usable: null, private: null, unit: "m2" },
  rooms: { bedrooms: 0, suites: null, bathrooms: 1, livingRooms: null, parkingSpaces: 0 } });
async function main() {
  assert.equal(formatCatalogPrice("9007199254740993.25"), "R$ 9.007.199.254.740.993,25");
  for (const price of ["0", "-1", "NaN", "1e4"]) assert.equal(catalogEditSchema.safeParse({ ...values, prices: { ...values.prices, sale: price } }).success, false);
  assert.equal(catalogEditSchema.safeParse({ ...values, role: "admin" }).success, false);
  assert.equal(catalogEditSchema.safeParse({ ...values, rooms: { ...values.rooms, bedrooms: 0.5 } }).success, false);
  const form = new FormData();
  for (const key of ["title","description","sale","rent","condominium","iptu","unit","total","usable","private","bedrooms","suites","bathrooms","livingRooms","parkingSpaces"]) form.set(key, "");
  form.set("sale", "100,25"); form.set("bedrooms", "0");
  assert.equal(readCatalogEdit(form).prices.sale, "100.25");
  assert.equal(readCatalogEdit(form).rooms.bedrooms, 0);
  for (const [key,value] of Object.entries({city:'Cidade teste',neighborhood:'Bairro teste',alias:'',state:'PR',street:'',number:'0',complement:'',postalCode:'12345-678',latitude:'0',longitude:'-51',type:'casa',subtype:'',usageCategory:'residencial'})) form.set(key,value);
  assert.equal(readCatalogEdit(form).privateLocation?.coordinates?.latitude,'0');
  assert.equal(readCatalogEdit(form).privateLocation?.number,null);
  form.set('postalCode','AB12345678');
  assert.throws(()=>readCatalogEdit(form));
  form.set('postalCode',''); form.set('longitude','0');
  assert.equal(readCatalogEdit(form).privateLocation?.coordinates,null);
  form.set('latitude','');
  assert.throws(()=>readCatalogEdit(form));
  console.log("PASS: strict input, decimal precision, zeros and validation");
  if (!process.argv.includes("--db")) return;
  const run = randomUUID();
  const admin = `editor-admin-${run}@imobiliariainglaterra.com.br`;
  const cadastro = `editor-cadastro-${run}@imobiliariainglaterra.com.br`;
  const inactive = `editor-inactive-${run}@imobiliariainglaterra.com.br`;
  const id = randomUUID();
  try {
    await sql`insert into usuarios(email,role,ativo) values (${admin},'admin',true),(${cadastro},'cadastro',true),(${inactive},'cadastro',false)`;
    await sql`insert into imoveis(id,codigo,origem,dados_origem,endereco_privado,source_hash)
      values (${id},${run},'manual',${sql.json({ ...values, negotiation: 'venda', publicLocation: { city: 'Cidade de teste', officialNeighborhood: 'Bairro de teste' } })},'{}',${'a'.repeat(64)})`;
    for (const email of [admin,cadastro]) {
      const list = await listCatalog(email, { q: run });
      assert.equal(list.total,1);
      assert.equal(Object.hasOwn(list.items[0], 'endereco_privado'), false);
    }
    for (const email of [inactive,`missing-${run}@imobiliariainglaterra.com.br`]) {
      await assert.rejects(() => listCatalog(email, {}), /CATALOG_FORBIDDEN/);
      await assert.rejects(() => saveCatalogEdit(email,id,'b'.repeat(32),values), /CATALOG_FORBIDDEN/);
    }
    const before = await getCatalogEditor(cadastro,id);
    assert(before);
    const edits = await Promise.allSettled([admin,cadastro].map(email => saveCatalogEdit(email,id,before.version,{...values,title:'Titulo revisado'})));
    assert.equal(edits.filter(result => result.status === 'fulfilled').length,1);
    const rejected = edits.find(result => result.status === 'rejected');
    assert(rejected?.status === 'rejected' && rejected.reason.message === 'CATALOG_CONFLICT');
    const after = await getCatalogEditor(admin,id);
    assert.equal(after?.values.title,'Titulo revisado');
    const [row] = await sql`select dados_origem->>'title' as original, ativo, status_publicacao from imoveis where id=${id}`;
    assert.equal(row.original,values.title); assert.equal(row.ativo,false); assert.equal(row.status_publicacao,'pending_review');
    assert.equal((await listCatalog(admin,{q:run, negotiation:'locacao'})).total,0);
    console.log('PASS: Neon authorization, listing, filters, editing, concurrent conflict and source/publication preservation');
  } finally {
    await sql`delete from imoveis where id=${id}`;
    await sql`delete from usuarios where email in (${admin},${cadastro},${inactive})`;
    const [remaining] = await sql`select (select count(*) from imoveis where id=${id}) + (select count(*) from usuarios where email in (${admin},${cadastro},${inactive})) as total`;
    assert.equal(Number(remaining.total),0);
    console.log('Temporary test data removed');
  }
}
main().catch(() => { console.error('CATALOG_EDITOR_TEST_FAILED'); process.exitCode=1; }).finally(async () => { if (process.argv.includes('--db')) await sql.end(); });
