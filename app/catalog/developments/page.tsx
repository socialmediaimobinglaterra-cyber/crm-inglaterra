import Link from 'next/link';
import { CrmNavigation } from '@/components/crm-navigation';
import { requireCatalogUser } from '@/lib/auth/catalog';
import { developmentFilters } from '@/lib/catalog/developments';
import { listDevelopmentCandidates } from '@/lib/queries/catalog-developments';
import { DevelopmentReview } from '@/components/development-review';

export const dynamic = 'force-dynamic';
export default async function DevelopmentsPage({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const user = await requireCatalogUser();
  const params = await searchParams;
  const parsed = developmentFilters.safeParse({ q: params.q, page: params.page });
  const filters = parsed.success ? parsed.data : developmentFilters.parse({});
  const data = await listDevelopmentCandidates(user.email, filters);
  const url = (page: number) => `/catalog/developments?${new URLSearchParams({q:filters.q,page:String(page)})}`;
  return <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-8">
    <CrmNavigation role={user.role}/>
    <h1 className="py-7 text-2xl font-semibold">Condomínios e lançamentos</h1>
    {!parsed.success && <p role="alert">Filtros inválidos. A busca foi redefinida.</p>}
    <form className="mb-6 flex flex-wrap items-end gap-3"><label className="text-sm">Nome, código ou cidade<input className="mt-1 block w-72 max-w-full rounded border border-slate-300 bg-white p-2.5" name="q" maxLength={100} defaultValue={filters.q}/></label><button className="rounded bg-emerald-800 px-4 py-2.5 text-white">Buscar</button></form>
    <p className="mb-4 text-sm text-slate-600">{data.total} imóveis com dados de empreendimento na origem</p>
    <DevelopmentReview key={`${filters.q}:${data.page}`} items={data.items} records={data.records}/>
    <nav aria-label="Paginação" className="my-6 flex justify-between text-sm">{data.page>1?<Link href={url(data.page-1)}>Anterior</Link>:<span/>}<span>Página {data.page} de {data.pages}</span>{data.page<data.pages?<Link href={url(data.page+1)}>Próxima</Link>:<span/>}</nav>
    <h2 id="cadastros" className="mb-3 border-t border-slate-200 pt-6 text-lg font-semibold">Cadastros existentes</h2>
    <ul className="divide-y divide-slate-200">{data.records.map(r=><li key={`${r.kind}:${r.id}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="break-words">{r.kind==='condominio'?<Link className="text-emerald-800 underline" href={`/catalog/developments/${r.id}`}>{r.nome}</Link>:r.nome} · {r.kind==='condominio'?'Condomínio':'Lançamento'}</span><span>{r.total} imóveis · {r.ativo?'Ativo':'Não publicado'}</span></li>)}</ul>
    {!data.records.length && <p className="text-sm text-slate-600">Nenhum cadastro.</p>}
  </main>;
}
