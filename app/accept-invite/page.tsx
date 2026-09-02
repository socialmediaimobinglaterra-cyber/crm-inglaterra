import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/accept-invite-form";

export const metadata: Metadata = {
  title: "Aceitar convite | CRM Inglaterra",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">CRM Inglaterra</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Aceitar convite</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Seu convite de acesso ao CRM Inglaterra e valido por 48 horas. Para concluir, confirme
            explicitamente que deseja aceitar o convite.
          </p>
        </div>

        <AcceptInviteForm />
      </section>
    </main>
  );
}
