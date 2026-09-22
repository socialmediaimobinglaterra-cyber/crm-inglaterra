'use client';

export default function DevelopmentError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl p-8"><h1 className="text-xl font-semibold">Não foi possível carregar os empreendimentos</h1><p className="my-4">Tente novamente em alguns instantes.</p><button onClick={reset} className="rounded bg-emerald-800 px-4 py-3 text-white">Tentar novamente</button></main>;
}
