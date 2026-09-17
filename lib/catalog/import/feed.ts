import { CatalogImportError } from "./types";

export async function* fetchPropertyFeed(): AsyncGenerator<string> {
  const value = process.env.PROPERTY_FEED_URL;
  if (!value) throw new CatalogImportError("FEED_NOT_CONFIGURED");
  let url: URL;
  try { url = new URL(value); } catch { throw new CatalogImportError("FEED_URL_INVALID"); }
  if (url.protocol !== "https:" || url.username || url.password) throw new CatalogImportError("FEED_HTTPS_REQUIRED");
  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(120_000) });
  } catch { throw new CatalogImportError("FEED_DOWNLOAD_FAILED"); }
  if (!response.ok || !response.body) throw new CatalogImportError("FEED_DOWNLOAD_FAILED");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      yield decoder.decode(chunk, { stream: true });
    }
    yield decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
