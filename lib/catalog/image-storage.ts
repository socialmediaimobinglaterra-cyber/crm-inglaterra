import { put, get, del } from '@vercel/blob';
import { catalogIdSchema } from './editor';

export function imagePath(id: string, thumbnail = false) {
  catalogIdSchema.parse(id);
  return `catalog/images/${id}/${thumbnail ? 'thumb' : 'full'}.webp`;
}
export function imageStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}
export type ImageStorage = {
  write: (id: string, full: Buffer, thumbnail: Buffer) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
export const privateImageStorage: ImageStorage = {
  async write(id, full, thumbnail) {
    // Let the SDK resolve and refresh OIDC. Never copy a runtime token into options.
    await put(imagePath(id), full, { access:'private', addRandomSuffix:false, allowOverwrite:false, contentType:'image/webp', abortSignal:AbortSignal.timeout(30000) });
    await put(imagePath(id,true), thumbnail, { access:'private', addRandomSuffix:false, allowOverwrite:false, contentType:'image/webp', abortSignal:AbortSignal.timeout(30000) });
  },
  async remove(id) {
    await del([imagePath(id),imagePath(id,true)], { abortSignal:AbortSignal.timeout(30000) });
  },
};
export function readPrivateImage(id: string, thumbnail: boolean) {
  return get(imagePath(id,thumbnail), {access:'private',useCache:false,abortSignal:AbortSignal.timeout(15000)});
}
