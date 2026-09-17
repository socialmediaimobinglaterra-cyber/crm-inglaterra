import assert from "node:assert/strict";
import { normalizeCatalogItem, toPublicCatalogItem } from "../lib/catalog";

type FeatureValue = string | number | boolean | null;

type CatalogFixture = {
  source: {
    sourceKey: string;
    externalId: string;
    importedAt: string | null;
    sourceCreatedAt: string | null;
    sourceUpdatedAt: string | null;
  };
  publicCode: string;
  publicationUnits: Array<"premium" | "matriz">;
  origin: "external" | "manual";
  publication: {
    status: "published" | "unpublished" | "pending_review";
    available: boolean;
  };
  negotiation: "venda" | "locacao" | "venda_locacao";
  prices: {
    sale: string | null;
    rent: string | null;
    condominium: string | null;
    iptu: string | null;
  };
  usageCategory:
    | "residencial"
    | "comercial"
    | "rural"
    | "industrial"
    | "corporativa"
    | "unknown";
  taxonomy: {
    normalizedType: string;
    normalizedSubtype: string | null;
    originalType: string;
    originalSubtype: string | null;
  };
  publicLocation: {
    officialNeighborhood: string;
    neighborhoodAlias: string | null;
    city: string;
    state: string;
  };
  privateLocation: {
    street: string | null;
    number: string | null;
    complement: string | null;
    postalCode: string | null;
    coordinates: {
      latitude: string;
      longitude: string;
    } | null;
  };
  areas: {
    unit: "m2" | "ha" | null;
    total: string | null;
    usable: string | null;
    private: string | null;
  };
  rooms: {
    bedrooms: number | null;
    suites: number | null;
    bathrooms: number | null;
    livingRooms: number | null;
    parkingSpaces: number | null;
  };
  title: string;
  description: string | null;
  features: Array<{
    key: string;
    label: string | null;
    value: FeatureValue;
    originalKey: string;
    originalValue: FeatureValue;
    visibility: "public" | "private" | "pending_review";
  }>;
  media: Array<{
    kind: "photo" | "video";
    order: number;
    isPrimary: boolean;
    externalUrl: string;
    originalKind: string | null;
    title: string | null;
    description: string | null;
    migration:
      | {
          status: "external_only" | "pending_blob" | "failed";
          blobKey: null;
          publicUrl: null;
          requiresProxy: true;
        }
      | {
          status: "blob_ready";
          blobKey: string;
          publicUrl: string;
          requiresProxy: boolean;
        };
  }>;
  rawMetadata: Record<string, string | boolean | null>;
  alerts: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    path: string;
    message: string;
  }>;
};

function baseFixture(): CatalogFixture {
  return {
    source: {
      sourceKey: "xml-feed-a",
      externalId: "EXT-001",
      importedAt: "2026-09-04T12:00:00Z",
      sourceCreatedAt: "2026-08-01T09:30:00Z",
      sourceUpdatedAt: "2026-09-01T10:45:00Z",
    },
    publicCode: "PUB-001",
    publicationUnits: ["premium"],
    origin: "external",
    publication: {
      status: "published",
      available: true,
    },
    negotiation: "venda",
    prices: {
      sale: "650000.00",
      rent: null,
      condominium: "650.00",
      iptu: "1200.00",
    },
    usageCategory: "residencial",
    taxonomy: {
      normalizedType: "apartamento",
      normalizedSubtype: "apartamento_padrao",
      originalType: "Apartamento",
      originalSubtype: "Apartamento Residencial",
    },
    publicLocation: {
      officialNeighborhood: "Bairro Oficial",
      neighborhoodAlias: "Bairro Alias",
      city: "Cidade Exemplo",
      state: "pr",
    },
    privateLocation: {
      street: "Rua Privada",
      number: "123",
      complement: "Apto 10",
      postalCode: "00000-000",
      coordinates: {
        latitude: "-23.300000",
        longitude: "-51.160000",
      },
    },
    areas: {
      unit: "m2",
      total: "120.50",
      usable: "95.25",
      private: null,
    },
    rooms: {
      bedrooms: 3,
      suites: 1,
      bathrooms: 2,
      livingRooms: 1,
      parkingSpaces: 2,
    },
    title: "Imovel anonimizado",
    description: "Descricao comercial anonimizada.",
    features: [
      {
        key: "area_servico",
        label: "Area de servico",
        value: true,
        originalKey: "AreaServico",
        originalValue: "1",
        visibility: "public",
      },
    ],
    media: [
      {
        kind: "photo",
        order: 0,
        isPrimary: true,
        externalUrl: "https://media.example.invalid/photo-001.jpg",
        originalKind: "Foto",
        title: "Foto principal",
        description: null,
        migration: {
          status: "blob_ready",
          blobKey: "catalog/photo-001.jpg",
          publicUrl: "https://admin.example.invalid/api/blob-image/catalog/photo-001.jpg",
          requiresProxy: true,
        },
      },
    ],
    rawMetadata: {
      tipoOferta: "1",
      publicaValores: "2",
      tipoLocacao: null,
    },
    alerts: [],
  };
}

function fixture(overrides: (value: CatalogFixture) => void = () => undefined) {
  const value = structuredClone(baseFixture());
  overrides(value);
  return value;
}

function assertRejectsFixture(
  overrides: (value: CatalogFixture) => void,
  message: RegExp,
) {
  assert.throws(() => normalizeCatalogItem(fixture(overrides)), message);
}

function collectKeysAndValues(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value !== "object") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectKeysAndValues(item));
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    key,
    ...collectKeysAndValues(nestedValue),
  ]);
}

const sale = normalizeCatalogItem(fixture());
assert.equal(sale.negotiation, "venda");
assert.equal(sale.prices.sale, "650000.00");

const rent = normalizeCatalogItem(
  fixture((value) => {
    value.negotiation = "locacao";
    value.prices.sale = null;
    value.prices.rent = "3500.00";
  }),
);
assert.equal(rent.negotiation, "locacao");
assert.equal(rent.prices.rent, "3500.00");

const saleAndRent = normalizeCatalogItem(
  fixture((value) => {
    value.negotiation = "venda_locacao";
    value.prices.rent = "4500.00";
  }),
);
assert.equal(saleAndRent.negotiation, "venda_locacao");

assertRejectsFixture((value) => {
  value.prices.rent = "4500.00";
}, /Sale-only negotiation cannot include a positive rent price/);

assertRejectsFixture((value) => {
  value.negotiation = "locacao";
  value.prices.rent = "3500.00";
}, /Rent-only negotiation cannot include a positive sale price/);

const zeroCoordinates = normalizeCatalogItem(
  fixture((value) => {
    value.privateLocation.coordinates = {
      latitude: "0",
      longitude: "0.000",
    };
  }),
);
assert.equal(zeroCoordinates.privateLocation.coordinates, null);

const isolatedZeroCoordinate = normalizeCatalogItem(
  fixture((value) => {
    value.privateLocation.coordinates = {
      latitude: "0",
      longitude: "-51.160000",
    };
  }),
);
assert.equal(isolatedZeroCoordinate.privateLocation.coordinates?.latitude, "0");

const zeroNumber = normalizeCatalogItem(
  fixture((value) => {
    value.privateLocation.number = "0";
  }),
);
assert.equal(zeroNumber.privateLocation.number, null);

const zeroBedrooms = normalizeCatalogItem(
  fixture((value) => {
    value.rooms.bedrooms = 0;
  }),
);
assert.equal(zeroBedrooms.rooms.bedrooms, 0);

const ambiguousField = normalizeCatalogItem(
  fixture((value) => {
    value.alerts = [
      {
        code: "UNKNOWN_SOURCE_CODE",
        severity: "warning",
        path: "rawMetadata.tipoOferta",
        message: "Codigo da origem preservado sem semantica oficial.",
      },
    ];
  }),
);
assert.equal(ambiguousField.alerts[0]?.severity, "warning");
assert.equal(ambiguousField.rawMetadata.tipoOferta, "1");

const unknownFeature = normalizeCatalogItem(
  fixture((value) => {
    value.features.push({
      key: "origem.indefinida",
      label: null,
      value: "valor",
      originalKey: "CaracteristicaSemMapa",
      originalValue: "valor",
      visibility: "pending_review",
    });
  }),
);
assert.equal(unknownFeature.features.at(-1)?.originalKey, "CaracteristicaSemMapa");

const httpPhoto = normalizeCatalogItem(
  fixture((value) => {
    value.media = [
      {
        kind: "photo",
        order: 0,
        isPrimary: true,
        externalUrl: "http://media.example.invalid/photo-http.jpg",
        originalKind: "Foto",
        title: null,
        description: null,
        migration: {
          status: "pending_blob",
          blobKey: null,
          publicUrl: null,
          requiresProxy: true,
        },
      },
    ];
  }),
);
const publicHttpPhoto = toPublicCatalogItem(httpPhoto, "premium");
assert.equal(publicHttpPhoto.media[0]?.url, null);
assert.equal("migrationStatus" in publicHttpPhoto.media[0]!, false);

const safeBlobPhoto = normalizeCatalogItem(
  fixture((value) => {
    value.media[0]!.migration = {
      status: "blob_ready",
      blobKey: "catalog/photo-001.jpg",
      publicUrl: "https://admin.example.invalid/api/blob-image/catalog/photo-001.jpg",
      requiresProxy: true,
    };
  }),
);
const mediaPolicy = { mediaOrigin: "https://admin.example.invalid" };
assert.match(toPublicCatalogItem(safeBlobPhoto, "premium", mediaPolicy).media[0]?.url ?? "", /^https:\/\//);
assert.equal(toPublicCatalogItem(safeBlobPhoto, "premium").media[0]?.url, null);

assertRejectsFixture((value) => {
  value.media[0]!.migration = {
    status: "blob_ready",
    blobKey: "catalog/photo-001.jpg",
    publicUrl: "http://admin.example.invalid/api/blob-image/catalog/photo-001.jpg",
    requiresProxy: true,
  };
}, /Use valid HTTPS URL/);

assertRejectsFixture((value) => {
  value.prices.sale = "-1.00";
}, /Use positive decimal string/);

assertRejectsFixture((value) => {
  value.prices.sale = "0";
}, /Use positive decimal string/);

assertRejectsFixture((value) => {
  value.areas.total = "0";
}, /Use positive decimal string/);

assertRejectsFixture((value) => {
  value.prices.sale = "1e5";
}, /Use positive decimal string/);

assertRejectsFixture((value) => {
  value.prices.sale = "NaN";
}, /Use positive decimal string/);

assertRejectsFixture((value) => {
  value.prices.sale = "Infinity";
}, /Use positive decimal string/);

assertRejectsFixture((value) => {
  value.source.sourceUpdatedAt = "04/09/2026";
}, /Use ISO 8601 date-time/);

assertRejectsFixture((value) => {
  value.source.sourceUpdatedAt = "2026-02-30T12:00:00Z";
}, /Use ISO 8601 date-time/);

assertRejectsFixture((value) => {
  value.media[0]!.externalUrl = "not-a-url";
}, /Use valid HTTP or HTTPS URL/);

assertRejectsFixture((value) => {
  value.rooms.bedrooms = 1.5;
}, /expected int/);

assertRejectsFixture((value) => {
  value.rooms.parkingSpaces = -1;
}, /Too small/);

assertRejectsFixture((value) => {
  value.publicLocation.state = "PR1";
}, /Use valid Brazilian state code/);

assertRejectsFixture((value) => {
  value.source.externalId = "";
}, /Use valid catalog identifier/);

assertRejectsFixture((value) => {
  value.publicCode = "";
}, /Use valid catalog identifier/);

assertRejectsFixture((value) => {
  value.areas.unit = "sqft" as "m2";
}, /Invalid option/);

assertRejectsFixture((value) => {
  value.features[0]!.key = "__proto__";
}, /Use safe structured key/);

assertRejectsFixture((value) => {
  value.features.push({
    key: "area_servico",
    label: "Duplicada",
    value: true,
    originalKey: "OutraOrigem",
    originalValue: "1",
    visibility: "public",
  });
}, /Feature keys must be unique/);

assertRejectsFixture((value) => {
  value.media.push({
    kind: "photo",
    order: 0,
    isPrimary: false,
    externalUrl: "https://media.example.invalid/photo-002.jpg",
    originalKind: "Foto",
    title: null,
    description: null,
    migration: {
      status: "pending_blob",
      blobKey: null,
      publicUrl: null,
      requiresProxy: true,
    },
  });
}, /Media order must be unique and sorted ascending/);

assertRejectsFixture((value) => {
  value.media.push({
    kind: "photo",
    order: 1,
    isPrimary: true,
    externalUrl: "https://media.example.invalid/photo-002.jpg",
    originalKind: "Foto",
    title: null,
    description: null,
    migration: {
      status: "pending_blob",
      blobKey: null,
      publicUrl: null,
      requiresProxy: true,
    },
  });
}, /Only one media item can be primary/);

assertRejectsFixture((value) => {
  value.rawMetadata.endereco = "Rua Privada";
}, /Raw metadata cannot contain private data keys/);

assertRejectsFixture((value) => {
  value.alerts = [
    {
      code: "UNKNOWN_SOURCE_CODE",
      severity: "warning",
      path: "rawMetadata.tipoOferta",
      message: "Contato teste@example.invalid nao deve aparecer.",
    },
  ];
}, /Text contains sensitive content/);

assert.throws(
  () =>
    normalizeCatalogItem({
      ...fixture(),
      unexpectedField: true,
    }),
  /Unrecognized key/,
);

assert.throws(
  () =>
    normalizeCatalogItem(
      fixture((value) => {
        Object.assign(value.publicLocation, { extra: "danger" });
      }),
    ),
  /Unrecognized key/,
);

const publicDto = toPublicCatalogItem(sale, "premium");
assert.equal("privateLocation" in publicDto, false);
const publicDtoText = collectKeysAndValues(publicDto).join("\n");
for (const forbidden of [
  "privateLocation",
  "street",
  "number",
  "complement",
  "postalCode",
  "coordinates",
  "latitude",
  "longitude",
  "rawMetadata",
  "originalValue",
  "originalKey",
  "originalType",
  "alerts",
  "Rua Privada",
  "123",
  "00000-000",
  "Apto 10",
  "corretor",
  "telefone",
  "email",
]) {
  assert.equal(publicDtoText.includes(forbidden), false, `Public DTO leaked ${forbidden}`);
}

assert.equal(normalizeCatalogItem(fixture((value) => {
  value.source.externalId = "0012345";
  value.publicCode = "98765";
})).source.externalId, "0012345");
assertRejectsFixture((value) => { value.publicLocation.state = "ZZ"; }, /Brazilian state/);
assertRejectsFixture((value) => {
  value.features[0]!.value = "person@example.invalid";
}, /Unsafe public feature/);
const privateOriginal = normalizeCatalogItem(fixture((value) => {
  value.features[0]!.originalValue = "person@example.invalid";
}));
assert.equal(JSON.stringify(toPublicCatalogItem(privateOriginal, "premium")).includes("person@"), false);
assert.equal("alerts" in toPublicCatalogItem(ambiguousField, "premium"), false);
assert.throws(() => toPublicCatalogItem(sale, "matriz"), /not published/);
for (const status of ["unpublished", "pending_review"] as const) {
  assert.throws(() => toPublicCatalogItem(normalizeCatalogItem(fixture((value) => {
    value.publication.status = status;
  })), "premium"), /not published/);
}
assert.throws(() => toPublicCatalogItem(normalizeCatalogItem(fixture((value) => {
  value.publication.available = false;
})), "premium"), /not published/);
assertRejectsFixture((value) => { value.publicationUnits = ["premium", "premium"]; }, /Duplicate publication unit/);
for (const url of ["https://external.example.invalid/photo.jpg", "https://admin.example.invalid/other", "https://admin.example.invalid/api/blob-image/photo?token=private"]) {
  const item = normalizeCatalogItem(fixture((value) => {
    value.media[0]!.migration = { status: "blob_ready", blobKey: "photo", publicUrl: url, requiresProxy: true };
  }));
  assert.equal(toPublicCatalogItem(item, "premium", mediaPolicy).media[0]!.url, null);
}
console.log("Catalog contract tests passed");
