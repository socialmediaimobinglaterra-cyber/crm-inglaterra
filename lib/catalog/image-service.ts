import { randomUUID } from 'node:crypto';
import { prepareCatalogImage } from './image-validation';
import { privateImageStorage, type ImageStorage } from './image-storage';
import { beginImageUpload, completeImageUpload, failImageUpload, finishImageDeletion, claimImageCleanup } from '@/lib/queries/catalog-images';

export async function cleanupCatalogImages(email:string,storage:ImageStorage=privateImageStorage) {
  const rows=await claimImageCleanup(email);
  let failed=0;
  for(const row of rows) {
    try { await storage.remove(row.id); await finishImageDeletion(row.id); }
    catch { failed++; }
  }
  return { processed:rows.length, failed };
}
export async function uploadCatalogImage(email:string,propertyId:string,bytes:Buffer,storage:ImageStorage=privateImageStorage) {
  const prepared=await prepareCatalogImage(bytes);
  const id=randomUUID();
  await beginImageUpload(email,propertyId,id,prepared);
  try {
    await storage.write(id,prepared.full,prepared.thumbnail);
    await completeImageUpload(email,propertyId,id);
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
