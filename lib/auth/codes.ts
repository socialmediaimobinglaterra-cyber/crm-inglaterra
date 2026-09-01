import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

export function generateLoginCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashLoginCode(email: string, code: string) {
  return createHmac("sha256", requireEnv("ADMIN_SESSION_SECRET"))
    .update(email.toLowerCase())
    .update(":")
    .update(code)
    .digest("hex");
}

export function verifyLoginCodeHash(email: string, code: string, expectedHash: string) {
  const actualHash = hashLoginCode(email, code);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
