import { randomUUID } from "node:crypto";
import { hashRateLimitIdentifier, type RateLimitScope } from "@/lib/auth/identifiers";
import { sql } from "@/lib/db";
import { recordLoginCodeRequestAttempt } from "@/lib/queries/rate-limit";

const testRunId = `rate-limit-${randomUUID()}`;

function testEmail(label: string) {
  return `${testRunId}-${label}@example.invalid`;
}

function testIp(index: number) {
  return `198.51.100.${index}`;
}

function summarize(results: boolean[]) {
  return {
    allowed: results.filter(Boolean).length,
    blocked: results.filter((result) => !result).length,
  };
}

async function attempt(email: string, ip: string) {
  const result = await recordLoginCodeRequestAttempt({ email, ip, testRunId });
  return result.allowed;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

type TestIdentifier = {
  scope: RateLimitScope;
  value: string;
};

async function main() {
  try {
    const emailLimitResults = [];
    for (let index = 1; index <= 6; index += 1) {
      emailLimitResults.push(await attempt(testEmail("email-limit"), testIp(index)));
    }

    const ipLimitResults = [];
    for (let index = 1; index <= 6; index += 1) {
      ipLimitResults.push(await attempt(testEmail(`ip-limit-${index}`), testIp(100)));
    }

    const sharedIpResults = [];
    for (let index = 1; index <= 6; index += 1) {
      sharedIpResults.push(await attempt(testEmail(`shared-ip-${index}`), testIp(101)));
    }

    const sharedEmailResults = [];
    for (let index = 1; index <= 6; index += 1) {
      sharedEmailResults.push(await attempt(testEmail("shared-email"), testIp(110 + index)));
    }

    const concurrencyResults = await Promise.all(
      Array.from({ length: 10 }, (_, index) => attempt(testEmail("concurrency"), testIp(130 + index))),
    );

    const oldEmail = testEmail("after-window");
    const oldIp = testIp(150);
    await sql`
      insert into login_rate_limit_attempts (scope, identifier_hash, allowed, test_run_id, created_at)
      values
        ('email', ${hashRateLimitIdentifier("email", oldEmail)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('email', ${hashRateLimitIdentifier("email", oldEmail)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('email', ${hashRateLimitIdentifier("email", oldEmail)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('email', ${hashRateLimitIdentifier("email", oldEmail)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('email', ${hashRateLimitIdentifier("email", oldEmail)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('ip', ${hashRateLimitIdentifier("ip", oldIp)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('ip', ${hashRateLimitIdentifier("ip", oldIp)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('ip', ${hashRateLimitIdentifier("ip", oldIp)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('ip', ${hashRateLimitIdentifier("ip", oldIp)}, true, ${testRunId}, now() - interval '16 minutes'),
        ('ip', ${hashRateLimitIdentifier("ip", oldIp)}, true, ${testRunId}, now() - interval '16 minutes')
    `;
    const afterWindowAllowed = await attempt(oldEmail, oldIp);
    const oldWindowRows = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_rate_limit_attempts
      where test_run_id = ${testRunId}
        and (
          (scope = 'email' and identifier_hash = ${hashRateLimitIdentifier("email", oldEmail)})
          or (scope = 'ip' and identifier_hash = ${hashRateLimitIdentifier("ip", oldIp)})
        )
        and created_at <= now() - interval '15 minutes'
    `;

    const blockedGrowthEmail = testEmail("blocked-growth");
    const blockedGrowthIp = testIp(160);
    for (let index = 1; index <= 5; index += 1) {
      await attempt(blockedGrowthEmail, blockedGrowthIp);
    }
    const blockedGrowthResults = await Promise.all(
      Array.from({ length: 20 }, () => attempt(blockedGrowthEmail, blockedGrowthIp)),
    );
    const blockedGrowthRows = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_rate_limit_attempts
      where test_run_id = ${testRunId}
        and (
          (scope = 'email' and identifier_hash = ${hashRateLimitIdentifier("email", blockedGrowthEmail)})
          or (scope = 'ip' and identifier_hash = ${hashRateLimitIdentifier("ip", blockedGrowthIp)})
        )
    `;

    const unrelatedOldValues: TestIdentifier[] = Array.from({ length: 125 }, (_, index) => ({
      scope: index % 2 === 0 ? "email" : "ip",
      value: index % 2 === 0 ? testEmail(`old-unrelated-${index}`) : testIp(200 + index),
    }));
    const unrelatedFreshValues: TestIdentifier[] = Array.from({ length: 3 }, (_, index) => ({
      scope: index % 2 === 0 ? "email" : "ip",
      value: index % 2 === 0 ? testEmail(`fresh-unrelated-${index}`) : testIp(400 + index),
    }));

    for (const identifier of unrelatedOldValues) {
      await sql`
        insert into login_rate_limit_attempts (scope, identifier_hash, allowed, test_run_id, created_at)
        values (
          ${identifier.scope},
          ${hashRateLimitIdentifier(identifier.scope, identifier.value)},
          true,
          ${testRunId},
          now() - interval '16 minutes'
        )
      `;
    }
    for (const identifier of unrelatedFreshValues) {
      await sql`
        insert into login_rate_limit_attempts (scope, identifier_hash, allowed, test_run_id, created_at)
        values (
          ${identifier.scope},
          ${hashRateLimitIdentifier(identifier.scope, identifier.value)},
          true,
          ${testRunId},
          now() - interval '14 minutes'
        )
      `;
    }

    await attempt(testEmail("global-cleanup-trigger-a"), testIp(500));
    const oldRowsAfterFirstCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_rate_limit_attempts
      where test_run_id = ${testRunId}
        and created_at <= now() - interval '15 minutes'
    `;

    await attempt(testEmail("global-cleanup-trigger-b"), testIp(501));
    const oldRowsAfterSecondCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_rate_limit_attempts
      where test_run_id = ${testRunId}
        and created_at <= now() - interval '15 minutes'
    `;
    const freshRowsAfterCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_rate_limit_attempts
      where test_run_id = ${testRunId}
        and created_at > now() - interval '15 minutes'
        and (
          identifier_hash = ${hashRateLimitIdentifier(unrelatedFreshValues[0].scope, unrelatedFreshValues[0].value)}
          or identifier_hash = ${hashRateLimitIdentifier(unrelatedFreshValues[1].scope, unrelatedFreshValues[1].value)}
          or identifier_hash = ${hashRateLimitIdentifier(unrelatedFreshValues[2].scope, unrelatedFreshValues[2].value)}
        )
    `;

    const rawIdentifierMatches = await sql<{ matches: number }[]>`
      select count(*)::int as matches
      from login_rate_limit_attempts
      where test_run_id = ${testRunId}
        and identifier_hash in (
          ${testEmail("email-limit")},
          ${testEmail("shared-email")},
          ${oldEmail},
          ${testIp(100)},
          ${oldIp}
        )
    `;
    const malformedHashes = await sql<{ malformed: number }[]>`
      select count(*)::int as malformed
      from login_rate_limit_attempts
      where test_run_id = ${testRunId}
        and identifier_hash !~ '^[0-9a-f]{64}$'
    `;

    assert(emailLimitResults.slice(0, 5).every(Boolean) && !emailLimitResults[5], "Email limit failed.");
    assert(ipLimitResults.slice(0, 5).every(Boolean) && !ipLimitResults[5], "IP limit failed.");
    assert(sharedIpResults.slice(0, 5).every(Boolean) && !sharedIpResults[5], "Shared IP limit failed.");
    assert(sharedEmailResults.slice(0, 5).every(Boolean) && !sharedEmailResults[5], "Shared email limit failed.");
    assert(summarize(concurrencyResults).allowed === 5, "Concurrent attempts exceeded 5 permissions.");
    assert(afterWindowAllowed, "Request after the rate limit window was not allowed.");
    assert(oldWindowRows[0].rows === 0, "Old rate limit rows were not cleaned.");
    assert(summarize(blockedGrowthResults).blocked === 20, "Blocked attempts were unexpectedly allowed.");
    assert(blockedGrowthRows[0].rows === 10, "Blocked attempts caused rate limit table growth.");
    assert(oldRowsAfterFirstCleanup[0].rows === 25, "Global cleanup did not remove one limited batch.");
    assert(oldRowsAfterSecondCleanup[0].rows === 0, "Global cleanup did not progress across batches.");
    assert(freshRowsAfterCleanup[0].rows === 3, "Global cleanup removed rows inside the rate limit window.");
    assert(rawIdentifierMatches[0].matches === 0, "Raw identifiers were found in the database.");
    assert(malformedHashes[0].malformed === 0, "Malformed identifier hashes were found.");

    console.log(
      JSON.stringify(
        {
          emailLimit: summarize(emailLimitResults),
          ipLimit: summarize(ipLimitResults),
          sharedIpLimit: summarize(sharedIpResults),
          sharedEmailLimit: summarize(sharedEmailResults),
          concurrentLimit: summarize(concurrencyResults),
          afterWindowAllowed,
          oldWindowRowsLeft: oldWindowRows[0].rows,
          blockedGrowth: {
            ...summarize(blockedGrowthResults),
            storedRows: blockedGrowthRows[0].rows,
          },
          globalCleanup: {
            oldRowsAfterFirstCleanup: oldRowsAfterFirstCleanup[0].rows,
            oldRowsAfterSecondCleanup: oldRowsAfterSecondCleanup[0].rows,
            freshRowsAfterCleanup: freshRowsAfterCleanup[0].rows,
          },
          rawIdentifiersFound: rawIdentifierMatches[0].matches,
          malformedHashesFound: malformedHashes[0].malformed,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql`delete from login_rate_limit_attempts where test_run_id = ${testRunId}`;
  }
}

main()
  .then(async () => {
    await sql.end();
  })
  .catch(async (error) => {
    await sql.end();
    console.error(error.message);
    process.exit(1);
  });
