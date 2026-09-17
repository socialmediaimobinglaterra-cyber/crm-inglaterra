import { z } from 'zod';

export const galleryDraftSchema = z.object({
  version: z.string().regex(/^[a-f0-9]{32}$/),
  ids: z.array(z.uuid()).max(1000).refine(ids => new Set(ids).size === ids.length),
  primaryId: z.uuid().nullable(),
}).strict().refine(value => value.ids.length ? value.primaryId !== null && value.ids.includes(value.primaryId) : value.primaryId === null);
export type GalleryDraft = z.infer<typeof galleryDraftSchema>;
