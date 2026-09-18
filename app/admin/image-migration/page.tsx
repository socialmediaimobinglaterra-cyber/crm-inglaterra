import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionFromCookie } from '@/lib/auth/session';
import { requireActiveAdminByEmail } from '@/lib/queries/users';
import { getImageBatchStatus, listImageBatches } from '@/lib/queries/catalog-image-batches';
import { catalogIdSchema } from '@/lib/catalog/editor';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';
import { CrmNavigation } from '@/components/crm-navigation';
import { ImageBatchForm, ImageMigrationPanel } from '@/components/image-migration-panel';

export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function ImageMigrationPage({searchParams}:{searchParams:Promise<{batch?:string}>}) {
  const session=await getSessionFromCookie();
  if(!session) redirect('/login');
  const user=await requireActiveAdminByEmail(session.email);
  if(!user) redirect('/dashboard');
  const {batch}=await searchParams;
  const parsed=catalogIdSchema.safeParse(batch);
  const batches=await listImageBatches(user.email);
  let selected=null;
  if(parsed.success) {
    try {selected=await getImageBatchStatus(user.email,parsed.data);} catch { /* Generic page message below. */ }
  }
  return <main className="mx-auto max-w-4xl px-4 pb-10 sm:px-8">
    <CrmNavigation role={user.role}/>
    <h1 className="my-7 text-2xl font-semibold">Migração de fotos</h1>
    <ImageBatchForm/>
    {batch&&!selected&&<p role="alert" className="mt-4">Lote indisponível. Confira a seleção e seu acesso.</p>}
    {selected&&<ImageMigrationPanel key={selected.id} initial={selected} configured={imageStorageConfigured()}/>}
    <section className="mt-10"><h2 className="text-lg font-semibold">Lotes recentes</h2>
      <ul className="mt-3 divide-y border-y border-slate-200">{batches.map((item,index)=><li key={item.id} className="py-3"><Link className="underline" href={`/admin/image-migration?batch=${item.id}`}>Imóvel {item.code} · Lote {batches.length-index}</Link></li>)}</ul>
      {!batches.length&&<p className="mt-3 text-sm text-slate-600">Nenhum lote preparado.</p>}
    </section>
  </main>;
}
