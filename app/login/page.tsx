import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
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
        <LoginForm />
      </section>
    </main>
  );
}
