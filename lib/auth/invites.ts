import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

const inviteTokenBytes = 32;

export function generateInviteToken() {
  return randomBytes(inviteTokenBytes).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHmac("sha256", requireEnv("ADMIN_SESSION_SECRET"))
    .update("user-invite-token")
    .update(":")
    .update(token)
    .digest("hex");
}

export function verifyInviteTokenHash(token: string, expectedHash: string) {
  const actualHash = hashInviteToken(token);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function buildInviteUrl(token: string) {
  const url = new URL("/accept-invite", requireEnv("APP_URL"));

  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    url.protocol !== "https:"
  ) {
    throw new Error("APP_URL must use HTTPS in production.");
  }

  url.searchParams.set("token", token);

  return url.toString();
}
