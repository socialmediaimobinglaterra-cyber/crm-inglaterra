import { LoginForm } from "@/components/login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    invite?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const inviteAccepted = firstParam(params?.invite) === "accepted";

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">CRM Inglaterra</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Acesso administrativo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Entre com seu e-mail da Imobiliaria Inglaterra para receber um codigo temporario.
          </p>
        </div>
        {inviteAccepted ? (
          <p className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Convite aceito. Solicite seu codigo de acesso para entrar.
          </p>
        ) : null}
        <LoginForm />
      </section>
    </main>
  );
}
