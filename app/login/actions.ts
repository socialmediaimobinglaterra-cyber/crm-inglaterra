"use server";

import { redirect } from "next/navigation";
import { generateLoginCode, hashLoginCode, verifyLoginCodeHash } from "@/lib/auth/codes";
import { getRequestContext } from "@/lib/auth/request-ip";
import { setSessionCookie } from "@/lib/auth/session";
import {
  consumeLoginCode,
  createLoginCode,
  getActiveUserByEmail,
} from "@/lib/queries/auth";
import {
  recordLoginCodeRequestAttempt,
  recordLoginCodeValidationAttempt,
} from "@/lib/queries/rate-limit";
import { recordAuthAuditEventBestEffort } from "@/lib/queries/audit";
import { sendLoginCodeEmail } from "@/lib/email/resend";

export type LoginActionState = {
  step: "email" | "code";
  email: string;
  message: string;
  error?: string;
};

const genericEmailMessage = "Se o e-mail existir, voce recebera um codigo em alguns instantes.";
const genericCodeError = "Código inválido ou expirado.";

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function isAllowedDomain(email: string) {
  return email.endsWith("@imobiliariainglaterra.com.br");
}

export async function requestLoginCode(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = normalizeEmail(formData.get("email"));

  if (!email) {
    return {
      step: "email",
      email: "",
      message: "",
      error: "Informe seu e-mail.",
    };
  }

  const requestContext = await getRequestContext();
  const { allowed } = await recordLoginCodeRequestAttempt({
    email,
    ip: requestContext.ip,
  });

  if (!allowed) {
    await recordAuthAuditEventBestEffort({
      eventType: "rate_limit_blocked",
      reason: "request_rate_limited",
      email,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
      dedupeBlockedEvent: true,
    });

    return {
      step: "code",
      email,
      message: genericEmailMessage,
    };
  }

  if (isAllowedDomain(email)) {
    const user = await getActiveUserByEmail(email);

    if (user) {
      const code = generateLoginCode();
      await createLoginCode(email, hashLoginCode(email, code));

      try {
        await sendLoginCodeEmail({ to: email, code });
      } catch (error) {
        console.error("Failed to send login code email.", error);
      }
    } else {
      await recordAuthAuditEventBestEffort({
        eventType: "login_rejected",
        reason: "invalid_credentials",
        email,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
      });
    }
  } else {
    await recordAuthAuditEventBestEffort({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });
  }

  return {
    step: "code",
    email,
    message: genericEmailMessage,
  };
}

export async function verifyLoginCode(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = normalizeEmail(formData.get("email"));
  const code = String(formData.get("code") ?? "").trim();
  const requestContext = await getRequestContext();
  const { allowed } = await recordLoginCodeValidationAttempt({
    ip: requestContext.ip,
  });

  if (!allowed) {
    await recordAuthAuditEventBestEffort({
      eventType: "rate_limit_blocked",
      reason: "validation_rate_limited",
      email,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
      dedupeBlockedEvent: true,
    });

    return {
      step: "code",
      email,
      message: "",
      error: genericCodeError,
    };
  }

  if (!email || !code) {
    await recordAuthAuditEventBestEffort({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return {
      step: "code",
      email,
      message: "",
      error: genericCodeError,
    };
  }

  if (!/^\d{6}$/.test(code)) {
    await recordAuthAuditEventBestEffort({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      email,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return {
      step: "code",
      email,
      message: "",
      error: genericCodeError,
    };
  }

  const user = isAllowedDomain(email) ? await getActiveUserByEmail(email) : null;
  const codeConsumed = user
    ? await consumeLoginCode(email, (lockedEmail, codeHash) => verifyLoginCodeHash(lockedEmail, code, codeHash))
    : false;

  if (!user || !codeConsumed) {
    await recordAuthAuditEventBestEffort({
      eventType: "login_rejected",
      reason: "invalid_credentials",
      usuarioId: user?.id,
      email,
      ip: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return {
      step: "code",
      email,
      message: "",
      error: genericCodeError,
    };
  }

  await recordAuthAuditEventBestEffort({
    eventType: "login_success",
    reason: "code_consumed",
    usuarioId: user.id,
    ip: requestContext.ip,
    userAgent: requestContext.userAgent,
  });

  await setSessionCookie({ email: user.email, role: user.role });

  redirect("/dashboard");
}
