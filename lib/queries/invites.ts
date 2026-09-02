import { buildInviteUrl, generateInviteToken, hashInviteToken } from "@/lib/auth/invites";
import { sql } from "@/lib/db";
import { sendUserInviteEmail } from "@/lib/email/resend";
import { recordAuthAuditEventBestEffort } from "@/lib/queries/audit";
import type postgres from "postgres";

export const genericInviteRejectionMessage = "Convite invalido ou expirado.";

export type UserInviteRole = "admin" | "cadastro";

type UserInvite = {
  id: string;
  email: string;
  role: UserInviteRole;
  token_hash: string;
  invited_by: string;
  expires_at: Date;
  sent_at: Date | null;
  used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
};

type InviteAdmin = {
  id: string;
  email: string;
};

type InviteUser = {
  id: string;
  email: string;
  role: UserInviteRole;
  ativo: boolean;
};

type RequestContext = {
  ip: string;
  userAgent: string;
};

type InviteEmailSender = (input: { to: string; inviteUrl: string; role: UserInviteRole }) => Promise<void>;
type Transaction = postgres.TransactionSql<Record<string, never>>;
const inviteCleanupBatchSize = 100;
const closedInviteRetentionWindow = "90 days";

type CreateInviteInput = {
  actorEmail: string;
  email: string;
  role: UserInviteRole;
  requestContext: RequestContext;
  sendEmail?: boolean;
  emailSender?: InviteEmailSender;
  testRunId?: string;
};

type ResendInviteInput = {
  actorEmail: string;
  email: string;
  requestContext: RequestContext;
  sendEmail?: boolean;
  emailSender?: InviteEmailSender;
  testRunId?: string;
};

type RevokeInviteInput = {
  actorEmail: string;
  email: string;
  requestContext: RequestContext;
  testRunId?: string;
};

type AcceptInviteInput = {
  token: string;
  requestContext: RequestContext;
  testRunId?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function assertAllowedDomain(email: string) {
  if (!email.endsWith("@imobiliariainglaterra.com.br")) {
    throw new Error("INVALID_INVITE_EMAIL_DOMAIN");
  }
}

function assertAllowedRole(role: UserInviteRole) {
  if (role !== "admin" && role !== "cadastro") {
    throw new Error("INVALID_INVITE_ROLE");
  }
}

async function requireActiveAdmin(tx: Transaction, actorEmail: string) {
  const admins = await tx<InviteAdmin[]>`
    select id, email
    from usuarios
    where email = ${normalizeEmail(actorEmail)}
      and role = 'admin'
      and ativo = true
    limit 1
  `;

  if (!admins[0]) {
    throw new Error("INVITE_ADMIN_REQUIRED");
  }

  return admins[0];
}

async function assertNotLastActiveAdminMutation(tx: Transaction, email: string, nextRole: UserInviteRole) {
  const users = await tx<InviteUser[]>`
    select id, email, role, ativo
    from usuarios
    where email = ${email}
    limit 1
    for update
  `;
  const user = users[0];

  if (!user || !user.ativo || user.role !== "admin") {
    return;
  }

  const activeAdmins = await tx<{ count: number }[]>`
    select count(*)::int as count
    from usuarios
    where role = 'admin'
      and ativo = true
  `;

  if ((nextRole !== "admin" || user.ativo) && (activeAdmins[0]?.count ?? 0) <= 1) {
    throw new Error("LAST_ACTIVE_ADMIN_PROTECTED");
  }
}

async function createInactiveUserForInvite(tx: Transaction, email: string, role: UserInviteRole) {
  const existingUsers = await tx<InviteUser[]>`
    select id, email, role, ativo
    from usuarios
    where email = ${email}
    limit 1
    for update
  `;
  const existingUser = existingUsers[0];

  if (existingUser?.ativo) {
    await assertNotLastActiveAdminMutation(tx, email, role);
    throw new Error("INVITE_TARGET_ALREADY_ACTIVE");
  }

  const users = await tx<InviteUser[]>`
    insert into usuarios (email, role, ativo)
    values (${email}, ${role}, false)
    on conflict (email) do update
    set role = excluded.role,
        ativo = false
    returning id, email, role, ativo
  `;

  return users[0];
}

export async function cleanupExpiredUserInvites(txClient: Transaction | typeof sql = sql) {
  await txClient`
    with expired_invites as (
      select ctid
      from convites_usuario
      where (
          used_at is not null
          and used_at <= now() - ${closedInviteRetentionWindow}::interval
        )
        or (
          revoked_at is not null
          and revoked_at <= now() - ${closedInviteRetentionWindow}::interval
        )
        or (
          used_at is null
          and revoked_at is null
          and expires_at <= now() - ${closedInviteRetentionWindow}::interval
        )
      order by coalesce(used_at, revoked_at, expires_at)
      limit ${inviteCleanupBatchSize}
      for update skip locked
    )
    delete from convites_usuario
    using expired_invites
    where convites_usuario.ctid = expired_invites.ctid
  `;
}

async function markInviteSent(inviteId: string) {
  await sql`
    update convites_usuario
    set sent_at = now()
    where id = ${inviteId}
      and sent_at is null
      and used_at is null
      and revoked_at is null
  `;
}

async function sendInviteIfNeeded({
  invite,
  token,
  role,
  sendEmail,
  emailSender,
}: {
  invite: UserInvite;
  token: string;
  role: UserInviteRole;
  sendEmail: boolean;
  emailSender: InviteEmailSender;
}) {
  if (!sendEmail) {
    return;
  }

  const inviteUrl = buildInviteUrl(token);
  await emailSender({ to: invite.email, inviteUrl, role });
  await markInviteSent(invite.id);
}

export async function createUserInvite({
  actorEmail,
  email,
  role,
  requestContext,
  sendEmail = true,
  emailSender = sendUserInviteEmail,
  testRunId,
}: CreateInviteInput) {
  const normalizedEmail = normalizeEmail(email);
  assertAllowedRole(role);
  assertAllowedDomain(normalizedEmail);

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);

  const created = await sql.begin(async (tx) => {
    await cleanupExpiredUserInvites(tx);

    const admin = await requireActiveAdmin(tx, actorEmail);

    await createInactiveUserForInvite(tx, normalizedEmail, role);

    await tx`
      update convites_usuario
      set revoked_at = now()
      where email = ${normalizedEmail}
        and used_at is null
        and revoked_at is null
    `;

    const invites = await tx<UserInvite[]>`
      insert into convites_usuario (
        email,
        role,
        token_hash,
        invited_by,
        expires_at,
        test_run_id
      )
      values (
        ${normalizedEmail},
        ${role},
        ${tokenHash},
        ${admin.id},
        now() + interval '48 hours',
        ${testRunId ?? null}
      )
      returning id, email, role, token_hash, invited_by, expires_at, sent_at, used_at, revoked_at, created_at
    `;

    return { admin, invite: invites[0] };
  });

  await sendInviteIfNeeded({
    invite: created.invite,
    token,
    role,
    sendEmail,
    emailSender,
  });

  await recordAuthAuditEventBestEffort({
    eventType: "invite_created",
    reason: "invite_created_by_admin",
    usuarioId: created.admin.id,
    ip: requestContext.ip,
    userAgent: requestContext.userAgent,
    testRunId,
  });

  return {
    inviteId: created.invite.id,
    token,
    sent: sendEmail,
  };
}

export async function resendUserInvite({
  actorEmail,
  email,
  requestContext,
  sendEmail = true,
  emailSender = sendUserInviteEmail,
  testRunId,
}: ResendInviteInput) {
  const normalizedEmail = normalizeEmail(email);
  assertAllowedDomain(normalizedEmail);

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);

  const resent = await sql.begin(async (tx) => {
    await cleanupExpiredUserInvites(tx);

    const admin = await requireActiveAdmin(tx, actorEmail);

    const previousInvites = await tx<UserInvite[]>`
      select id, email, role, token_hash, invited_by, expires_at, sent_at, used_at, revoked_at, created_at
      from convites_usuario
      where email = ${normalizedEmail}
        and used_at is null
        and revoked_at is null
      order by created_at desc
      limit 1
      for update
    `;
    const previousInvite = previousInvites[0];

    if (!previousInvite || previousInvite.expires_at.getTime() <= Date.now()) {
      throw new Error(genericInviteRejectionMessage);
    }

    const users = await tx<InviteUser[]>`
      select id, email, role, ativo
      from usuarios
      where email = ${normalizedEmail}
      limit 1
      for update
    `;
    const user = users[0];

    if (!user || user.ativo) {
      throw new Error(genericInviteRejectionMessage);
    }

    await tx`
      update convites_usuario
      set revoked_at = now()
      where email = ${normalizedEmail}
        and used_at is null
        and revoked_at is null
    `;

    const invites = await tx<UserInvite[]>`
      insert into convites_usuario (
        email,
        role,
        token_hash,
        invited_by,
        expires_at,
        test_run_id
      )
      values (
        ${normalizedEmail},
        ${user.role},
        ${tokenHash},
        ${admin.id},
        now() + interval '48 hours',
        ${testRunId ?? null}
      )
      returning id, email, role, token_hash, invited_by, expires_at, sent_at, used_at, revoked_at, created_at
    `;

    return { admin, invite: invites[0] };
  });

  await sendInviteIfNeeded({
    invite: resent.invite,
    token,
    role: resent.invite.role,
    sendEmail,
    emailSender,
  });

  await recordAuthAuditEventBestEffort({
    eventType: "invite_resent",
    reason: "invite_resent_by_admin",
    usuarioId: resent.admin.id,
    ip: requestContext.ip,
    userAgent: requestContext.userAgent,
    testRunId,
  });

  return {
    inviteId: resent.invite.id,
    token,
    sent: sendEmail,
  };
}

export async function revokeUserInvite({
  actorEmail,
  email,
  requestContext,
  testRunId,
}: RevokeInviteInput) {
  const normalizedEmail = normalizeEmail(email);
  assertAllowedDomain(normalizedEmail);

  const revoked = await sql.begin(async (tx) => {
    await cleanupExpiredUserInvites(tx);

    const admin = await requireActiveAdmin(tx, actorEmail);

    const rows = await tx<{ id: string }[]>`
      update convites_usuario
      set revoked_at = now()
      where email = ${normalizedEmail}
        and used_at is null
        and revoked_at is null
      returning id
    `;

    return { admin, revokedCount: rows.length };
  });

  await recordAuthAuditEventBestEffort({
    eventType: "invite_revoked",
    reason: "invite_revoked_by_admin",
    usuarioId: revoked.admin.id,
    ip: requestContext.ip,
    userAgent: requestContext.userAgent,
    testRunId,
  });

  return { revoked: revoked.revokedCount > 0 };
}

export async function acceptUserInvite({ token, requestContext, testRunId }: AcceptInviteInput) {
  const tokenHash = hashInviteToken(token);

  const accepted = await sql.begin(async (tx) => {
    await cleanupExpiredUserInvites(tx);

    const invites = await tx<UserInvite[]>`
      select id, email, role, token_hash, invited_by, expires_at, sent_at, used_at, revoked_at, created_at
      from convites_usuario
      where token_hash = ${tokenHash}
      limit 1
      for update
    `;
    const invite = invites[0];

    if (
      !invite ||
      invite.used_at ||
      invite.revoked_at ||
      invite.expires_at.getTime() <= Date.now()
    ) {
      return null;
    }

    const users = await tx<InviteUser[]>`
      update usuarios
      set ativo = true
      where email = ${invite.email}
        and role = ${invite.role}
        and ativo = false
      returning id, email, role, ativo
    `;
    const user = users[0];

    if (!user) {
      return null;
    }

    const consumed = await tx<{ id: string }[]>`
      update convites_usuario
      set used_at = now()
      where id = ${invite.id}
        and used_at is null
        and revoked_at is null
        and expires_at > now()
      returning id
    `;

    if (consumed.length !== 1) {
      return null;
    }

    return { invite, user };
  });

  if (!accepted) {
    return { accepted: false, message: genericInviteRejectionMessage };
  }

  await recordAuthAuditEventBestEffort({
    eventType: "invite_accepted",
    reason: "invite_accepted_by_user",
    usuarioId: accepted.user.id,
    ip: requestContext.ip,
    userAgent: requestContext.userAgent,
    testRunId,
  });

  return { accepted: true, redirectTo: "/login" };
}
