import { claimBatchImage } from '@/lib/queries/catalog-image-batches';
import { transferClaimedImage } from './image-pilot-service';
import { privateImageStorage, type ImageStorage } from './image-storage';
import { downloadExternalImage } from './external-image';

// One image per request; the browser may continue only the explicitly selected batch.
export async function migrateBatchImage(email:string,batchId:string,storage:ImageStorage=privateImageStorage,download=downloadExternalImage) {
  const {propertyId,job}=await claimBatchImage(email,batchId);
  return transferClaimedImage(email,propertyId,job,storage,download);
}
