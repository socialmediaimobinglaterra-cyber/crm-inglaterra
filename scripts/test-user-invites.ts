import { randomUUID } from "node:crypto";
import { buildInviteUrl, hashInviteToken } from "@/lib/auth/invites";
import { sql } from "@/lib/db";
import {
  acceptUserInvite,
  cleanupExpiredUserInvites,
  createUserInvite,
  genericInviteRejectionMessage,
  resendUserInvite,
  revokeUserInvite,
} from "@/lib/queries/invites";

const testRunId = `user-invites-${randomUUID()}`;
process.env.APP_URL = "https://crm.example.invalid";

const requestContext = {
  ip: "203.0.113.88",
  userAgent: `invite-test/${testRunId}`,
};
const realAdminEmail = "socialmedia@imobiliariainglaterra.com.br";
const actorAdminEmail = `actor-admin-${testRunId}@imobiliariainglaterra.com.br`;
const cadastroActorEmail = `actor-cadastro-${testRunId}@imobiliariainglaterra.com.br`;
const inactiveAdminEmail = `actor-inactive-${testRunId}@imobiliariainglaterra.com.br`;

function testEmail(label: string) {
  return `${label}-${testRunId}@imobiliariainglaterra.com.br`;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createUser(email: string, role: "admin" | "cadastro", ativo: boolean) {
  const rows = await sql<{ id: string }[]>`
    insert into usuarios (email, role, ativo)
    values (${email}, ${role}, ${ativo})
    returning id
  `;

  return rows[0].id;
}

async function expectRejected(operation: Promise<unknown>, message: string) {
  let rejected = false;

  try {
    await operation;
  } catch {
    rejected = true;
  }

  assert(rejected, message);
}

function expectRejectedSync(operation: () => unknown, message: string) {
  let rejected = false;

  try {
    operation();
  } catch {
    rejected = true;
  }

  assert(rejected, message);
}

async function assertGenericInvalidInvite(token: string, message: string) {
  const result = await acceptUserInvite({ token, requestContext, testRunId });

  assert(!result.accepted, message);
  assert(result.message === genericInviteRejectionMessage, "Invalid invite did not return the generic message.");
}

async function assertNoRawTokenStored(tokens: string[]) {
  const rows = await sql<{ matches: number; malformed_hashes: number }[]>`
    select
      count(*) filter (where token_hash in ${sql(tokens)})::int as matches,
      count(*) filter (where token_hash !~ '^[0-9a-f]{64}$')::int as malformed_hashes
    from convites_usuario
    where test_run_id = ${testRunId}
  `;

  assert(rows[0].matches === 0, "A raw invite token was stored.");
  assert(rows[0].malformed_hashes === 0, "An invite token hash was not hex SHA-256.");
}

async function assertAuditEvents() {
  const rows = await sql<{ event_type: string; rows: number }[]>`
    select event_type::text, count(*)::int as rows
    from auth_audit_events
    where test_run_id = ${testRunId}
      and event_type in ('invite_created', 'invite_resent', 'invite_revoked', 'invite_accepted')
    group by event_type
  `;
  const counts = new Map(rows.map((row) => [row.event_type, row.rows]));

  assert((counts.get("invite_created") ?? 0) > 0, "Invite creation was not audited.");
  assert((counts.get("invite_resent") ?? 0) > 0, "Invite resend was not audited.");
  assert((counts.get("invite_revoked") ?? 0) > 0, "Invite revocation was not audited.");
  assert((counts.get("invite_accepted") ?? 0) > 0, "Invite acceptance was not audited.");
}

async function assertNoTemporaryData() {
  const rows = await sql<{ invites: number; users: number; audit_events: number }[]>`
    select
      (select count(*)::int from convites_usuario where test_run_id = ${testRunId}) as invites,
      (select count(*)::int from usuarios where email like ${`%-${testRunId}@imobiliariainglaterra.com.br`}) as users,
      (select count(*)::int from auth_audit_events where test_run_id = ${testRunId}) as audit_events
  `;

  assert(rows[0].invites === 0, "Temporary invite rows were not removed.");
  assert(rows[0].users === 0, "Temporary users were not removed.");
  assert(rows[0].audit_events === 0, "Temporary audit rows were not removed.");
}

async function main() {
  const observedTokens: string[] = [];

  try {
    const activeAdmins = await sql<{ count: number }[]>`
      select count(*)::int as count
      from usuarios
      where role = 'admin'
        and ativo = true
    `;

    if (activeAdmins[0].count === 1) {
      await expectRejected(
        createUserInvite({
          actorEmail: realAdminEmail,
          email: realAdminEmail,
          role: "cadastro",
          requestContext,
          sendEmail: false,
          testRunId,
        }),
        "The last active admin could be demoted or deactivated through an invite.",
      );
    }

    await createUser(actorAdminEmail, "admin", true);
    await createUser(cadastroActorEmail, "cadastro", true);
    await createUser(inactiveAdminEmail, "admin", false);

    const validInviteEmail = testEmail("valid");
    const created = await createUserInvite({
      actorEmail: actorAdminEmail,
      email: validInviteEmail,
      role: "cadastro",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(created.token);
    assert(!created.sent, "Invite without e-mail sending was marked as sent.");

    const alreadyActiveEmail = testEmail("already-active");
    await createUser(alreadyActiveEmail, "admin", true);
    await expectRejected(
      createUserInvite({
        actorEmail: actorAdminEmail,
        email: alreadyActiveEmail,
        role: "cadastro",
        requestContext,
        sendEmail: false,
        testRunId,
      }),
      "An active user was silently changed or invited.",
    );
    const activeUserAfterInviteAttempt = await sql<{ role: string; ativo: boolean; invites: number }[]>`
      select
        u.role::text as role,
        u.ativo,
        (
          select count(*)::int
          from convites_usuario c
          where c.email = u.email
            and c.used_at is null
            and c.revoked_at is null
            and c.expires_at > now()
        ) as invites
      from usuarios u
      where u.email = ${alreadyActiveEmail}
      limit 1
    `;
    assert(activeUserAfterInviteAttempt[0].ativo, "Active user was deactivated by invite attempt.");
    assert(activeUserAfterInviteAttempt[0].role === "admin", "Active user role was changed by invite attempt.");
    assert(activeUserAfterInviteAttempt[0].invites === 0, "A valid invite was created for an active user.");

    await expectRejected(
      createUserInvite({
        actorEmail: cadastroActorEmail,
        email: testEmail("blocked-cadastro"),
        role: "cadastro",
        requestContext,
        sendEmail: false,
        testRunId,
      }),
      "A cadastro user was allowed to invite.",
    );
    await expectRejected(
      createUserInvite({
        actorEmail: inactiveAdminEmail,
        email: testEmail("blocked-inactive"),
        role: "cadastro",
        requestContext,
        sendEmail: false,
        testRunId,
      }),
      "An inactive admin was allowed to invite.",
    );
    await expectRejected(
      createUserInvite({
        actorEmail: actorAdminEmail,
        email: `external-${testRunId}@example.invalid`,
        role: "cadastro",
        requestContext,
        sendEmail: false,
        testRunId,
      }),
      "External domain was allowed.",
    );

    const accepted = await acceptUserInvite({ token: created.token, requestContext, testRunId });
    assert(accepted.accepted, "Valid invite token was not accepted.");
    assert(accepted.redirectTo === "/login", "Accepted invite did not point to login.");

    const activatedUser = await sql<{ role: string; ativo: boolean }[]>`
      select role::text, ativo
      from usuarios
      where email = ${validInviteEmail}
      limit 1
    `;
    assert(activatedUser[0].role === "cadastro", "Accepted invite did not apply the selected role.");
    assert(activatedUser[0].ativo, "Accepted invite did not activate the user.");

    await assertGenericInvalidInvite(created.token, "Used invite token was accepted again.");
    await assertGenericInvalidInvite(`invalid-${created.token}`, "Invalid invite token was accepted.");

    const expired = await createUserInvite({
      actorEmail: actorAdminEmail,
      email: testEmail("expired"),
      role: "cadastro",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(expired.token);
    await sql`
      update convites_usuario
      set expires_at = now() - interval '1 minute'
      where token_hash = ${hashInviteToken(expired.token)}
        and test_run_id = ${testRunId}
    `;
    await assertGenericInvalidInvite(expired.token, "Expired invite token was accepted.");

    const revoked = await createUserInvite({
      actorEmail: actorAdminEmail,
      email: testEmail("revoked"),
      role: "cadastro",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(revoked.token);
    const revokedResult = await revokeUserInvite({
      actorEmail: actorAdminEmail,
      email: testEmail("revoked"),
      requestContext,
      testRunId,
    });
    assert(revokedResult.revoked, "Invite revocation did not affect an active invite.");
    await assertGenericInvalidInvite(revoked.token, "Revoked invite token was accepted.");

    const resendEmail = testEmail("resend");
    const original = await createUserInvite({
      actorEmail: actorAdminEmail,
      email: resendEmail,
      role: "cadastro",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    const resent = await resendUserInvite({
      actorEmail: actorAdminEmail,
      email: resendEmail,
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(original.token, resent.token);
    await assertGenericInvalidInvite(original.token, "Original invite token remained valid after resend.");
    const resentAccepted = await acceptUserInvite({ token: resent.token, requestContext, testRunId });
    assert(resentAccepted.accepted, "Resent invite token was not accepted.");

    const staleEmail = testEmail("stale-admin-change");
    const staleInvite = await createUserInvite({
      actorEmail: actorAdminEmail,
      email: staleEmail,
      role: "cadastro",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(staleInvite.token);
    await sql`
      update usuarios
      set role = 'admin'
      where email = ${staleEmail}
        and ativo = false
    `;
    const staleAccepted = await acceptUserInvite({ token: staleInvite.token, requestContext, testRunId });
    assert(!staleAccepted.accepted, "Invite acceptance overwrote a later administrative role change.");
    const staleUser = await sql<{ role: string; ativo: boolean }[]>`
      select role::text, ativo
      from usuarios
      where email = ${staleEmail}
      limit 1
    `;
    assert(staleUser[0].role === "admin", "Later administrative role change was overwritten.");
    assert(!staleUser[0].ativo, "Stale invite activated a user after administrative change.");

    const failedSendEmail = testEmail("failed-send");
    await expectRejected(
      createUserInvite({
        actorEmail: actorAdminEmail,
        email: failedSendEmail,
        role: "cadastro",
        requestContext,
        emailSender: async () => {
          throw new Error("simulated-send-failure");
        },
        testRunId,
      }),
      "Resend failure did not reject invite creation.",
    );
    const failedSendState = await sql<{ sent_at: Date | null; active_invites: number }[]>`
      select sent_at,
        (
          select count(*)::int
          from convites_usuario
          where email = ${failedSendEmail}
            and used_at is null
            and revoked_at is null
        ) as active_invites
      from convites_usuario
      where email = ${failedSendEmail}
        and test_run_id = ${testRunId}
      order by created_at desc
      limit 1
    `;
    assert(failedSendState[0].sent_at === null, "Failed send filled sent_at.");
    assert(failedSendState[0].active_invites === 1, "Failed send did not leave a safely resendable invite state.");
    const resentAfterFailure = await resendUserInvite({
      actorEmail: actorAdminEmail,
      email: failedSendEmail,
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(resentAfterFailure.token);
    assert(!resentAfterFailure.sent, "Resend without e-mail sending was marked as sent.");

    const concurrent = await createUserInvite({
      actorEmail: actorAdminEmail,
      email: testEmail("concurrent"),
      role: "admin",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(concurrent.token);
    const concurrentResults = await Promise.all([
      acceptUserInvite({ token: concurrent.token, requestContext, testRunId }),
      acceptUserInvite({ token: concurrent.token, requestContext, testRunId }),
    ]);
    assert(
      concurrentResults.filter((result) => result.accepted).length === 1,
      "Concurrent invite acceptance allowed more than one success.",
    );

    await assertNoRawTokenStored(observedTokens);
    await assertAuditEvents();

    const validAppUrl = process.env.APP_URL;
    process.env.APP_URL = "not-a-url";
    expectRejectedSync(() => buildInviteUrl("token"), "APP_URL accepted a non-absolute URL.");
    const previousVercelEnv = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = "http://crm.example.invalid";
    expectRejectedSync(() => buildInviteUrl("token"), "Production APP_URL accepted HTTP.");
    process.env.VERCEL_ENV = previousVercelEnv;
    process.env.APP_URL = validAppUrl;

    for (let index = 0; index < 125; index += 1) {
      const closedState = index % 3;

      await sql`
        insert into convites_usuario (
          email,
          role,
          token_hash,
          invited_by,
          expires_at,
          used_at,
          revoked_at,
          test_run_id
        )
        values (
          ${testEmail(`old-closed-${index}`)},
          'cadastro',
          ${hashInviteToken(`old-closed-token-${testRunId}-${index}`)},
          (select id from usuarios where email = ${actorAdminEmail}),
          now() - interval '91 days',
          ${closedState === 0 ? sql`now() - interval '91 days'` : null},
          ${closedState === 1 ? sql`now() - interval '91 days'` : null},
          ${testRunId}
        )
      `;
    }
    for (const state of ["recent-used", "recent-revoked", "recent-expired", "active"]) {
      await sql`
        insert into convites_usuario (
          email,
          role,
          token_hash,
          invited_by,
          expires_at,
          used_at,
          revoked_at,
          test_run_id
        )
        values (
          ${testEmail(state)},
          'cadastro',
          ${hashInviteToken(`fresh-retained-token-${testRunId}-${state}`)},
          (select id from usuarios where email = ${actorAdminEmail}),
          ${state === "active" ? sql`now() + interval '48 hours'` : sql`now() - interval '89 days'`},
          ${state === "recent-used" ? sql`now() - interval '89 days'` : null},
          ${state === "recent-revoked" ? sql`now() - interval '89 days'` : null},
          ${testRunId}
        )
      `;
    }
    await cleanupExpiredUserInvites();
    const oldRowsAfterFirstCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from convites_usuario
      where test_run_id = ${testRunId}
        and email like ${`old-closed-%-${testRunId}@imobiliariainglaterra.com.br`}
    `;
    await cleanupExpiredUserInvites();
    const oldRowsAfterSecondCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from convites_usuario
      where test_run_id = ${testRunId}
        and email like ${`old-closed-%-${testRunId}@imobiliariainglaterra.com.br`}
    `;
    const retainedRowsAfterCleanup = await sql<{ rows: number }[]>`
      select count(*)::int as rows
      from convites_usuario
      where test_run_id = ${testRunId}
        and email in (
          ${testEmail("recent-used")},
          ${testEmail("recent-revoked")},
          ${testEmail("recent-expired")},
          ${testEmail("active")}
        )
    `;
    assert(oldRowsAfterFirstCleanup[0].rows === 25, "Invite cleanup did not remove one limited batch.");
    assert(oldRowsAfterSecondCleanup[0].rows === 0, "Invite cleanup did not progress across batches.");
    assert(retainedRowsAfterCleanup[0].rows === 4, "Invite cleanup removed recent or active invites.");

    console.log(
      JSON.stringify(
        {
          inviteCore: {
            activeAdminCanInvite: true,
            activeUserNotChangedOrInvited: true,
            cadastroCannotInvite: true,
            inactiveAdminCannotInvite: true,
            externalDomainRejected: true,
            validTokenActivatesUser: true,
            invalidExpiredUsedRevokedRejected: true,
            resendInvalidatesPreviousToken: true,
            laterAdminChangeNotOverwritten: true,
            concurrentAcceptanceSuccesses: concurrentResults.filter((result) => result.accepted).length,
            rawTokensStored: false,
            lastActiveAdminProtectedWhenApplicable: activeAdmins[0].count === 1,
          },
          appUrl: {
            absoluteUrlRequired: true,
            httpsRequiredInProduction: true,
          },
          emailDelivery: {
            failedSendDoesNotMarkSent: true,
            failedSendCanBeResentSafely: true,
          },
          audit: {
            createdResentRevokedAccepted: true,
          },
          retention: {
            oldRowsAfterFirstCleanup: oldRowsAfterFirstCleanup[0].rows,
            oldRowsAfterSecondCleanup: oldRowsAfterSecondCleanup[0].rows,
            retainedRecentAndActiveRows: retainedRowsAfterCleanup[0].rows,
          },
          cleanup: {
            testDataRemovedInFinally: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await sql`delete from auth_audit_events where test_run_id = ${testRunId}`;
    await sql`delete from convites_usuario where test_run_id = ${testRunId}`;
    await sql`delete from usuarios where email like ${`%-${testRunId}@imobiliariainglaterra.com.br`}`;
    await assertNoTemporaryData();
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
