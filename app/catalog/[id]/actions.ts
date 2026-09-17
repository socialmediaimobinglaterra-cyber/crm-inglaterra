"use server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookie } from "@/lib/auth/session";
import { readCatalogEdit } from "@/lib/catalog/editor";
import { saveCatalogEdit } from "@/lib/queries/catalog";
import { galleryDraftSchema } from '@/lib/catalog/gallery-draft';
import { cleanupCatalogImages } from '@/lib/catalog/image-service';
import { publicationDraftSchema } from '@/lib/catalog/publication';

export async function updateCatalog(_previous: { message: string; ok: boolean }, form: FormData) {
  const session = await getSessionFromCookie();
  if (!session) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  try {
    const id = form.get("id"), version = form.get("version");
    if (typeof id !== "string" || typeof version !== "string") throw new Error("INVALID_INPUT");
    const rawGallery=form.get('gallery');
    if(rawGallery !== null && (typeof rawGallery!=='string' || rawGallery.length>50000)) throw new Error('INVALID_INPUT');
    const gallery=typeof rawGallery==='string' ? galleryDraftSchema.parse(JSON.parse(rawGallery)) : undefined;
    const rawPublication=form.get('publication');
    if(rawPublication !== null && (typeof rawPublication!=='string' || rawPublication.length>1000)) throw new Error('INVALID_INPUT');
    const publication=typeof rawPublication==='string' ? publicationDraftSchema.parse(JSON.parse(rawPublication)) : undefined;
    await saveCatalogEdit(session.email, id, version, readCatalogEdit(form),gallery,publication);
    // Cleanup failure must not turn a committed save into a reported failure.
    if(gallery) await cleanupCatalogImages(session.email).catch(()=>undefined);
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${id}`);
    return { ok: true, message: "Alterações salvas." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if(code === 'PUBLICATION_FORBIDDEN') return {ok:false,message:'Seu perfil não pode alterar a publicação. Nenhuma alteração foi salva.'};
    if(code === 'PUBLICATION_CONFLICT') return {ok:false,message:'O imóvel ou sua publicação mudou. Recarregue a página antes de salvar novamente.'};
    return { ok: false, message: code === "CATALOG_CONFLICT" || code === 'GALLERY_CONFLICT' ? "Este imóvel mudou desde a abertura. Recarregue a página antes de editar novamente." : code === "CATALOG_FORBIDDEN" ? "Seu acesso não está mais disponível." : "Não foi possível salvar. Confira os campos, use preços positivos e não inclua contatos nos textos. Se persistir, tente novamente." };
  }
}
