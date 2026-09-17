"use server";
import { revalidatePath } from 'next/cache';
import { getSessionFromCookie } from '@/lib/auth/session';
import { getActiveUserByEmail } from '@/lib/queries/auth';
import { mutateGallery } from '@/lib/queries/catalog-images';
import { uploadCatalogImage, cleanupCatalogImages } from '@/lib/catalog/image-service';
import { maxImageBytes } from '@/lib/catalog/image-validation';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';

export async function catalogImageAction(_previous:{ok:boolean;message:string},form:FormData) {
  let propertyId='';
  try {
    const session=await getSessionFromCookie();
    const user=session ? await getActiveUserByEmail(session.email) : null;
    if(!user || !['admin','cadastro'].includes(user.role)) return {ok:false,message:'Sua sessão ou permissão não está mais disponível.'};
    const property=form.get('propertyId'); const command=form.get('command');
    if(typeof property!=='string') throw new Error('INVALID_INPUT');
    propertyId=property;
    if(command==='upload') {
      if(!imageStorageConfigured()) return {ok:false,message:'Upload indisponível neste ambiente. A conexão privada do Blob precisa estar disponível no servidor.'};
      const file=form.get('image');
      if(!(file instanceof File) || !file.size || file.size>maxImageBytes) return {ok:false,message:'Selecione uma imagem JPEG, PNG ou WebP de até 4 MB.'};
      await cleanupCatalogImages(user.email);
      await uploadCatalogImage(user.email,propertyId,Buffer.from(await file.arrayBuffer()));
    } else if(command==='primary' || command==='earlier' || command==='later' || command==='remove') {
      const id=form.get('imageId'); const version=form.get('version');
      if(typeof id!=='string' || typeof version!=='string') throw new Error('INVALID_INPUT');
      if(command==='remove' && !imageStorageConfigured()) return {ok:false,message:'Remoção indisponível sem conexão com o armazenamento.'};
      await mutateGallery(user.email,propertyId,id,version,command);
      if(command==='remove') {
        const result=await cleanupCatalogImages(user.email);
        if(result.failed) {
          revalidatePath(`/catalog/${propertyId}`);
          return {ok:true,message:'Foto retirada da galeria. A limpeza do armazenamento será tentada novamente.'};
        }
      }
    } else throw new Error('INVALID_INPUT');
    revalidatePath(`/catalog/${propertyId}`);
    return {ok:true,message:command==='upload'?'Imagem adicionada.':'Galeria atualizada.'};
  } catch(error) {
    const code=error instanceof Error?error.message:'';
    return {ok:false,message:code==='GALLERY_CONFLICT'?'A galeria mudou. Recarregue a página antes de tentar novamente.':code.startsWith('IMAGE_')?'Não foi possível processar a imagem. Verifique o formato, o tamanho e tente novamente.':'Não foi possível atualizar a galeria. Tente novamente em instantes.'};
  }
}
