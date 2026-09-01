import { hashRateLimitIdentifier } from "@/lib/auth/identifiers";
import { sql } from "@/lib/db";

const maxRequests = 5;
const rateLimitWindow = "15 minutes";
const expiredCleanupBatchSize = 100;

type LoginCodeRateLimitInput = {
  email: string;
  ip: string;
  testRunId?: string;
};

type RateLimitCount = {
  scope: "email" | "ip";
  attempts: number;
};

export async function recordLoginCodeRequestAttempt({
  email,
  ip,
  testRunId,
}: LoginCodeRateLimitInput) {
  const emailHash = hashRateLimitIdentifier("email", email);
  const ipHash = hashRateLimitIdentifier("ip", ip);

  return sql.begin(async (tx) => {
    await tx`
      select pg_advisory_xact_lock(lock_key)
      from (
        select lock_key
        from (
          values
            (hashtextextended(${emailHash}, 0)),
            (hashtextextended(${ipHash}, 0))
        ) as identifiers(lock_key)
        order by lock_key
      ) as ordered_locks
    `;

    await tx`
      delete from login_rate_limit_attempts
      where (
          (scope = 'email' and identifier_hash = ${emailHash})
          or (scope = 'ip' and identifier_hash = ${ipHash})
        )
        and created_at <= now() - ${rateLimitWindow}::interval
    `;

    await tx`
      with expired_attempts as (
        select ctid
        from login_rate_limit_attempts
        where created_at <= now() - ${rateLimitWindow}::interval
        order by created_at
        limit ${expiredCleanupBatchSize}
        for update skip locked
      )
      delete from login_rate_limit_attempts
      using expired_attempts
      where login_rate_limit_attempts.ctid = expired_attempts.ctid
    `;

    const inserted = await tx<{ id: string; scope: "email" | "ip" }[]>`
      insert into login_rate_limit_attempts (scope, identifier_hash, test_run_id)
      values
        ('email', ${emailHash}, ${testRunId ?? null}),
        ('ip', ${ipHash}, ${testRunId ?? null})
      returning id, scope
    `;

    const counts = await tx<RateLimitCount[]>`
      select scope, count(*)::int as attempts
      from login_rate_limit_attempts
      where (
          (scope = 'email' and identifier_hash = ${emailHash})
          or (scope = 'ip' and identifier_hash = ${ipHash})
        )
        and created_at > now() - interval '15 minutes'
      group by scope
    `;
    const emailAttempts = counts.find((count) => count.scope === "email")?.attempts ?? 0;
    const ipAttempts = counts.find((count) => count.scope === "ip")?.attempts ?? 0;
    const allowed = emailAttempts <= maxRequests && ipAttempts <= maxRequests;

    if (allowed) {
      await tx`
        update login_rate_limit_attempts
        set allowed = true
        where id in ${tx(inserted.map((attempt) => attempt.id))}
      `;
    } else {
      await tx`
        delete from login_rate_limit_attempts
        where id in ${tx(inserted.map((attempt) => attempt.id))}
      `;
    }

    return { allowed };
  });
}
