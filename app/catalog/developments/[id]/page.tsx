import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireCatalogUser } from '@/lib/auth/catalog';
import { getCondominiumEditor } from '@/lib/queries/catalog-developments';
import { CrmNavigation } from '@/components/crm-navigation';
import { CondominiumEditor } from '@/components/condominium-editor';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';

export const dynamic='force-dynamic';
export default async function CondominiumPage({params}:{params:Promise<{id:string}>}) {
  const user=await requireCatalogUser();
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) notFound();
  const data=await getCondominiumEditor(user.email,id);
  if(!data) notFound();
  return <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-8">
    <CrmNavigation role={user.role}/>
    <Link href="/catalog/developments#cadastros" className="mt-6 inline-block text-sm text-emerald-800 underline">Voltar aos condomínios</Link>
    <header className="py-6"><h1 className="break-words text-2xl font-semibold">Editar condomínio</h1><p className="mt-2 text-sm text-slate-600">{data.active?'Ativo':'Não publicado'}</p></header>
    <CondominiumEditor id={id} name={data.name} description={data.description} version={data.version} gallery={data.gallery} uploadAvailable={imageStorageConfigured()}/>
    <h2 className="mb-4 mt-8 text-lg font-semibold">Imóveis vinculados ({data.properties.length})</h2>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-3">Imóvel</th><th className="p-3">Bairro</th><th className="p-3">Cidade</th></tr></thead><tbody>{data.properties.map(p=><tr key={p.id} className="border-b border-slate-200"><td className="p-3"><Link className="text-emerald-800 underline" href={`/catalog/${p.id}`}>{p.codigo}</Link></td><td className="p-3">{p.neighborhood||'Não informado'}</td><td className="p-3">{p.city||'Não informada'}</td></tr>)}</tbody></table></div>
    {!data.properties.length&&<p className="py-4 text-sm">Nenhum imóvel vinculado.</p>}
  </main>;
}
