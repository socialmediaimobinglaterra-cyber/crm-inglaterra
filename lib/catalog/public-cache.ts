const TTL_MS = 60_000;
const MAX_ENTRIES = 100;
const MAX_BYTES = 10 * 1024 * 1024;

// Per-instance data cache, never a cache of authorization or HTTP headers.
export function createPublicDataCache(now: () => number = () => performance.now()) {
  const entries = new Map<string, { body: string; expires: number; bytes: number }>();
  let bytes = 0;
  function remove(key: string) {
    const entry = entries.get(key);
    if (entry) { bytes -= entry.bytes; entries.delete(key); }
  }

  return async (key: string, load: () => Promise<unknown>): Promise<string | null> => {
    const started = now();
    for (const [id, entry] of entries) if (entry.expires <= started) remove(id);
    const hit = entries.get(key);
    if (hit) return hit.body;

    const value = await load();
    if (value === null) return null;
    const body = JSON.stringify(value);
    if (body === undefined) throw new Error('INVALID_PUBLIC_DATA');
    const size = Buffer.byteLength(body, 'utf8');
    // Count slow queries/serialization inside the window, not after it.
    const expires = started + TTL_MS;
    if (now() >= expires) throw new Error('PUBLIC_DATA_EXPIRED');
    if (size <= MAX_BYTES && (entries.get(key)?.expires ?? -Infinity) <= expires) {
      remove(key);
      while (entries.size >= MAX_ENTRIES || bytes + size > MAX_BYTES) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        remove(oldest);
      }
      entries.set(key, { body, expires, bytes: size });
      bytes += size;
    }
    return body;
  };
}
