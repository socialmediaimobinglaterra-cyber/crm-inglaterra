import { prepareCatalogImage } from './image-validation';
import { downloadExternalImage } from './external-image';
import { privateImageStorage, type ImageStorage } from './image-storage';
import { claimPilotImage, beginPilotUpload, completePilotImage, failPilotImage, recordImageDownload } from '@/lib/queries/catalog-image-pilot';
import { failImageUpload, finishImageDeletion } from '@/lib/queries/catalog-images';

// One bounded image per invocation; the persistent selection contains at most three.
export async function migratePilotImage(email:string,propertyId:string,storage:ImageStorage=privateImageStorage,download=downloadExternalImage) {
  const job=await claimPilotImage(email,propertyId);
  return transferClaimedImage(email,propertyId,job,storage,download);
}

// Only server-side queries may supply a claimed job; never pass form data here.
export async function transferClaimedImage(email:string,propertyId:string,job:Awaited<ReturnType<typeof claimPilotImage>>,storage:ImageStorage=privateImageStorage,download=downloadExternalImage) {
  if(!job) return {status:'idle' as const};
  let imageId:string|undefined;
  let reason:'download'|'image'|'storage'|'finalize'='download';
  try {
    const bytes=await download(job.url);
    await recordImageDownload(propertyId,job.slot,job.attempt,bytes.length);
    reason='image';
    const prepared=await prepareCatalogImage(bytes);
    imageId=await beginPilotUpload(email,propertyId,job.slot,job.attempt,prepared);
    reason='storage';
    await storage.write(imageId,prepared.full,prepared.thumbnail);
    reason='finalize';
    await completePilotImage(email,propertyId,job.slot,job.attempt,imageId,prepared.full.length+prepared.thumbnail.length);
    return {status:'done' as const};
  } catch {
    // A commit with an uncertain response must never lead to deleting a ready image.
    if(imageId && await failImageUpload(imageId)) {
      try {await storage.remove(imageId);await finishImageDeletion(imageId);} catch { /* Existing cleanup queue retries deletion. */ }
    }
    await failPilotImage(propertyId,job.slot,job.attempt,reason);
    return {status:'failed' as const};
  }
}
