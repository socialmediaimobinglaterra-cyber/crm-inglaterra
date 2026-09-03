import type { Usuario } from "@/lib/queries/auth";
import { recordAuthAuditEventInTransaction } from "@/lib/queries/audit";
import { sql } from "@/lib/db";
import type postgres from "postgres";

export type UsuarioRole = "admin" | "cadastro";

export type AdminUserListItem = Usuario & {
  pending_invites: number;
};

export type PendingInviteListItem = {
  id: string;
  email: string;
  role: UsuarioRole;
  expires_at: Date;
  created_at: Date;
  sent_at: Date | null;
};

export type AdminUsersOverview = {
  currentUser: Usuario;
  users: AdminUserListItem[];
  pendingInvites: PendingInviteListItem[];
};

type Transaction = postgres.TransactionSql<Record<string, never>>;

type RequestContext = {
  ip: string;
  userAgent: string;
};

type UserMutationResult = {
  actorId: string;
  targetId: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUserEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isUsuarioRole(value: string): value is UsuarioRole {
  return value === "admin" || value === "cadastro";
}

function assertAllowedDomain(email: string) {
  if (!email.endsWith("@imobiliariainglaterra.com.br")) {
    throw new Error("INVALID_USER_EMAIL_DOMAIN");
  }
}

export function validateUserId(value: string) {
  const userId = value.trim();

  if (!uuidPattern.test(userId)) {
    throw new Error("INVALID_USER_ID");
  }

  return userId;
}

async function lockAdminMutationUsers(tx: Transaction, actorEmail: string, targetUserId: string) {
  const normalizedActorEmail = normalizeUserEmail(actorEmail);
  const users = await tx<Usuario[]>`
    select id, email, role, ativo, created_at
    from usuarios
    where email = ${normalizedActorEmail}
       or id = ${targetUserId}
    order by id
    for update
  `;
  const actor = users.find((user) => user.email === normalizedActorEmail);
  const target = users.find((user) => user.id === targetUserId);

  if (!actor || actor.role !== "admin" || !actor.ativo) {
    throw new Error("ADMIN_REQUIRED");
  }

  if (!target) {
    throw new Error("USER_NOT_FOUND");
  }

  return { actor, target };
}

async function assertAnotherActiveAdminRemains(tx: Transaction, targetUserId: string) {
  const rows = await tx<{ id: string }[]>`
    select id
    from usuarios
    where role = 'admin'
      and ativo = true
      and id <> ${targetUserId}
    limit 1
    for update
  `;

  if (!rows[0]) {
    throw new Error("LAST_ACTIVE_ADMIN_PROTECTED");
  }
}

export async function requireActiveAdminByEmail(email: string) {
  const users = await sql<Usuario[]>`
    select id, email, role, ativo, created_at
    from usuarios
    where email = ${normalizeUserEmail(email)}
      and role = 'admin'
      and ativo = true
    limit 1
  `;
  const user = users[0];

  if (!user) {
    return null;
  }

  return user;
}

export async function getAdminUsersOverview(actorEmail: string): Promise<AdminUsersOverview | null> {
  const currentUser = await requireActiveAdminByEmail(actorEmail);

  if (!currentUser) {
    return null;
  }

  const [users, pendingInvites] = await Promise.all([
    sql<AdminUserListItem[]>`
      select
        u.id,
        u.email,
        u.role,
        u.ativo,
        u.created_at,
        (
          select count(*)::int
          from convites_usuario c
          where c.email = u.email
            and c.used_at is null
            and c.revoked_at is null
            and c.expires_at > now()
        ) as pending_invites
      from usuarios u
      order by u.ativo desc, u.email asc
    `,
    sql<PendingInviteListItem[]>`
      select id, email, role, expires_at, created_at, sent_at
      from convites_usuario
      where used_at is null
        and revoked_at is null
        and expires_at > now()
      order by expires_at asc, email asc
    `,
  ]);

  return { currentUser, users, pendingInvites };
}

export async function changeUserRole({
  actorEmail,
  targetUserId,
  role,
  requestContext,
  testRunId,
}: {
  actorEmail: string;
  targetUserId: string;
  role: UsuarioRole;
  requestContext: RequestContext;
  testRunId?: string;
}) {
  const validatedTargetUserId = validateUserId(targetUserId);

  if (!isUsuarioRole(role)) {
    throw new Error("INVALID_USER_ROLE");
  }

  await sql.begin<UserMutationResult>(async (tx) => {
    const { actor, target } = await lockAdminMutationUsers(tx, actorEmail, validatedTargetUserId);

    if (actor.id === target.id) {
      throw new Error("SELF_ROLE_CHANGE_BLOCKED");
    }

    if (target.ativo && target.role === "admin" && role !== "admin") {
      await assertAnotherActiveAdminRemains(tx, target.id);
    }

    await tx`
      update usuarios
      set role = ${role}
      where id = ${target.id}
    `;

    await recordAuthAuditEventInTransaction(tx, {
      eventType: "user_role_changed",
      reason: "user_role_changed_by_admin",
      usuarioId: actor.id,
      targetUsuarioId: target.id,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
      testRunId,
    });

    return { actorId: actor.id, targetId: target.id };
  });
}

export async function changeUserStatus({
  actorEmail,
  targetUserId,
  ativo,
  requestContext,
  testRunId,
}: {
  actorEmail: string;
  targetUserId: string;
  ativo: boolean;
  requestContext: RequestContext;
  testRunId?: string;
}) {
  const validatedTargetUserId = validateUserId(targetUserId);

  await sql.begin<UserMutationResult & { eventType: "user_activated" | "user_deactivated"; reason: "user_activated_by_admin" | "user_deactivated_by_admin" }>(
    async (tx) => {
      const { actor, target } = await lockAdminMutationUsers(tx, actorEmail, validatedTargetUserId);

      if (actor.id === target.id && !ativo) {
        throw new Error("SELF_DEACTIVATION_BLOCKED");
      }

      if (!ativo && target.ativo && target.role === "admin") {
        await assertAnotherActiveAdminRemains(tx, target.id);
      }

      await tx`
        update usuarios
        set ativo = ${ativo}
        where id = ${target.id}
      `;

      const eventType = ativo ? "user_activated" : "user_deactivated";
      const reason = ativo ? "user_activated_by_admin" : "user_deactivated_by_admin";

      await recordAuthAuditEventInTransaction(tx, {
        eventType,
        reason,
        usuarioId: actor.id,
        targetUsuarioId: target.id,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
        testRunId,
      });

      return {
        actorId: actor.id,
        targetId: target.id,
        eventType,
        reason,
      };
    },
  );
}

export function validateInviteInput(email: string, role: string) {
  const normalizedEmail = normalizeUserEmail(email);

  if (!normalizedEmail) {
    throw new Error("EMAIL_REQUIRED");
  }

  assertAllowedDomain(normalizedEmail);

  if (!isUsuarioRole(role)) {
    throw new Error("INVALID_USER_ROLE");
  }

  return { email: normalizedEmail, role };
}
