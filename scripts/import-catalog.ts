import { propertyXmlAdapter } from "@/lib/catalog/import/adapters/property-xml";
import { fetchPropertyFeed } from "@/lib/catalog/import/feed";
import { CatalogImportError } from "@/lib/catalog/import/types";
import { importCatalog } from "@/lib/catalog/import/run";
import { sql } from "@/lib/db";

async function main() {
  if (process.argv.includes("--apply")) {
    console.log(JSON.stringify(await importCatalog(propertyXmlAdapter, fetchPropertyFeed(), "property-feed"), null, 2));
  } else {
    const snapshot = await propertyXmlAdapter.read(fetchPropertyFeed(), "property-feed");
    console.log(JSON.stringify(snapshot.summary, null, 2));
    if (snapshot.summary.rejected) process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof CatalogImportError ? error.code : "CATALOG_IMPORT_FAILED");
  process.exitCode = 1;
}).finally(() => sql.end());
