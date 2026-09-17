import { z } from "zod";

const ISO_8601_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const COORDINATE_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SAFE_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$/;
const brazilianStates = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

const zeroDecimalPattern = /^-?0(?:\.0+)?$/;
const sensitiveTextPattern =
  /(?:@|\b\d{5}-?\d{3}\b|\b(?:\+?\d[\s().-]*){8,}\d\b|token|secret|cookie|senha|password)/i;
const privateMetadataKeyPattern =
  /(?:street|rua|endereco|address|numero|number|complement|cep|postal|coordinate|latitude|longitude|corretor|broker|telefone|phone|email)/i;

function isIsoDateTime(value: string): boolean {
  const match = ISO_8601_PATTERN.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) {
    return false;
  }

  const [, year, month, day, hour, minute, second] = match;
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);
  const parsedSecond = Number(second);
  const calendarDate = new Date(
    Date.UTC(parsedYear, parsedMonth - 1, parsedDay, parsedHour, parsedMinute, parsedSecond),
  );

  return (
    calendarDate.getUTCFullYear() === parsedYear &&
    calendarDate.getUTCMonth() === parsedMonth - 1 &&
    calendarDate.getUTCDate() === parsedDay &&
    parsedHour <= 23 &&
    parsedMinute <= 59 &&
    parsedSecond <= 59
  );
}

function isPositiveDecimal(value: string): boolean {
  return POSITIVE_DECIMAL_PATTERN.test(value) && !zeroDecimalPattern.test(value);
}

function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSafePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isZeroDecimalValue(value: unknown): boolean {
  return typeof value === "string" && zeroDecimalPattern.test(value.trim());
}

function copyRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return { ...(value as Record<string, unknown>) };
}

function isSafeKey(value: string): boolean {
  return (
    SAFE_KEY_PATTERN.test(value) &&
    value !== "__proto__" &&
    value !== "constructor" &&
    value !== "prototype"
  );
}

function containsSensitiveText(value: string): boolean {
  return sensitiveTextPattern.test(value);
}

function hasUniqueValues(values: Array<string | number>): boolean {
  return new Set(values).size === values.length;
}

function isSortedAscending(values: number[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

export const decimalStringSchema = z
  .string()
  .refine(isPositiveDecimal, "Use positive decimal string")
  .brand<"DecimalString">();

export const positiveDecimalStringSchema = decimalStringSchema.refine(
  (value) => isPositiveDecimal(value),
  "Use positive decimal string",
);

export const coordinateDecimalStringSchema = z
  .string()
  .regex(COORDINATE_DECIMAL_PATTERN, "Use decimal coordinate string")
  .brand<"CoordinateDecimalString">();

export const isoDateTimeSchema = z
  .string()
  .refine(isIsoDateTime, "Use ISO 8601 date-time");

const safeKeySchema = z.string().trim().refine(isSafeKey, "Use safe structured key");
const identifierSchema = z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/, "Use valid catalog identifier");
export const publicationUnitSchema = z.enum(["premium", "matriz"]);

const safeTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(5000)
  .refine((value) => !containsSensitiveText(value), "Text contains sensitive content");

const safeShortTextSchema = safeTextSchema.max(512);

export const sourceIdentificationSchema = z.object({
  sourceKey: safeKeySchema,
  externalId: identifierSchema,
  importedAt: isoDateTimeSchema.nullable(),
  sourceCreatedAt: isoDateTimeSchema.nullable(),
  sourceUpdatedAt: isoDateTimeSchema.nullable(),
}).strict();

export const priceSetSchema = z.object({
  sale: decimalStringSchema.nullable(),
  rent: decimalStringSchema.nullable(),
  condominium: decimalStringSchema.nullable(),
  iptu: decimalStringSchema.nullable(),
}).strict();

export const taxonomySchema = z.object({
  normalizedType: z.string().trim().min(1),
  normalizedSubtype: z.string().trim().min(1).nullable(),
  originalType: z.string().trim().min(1),
  originalSubtype: z.string().trim().min(1).nullable(),
}).strict();

export const publicLocationSchema = z.object({
  officialNeighborhood: z.string().trim().min(1),
  neighborhoodAlias: z.string().trim().min(1).nullable(),
  city: z.string().trim().min(1),
  state: z
    .string()
    .trim()
    .refine((value) => brazilianStates.has(value.toUpperCase()), "Use valid Brazilian state code")
    .transform((value) => value.toUpperCase()),
}).strict();

export const coordinatesSchema = z.object({
  latitude: coordinateDecimalStringSchema.refine(
    (value) => Number(value) >= -90 && Number(value) <= 90,
    "Latitude out of range",
  ),
  longitude: coordinateDecimalStringSchema.refine(
    (value) => Number(value) >= -180 && Number(value) <= 180,
    "Longitude out of range",
  ),
}).strict();

export const privateLocationSchema = z.object({
  street: z.string().trim().min(1).nullable(),
  number: z.string().trim().min(1).nullable(),
  complement: z.string().trim().min(1).nullable(),
  postalCode: z.string().trim().min(1).nullable(),
  coordinates: coordinatesSchema.nullable(),
}).strict();

export const areaSetSchema = z.object({
  unit: z.enum(["m2", "ha"]).nullable(),
  total: decimalStringSchema.nullable(),
  usable: decimalStringSchema.nullable(),
  private: decimalStringSchema.nullable(),
}).strict();

export const roomCountsSchema = z.object({
  bedrooms: z.number().int().nonnegative().nullable(),
  suites: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  livingRooms: z.number().int().nonnegative().nullable(),
  parkingSpaces: z.number().int().nonnegative().nullable(),
}).strict();

const featureValueSchema = z.union([
  z.string(),
  z.number().int(),
  z.boolean(),
  z.null(),
]);

export const dynamicFeatureSchema = z.object({
  key: safeKeySchema,
  label: safeShortTextSchema.nullable(),
  value: featureValueSchema,
  originalKey: safeKeySchema,
  originalValue: featureValueSchema,
  visibility: z.enum(["public", "private", "pending_review"]),
}).strict();

export const publicFeatureSchema = z.object({
  key: safeKeySchema.refine((value) => !privateMetadataKeyPattern.test(value), "Private feature key"),
  label: safeShortTextSchema.nullable(),
  value: z.union([safeTextSchema, z.number().int(), z.boolean(), z.null()]),
}).strict();

const urlSchema = z.string().refine(isSafeUrl, "Use valid HTTP or HTTPS URL");
const publicUrlSchema = z.string().refine(isSafePublicUrl, "Use valid HTTPS URL");

export const mediaMigrationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("external_only"),
    blobKey: z.null(),
    publicUrl: z.null(),
    requiresProxy: z.literal(true),
  }).strict(),
  z.object({
    status: z.literal("pending_blob"),
    blobKey: z.null(),
    publicUrl: z.null(),
    requiresProxy: z.literal(true),
  }).strict(),
  z.object({
    status: z.literal("blob_ready"),
    blobKey: z.string().trim().min(1),
    publicUrl: publicUrlSchema,
    requiresProxy: z.literal(true),
  }).strict(),
  z.object({
    status: z.literal("failed"),
    blobKey: z.null(),
    publicUrl: z.null(),
    requiresProxy: z.literal(true),
  }).strict(),
]);

const mediaBaseSchema = z.object({
  order: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  externalUrl: urlSchema,
  originalKind: z.string().trim().min(1).nullable(),
  title: safeShortTextSchema.nullable(),
  description: safeTextSchema.nullable(),
  migration: mediaMigrationSchema,
}).strict();

export const photoSchema = mediaBaseSchema.extend({
  kind: z.literal("photo"),
}).strict();

export const videoSchema = mediaBaseSchema.extend({
  kind: z.literal("video"),
}).strict();

export const rawMetadataValueSchema = z.union([z.string(), z.boolean(), z.null()]);

export const rawMetadataSchema = z
  .record(safeKeySchema, rawMetadataValueSchema)
  .refine(
    (metadata) => Object.keys(metadata).every((key) => !privateMetadataKeyPattern.test(key)),
    "Raw metadata cannot contain private data keys",
  );

export const normalizationAlertSchema = z.object({
  code: safeKeySchema,
  severity: z.enum(["info", "warning", "error"]),
  path: safeKeySchema,
  message: safeShortTextSchema,
}).strict();

export const normalizedCatalogItemSchema = z
  .object({
    source: sourceIdentificationSchema,
    publicCode: identifierSchema,
    publicationUnits: z.array(publicationUnitSchema).refine(hasUniqueValues, "Duplicate publication unit"),
    origin: z.enum(["external", "manual"]),
    publication: z.object({
      status: z.enum(["published", "unpublished", "pending_review"]),
      available: z.boolean(),
    }).strict(),
    negotiation: z.enum(["venda", "locacao", "venda_locacao"]),
    prices: priceSetSchema,
    usageCategory: z.enum([
      "residencial",
      "comercial",
      "rural",
      "industrial",
      "corporativa",
      "unknown",
    ]),
    taxonomy: taxonomySchema,
    publicLocation: publicLocationSchema,
    privateLocation: privateLocationSchema,
    areas: areaSetSchema,
    rooms: roomCountsSchema,
    title: safeShortTextSchema.nullable(),
    description: safeTextSchema.nullable(),
    features: z.array(dynamicFeatureSchema),
    media: z.array(z.discriminatedUnion("kind", [photoSchema, videoSchema])),
    rawMetadata: rawMetadataSchema,
    alerts: z.array(normalizationAlertSchema),
  })
  .strict()
  .superRefine((item, ctx) => {
    item.features.forEach((feature, index) => {
      if (feature.visibility === "public" && !publicFeatureSchema.safeParse({
        key: feature.key, label: feature.label, value: feature.value,
      }).success) {
        ctx.addIssue({ code: "custom", path: ["features", index], message: "Unsafe public feature" });
      }
    });
    const hasSalePrice = Boolean(item.prices.sale && isPositiveDecimal(item.prices.sale));
    const hasRentPrice = Boolean(item.prices.rent && isPositiveDecimal(item.prices.rent));

    if (
      (item.negotiation === "venda" || item.negotiation === "venda_locacao") &&
      !hasSalePrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["prices", "sale"],
        message: "Sale negotiation requires a positive sale price",
      });
    }

    if (
      (item.negotiation === "locacao" || item.negotiation === "venda_locacao") &&
      !hasRentPrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["prices", "rent"],
        message: "Rent negotiation requires a positive rent price",
      });
    }

    if (item.negotiation === "venda" && hasRentPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["negotiation"],
        message: "Sale-only negotiation cannot include a positive rent price",
      });
    }

    if (item.negotiation === "locacao" && hasSalePrice) {
      ctx.addIssue({
        code: "custom",
        path: ["negotiation"],
        message: "Rent-only negotiation cannot include a positive sale price",
      });
    }

    const featureKeys = item.features.map((feature) => feature.key);
    if (!hasUniqueValues(featureKeys)) {
      ctx.addIssue({
        code: "custom",
        path: ["features"],
        message: "Feature keys must be unique",
      });
    }

    const mediaOrders = item.media.map((media) => media.order);
    if (!hasUniqueValues(mediaOrders) || !isSortedAscending(mediaOrders)) {
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Media order must be unique and sorted ascending",
      });
    }

    const primaryCount = item.media.filter((media) => media.isPrimary).length;
    if (primaryCount > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["media"],
        message: "Only one media item can be primary",
      });
    }
  });

export const publicCatalogItemSchema = z.object({
  publicCode: normalizedCatalogItemSchema.shape.publicCode,
  unit: publicationUnitSchema,
  negotiation: normalizedCatalogItemSchema.shape.negotiation,
  prices: priceSetSchema,
  usageCategory: normalizedCatalogItemSchema.shape.usageCategory,
  taxonomy: taxonomySchema.pick({ normalizedType: true, normalizedSubtype: true }),
  location: publicLocationSchema,
  areas: areaSetSchema,
  rooms: roomCountsSchema,
  title: safeShortTextSchema,
  description: normalizedCatalogItemSchema.shape.description,
  features: z.array(publicFeatureSchema),
  media: z.array(
    z.object({
      kind: z.enum(["photo", "video"]),
      order: z.number().int().nonnegative(),
      isPrimary: z.boolean(),
      url: publicUrlSchema.nullable(),
      title: safeShortTextSchema.nullable(),
      description: safeTextSchema.nullable(),
    }).strict(),
  ),
}).strict();

export function normalizeCatalogItem(input: unknown): NormalizedCatalogItem {
  const item = copyRecord(input);
  if (!item) {
    return normalizedCatalogItemSchema.parse(input);
  }

  const privateLocation = copyRecord(item.privateLocation);
  if (privateLocation) {
    if (isZeroDecimalValue(privateLocation.number)) {
      privateLocation.number = null;
    }

    const coordinates = copyRecord(privateLocation.coordinates);
    if (
      coordinates &&
      isZeroDecimalValue(coordinates.latitude) &&
      isZeroDecimalValue(coordinates.longitude)
    ) {
      privateLocation.coordinates = null;
    }

    item.privateLocation = privateLocation;
  }

  return normalizedCatalogItemSchema.parse(item);
}

export type DecimalString = z.infer<typeof decimalStringSchema>;
export type CoordinateDecimalString = z.infer<typeof coordinateDecimalStringSchema>;
export type NormalizedCatalogItem = z.infer<typeof normalizedCatalogItemSchema>;
export type PublicCatalogItem = z.infer<typeof publicCatalogItemSchema>;
export type NormalizationAlert = z.infer<typeof normalizationAlertSchema>;
export type PublicationUnit = z.infer<typeof publicationUnitSchema>;
