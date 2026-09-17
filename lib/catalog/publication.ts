import { z } from 'zod';
import { catalogVersionSchema } from './editor';
import { publicationUnitSchema } from './schemas';

export const publicationDraftSchema = z.object({
  version: catalogVersionSchema,
  units: z.array(publicationUnitSchema).max(2).refine(units => new Set(units).size === units.length),
}).strict();
export type PublicationDraft = z.infer<typeof publicationDraftSchema>;
