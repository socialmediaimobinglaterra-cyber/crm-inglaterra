"use server";
import { getSessionFromCookie } from '@/lib/auth/session';
import { getActiveUserByEmail } from '@/lib/queries/auth';
import { uploadCatalogImage, cleanupCatalogImages } from '@/lib/catalog/image-service';
import { maxImageBytes } from '@/lib/catalog/image-validation';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';

export async function stageCatalogImage(form:FormData):Promise<{ok:boolean;message:string;id?:string}> {
  try {
    const session=await getSessionFromCookie();
    const user=session ? await getActiveUserByEmail(session.email) : null;
    if(!user || !['admin','cadastro'].includes(user.role)) throw new Error('FORBIDDEN');
    const propertyId=form.get('propertyId'); const file=form.get('image');
    if(typeof propertyId!=='string' || !(file instanceof File) || !file.size || file.size>maxImageBytes || !imageStorageConfigured()) throw new Error('INVALID_IMAGE');
    await cleanupCatalogImages(user.email);
    const id=await uploadCatalogImage(user.email,propertyId,Buffer.from(await file.arrayBuffer()),undefined,true);
    return {ok:true,message:'',id};
  } catch { return {ok:false,message:'Não foi possível enviar uma das fotos. Confira formato e tamanho e tente salvar novamente.'}; }
}
