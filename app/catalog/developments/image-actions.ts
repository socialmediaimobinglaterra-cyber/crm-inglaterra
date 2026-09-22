'use server';

import { requireCatalogUser } from '@/lib/auth/catalog';
import { uploadCondominiumImage, cleanupCatalogImages } from '@/lib/catalog/image-service';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';
import { maxImageBytes } from '@/lib/catalog/image-validation';
import { z } from 'zod';

export async function stageCondominiumImage(form:FormData):Promise<{ok:boolean;message:string;id?:string}> {
  try {
    const user=await requireCatalogUser();
    const condominiumId=z.uuid().parse(form.get('condominiumId'));
    const file=form.get('image');
    if(!(file instanceof File)||!file.size||file.size>maxImageBytes||!imageStorageConfigured()) throw new Error('INVALID_IMAGE');
    await cleanupCatalogImages(user.email,undefined,condominiumId);
    const id=await uploadCondominiumImage(user.email,condominiumId,Buffer.from(await file.arrayBuffer()));
    return {ok:true,message:'',id};
  } catch {
    return {ok:false,message:'Não foi possível enviar uma das fotos. Confira formato e tamanho e tente salvar novamente.'};
  }
}
