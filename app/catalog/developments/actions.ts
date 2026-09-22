'use server';

import { requireCatalogUser } from '@/lib/auth/catalog';
import { confirmDevelopment, saveCondominiumEditor } from '@/lib/queries/catalog-developments';
import { revalidatePath } from 'next/cache';
import { cleanupCatalogImages } from '@/lib/catalog/image-service';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';
import { condominiumEdit } from '@/lib/catalog/developments';

export async function saveCondominiumAction(input: unknown) {
  const user=await requireCatalogUser();
  try {
    const value=condominiumEdit.parse(input);
    const saved=await saveCondominiumEditor(user.email,value);
    // Storage cleanup cannot turn an already committed save into a reported failure.
    if(value.gallery&&imageStorageConfigured()) await cleanupCatalogImages(user.email,undefined,value.id).catch(()=>undefined);
    revalidatePath('/catalog/developments','layout');
    return {ok:true as const,...saved};
  } catch(error) {
    return {ok:false as const,message:error instanceof Error && ['DEVELOPMENT_CONFLICT','GALLERY_CONFLICT'].includes(error.message)
      ? 'O cadastro mudou desde que foi aberto. Recarregue a página e confira antes de salvar.'
      : 'Não foi possível salvar. Confira os campos e tente novamente.'};
  }
}

export async function confirmDevelopmentAction(input: unknown) {
  const user = await requireCatalogUser();
  try {
    await confirmDevelopment(user.email, input);
    revalidatePath('/catalog/developments');
    return { ok: true, message: 'Cadastro e vínculos salvos. Nenhuma publicação foi alterada.' };
  } catch (error) {
    const conflict = error instanceof Error && error.message === 'DEVELOPMENT_CONFLICT';
    return { ok: false, message: conflict ? 'Os dados ou vínculos mudaram. Atualize a página e revise a seleção.' : 'Não foi possível salvar. Confira a seleção e tente novamente.' };
  }
}
