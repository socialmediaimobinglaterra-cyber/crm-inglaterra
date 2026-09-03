import { redirect } from "next/navigation";
import { AdminUsersPanel } from "@/components/admin-users-panel";
import { getSessionFromCookie } from "@/lib/auth/session";
import { getAdminUsersOverview } from "@/lib/queries/users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminUsersPage() {
  const session = await getSessionFromCookie();

  if (!session) {
    redirect("/login");
  }

  const overview = await getAdminUsersOverview(session.email);

  if (!overview) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">CRM Inglaterra</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Usuarios e convites</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Gerencie acessos administrativos, convites pendentes e status dos usuarios do CRM.
          </p>
        </header>

        <section className="py-8">
          <AdminUsersPanel
            users={overview.users}
            pendingInvites={overview.pendingInvites}
            currentUserId={overview.currentUser.id}
          />
        </section>
      </div>
    </main>
  );
}
