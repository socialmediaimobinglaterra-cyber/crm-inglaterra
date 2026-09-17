import { notFound } from "next/navigation";
import Link from "next/link";
import { CrmNavigation } from "@/components/crm-navigation";
import { CatalogEditor } from "@/components/catalog-editor";
import { getCatalogGallery } from "@/lib/queries/catalog-images";
import { imageStorageConfigured } from "@/lib/catalog/image-storage";
import { requireCatalogUser } from "@/lib/auth/catalog";
import { catalogIdSchema } from "@/lib/catalog/editor";
import { getCatalogEditor } from "@/lib/queries/catalog";
import { getCatalogPublication } from '@/lib/queries/catalog-publication';
import { canPublishCatalog } from '@/lib/auth/roles';

export const dynamic = "force-dynamic";
export default async function CatalogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCatalogUser();
  const { id } = await params;
  if (!catalogIdSchema.safeParse(id).success) notFound();
  const item = await getCatalogEditor(user.email, id);
  if (!item) notFound();
  const gallery = await getCatalogGallery(user.email, id);
  const publication = await getCatalogPublication(user.email,id);
  return <main className="mx-auto max-w-7xl px-4 pb-10 sm:px-8"><CrmNavigation role={user.role} />
    <header className="pt-6"><Link className="text-sm underline" href="/catalog">Voltar aos imóveis</Link><h1 className="mt-4 text-2xl font-semibold">Imóvel {item.codigo}</h1></header>
    <CatalogEditor id={id} version={item.version} values={item.values} gallery={{...gallery,uploadAvailable:imageStorageConfigured()}} publication={{...publication,canPublish:canPublishCatalog(user.role)}} />
  </main>;
}
