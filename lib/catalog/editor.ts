import { z } from "zod";
import { normalizedCatalogItemSchema, priceSetSchema, areaSetSchema, roomCountsSchema, publicLocationSchema, privateLocationSchema } from "./schemas";
import { propertyTypes } from "./property-types";

const editorTaxonomySchema = z.object({
  normalizedType: z.string().refine(value => propertyTypes.some(type => type.key === value)),
  normalizedSubtype: z.string().trim().min(1).max(120).nullable(),
}).strict();

export const catalogEditSchema = z.object({
  title: normalizedCatalogItemSchema.shape.title,
  description: normalizedCatalogItemSchema.shape.description,
  prices: priceSetSchema,
  areas: areaSetSchema,
  rooms: roomCountsSchema,
  publicLocation: publicLocationSchema.optional(),
  privateLocation: privateLocationSchema.refine(value => value.postalCode === null || /^\d{8}$/.test(value.postalCode), 'CEP invalido').optional(),
  taxonomy: editorTaxonomySchema.optional(),
  usageCategory: normalizedCatalogItemSchema.shape.usageCategory.optional(),
}).strict().refine(value => value.prices.sale !== null || value.prices.rent !== null, {
  message: "Informe um preco de venda ou locacao positivo.",
});
export type CatalogEdit = z.infer<typeof catalogEditSchema>;
export const catalogIdSchema = z.uuid();
export const catalogVersionSchema = z.string().regex(/^[a-f0-9]{32}$/);
export const catalogFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  negotiation: z.enum(["", "venda", "locacao", "venda_locacao"]).default(""),
  status: z.enum(["", "pending_review", "published", "unpublished"]).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();

export function formatCatalogPrice(value: string | null): string {
  if (value === null) return "Nao informado";
  const [integer, fraction = ""] = value.split(".");
  return `R$ ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction.padEnd(2, "0")}`;
}

export function readCatalogEdit(form: FormData): CatalogEdit {
  const text = (key: string) => {
    const value = form.get(key);
    if (typeof value !== "string" || value.length > 5000) throw new Error("INVALID_INPUT");
    return value.trim() || null;
  };
  const decimal = (key: string) => {
    const value = text(key);
    if (value && value.length > 40) throw new Error("INVALID_INPUT");
    return value?.replace(",", ".") ?? null;
  };
  const count = (key: string) => {
    const value = text(key);
    if (value === null) return null;
    if (!/^\d{1,6}$/.test(value)) throw new Error("INVALID_INPUT");
    return Number(value);
  };
  const latitude = form.has('city') ? decimal('latitude') : null;
  const longitude = form.has('city') ? decimal('longitude') : null;
  return catalogEditSchema.parse({
    title: text("title"), description: text("description"),
    prices: { sale: decimal("sale"), rent: decimal("rent"), condominium: decimal("condominium"), iptu: decimal("iptu") },
    areas: { unit: text("unit"), total: decimal("total"), usable: decimal("usable"), private: decimal("private") },
    rooms: { bedrooms: count("bedrooms"), suites: count("suites"), bathrooms: count("bathrooms"), livingRooms: count("livingRooms"), parkingSpaces: count("parkingSpaces") },
    ...(form.has("city") ? {
      publicLocation: { officialNeighborhood: text("neighborhood"), neighborhoodAlias: text("alias"), city: text("city"), state: text("state") },
      privateLocation: {
        street: text("street"), number: /^0+$/.test(text("number") ?? "") ? null : text("number"),
        complement: text("complement"), postalCode: text("postalCode")?.replace("-", "") ?? null,
        coordinates: latitude === null && longitude === null || latitude !== null && longitude !== null && Number(latitude) === 0 && Number(longitude) === 0
          ? null : { latitude, longitude },
      },
      taxonomy: { normalizedType: text("type"), normalizedSubtype: text("subtype") },
      usageCategory: text("usageCategory"),
    } : {}),
  });
}
