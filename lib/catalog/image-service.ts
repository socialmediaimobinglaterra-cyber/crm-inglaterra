import { randomUUID } from 'node:crypto';
import { prepareCatalogImage } from './image-validation';
import { privateImageStorage, type ImageStorage } from './image-storage';
import { beginImageUpload, completeImageUpload, stageImageUpload, failImageUpload, finishImageDeletion, claimImageCleanup, type ImageOwner } from '@/lib/queries/catalog-images';

export async function cleanupCatalogImages(email:string,storage:ImageStorage=privateImageStorage,condominiumId?:string) {
  const rows=await claimImageCleanup(email,condominiumId);
  let failed=0;
  for(const row of rows) {
    try { await storage.remove(row.id); await finishImageDeletion(row.id); }
    catch { failed++; }
  }
  return { processed:rows.length, failed };
}
export async function uploadCatalogImage(email:string,propertyId:string,bytes:Buffer,storage:ImageStorage=privateImageStorage,staged=false) {
  return uploadImage(email,propertyId,bytes,storage,staged,'property');
}
export async function uploadCondominiumImage(email:string,id:string,bytes:Buffer,storage:ImageStorage=privateImageStorage) {
  return uploadImage(email,id,bytes,storage,true,'condominium');
}
async function uploadImage(email:string,propertyId:string,bytes:Buffer,storage:ImageStorage,staged:boolean,owner:ImageOwner) {
  const prepared=await prepareCatalogImage(bytes);
  const id=randomUUID();
  await beginImageUpload(email,propertyId,id,prepared,owner);
  try {
    await storage.write(id,prepared.full,prepared.thumbnail);
    if(staged) await stageImageUpload(email,propertyId,id,owner);
    else await completeImageUpload(email,propertyId,id);
  } catch {
    // Persist deletion intent before attempting cleanup; retries retain the exact generated paths.
    const marked=await failImageUpload(id);
    if(marked) {
      try { await storage.remove(id); await finishImageDeletion(id); } catch { /* Retried by bounded cleanup. */ }
    }
    throw new Error('IMAGE_UPLOAD_FAILED');
  }
  return id;
}
