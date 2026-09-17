"use client";
export default function CatalogError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">Não foi possível carregar os imóveis</h1><p className="my-4">Tente novamente em instantes.</p><button onClick={reset} className="rounded bg-emerald-800 px-4 py-2 text-white">Tentar novamente</button></main>;
}
