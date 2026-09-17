import type postgres from 'postgres';
import { createHash } from 'node:crypto';
import { sql } from '@/lib/db';
import { catalogIdSchema } from '@/lib/catalog/editor';
import { canPublishCatalog } from '@/lib/auth/roles';
import type { PublicationUnit } from '@/lib/catalog/schemas';
import { publicationDraftSchema, type PublicationDraft } from '@/lib/catalog/publication';

type Tx = postgres.TransactionSql<Record<string, never>>;

// All publication writers lock the parent property before reading or changing units.
export async function readPublication(tx: Tx, id: string) {
  const [row] = await tx`select status_publicacao, ativo, updated_at::text as revision from imoveis where id=${id}`;
  if (!row) throw new Error('CATALOG_NOT_FOUND');
  const rows = await tx<{ unidade: PublicationUnit; ativo: boolean; inclusao_manual: boolean | null; elegivel_filtro_automatico: boolean }[]>`
    select unidade, ativo, inclusao_manual, elegivel_filtro_automatico from unidades_publicacao where imovel_id=${id} order by unidade`;
  return {
    version: createHash('md5').update(JSON.stringify([row, rows])).digest('hex'),
    units: rows.filter(unit => unit.ativo).map(unit => unit.unidade),
  };
}

export async function getCatalogPublication(email: string, id: string) {
  catalogIdSchema.parse(id);
  return sql.begin(async tx => {
    const users = await tx`select id from usuarios where email=${email.trim().toLowerCase()} and ativo and role in ('admin','cadastro','corretor') for share`;
    if (!users.length) throw new Error('CATALOG_FORBIDDEN');
    await tx`select id from imoveis where id=${id} for share`;
    return readPublication(tx, id);
  });
}

export async function validatePublicationChange(tx: Tx, email: string, id: string, input: PublicationDraft) {
  const draft = publicationDraftSchema.parse(input);
  const [user] = await tx`select role from usuarios where email=${email.trim().toLowerCase()} and ativo for share`;
  if (!user || !canPublishCatalog(user.role)) throw new Error('PUBLICATION_FORBIDDEN');
  await tx`select id from imoveis where id=${id} for update`;
  if ((await readPublication(tx,id)).version !== draft.version) throw new Error('PUBLICATION_CONFLICT');
  return draft;
}

export async function savePublication(tx: Tx, id: string, draft: PublicationDraft) {
  for (const unit of ['matriz', 'premium'] as const) {
    const enabled = draft.units.includes(unit);
    await tx`insert into unidades_publicacao(imovel_id,unidade,ativo,inclusao_manual)
      values(${id},${unit},${enabled},${enabled})
      on conflict(imovel_id,unidade) do update set ativo=excluded.ativo,inclusao_manual=excluded.inclusao_manual`;
  }
  const published = draft.units.length > 0;
  await tx`update imoveis set ativo=${published},status_publicacao=${published ? 'published' : 'unpublished'},updated_at=clock_timestamp() where id=${id}`;
}
