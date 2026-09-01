import { createHmac } from "node:crypto";
import { requireEnv } from "@/lib/env";

export type RateLimitScope = "email" | "ip";

export function hashRateLimitIdentifier(scope: RateLimitScope, value: string) {
  return createHmac("sha256", requireEnv("ADMIN_SESSION_SECRET"))
    .update(scope)
    .update(":")
    .update(value.trim().toLowerCase())
    .digest("hex");
}
