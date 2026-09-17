import type { NormalizedCatalogItem } from "../schemas";

export type ImportSummary = {
  total: number;
  photos: number;
  rejected: number;
  warnings: Record<string, number>;
  errors: Record<string, number>;
};

export type CatalogSnapshot = { items: NormalizedCatalogItem[]; summary: ImportSummary };

export class CatalogImportError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
  }
}

export interface CatalogFeedAdapter {
  readonly key: string;
  read(chunks: AsyncIterable<string>, sourceKey: string): Promise<CatalogSnapshot>;
}
