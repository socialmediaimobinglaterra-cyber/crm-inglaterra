import Link from "next/link";
import { CrmNavigation } from "@/components/crm-navigation";
import { requireCatalogUser } from "@/lib/auth/catalog";
import { catalogFiltersSchema, formatCatalogPrice } from "@/lib/catalog/editor";
import { listCatalog } from "@/lib/queries/catalog";

export const dynamic = "force-dynamic";
export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCatalogUser();
  const params = await searchParams;
  const parsed = catalogFiltersSchema.safeParse({ q: params.q, status: params.status, negotiation: params.negotiation, page: params.page });
  const filters = parsed.success ? parsed.data : catalogFiltersSchema.parse({});
  const data = await listCatalog(user.email, filters);
  const pageUrl = (page: number) => `/catalog?${new URLSearchParams({ ...filters, page: String(page) })}`;
  const statuses: Record<string, string> = { pending_review: "Pendente de revisão", published: "Publicado", unpublished: "Não publicado" };
  return <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-8">
    <CrmNavigation role={user.role} />
    <header className="flex flex-wrap items-center justify-between gap-4 py-7"><div><h1 className="text-2xl font-semibold">Imóveis</h1><p className="mt-1 text-sm text-slate-600">{data.total.toLocaleString("pt-BR")} imóveis encontrados</p></div><Link href="/catalog/new" className="rounded bg-emerald-800 px-4 py-3 font-semibold text-white">Novo imóvel</Link></header>
    {!parsed.success && <p role="alert" className="mb-4 text-red-700">Filtros inválidos. A listagem foi redefinida.</p>}
    <form className="mb-6 grid gap-3 sm:grid-cols-[minmax(180px,1fr)_180px_200px_auto]">
      <label className="text-sm">Buscar<input name="q" defaultValue={filters.q} maxLength={100} placeholder="Código, título, bairro ou cidade" className="mt-1 w-full rounded border border-slate-300 bg-white p-2.5" /></label>
      <label className="text-sm">Negociação<select name="negotiation" defaultValue={filters.negotiation} className="mt-1 w-full rounded border border-slate-300 bg-white p-2.5"><option value="">Todas</option><option value="venda">Venda</option><option value="locacao">Locação</option><option value="venda_locacao">Venda e locação</option></select></label>
      <label className="text-sm">Publicação<select name="status" defaultValue={filters.status} className="mt-1 w-full rounded border border-slate-300 bg-white p-2.5"><option value="">Todas</option>{Object.entries(statuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="self-end rounded bg-emerald-800 px-5 py-2.5 text-white">Filtrar</button>
    </form>
    <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{["Imóvel", "Localização", "Venda / locação", "Publicação", ""].map((label,i) => <th key={i} className="p-4 font-medium">{label}</th>)}</tr></thead><tbody>
      {data.items.map(item => <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50"><td className="min-w-56 max-w-sm p-4"><span className="text-xs text-slate-500">{item.codigo}</span><p className="mt-1 break-words font-medium">{item.title ?? "Sem título"}</p></td><td className="p-4">{item.neighborhood}<p className="text-slate-500">{item.city}</p></td><td className="whitespace-nowrap p-4">{formatCatalogPrice(item.sale)}<p className="mt-1 text-slate-500">{formatCatalogPrice(item.rent)}</p></td><td className="p-4">{statuses[item.status_publicacao]}</td><td className="p-4"><Link aria-label={`Editar imóvel ${item.codigo}`} className="font-semibold text-emerald-800 underline" href={`/catalog/${item.id}`}>Editar</Link></td></tr>)}
    </tbody></table>{!data.items.length && <p className="p-10 text-center text-slate-600">Nenhum imóvel encontrado.</p>}</div>
    <footer className="mt-5 flex items-center justify-between text-sm">{data.page > 1 ? <Link href={pageUrl(data.page-1)}>Anterior</Link> : <span /> }<span>Página {data.page} de {data.pages}</span>{data.page < data.pages ? <Link href={pageUrl(data.page+1)}>Próxima</Link> : <span />}</footer>
  </main>;
}
