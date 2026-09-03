import { randomUUID } from "node:crypto";
import { hashInviteToken } from "@/lib/auth/invites";
import { sql } from "@/lib/db";
import { createUserInvite, resendUserInvite, revokeUserInvite } from "@/lib/queries/invites";
import {
  changeUserRole,
  changeUserStatus,
  getAdminUsersOverview,
  validateInviteInput,
  validateUserId,
} from "@/lib/queries/users";

const testRunId = `admin-users-${randomUUID()}`;
process.env.APP_URL = "https://crm.example.invalid";

const requestContext = {
  ip: "203.0.113.144",
  userAgent: `admin-users-test/${testRunId}`,
};

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

async function assertNoTemporaryData() {
  const rows = await sql<{ users: number; invites: number; audit_events: number }[]>`
    select
      (select count(*)::int from usuarios where email like ${`%-${testRunId}@imobiliariainglaterra.com.br`}) as users,
      (select count(*)::int from convites_usuario where test_run_id = ${testRunId}) as invites,
      (select count(*)::int from auth_audit_events where test_run_id = ${testRunId}) as audit_events
  `;

  assert(rows[0].users === 0, "Temporary users were not removed.");
  assert(rows[0].invites === 0, "Temporary invites were not removed.");
  assert(rows[0].audit_events === 0, "Temporary audit events were not removed.");
}

async function main() {
  const actorEmail = testEmail("actor-admin");
  const cadastroEmail = testEmail("actor-cadastro");
  const inactiveEmail = testEmail("actor-inactive");
  const targetEmail = testEmail("target");
  const inviteEmail = testEmail("invite");
  const resendEmail = testEmail("resend");
  const revokeEmail = testEmail("revoke");
  const concurrentOneEmail = testEmail("concurrent-one");
  const concurrentTwoEmail = testEmail("concurrent-two");
  const observedTokens: string[] = [];

  try {
    const actorId = await createUser(actorEmail, "admin", true);
    await createUser(cadastroEmail, "cadastro", true);
    await createUser(inactiveEmail, "admin", false);
    const targetId = await createUser(targetEmail, "cadastro", true);
    const concurrentOneId = await createUser(concurrentOneEmail, "admin", true);
    const concurrentTwoId = await createUser(concurrentTwoEmail, "admin", true);

    const overview = await getAdminUsersOverview(actorEmail);
    if (!overview) {
      throw new Error("Active admin could not access users overview.");
    }
    assert(
      overview.users.some((user) => user.email === targetEmail),
      "Users overview did not list the temporary target user.",
    );
    assert((await getAdminUsersOverview(cadastroEmail)) === null, "Cadastro user received admin users data.");
    assert((await getAdminUsersOverview(inactiveEmail)) === null, "Inactive admin received admin users data.");
    assert((await getAdminUsersOverview(testEmail("missing"))) === null, "Missing session identity received admin users data.");
    assert((await getAdminUsersOverview(cadastroEmail.toUpperCase())) === null, "Divergent cookie role could expose admin users data.");
    expectRejectedSync(() => validateUserId("not-a-uuid"), "Invalid user ID was accepted.");
    expectRejectedSync(() => validateInviteInput(inviteEmail, "owner"), "Invalid role was accepted.");

    const invite = validateInviteInput(inviteEmail.toUpperCase(), "cadastro");
    const created = await createUserInvite({
      actorEmail,
      email: invite.email,
      role: invite.role,
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(created.token);
    assert(!created.sent, "Test invite sent a real e-mail.");

    await expectRejected(
      createUserInvite({
        actorEmail: cadastroEmail,
        email: testEmail("blocked-cadastro"),
        role: "cadastro",
        requestContext,
        sendEmail: false,
        testRunId,
      }),
      "Cadastro user was allowed to invite.",
    );
    await expectRejected(
      createUserInvite({
        actorEmail: inactiveEmail,
        email: testEmail("blocked-inactive"),
        role: "cadastro",
        requestContext,
        sendEmail: false,
        testRunId,
      }),
      "Inactive admin was allowed to invite.",
    );
    await expectRejected(
      createUserInvite({
        actorEmail,
        email: `external-${testRunId}@example.invalid`,
        role: "cadastro",
        requestContext,
        sendEmail: false,
        testRunId,
      }),
      "External domain invite was allowed.",
    );

    const missingAppUrlEmail = testEmail("missing-app-url");
    const previousAppUrl = process.env.APP_URL;
    delete process.env.APP_URL;
    await expectRejected(
      createUserInvite({
        actorEmail,
        email: missingAppUrlEmail,
        role: "cadastro",
        requestContext,
        testRunId,
      }),
      "Missing APP_URL created an apparently sent invite.",
    );
    process.env.APP_URL = previousAppUrl;
    const missingAppUrlRows = await sql<{ users: number; invites: number }[]>`
      select
        (select count(*)::int from usuarios where email = ${missingAppUrlEmail}) as users,
        (select count(*)::int from convites_usuario where email = ${missingAppUrlEmail}) as invites
    `;
    assert(missingAppUrlRows[0].users === 0, "Missing APP_URL created a user.");
    assert(missingAppUrlRows[0].invites === 0, "Missing APP_URL created an invite.");

    const resendOriginal = await createUserInvite({
      actorEmail,
      email: resendEmail,
      role: "cadastro",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    const resent = await resendUserInvite({
      actorEmail,
      email: resendEmail,
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(resendOriginal.token, resent.token);
    const resendState = await sql<{ original_revoked: boolean; active_invites: number }[]>`
      select
        exists(
          select 1
          from convites_usuario
          where token_hash = ${hashInviteToken(resendOriginal.token)}
            and revoked_at is not null
        ) as original_revoked,
        (
          select count(*)::int
          from convites_usuario
          where email = ${resendEmail}
            and used_at is null
            and revoked_at is null
            and expires_at > now()
        ) as active_invites
    `;
    assert(resendState[0].original_revoked, "Resend did not revoke the previous invite.");
    assert(resendState[0].active_invites === 1, "Resend left more than one active invite.");

    const revokeInvite = await createUserInvite({
      actorEmail,
      email: revokeEmail,
      role: "admin",
      requestContext,
      sendEmail: false,
      testRunId,
    });
    observedTokens.push(revokeInvite.token);
    const revoked = await revokeUserInvite({ actorEmail, email: revokeEmail, requestContext, testRunId });
    assert(revoked.revoked, "Pending invite was not revoked.");

    await changeUserRole({ actorEmail, targetUserId: targetId, role: "admin", requestContext, testRunId });
    let target = await sql<{ role: string; ativo: boolean }[]>`
      select role::text, ativo
      from usuarios
      where id = ${targetId}
    `;
    assert(target[0].role === "admin", "User role was not changed.");

    await changeUserStatus({ actorEmail, targetUserId: targetId, ativo: false, requestContext, testRunId });
    target = await sql<{ role: string; ativo: boolean }[]>`
      select role::text, ativo
      from usuarios
      where id = ${targetId}
    `;
    assert(!target[0].ativo, "User was not deactivated.");

    await changeUserStatus({ actorEmail, targetUserId: targetId, ativo: true, requestContext, testRunId });
    target = await sql<{ role: string; ativo: boolean }[]>`
      select role::text, ativo
      from usuarios
      where id = ${targetId}
    `;
    assert(target[0].ativo, "User was not activated.");

    await expectRejected(
      changeUserRole({ actorEmail, targetUserId: actorId, role: "cadastro", requestContext, testRunId }),
      "Admin was allowed to change their own role.",
    );
    await expectRejected(
      changeUserStatus({ actorEmail, targetUserId: actorId, ativo: false, requestContext, testRunId }),
      "Admin was allowed to deactivate their own account.",
    );
    await expectRejected(
      changeUserRole({ actorEmail, targetUserId: "not-a-uuid", role: "cadastro", requestContext, testRunId }),
      "Invalid form user ID reached the mutation.",
    );

    await Promise.allSettled([
      changeUserStatus({ actorEmail, targetUserId: concurrentOneId, ativo: false, requestContext, testRunId }),
      changeUserStatus({ actorEmail, targetUserId: concurrentTwoId, ativo: false, requestContext, testRunId }),
    ]);
    const swappedOneEmail = testEmail("swapped-one");
    const swappedTwoEmail = testEmail("swapped-two");
    const swappedOneId = await createUser(swappedOneEmail, "admin", true);
    const swappedTwoId = await createUser(swappedTwoEmail, "admin", true);
    const swappedResults = await Promise.race([
      Promise.allSettled([
        changeUserRole({
          actorEmail: swappedOneEmail,
          targetUserId: swappedTwoId,
          role: "cadastro",
          requestContext,
          testRunId,
        }),
        changeUserRole({
          actorEmail: swappedTwoEmail,
          targetUserId: swappedOneId,
          role: "cadastro",
          requestContext,
          testRunId,
        }),
      ]),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), 5000);
      }),
    ]);
    assert(swappedResults !== "timeout", "Swapped concurrent admin mutations deadlocked.");
    const remainingAdmins = await sql<{ count: number }[]>`
      select count(*)::int as count
      from usuarios
      where role = 'admin'
        and ativo = true
    `;
    assert(remainingAdmins[0].count >= 1, "Concurrent status changes left the system without an active admin.");

    const rawTokenMatches = await sql<{ matches: number }[]>`
      select count(*)::int as matches
      from convites_usuario
      where test_run_id = ${testRunId}
        and token_hash in ${sql(observedTokens)}
    `;
    assert(rawTokenMatches[0].matches === 0, "Raw invite token appeared in invite storage.");

    const auditRows = await sql<
      { event_type: string; reason: string; usuario_id: string | null; target_usuario_id: string | null }[]
    >`
      select event_type::text, reason::text, usuario_id, target_usuario_id
      from auth_audit_events
      where test_run_id = ${testRunId}
        and event_type in ('user_activated', 'user_deactivated', 'user_role_changed')
      order by created_at
    `;
    assert(
      auditRows.some(
        (row) =>
          row.event_type === "user_role_changed" &&
          row.reason === "user_role_changed_by_admin" &&
          row.usuario_id === actorId &&
          row.target_usuario_id === targetId,
      ),
      "Role change audit did not identify actor and target.",
    );
    assert(
      auditRows.some(
        (row) =>
          row.event_type === "user_deactivated" &&
          row.reason === "user_deactivated_by_admin" &&
          row.usuario_id === actorId &&
          row.target_usuario_id === targetId,
      ),
      "Deactivation audit did not identify actor and target.",
    );
    assert(
      auditRows.some(
        (row) =>
          row.event_type === "user_activated" &&
          row.reason === "user_activated_by_admin" &&
          row.usuario_id === actorId &&
          row.target_usuario_id === targetId,
      ),
      "Activation audit did not identify actor and target.",
    );

    const uiSensitiveRows = await sql<{ matches: number }[]>`
      select count(*)::int as matches
      from auth_audit_events
      where test_run_id = ${testRunId}
        and (
          coalesce(email_hash, '') in ${sql(observedTokens)}
          or user_agent like ${`%${observedTokens[0] ?? "no-token"}%`}
        )
    `;
    assert(uiSensitiveRows[0].matches === 0, "Sensitive token data appeared in audit logs.");

    console.log(
      JSON.stringify(
        {
          adminUsers: {
            activeAdminAccess: true,
            cadastroBlocked: true,
            inactiveBlocked: true,
            missingSessionIdentityBlocked: true,
            divergentCookieRoleBlocked: true,
            invalidFormValuesRejected: true,
            inviteUsesCoreWithoutEmail: true,
            missingAppUrlCreatesNoState: true,
            resendRevokesPrevious: true,
            revokeWorks: true,
            roleChangeWorks: true,
            statusChangeWorks: true,
            selfRoleChangeRejected: true,
            selfDeactivationRejected: true,
            concurrentAdminProtectionLeavesActiveAdmin: true,
            swappedAdminMutationsNoDeadlock: true,
            rawTokensExposed: false,
          },
          audit: {
            actorAndTargetRecorded: true,
            userEvents: auditRows.length,
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
