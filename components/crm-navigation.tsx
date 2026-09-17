import Link from "next/link";
import { logout } from "@/app/dashboard/actions";
import type { UserRole } from "@/lib/auth/roles";

export function CrmNavigation({ role }: { role: UserRole }) {
  return <nav aria-label="Navegacao principal" className="flex flex-wrap items-center gap-5 border-b border-slate-200 py-4 text-sm">
    <Link href="/dashboard" className="font-semibold text-emerald-800">CRM Inglaterra</Link>
    <Link href="/catalog">Imóveis</Link>
    {role === "admin" && <Link href="/admin/users">Usuários</Link>}
    <form action={logout} className="ml-auto"><button className="px-3 py-2 underline">Sair</button></form>
  </nav>;
}
