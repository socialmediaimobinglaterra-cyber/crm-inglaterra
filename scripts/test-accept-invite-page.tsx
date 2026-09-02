import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { consumeSealedInviteToken } from "@/lib/auth/accept-invite-action";
import {
  inviteTokenCookieMaxAgeSeconds,
  inviteTokenCookieName,
  sealInviteToken,
  unsealInviteToken,
} from "@/lib/auth/invite-cookie";
import { hashInviteToken } from "@/lib/auth/invites";
import { sql } from "@/lib/db";
import {
  createUserInvite,
  genericInviteRejectionMessage,
  revokeUserInvite,
} from "@/lib/queries/invites";
import { middleware } from "@/middleware";

const testRunId = `accept-invite-page-${randomUUID()}`;
process.env.APP_URL = "https://crm.example.invalid";

const requestContext = {
  ip: "203.0.113.99",
  userAgent: `accept-invite-page-test/${testRunId}`,
};
const actorAdminEmail = `actor-admin-${testRunId}@imobiliariainglaterra.com.br`;

function testEmail(label: string) {
  return `${label}-${testRunId}@imobiliariainglaterra.com.br`;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function emptyFormData() {
  return new FormData();
}

function editableTokenFormData(token: string) {
  const formData = new FormData();
  formData.set("token", token);

  return formData;
}

function redirectDigest(error: unknown) {
  return typeof error === "object" && error && "digest" in error
    ? String((error as { digest: unknown }).digest)
    : "";
}

async function expectLoginRedirect(promise: Promise<unknown>, token: string, tokenHash: string) {
  try {
    await promise;
  } catch (error) {
    const digest = redirectDigest(error);
    assert(digest.includes("NEXT_REDIRECT"), "Successful invite acceptance did not redirect.");
    assert(digest.includes("/login?invite=accepted"), "Successful invite acceptance did not redirect to login.");
    assert(!digest.includes(token), "Redirect response contained the raw invite token.");
    assert(!digest.includes(tokenHash), "Redirect response contained the invite token hash.");

    return;
  }

  throw new Error("Successful invite acceptance returned instead of redirecting.");
}

async function expectGenericRejection(token: string, message: string) {
  const tokenHash = hashInviteToken(token);
  const sealedToken = await sealInviteToken(token);
  assert(sealedToken !== null, "Valid token could not be sealed for rejection test.");
  const state = await consumeSealedInviteToken({
    sealedToken,
    requestContext,
    clearInviteToken: () => undefined,
  });
  const serialized = JSON.stringify(state);

  assert(state.error === genericInviteRejectionMessage, message);
  assert(!serialized.includes(token), "Rejected action response contained the raw invite token.");
  assert(!serialized.includes(tokenHash), "Rejected action response contained the invite token hash.");
  assert(!serialized.includes("INVITE_"), "Rejected action response contained an internal reason.");
}

async function createActorAdmin() {
  await sql`
    insert into usuarios (email, role, ativo)
    values (${actorAdminEmail}, 'admin', true)
  `;
}

async function createInvite(label: string, role: "admin" | "cadastro" = "cadastro") {
  return createUserInvite({
    actorEmail: actorAdminEmail,
    email: testEmail(label),
    role,
    requestContext,
    sendEmail: false,
    testRunId,
  });
}

async function inviteState(token: string) {
  const rows = await sql<{ used_at: Date | null; revoked_at: Date | null; ativo: boolean }[]>`
    select c.used_at, c.revoked_at, u.ativo
    from convites_usuario c
    join usuarios u on u.email = c.email
    where c.token_hash = ${hashInviteToken(token)}
    limit 1
  `;

  return rows[0];
}

async function assertNoTemporaryData() {
  const rows = await sql<{ invites: number; users: number; audit_events: number }[]>`
    select
      (select count(*)::int from convites_usuario where test_run_id = ${testRunId}) as invites,
      (select count(*)::int from usuarios where email like ${`%-${testRunId}@imobiliariainglaterra.com.br`}) as users,
      (
        select count(*)::int
        from auth_audit_events
        where test_run_id = ${testRunId}
           or usuario_id in (
             select id
             from usuarios
             where email like ${`%-${testRunId}@imobiliariainglaterra.com.br`}
           )
      ) as audit_events
  `;

  assert(rows[0].invites === 0, "Temporary invite rows were not removed.");
  assert(rows[0].users === 0, "Temporary users were not removed.");
  assert(rows[0].audit_events === 0, "Temporary audit rows were not removed.");
}

async function main() {
  const rawTokens: string[] = [];

  try {
    await createActorAdmin();

    const getInvite = await createInvite("get-only");
    rawTokens.push(getInvite.token);
    const afterGet = await inviteState(getInvite.token);
    assert(afterGet.used_at === null, "GET consumed the invite.");
    assert(!afterGet.ativo, "GET activated the invited user.");

    const middlewareResponse = await middleware(
      new NextRequest(`https://crm.example.invalid/accept-invite?token=${encodeURIComponent(getInvite.token)}`),
    );
    const location = middlewareResponse.headers.get("location") ?? "";
    const setCookie = middlewareResponse.headers.get("set-cookie") ?? "";
    const sealedCookieValue = /crm_invite_token=([^;]+)/.exec(setCookie)?.[1] ?? "";
    assert(location === "https://crm.example.invalid/accept-invite", "Middleware did not redirect to the clean URL.");
    assert(!location.includes(getInvite.token), "Clean redirect leaked the token.");
    assert(setCookie.includes(inviteTokenCookieName), "Middleware did not set the invite token cookie.");
    assert(!setCookie.includes(getInvite.token), "Invite token cookie leaked the raw token.");
    assert(!setCookie.includes(hashInviteToken(getInvite.token)), "Invite token cookie leaked the token hash.");
    assert(setCookie.includes("HttpOnly"), "Invite token cookie is not HttpOnly.");
    assert(setCookie.includes("Secure"), "Invite token cookie is not Secure on HTTPS.");
    assert(/samesite=lax/i.test(setCookie), "Invite token cookie does not use SameSite=Lax.");
    assert(setCookie.includes("Path=/accept-invite"), "Invite token cookie path is broader than needed.");
    assert(
      setCookie.includes(`Max-Age=${inviteTokenCookieMaxAgeSeconds}`),
      "Invite token cookie exceeds the 48 hour maximum.",
    );
    assert((await unsealInviteToken(sealedCookieValue)) === getInvite.token, "Invite token cookie could not be unsealed.");
    assert(middlewareResponse.headers.get("Referrer-Policy") === "no-referrer", "Referrer-Policy header is missing.");
    assert(middlewareResponse.headers.get("Cache-Control") === "no-store", "Redirect response is publicly cacheable.");

    const finalPageResponse = await middleware(new NextRequest("https://crm.example.invalid/accept-invite"));
    assert(finalPageResponse.headers.get("Referrer-Policy") === "no-referrer", "Final page Referrer-Policy is missing.");
    assert(finalPageResponse.headers.get("Cache-Control") === "no-store", "Final page response is publicly cacheable.");

    const invalidTokenResponse = await middleware(
      new NextRequest(`https://crm.example.invalid/accept-invite?token=${"x".repeat(5000)}`),
    );
    const invalidSetCookie = invalidTokenResponse.headers.get("set-cookie") ?? "";
    assert(invalidSetCookie.includes(`${inviteTokenCookieName}=`), "Invalid token did not replace the cookie.");
    assert(invalidSetCookie.includes("Max-Age=0"), "Invalid token did not clear the invite cookie.");

    const sealedOne = await sealInviteToken(getInvite.token);
    const sealedTwo = await sealInviteToken(getInvite.token);
    assert(sealedOne !== null && sealedTwo !== null && sealedOne !== sealedTwo, "AES-GCM sealing did not use a fresh nonce.");
    assert((await unsealInviteToken("v1.truncated")) === null, "Truncated payload was not rejected.");
    assert((await unsealInviteToken(`${sealedOne.slice(0, -2)}xx`)) === null, "Tampered payload was not rejected.");
    const realDateNow = Date.now;
    Date.now = () => realDateNow() - inviteTokenCookieMaxAgeSeconds * 1000 - 1000;
    const expiredSealedToken = await sealInviteToken(getInvite.token);
    Date.now = realDateNow;
    assert(
      expiredSealedToken !== null && (await unsealInviteToken(expiredSealedToken)) === null,
      "Expired payload was not rejected.",
    );
    const originalSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = `${originalSecret}-other`;
    const otherKeySealedToken = await sealInviteToken(getInvite.token);
    process.env.ADMIN_SESSION_SECRET = originalSecret;
    assert(
      otherKeySealedToken !== null && (await unsealInviteToken(otherKeySealedToken)) === null,
      "Payload from another key was not rejected.",
    );

    const editableOnlyInvite = await createInvite("editable-only");
    rawTokens.push(editableOnlyInvite.token);
    const editableOnlyState = await consumeSealedInviteToken({
      requestContext,
      clearInviteToken: () => undefined,
    });
    const editableOnlyInviteState = await inviteState(editableOnlyInvite.token);
    assert(editableOnlyState.error === genericInviteRejectionMessage, "Editable form token was accepted.");
    assert(editableOnlyInviteState.used_at === null, "Editable form token consumed the invite.");

    const validInvite = await createInvite("valid");
    rawTokens.push(validInvite.token);
    const validSealedToken = await sealInviteToken(validInvite.token);
    assert(validSealedToken !== null, "Valid invite token could not be sealed.");
    await expectLoginRedirect(
      consumeSealedInviteToken({
        sealedToken: validSealedToken,
        requestContext,
        clearInviteToken: () => undefined,
      }),
      validInvite.token,
      hashInviteToken(validInvite.token),
    );
    const afterPost = await inviteState(validInvite.token);
    assert(afterPost.used_at !== null, "POST with valid token did not consume the invite.");
    assert(afterPost.ativo, "POST with valid token did not activate the invited user.");
    await expectGenericRejection(validInvite.token, "Repeated POST was not rejected generically.");

    await expectGenericRejection(`invalid-${randomUUID()}`, "Invalid token was not rejected generically.");

    const expiredInvite = await createInvite("expired");
    rawTokens.push(expiredInvite.token);
    await sql`
      update convites_usuario
      set expires_at = now() - interval '1 minute'
      where token_hash = ${hashInviteToken(expiredInvite.token)}
        and test_run_id = ${testRunId}
    `;
    await expectGenericRejection(expiredInvite.token, "Expired token was not rejected generically.");

    const revokedInvite = await createInvite("revoked");
    rawTokens.push(revokedInvite.token);
    await revokeUserInvite({
      actorEmail: actorAdminEmail,
      email: testEmail("revoked"),
      requestContext,
      testRunId,
    });
    await expectGenericRejection(revokedInvite.token, "Revoked token was not rejected generically.");

    const concurrentInvite = await createInvite("concurrent", "admin");
    rawTokens.push(concurrentInvite.token);
    const concurrentSealedToken = await sealInviteToken(concurrentInvite.token);
    assert(concurrentSealedToken !== null, "Concurrent invite token could not be sealed.");
    const concurrentSettled = await Promise.allSettled([
      consumeSealedInviteToken({
        sealedToken: concurrentSealedToken,
        requestContext,
        clearInviteToken: () => undefined,
      }),
      consumeSealedInviteToken({
        sealedToken: concurrentSealedToken,
        requestContext,
        clearInviteToken: () => undefined,
      }),
    ]);
    const redirectCount = concurrentSettled.filter(
      (result) => result.status === "rejected" && redirectDigest(result.reason).includes("NEXT_REDIRECT"),
    ).length;
    const genericRejectionCount = concurrentSettled.filter(
      (result) => result.status === "fulfilled" && result.value.error === genericInviteRejectionMessage,
    ).length;
    const serializedConcurrent = JSON.stringify(concurrentSettled);
    assert(redirectCount === 1, "Concurrent POST did not produce exactly one successful redirect.");
    assert(genericRejectionCount === 1, "Concurrent POST did not reject the second attempt generically.");
    assert(!rawTokens.some((token) => serializedConcurrent.includes(token)), "Concurrent responses contained a token.");
    assert(
      !rawTokens.some((token) => serializedConcurrent.includes(hashInviteToken(token))),
      "Concurrent responses contained a token hash.",
    );

    const rawTokenRows = await sql<{ matches: number }[]>`
      select count(*)::int as matches
      from convites_usuario
      where test_run_id = ${testRunId}
        and token_hash in ${sql(rawTokens)}
    `;
    assert(rawTokenRows[0].matches === 0, "A raw token was stored in the database.");

    console.log(
      JSON.stringify(
        {
          acceptInvitePage: {
            getDoesNotConsume: true,
            middlewareCleansTokenFromUrl: true,
            referrerPolicyNoReferrer: true,
            cacheControlNoStore: true,
            oversizedTokenClearsCookie: true,
            encryptedCookieRejectsTampering: true,
            encryptedCookieRejectsOtherKey: true,
            encryptedCookieUsesFreshNonce: true,
            actionIgnoresEditableTokenField: true,
            validPostRedirectsToLogin: true,
            repeatedPostRejected: true,
            invalidExpiredRevokedGeneric: true,
            concurrentSuccesses: redirectCount,
            tokenOrHashInActionResponses: false,
            internalReasonInActionResponses: false,
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
    await sql`
      delete from auth_audit_events
      where test_run_id = ${testRunId}
         or usuario_id in (
           select id
           from usuarios
           where email like ${`%-${testRunId}@imobiliariainglaterra.com.br`}
         )
    `;
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
