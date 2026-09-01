import { randomInt, randomUUID } from "node:crypto";
import { hashRateLimitIdentifier } from "@/lib/auth/identifiers";
import { hashLoginCode, verifyLoginCodeHash } from "@/lib/auth/codes";
import { sql } from "@/lib/db";
import { consumeLoginCode, createLoginCode } from "@/lib/queries/auth";
import { recordLoginCodeValidationAttempt } from "@/lib/queries/rate-limit";

const testRunId = `validation-limit-${randomUUID()}`;

function testEmail(label: string) {
  return `${testRunId}-${label}@example.invalid`;
}

function testIp(index: number) {
  return `203.0.113.${index}`;
}

function generateTestCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function differentCode(code: string) {
  return code === "000000" ? "000001" : "000000";
}

function summarize(results: boolean[]) {
  return {
    allowed: results.filter(Boolean).length,
    blocked: results.filter((result) => !result).length,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createTestLoginCode(label: string) {
  const email = testEmail(label);
  const code = generateTestCode();
  await createLoginCode(email, hashLoginCode(email, code));
  return { email, code };
}

async function validateCode(email: string, code: string) {
  return consumeLoginCode(email, (lockedEmail, codeHash) => verifyLoginCodeHash(lockedEmail, code, codeHash));
}

async function getLatestCodeState(email: string) {
  const rows = await sql<
    {
      failed_attempts: number;
      used_at: Date | null;
      invalidated_at: Date | null;
    }[]
  >`
    select failed_attempts, used_at, invalidated_at
    from codigos_login
    where email = ${email}
    order by created_at desc
    limit 1
  `;

  return rows[0];
}

async function validationAttempt(ip: string) {
  const result = await recordLoginCodeValidationAttempt({ ip, testRunId });
  return result.allowed;
}

async function main() {
  try {
    const fourErrors = await createTestLoginCode("four-errors");
    const wrongCode = differentCode(fourErrors.code);
    for (let index = 0; index < 4; index += 1) {
      assert(!(await validateCode(fourErrors.email, wrongCode)), "Wrong code was accepted before the fifth failure.");
    }
    const fourErrorState = await getLatestCodeState(fourErrors.email);
    const correctAfterFourErrors = await validateCode(fourErrors.email, fourErrors.code);
    const consumedAfterFourErrorState = await getLatestCodeState(fourErrors.email);

    const fiveErrors = await createTestLoginCode("five-errors");
    for (let index = 0; index < 5; index += 1) {
      assert(!(await validateCode(fiveErrors.email, wrongCode)), "Wrong code was accepted.");
    }
    const fiveErrorState = await getLatestCodeState(fiveErrors.email);
    const correctAfterFiveErrors = await validateCode(fiveErrors.email, fiveErrors.code);

    const concurrentErrors = await createTestLoginCode("concurrent-errors");
    const concurrentWrongResults = await Promise.all(
      Array.from({ length: 10 }, () => validateCode(concurrentErrors.email, wrongCode)),
    );
    const concurrentErrorState = await getLatestCodeState(concurrentErrors.email);

    const ipLimitResults = [];
    for (let index = 0; index < 21; index += 1) {
      ipLimitResults.push(await validationAttempt(testIp(10)));
    }

    const firstIpResults = [];
    for (let index = 0; index < 20; index += 1) {
      firstIpResults.push(await validationAttempt(testIp(20)));
    }
    const independentIpAllowed = await validationAttempt(testIp(21));

    const concurrentIpResults = await Promise.all(
      Array.from({ length: 30 }, () => validationAttempt(testIp(30))),
    );

    const blockedGrowthIp = testIp(40);
    for (let index = 0; index < 20; index += 1) {
      await validationAttempt(blockedGrowthIp);
    }
    const blockedGrowthResults = await Promise.all(Array.from({ length: 20 }, () => validationAttempt(blockedGrowthIp)));
    const blockedGrowthRows = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_validation_rate_limit_attempts
      where test_run_id = ${testRunId}
        and ip_hash = ${hashRateLimitIdentifier("ip", blockedGrowthIp)}
    `;

    const unrelatedOldIps = Array.from({ length: 125 }, (_, index) => testIp(60 + index));
    const unrelatedFreshIps = Array.from({ length: 3 }, (_, index) => testIp(200 + index));
    for (const ip of unrelatedOldIps) {
      await sql`
        insert into login_validation_rate_limit_attempts (ip_hash, allowed, test_run_id, created_at)
        values (${hashRateLimitIdentifier("ip", ip)}, true, ${testRunId}, now() - interval '16 minutes')
      `;
    }
    for (const ip of unrelatedFreshIps) {
      await sql`
        insert into login_validation_rate_limit_attempts (ip_hash, allowed, test_run_id, created_at)
        values (${hashRateLimitIdentifier("ip", ip)}, true, ${testRunId}, now() - interval '14 minutes')
      `;
    }

    await validationAttempt(testIp(210));
    const oldRowsAfterFirstCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_validation_rate_limit_attempts
      where test_run_id = ${testRunId}
        and created_at <= now() - interval '15 minutes'
    `;
    await validationAttempt(testIp(211));
    const oldRowsAfterSecondCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_validation_rate_limit_attempts
      where test_run_id = ${testRunId}
        and created_at <= now() - interval '15 minutes'
    `;
    const freshRowsAfterCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from login_validation_rate_limit_attempts
      where test_run_id = ${testRunId}
        and created_at > now() - interval '15 minutes'
        and ip_hash in (
          ${hashRateLimitIdentifier("ip", unrelatedFreshIps[0])},
          ${hashRateLimitIdentifier("ip", unrelatedFreshIps[1])},
          ${hashRateLimitIdentifier("ip", unrelatedFreshIps[2])}
        )
    `;

    const rawIpMatches = await sql<{ matches: number }[]>`
      select count(*)::int as matches
      from login_validation_rate_limit_attempts
      where test_run_id = ${testRunId}
        and ip_hash in (${testIp(10)}, ${testIp(20)}, ${testIp(30)}, ${blockedGrowthIp})
    `;

    assert(fourErrorState.failed_attempts === 4, "Four wrong codes did not produce four failures.");
    assert(fourErrorState.invalidated_at === null, "Code was invalidated before the fifth failure.");
    assert(correctAfterFourErrors, "Correct code was rejected after four failures.");
    assert(consumedAfterFourErrorState.used_at !== null, "Correct code was not consumed.");
    assert(fiveErrorState.failed_attempts === 5, "Fifth wrong code did not produce five failures.");
    assert(fiveErrorState.invalidated_at !== null, "Code was not invalidated on the fifth failure.");
    assert(!correctAfterFiveErrors, "Correct code was accepted after five failures.");
    assert(concurrentWrongResults.every((result) => !result), "A concurrent wrong code attempt was accepted.");
    assert(concurrentErrorState.failed_attempts === 5, "Concurrent wrong attempts exceeded five recorded failures.");
    assert(concurrentErrorState.invalidated_at !== null, "Concurrent wrong attempts did not invalidate the code.");
    assert(ipLimitResults.slice(0, 20).every(Boolean) && !ipLimitResults[20], "IP validation limit failed.");
    assert(firstIpResults.every(Boolean) && independentIpAllowed, "Different IPs did not have independent limits.");
    assert(summarize(concurrentIpResults).allowed === 20, "Concurrent IP attempts exceeded 20 permissions.");
    assert(summarize(blockedGrowthResults).blocked === 20, "Blocked IP attempts were unexpectedly allowed.");
    assert(blockedGrowthRows[0].rows === 20, "Blocked IP attempts caused table growth.");
    assert(oldRowsAfterFirstCleanup[0].rows === 25, "Global validation cleanup did not remove one limited batch.");
    assert(oldRowsAfterSecondCleanup[0].rows === 0, "Global validation cleanup did not progress across batches.");
    assert(freshRowsAfterCleanup[0].rows === 3, "Global validation cleanup removed valid rows.");
    assert(rawIpMatches[0].matches === 0, "Raw IP identifiers were found in the database.");

    console.log(
      JSON.stringify(
        {
          codeFailures: {
            fourErrorsRejected: !fourErrorState.invalidated_at,
            correctAfterFourErrors,
            fiveErrorsInvalidated: fiveErrorState.invalidated_at !== null,
            correctAfterFiveErrors,
            concurrentFailures: concurrentErrorState.failed_attempts,
          },
          ipLimit: summarize(ipLimitResults),
          independentIpAllowed,
          concurrentIpLimit: summarize(concurrentIpResults),
          blockedGrowth: {
            ...summarize(blockedGrowthResults),
            storedRows: blockedGrowthRows[0].rows,
          },
          globalCleanup: {
            oldRowsAfterFirstCleanup: oldRowsAfterFirstCleanup[0].rows,
            oldRowsAfterSecondCleanup: oldRowsAfterSecondCleanup[0].rows,
            freshRowsAfterCleanup: freshRowsAfterCleanup[0].rows,
          },
          rawIpIdentifiersFound: rawIpMatches[0].matches,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql`delete from login_validation_rate_limit_attempts where test_run_id = ${testRunId}`;
    await sql`delete from codigos_login where email like ${`${testRunId}-%@example.invalid`}`;
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
