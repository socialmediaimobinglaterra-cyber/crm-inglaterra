import { z } from 'zod';

export const imageBatchSchema = z.object({
  id: z.uuid(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}[0-9]{4,12}$/),
  limit: z.coerce.number().int().min(1).max(10),
}).strict();
export type ImageBatchInput = z.infer<typeof imageBatchSchema>;

export function readImageBatch(form: FormData) {
  return imageBatchSchema.parse({id: form.get('id'), code: form.get('code'), limit: form.get('limit')});
}
