import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

export const sessionCookieName = "crm_admin_session";

export type AdminSession = {
  email: string;
  role: "admin" | "cadastro";
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", requireEnv("ADMIN_SESSION_SECRET")).update(payload).digest("base64url");
}

function verifySignature(payload: string, signature: string) {
  const actual = Buffer.from(sign(payload), "base64url");
  const expected = Buffer.from(signature, "base64url");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(session: Omit<AdminSession, "exp">) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const payload = base64UrlEncode(JSON.stringify({ ...session, exp }));
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function parseSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !verifySignature(payload, signature)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AdminSession;

    if (!session.email || !session.role || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Omit<AdminSession, "exp">) {
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, createSessionToken(session), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromCookie() {
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(sessionCookieName)?.value);
}
