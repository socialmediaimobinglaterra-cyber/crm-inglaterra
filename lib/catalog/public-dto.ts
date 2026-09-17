import {
  publicCatalogItemSchema,
  type NormalizedCatalogItem,
  type PublicCatalogItem,
  type PublicationUnit,
  normalizedCatalogItemSchema,
} from "./schemas";

// Supply only a server-configured CRM origin, never one from a feed or form.
function trustedMediaUrl(value: string, mediaOrigin?: string): string | null {
  if (!mediaOrigin) return null;
  try {
    const origin = new URL(mediaOrigin);
    const url = new URL(value);
    if (origin.protocol !== "https:" || origin.username || origin.password ||
        origin.pathname !== "/" || origin.search || origin.hash ||
        url.origin !== origin.origin || url.username || url.password || url.search || url.hash ||
        !url.pathname.startsWith("/api/blob-image/")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function toPublicCatalogItem(
  input: NormalizedCatalogItem,
  unit: PublicationUnit,
  mediaPolicy: { mediaOrigin?: string } = {},
): PublicCatalogItem {
  const item = normalizedCatalogItemSchema.parse(input);
  if (!item.title || item.publication.status !== "published" || !item.publication.available ||
      !item.publicationUnits.includes(unit)) {
    throw new Error("Catalog item is not published for this unit");
  }
  const publicItem: PublicCatalogItem = {
    publicCode: item.publicCode,
    unit,
    negotiation: item.negotiation,
    prices: item.prices,
    usageCategory: item.usageCategory,
    taxonomy: {
      normalizedType: item.taxonomy.normalizedType,
      normalizedSubtype: item.taxonomy.normalizedSubtype,
    },
    location: item.publicLocation,
    areas: item.areas,
    rooms: item.rooms,
    title: item.title,
    description: item.description,
    features: item.features.filter((feature) => feature.visibility === "public")
      .map(({ key, label, value }) => ({ key, label, value })),
    media: item.media.map((media) => ({
      kind: media.kind,
      order: media.order,
      isPrimary: media.isPrimary,
      url: media.migration.status === "blob_ready"
        ? trustedMediaUrl(media.migration.publicUrl, mediaPolicy.mediaOrigin) : null,
      title: media.title,
      description: media.description,
    })),
  };

  return publicCatalogItemSchema.parse(publicItem);
}
