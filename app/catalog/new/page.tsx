import { randomUUID } from "node:crypto";
import Link from "next/link";
import { CrmNavigation } from "@/components/crm-navigation";
import { CatalogEditor } from "@/components/catalog-editor";
import { requireCatalogUser } from "@/lib/auth/catalog";

export const dynamic = "force-dynamic";
export default async function NewCatalogPage() {
  const user = await requireCatalogUser();
  return <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-8"><CrmNavigation role={user.role} />
    <header className="pt-6"><Link href="/catalog" className="text-sm underline">Voltar aos imóveis</Link><h1 className="mt-4 text-2xl font-semibold">Novo imóvel</h1></header>
    <CatalogEditor mode="create" id={randomUUID()} version="" values={{
      title: null, description: null, prices: { sale: null, rent: null, condominium: null, iptu: null },
      areas: { unit: null, total: null, usable: null, private: null },
      rooms: { bedrooms: null, suites: null, bathrooms: null, livingRooms: null, parkingSpaces: null },
    }} />
  </main>;
}
