import { headers } from "next/headers";

const unknownIpFallback = "unknown-ip";

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function getRequestIpFromHeaders(headerStore: Pick<Headers, "get">) {
  if (process.env.VERCEL === "1") {
    return (
      firstForwardedIp(headerStore.get("x-vercel-forwarded-for")) ??
      firstForwardedIp(headerStore.get("x-forwarded-for")) ??
      unknownIpFallback
    );
  }

  return (
    firstForwardedIp(headerStore.get("x-forwarded-for")) ??
    headerStore.get("x-real-ip") ??
    headerStore.get("cf-connecting-ip") ??
    unknownIpFallback
  );
}

export async function getRequestIp() {
  const headerStore = await headers();

  // In production, trust only the Vercel proxy-provided forwarding chain. If it
  // is absent, every unknown client shares one conservative bucket.
  return getRequestIpFromHeaders(headerStore);
}
