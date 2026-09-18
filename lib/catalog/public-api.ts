import { z } from 'zod';
import { publicCatalogItemSchema, publicationUnitSchema, type PublicationUnit } from './schemas';

export const mediaOrigin = 'https://admin.inglaterrapremium.com.br';
export const publicCodeSchema = z.string().regex(/^[A-Z]{2}\d{4,12}$/);
const text = z.string().trim().min(1).max(120);
const decimal = z.string().regex(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,6})?$/);
const integer = (max: number) => z.string().regex(/^(?:0|[1-9]\d*)$/).transform(Number).pipe(z.number().int().min(0).max(max));

export const publicFiltersSchema = z.object({
  bairro: text.optional(), cidade: text.optional(), tipo: text.optional(), condominio: text.optional(),
  negocio: z.enum(['Comprar', 'Alugar']).default('Comprar'),
  valorMinimo: decimal.optional(), valorMaximo: decimal.optional(),
  suitesMinimas: integer(1000).optional(), vagasMinimas: integer(1000).optional(),
  quartosMinimos: integer(1000).optional(), areaMinima: decimal.optional(), areaMaxima: decimal.optional(),
  order: z.enum(['relevancia', 'maior_valor', 'menor_valor', 'mais_recentes']).default('relevancia'),
  page: integer(10000).pipe(z.number().min(1)).default(1),
  perPage: integer(48).pipe(z.number().min(1)).default(24),
}).strict().refine(value => !value.valorMinimo || !value.valorMaximo ||
  decimalUnits(value.valorMinimo) <= decimalUnits(value.valorMaximo), 'Invalid price range')
  .refine(value => !value.areaMinima || !value.areaMaxima ||
    decimalUnits(value.areaMinima) <= decimalUnits(value.areaMaxima), 'Invalid area range');

function decimalUnits(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, '0'));
}

export function parsePublicQuery(params: URLSearchParams) {
  const result: Record<string, string> = Object.create(null);
  for (const [key, value] of params) {
    if (Object.hasOwn(result, key)) throw new Error('INVALID_QUERY');
    result[key] = value;
  }
  return publicFiltersSchema.parse(result);
}

export type PublicFilters = z.output<typeof publicFiltersSchema>;
export type ReadyPublicImage = { id: string; position: number; is_primary: boolean };
export function publicImageUrl(unit: PublicationUnit, id: string) {
  publicationUnitSchema.parse(unit);
  z.uuid().parse(id);
  return `${mediaOrigin}/api/blob-image/public/${unit}/${id}`;
}

// Both the SQL projection and this boundary are allowlists, never a spread of source data.
export function projectPublicItem(code: string, unit: PublicationUnit, input: unknown, images: ReadyPublicImage[]) {
  const data = z.record(z.string(), z.unknown()).parse(input);
  const taxonomy = z.record(z.string(), z.unknown()).parse(data.taxonomy);
  const features = z.array(z.object({ key: z.unknown(), label: z.unknown(), value: z.unknown(), visibility: z.string() })).parse(data.features);
  const item = publicCatalogItemSchema.parse({
    publicCode: code, unit, negotiation: data.negotiation, prices: data.prices,
    usageCategory: data.usageCategory,
    taxonomy: { normalizedType: taxonomy.normalizedType, normalizedSubtype: taxonomy.normalizedSubtype },
    location: data.publicLocation, areas: data.areas, rooms: data.rooms,
    title: data.title, description: data.description,
    features: features.filter(feature => feature.visibility === 'public').map(({key, label, value}) => ({key, label, value})),
    media: images.map(image => ({ kind: 'photo', order: image.position, isPrimary: image.is_primary,
      url: publicImageUrl(unit, image.id), title: null, description: null })),
  });
  const negotiation = item.prices.sale ? (item.prices.rent ? 'venda_locacao' : 'venda') : item.prices.rent ? 'locacao' : null;
  if (item.negotiation !== negotiation) throw new Error('INVALID_PUBLIC_ITEM');
  return item;
}
