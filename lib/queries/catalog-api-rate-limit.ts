import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { sql } from '@/lib/db';
import { requireEnv } from '@/lib/env';

export type ApiScope = 'json' | 'image';
export function apiIdentifier(headers: Headers) {
  // Only Vercel's overwritten header is trusted. Local/untrusted proxies share a bucket.
  const value = process.env.VERCEL === '1' ? headers.get('x-vercel-forwarded-for')?.trim() : undefined;
  const ip = value && isIP(value) ? value.toLowerCase() : 'unknown';
  return createHmac('sha256', requireEnv('ADMIN_SESSION_SECRET')).update('catalog-api:v1:').update(ip).digest('hex');
}

export async function consumeApiLimit(identifier: string, scope: ApiScope) {
  if (!/^[a-f0-9]{64}$/.test(identifier) || !['json', 'image'].includes(scope)) throw new Error('INVALID_LIMIT');
  const limit = scope === 'json' ? 120 : 600;
  return sql.begin(async tx => {
    const rows = await tx`insert into catalog_api_rate_limits(identifier_hash,scope,window_start,attempts)
      values(${identifier},${scope},date_trunc('minute',now()),1)
      on conflict(identifier_hash,scope) do update set
        window_start=date_trunc('minute',now()),
        attempts=case when catalog_api_rate_limits.window_start < date_trunc('minute',now()) then 1 else catalog_api_rate_limits.attempts+1 end
      where catalog_api_rate_limits.window_start < date_trunc('minute',now()) or catalog_api_rate_limits.attempts < ${limit}
      returning attempts`;
    await tx`with expired as (
      select identifier_hash, scope from catalog_api_rate_limits
      where window_start < now() - interval '1 day' order by window_start limit 100 for update skip locked
    ) delete from catalog_api_rate_limits r using expired e where r.identifier_hash=e.identifier_hash and r.scope=e.scope`;
    return rows.length > 0;
  });
}
