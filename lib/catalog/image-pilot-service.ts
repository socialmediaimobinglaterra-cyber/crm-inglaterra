import { prepareCatalogImage } from './image-validation';
import { downloadExternalImage } from './external-image';
import { privateImageStorage, type ImageStorage } from './image-storage';
import { claimPilotImage, beginPilotUpload, completePilotImage, failPilotImage } from '@/lib/queries/catalog-image-pilot';
import { failImageUpload, finishImageDeletion } from '@/lib/queries/catalog-images';

// One bounded image per invocation; the persistent selection contains at most three.
export async function migratePilotImage(email:string,propertyId:string,storage:ImageStorage=privateImageStorage,download=downloadExternalImage) {
  const job=await claimPilotImage(email,propertyId);
  if(!job) return {status:'idle' as const};
  let imageId:string|undefined;
  try {
    const prepared=await prepareCatalogImage(await download(job.url));
    imageId=await beginPilotUpload(email,propertyId,job.slot,job.attempt,prepared);
    await storage.write(imageId,prepared.full,prepared.thumbnail);
    await completePilotImage(email,propertyId,job.slot,job.attempt,imageId);
    return {status:'done' as const};
  } catch {
    // A commit with an uncertain response must never lead to deleting a ready image.
    if(imageId && await failImageUpload(imageId)) {
      try {await storage.remove(imageId);await finishImageDeletion(imageId);} catch { /* Existing cleanup queue retries deletion. */ }
    }
    await failPilotImage(propertyId,job.slot,job.attempt);
    return {status:'failed' as const};
  }
}
