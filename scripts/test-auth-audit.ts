import { randomInt, randomUUID } from "node:crypto";
import { hashRateLimitIdentifier } from "@/lib/auth/identifiers";
import { hashLoginCode, verifyLoginCodeHash } from "@/lib/auth/codes";
import { sql } from "@/lib/db";
import { cleanupExpiredAuthAuditEvents, recordAuthAuditEvent } from "@/lib/queries/audit";
import { consumeLoginCode, createLoginCode } from "@/lib/queries/auth";

const testRunId = `auth-audit-${randomUUID()}`;
const knownEmail = `audit-${randomUUID()}@imobiliariainglaterra.com.br`;
const unknownEmail = `${testRunId}@example.invalid`;
const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
const wrongCode = code === "000000" ? "000001" : "000000";
const auditIp = "203.0.113.240";
const auditIpv6 = "2001:db8::240";
const longUserAgent = `audit-test/${"x".repeat(600)}`;
const cookieMarker = `cookie-${randomUUID()}`;
const credentialMarker = `credential-${randomUUID()}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createKnownUser() {
  const rows = await sql<{ id: string }[]>`
    insert into usuarios (email, role, ativo)
    values (${knownEmail}, 'admin', true)
    returning id
  `;

  return rows[0].id;
}

async function auditRows() {
  return sql<
    {
      event_type: string;
      reason: string;
      usuario_id: string | null;
      email_hash: string | null;
      ip: string | null;
      user_agent_length: number;
    }[]
  >`
    select event_type, reason, usuario_id, email_hash, host(ip) as ip, length(user_agent)::int as user_agent_length
    from auth_audit_events
    where test_run_id = ${testRunId}
    order by created_at, event_type
  `;
}

async function main() {
  try {
    const userId = await createKnownUser();
    await createLoginCode(knownEmail, hashLoginCode(knownEmail, code));

    const rejected = await consumeLoginCode(knownEmail, (email, codeHash) =>
      verifyLoginCodeHash(email, wrongCode, codeHash),
    );
    assert(!rejected, "Wrong code was accepted.");
    await recordAuthAuditEvent({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      usuarioId: userId,
      ip: auditIp,
      userAgent: longUserAgent,
      testRunId,
    });

    const consumed = await consumeLoginCode(knownEmail, (email, codeHash) =>
      verifyLoginCodeHash(email, code, codeHash),
    );
    assert(consumed, "Correct code was not consumed.");
    await recordAuthAuditEvent({
      eventType: "login_success",
      reason: "code_consumed",
      usuarioId: userId,
      ip: auditIp,
      userAgent: longUserAgent,
      testRunId,
    });

    await recordAuthAuditEvent({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email: unknownEmail,
      ip: auditIp,
      userAgent: longUserAgent,
      testRunId,
    });

    for (let index = 0; index < 25; index += 1) {
      await recordAuthAuditEvent({
        eventType: "rate_limit_blocked",
        reason: "validation_rate_limited",
        email: unknownEmail,
        ip: auditIp,
        userAgent: longUserAgent,
        dedupeBlockedEvent: true,
        testRunId,
      });
    }

    await recordAuthAuditEvent({
      eventType: "logout",
      reason: "user_logout",
      usuarioId: userId,
      ip: auditIp,
      userAgent: longUserAgent,
      testRunId,
    });

    await recordAuthAuditEvent({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email: `${testRunId}-ipv6@example.invalid`,
      ip: auditIpv6,
      userAgent: longUserAgent,
      testRunId,
    });

    await recordAuthAuditEvent({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email: `${testRunId}-invalid-ip@example.invalid`,
      ip: "not-an-ip",
      userAgent: longUserAgent,
      testRunId,
    });

    await recordAuthAuditEvent({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email: `${testRunId}-missing-ip@example.invalid`,
      ip: "",
      userAgent: longUserAgent,
      testRunId,
    });

    await recordAuthAuditEvent({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email: `${testRunId}-fallback-ip@example.invalid`,
      ip: "unknown-ip",
      userAgent: longUserAgent,
      testRunId,
    });

    const repeatedBlocks = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from auth_audit_events
      where test_run_id = ${testRunId}
        and event_type = 'rate_limit_blocked'
    `;

    const unknownEmailRows = await sql<{ usuario_id: string | null; email_hash: string | null; raw_matches: number }[]>`
      select usuario_id, email_hash, (case when email_hash = ${unknownEmail} then 1 else 0 end)::int as raw_matches
      from auth_audit_events
      where test_run_id = ${testRunId}
        and reason = 'invalid_credentials'
        and usuario_id is null
      limit 1
    `;

    const rawSensitiveMatches = await sql<{ matches: number }[]>`
      select count(*)::int as matches
      from auth_audit_events
      where test_run_id = ${testRunId}
        and (
          coalesce(email_hash, '') in (${knownEmail}, ${unknownEmail}, ${code}, ${wrongCode}, ${cookieMarker}, ${credentialMarker})
          or user_agent like ${`%${code}%`}
          or user_agent like ${`%${wrongCode}%`}
          or user_agent like ${`%${cookieMarker}%`}
          or user_agent like ${`%${credentialMarker}%`}
        )
    `;

    const ipNormalization = await sql<
      {
        ipv4_preserved: boolean;
        ipv6_preserved: boolean;
        invalid_ip_is_null: boolean;
        missing_ip_is_null: boolean;
        fallback_ip_is_null: boolean;
      }[]
    >`
      select
        exists(
          select 1
          from auth_audit_events
          where test_run_id = ${testRunId}
            and ip = ${auditIp}::inet
        ) as ipv4_preserved,
        exists(
          select 1
          from auth_audit_events
          where test_run_id = ${testRunId}
            and ip = ${auditIpv6}::inet
        ) as ipv6_preserved,
        exists(
          select 1
          from auth_audit_events
          where test_run_id = ${testRunId}
            and email_hash = ${hashRateLimitIdentifier("email", `${testRunId}-invalid-ip@example.invalid`)}
            and ip is null
        ) as invalid_ip_is_null,
        exists(
          select 1
          from auth_audit_events
          where test_run_id = ${testRunId}
            and email_hash = ${hashRateLimitIdentifier("email", `${testRunId}-missing-ip@example.invalid`)}
            and ip is null
        ) as missing_ip_is_null,
        exists(
          select 1
          from auth_audit_events
          where test_run_id = ${testRunId}
            and email_hash = ${hashRateLimitIdentifier("email", `${testRunId}-fallback-ip@example.invalid`)}
            and ip is null
        ) as fallback_ip_is_null
    `;

    const updateTarget = await sql<{ id: string }[]>`
      select id
      from auth_audit_events
      where test_run_id = ${testRunId}
      limit 1
    `;
    let updateBlocked = false;
    try {
      await sql`update auth_audit_events set reason = 'invalid_credentials' where id = ${updateTarget[0].id}`;
    } catch {
      updateBlocked = true;
    }

    for (let index = 0; index < 125; index += 1) {
      await sql`
        insert into auth_audit_events (event_type, email_hash, ip, user_agent, reason, test_run_id, created_at)
        values (
          'login_rejected',
          ${hashRateLimitIdentifier("email", `${testRunId}-old-${index}@example.invalid`)},
          ${auditIp},
          'old-audit-test',
          'invalid_credentials',
          ${testRunId},
          now() - interval '25 months'
        )
      `;
    }
    for (let index = 0; index < 3; index += 1) {
      await sql`
        insert into auth_audit_events (event_type, email_hash, ip, user_agent, reason, test_run_id, created_at)
        values (
          'login_rejected',
          ${hashRateLimitIdentifier("email", `${testRunId}-fresh-${index}@example.invalid`)},
          ${auditIp},
          'fresh-audit-test',
          'invalid_credentials',
          ${testRunId},
          now() - interval '23 months'
        )
      `;
    }

    await cleanupExpiredAuthAuditEvents();
    const oldRowsAfterFirstCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from auth_audit_events
      where test_run_id = ${testRunId}
        and created_at <= now() - interval '24 months'
    `;
    await cleanupExpiredAuthAuditEvents();
    const oldRowsAfterSecondCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from auth_audit_events
      where test_run_id = ${testRunId}
        and created_at <= now() - interval '24 months'
    `;
    const freshRowsAfterCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from auth_audit_events
      where test_run_id = ${testRunId}
        and user_agent = 'fresh-audit-test'
    `;

    const rows = await auditRows();
    const success = rows.find((row) => row.event_type === "login_success");
    const logout = rows.find((row) => row.event_type === "logout");
    const knownRejection = rows.find((row) => row.event_type === "login_rejected" && row.usuario_id === userId);
    const unknownRejection = unknownEmailRows[0];

    assert(success?.usuario_id === userId, "Login success was not linked to the known user.");
    assert(logout?.usuario_id === userId, "Logout was not linked to the known user.");
    assert(knownRejection?.usuario_id === userId, "Known rejection was not linked to the known user.");
    assert(unknownRejection?.usuario_id === null, "Unknown email rejection was linked to a user.");
    assert(unknownRejection?.email_hash === hashRateLimitIdentifier("email", unknownEmail), "Unknown email was not stored as HMAC.");
    assert(unknownRejection.raw_matches === 0, "Unknown raw email was stored.");
    assert(ipNormalization[0].ipv4_preserved, "Valid IPv4 was not preserved.");
    assert(ipNormalization[0].ipv6_preserved, "Valid IPv6 was not preserved.");
    assert(ipNormalization[0].invalid_ip_is_null, "Invalid IP was not stored as null.");
    assert(ipNormalization[0].missing_ip_is_null, "Missing IP was not stored as null.");
    assert(ipNormalization[0].fallback_ip_is_null, "Fallback IP was not stored as null.");
    assert(rows.every((row) => row.user_agent_length <= 512), "User-Agent was not limited.");
    assert(repeatedBlocks[0].rows === 1, "Repeated rate limit blocks caused audit growth.");
    assert(rawSensitiveMatches[0].matches === 0, "Sensitive values were found in audit rows.");
    assert(updateBlocked, "Audit events can be updated.");
    assert(oldRowsAfterFirstCleanup[0].rows === 25, "First retention cleanup did not remove one limited batch.");
    assert(oldRowsAfterSecondCleanup[0].rows === 0, "Retention cleanup did not progress across batches.");
    assert(freshRowsAfterCleanup[0].rows === 3, "Retention cleanup removed events younger than 24 months.");

    console.log(
      JSON.stringify(
        {
          events: {
            success: Boolean(success),
            knownRejection: Boolean(knownRejection),
            unknownRejectionHmacOnly: unknownRejection.raw_matches === 0,
            rateLimitBlocksStored: repeatedBlocks[0].rows,
            logout: Boolean(logout),
          },
          userAgentMaxLength: Math.max(...rows.map((row) => row.user_agent_length)),
          updateBlocked,
          ipNormalization: ipNormalization[0],
          retention: {
            oldRowsAfterFirstCleanup: oldRowsAfterFirstCleanup[0].rows,
            oldRowsAfterSecondCleanup: oldRowsAfterSecondCleanup[0].rows,
            freshRowsAfterCleanup: freshRowsAfterCleanup[0].rows,
          },
          sensitiveValuesFound: rawSensitiveMatches[0].matches,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql`delete from auth_audit_events where test_run_id = ${testRunId}`;
    await sql`delete from codigos_login where email = ${knownEmail}`;
    await sql`delete from usuarios where email = ${knownEmail}`;
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
