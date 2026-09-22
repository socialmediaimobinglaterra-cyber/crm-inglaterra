import { z } from 'zod';
import { galleryDraftSchema } from './gallery-draft';

export const developmentKind = z.enum(['condominio', 'lancamento']);
export const condominiumEdit = z.object({
  id: z.uuid(),
  version: z.string().regex(/^[a-f0-9]{32}$/),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(20000),
  gallery: galleryDraftSchema.optional(),
}).strict();
export const developmentFilters = z.object({
  q: z.string().trim().max(100).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const developmentSelection = z.object({
  kind: developmentKind,
  id: z.uuid(),
  existing: z.boolean(),
  name: z.string().trim().min(1).max(200),
  properties: z.array(z.object({ id: z.uuid(), version: z.string().regex(/^[a-f0-9]{32}$/) }).strict()).min(1).max(25),
}).strict().refine(value => new Set(value.properties.map(p => p.id)).size === value.properties.length);
export type DevelopmentSelection = z.infer<typeof developmentSelection>;
export type DevelopmentCandidate = {
  id: string; codigo: string; condominium: string; building: string; commercial: string;
  city: string; state: string; neighborhood: string; version: string;
  condominio_id: string | null; lancamento_id: string | null;
};
export type DevelopmentRecord = { id: string; nome: string; ativo: boolean; total: number; kind: 'condominio' | 'lancamento' };
