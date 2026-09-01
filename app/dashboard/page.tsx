import { redirect } from "next/navigation";
import { logout } from "@/app/dashboard/actions";
import { getSessionFromCookie } from "@/lib/auth/session";
import { getActiveUserByEmail } from "@/lib/queries/auth";

export default async function DashboardPage() {
  const session = await getSessionFromCookie();

  if (!session) {
    redirect("/login");
  }

  const user = await getActiveUserByEmail(session.email);

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">CRM Inglaterra</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Dashboard</h1>
          </div>
          <form action={logout}>
            <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
              Sair
            </button>
          </form>
        </header>

        <section className="py-8">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Sessao ativa</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-500">E-mail</dt>
                <dd className="mt-1 font-medium text-slate-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Papel</dt>
                <dd className="mt-1 font-medium text-slate-900">{user.role}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
