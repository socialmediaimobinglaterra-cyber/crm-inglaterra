"use server";

import { redirect } from "next/navigation";
import { generateLoginCode, hashLoginCode, verifyLoginCodeHash } from "@/lib/auth/codes";
import { setSessionCookie } from "@/lib/auth/session";
import {
  createLoginCode,
  getActiveUserByEmail,
  getLatestUsableLoginCode,
  markLoginCodeUsed,
} from "@/lib/queries/auth";
import { sendLoginCodeEmail } from "@/lib/email/resend";

export type LoginActionState = {
  step: "email" | "code";
  email: string;
  message: string;
  error?: string;
};

const genericEmailMessage = "Se o e-mail existir, voce recebera um codigo em alguns instantes.";

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
    }
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

  if (!email || !code) {
    return {
      step: "code",
      email,
      message: "",
      error: "Informe o e-mail e o codigo recebido.",
    };
  }

  if (!/^\d{6}$/.test(code)) {
    return {
      step: "code",
      email,
      message: "",
      error: "Codigo invalido ou expirado.",
    };
  }

  const user = isAllowedDomain(email) ? await getActiveUserByEmail(email) : null;
  const loginCode = user ? await getLatestUsableLoginCode(email) : null;

  if (
    !user ||
    !loginCode ||
    loginCode.expires_at.getTime() <= Date.now() ||
    !verifyLoginCodeHash(email, code, loginCode.code_hash)
  ) {
    return {
      step: "code",
      email,
      message: "",
      error: "Codigo invalido ou expirado.",
    };
  }

  await markLoginCodeUsed(loginCode.id);
  await setSessionCookie({ email: user.email, role: user.role });

  redirect("/dashboard");
}
