import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { hashRateLimitIdentifier } from "@/lib/auth/identifiers";
import { sql } from "@/lib/db";
import { requireEnv } from "@/lib/env";
import type postgres from "postgres";

export type AuthAuditEventType =
  | "login_success"
  | "login_rejected"
  | "rate_limit_blocked"
  | "logout"
  | "invite_created"
  | "invite_resent"
  | "invite_revoked"
  | "invite_accepted"
  | "user_activated"
  | "user_deactivated"
  | "user_role_changed";
export type AuthAuditReason =
  | "code_consumed"
  | "invalid_credentials"
  | "request_rate_limited"
  | "validation_rate_limited"
  | "user_logout"
  | "invite_created_by_admin"
  | "invite_resent_by_admin"
  | "invite_revoked_by_admin"
  | "invite_accepted_by_user"
  | "user_activated_by_admin"
  | "user_deactivated_by_admin"
  | "user_role_changed_by_admin";

const auditRetentionWindow = "24 months";
const auditCleanupBatchSize = 100;
const blockDedupeWindowSeconds = 15 * 60;

type AuthAuditInput = {
  eventType: AuthAuditEventType;
  reason: AuthAuditReason;
  usuarioId?: string | null;
  targetUsuarioId?: string | null;
  email?: string | null;
  ip: string;
  userAgent: string;
  dedupeBlockedEvent?: boolean;
  testRunId?: string;
};

type AuditSqlClient = typeof sql | postgres.TransactionSql<Record<string, never>>;

export function normalizeAuditIp(value: string) {
  const normalized = value.trim();

  if (!normalized || normalized === "unknown-ip" || !isIP(normalized)) {
    return null;
  }

  return normalized;
}

function blockDedupeKey(input: {
  reason: AuthAuditReason;
  usuarioId?: string | null;
  emailHash: string | null;
  ip: string;
}) {
  const bucket = Math.floor(Date.now() / 1000 / blockDedupeWindowSeconds);

  return createHmac("sha256", requireEnv("ADMIN_SESSION_SECRET"))
    .update("auth-audit-block")
    .update(":")
    .update(input.reason)
    .update(":")
    .update(input.usuarioId ?? "")
    .update(":")
    .update(input.emailHash ?? "")
    .update(":")
    .update(input.ip)
    .update(":")
    .update(String(bucket))
    .digest("hex");
}

export async function cleanupExpiredAuthAuditEvents() {
  await sql`
    with expired_events as (
      select ctid
      from auth_audit_events
      where created_at <= now() - ${auditRetentionWindow}::interval
      order by created_at
      limit ${auditCleanupBatchSize}
      for update skip locked
    )
    delete from auth_audit_events
    using expired_events
    where auth_audit_events.ctid = expired_events.ctid
  `;
}

async function insertAuthAuditEvent(
  txClient: AuditSqlClient,
  {
  eventType,
  reason,
  usuarioId = null,
  targetUsuarioId = null,
  email = null,
  ip,
  userAgent,
  dedupeBlockedEvent = false,
  testRunId,
}: AuthAuditInput,
) {
  const emailHash = usuarioId ? null : hashRateLimitIdentifier("email", email ?? "");
  const dedupeKey = dedupeBlockedEvent
    ? blockDedupeKey({ reason, usuarioId, emailHash, ip })
    : null;

  await txClient`
    insert into auth_audit_events (
      event_type,
      usuario_id,
      target_usuario_id,
      email_hash,
      ip,
      user_agent,
      reason,
      dedupe_key,
      test_run_id
    )
    values (
      ${eventType},
      ${usuarioId},
      ${targetUsuarioId},
      ${emailHash},
      ${normalizeAuditIp(ip)},
      ${userAgent.slice(0, 512)},
      ${reason},
      ${dedupeKey},
      ${testRunId ?? null}
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing
  `;
}

export async function recordAuthAuditEvent(input: AuthAuditInput) {
  await cleanupExpiredAuthAuditEvents();
  await insertAuthAuditEvent(sql, input);
}

export async function recordAuthAuditEventInTransaction(tx: postgres.TransactionSql<Record<string, never>>, input: AuthAuditInput) {
  await insertAuthAuditEvent(tx, input);
}

export async function recordAuthAuditEventBestEffort(input: AuthAuditInput) {
  try {
    await recordAuthAuditEvent(input);
  } catch (error) {
    console.error("Failed to record auth audit event.", error);
  }
}
