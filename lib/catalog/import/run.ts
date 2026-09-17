import { startCatalogImport, applyCatalogSnapshot, failCatalogImport } from "@/lib/queries/catalog-import";
import { CatalogImportError, type CatalogFeedAdapter, type ImportSummary } from "./types";

export async function importCatalog(adapter: CatalogFeedAdapter, chunks: AsyncIterable<string>, sourceKey: string) {
  const run = await startCatalogImport(sourceKey, adapter.key);
  let summary: ImportSummary | undefined;
  try {
    const snapshot = await adapter.read(chunks, sourceKey);
    summary = snapshot.summary;
    const result = await applyCatalogSnapshot(run, snapshot);
    return { summary, result };
  } catch (error) {
    const code = error instanceof CatalogImportError ? error.code : "IMPORT_FAILED";
    await failCatalogImport(run.id, code, summary);
    throw new CatalogImportError(code, { cause: error });
  }
}
