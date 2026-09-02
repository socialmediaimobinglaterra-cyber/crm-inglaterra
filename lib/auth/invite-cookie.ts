import { requireEnv } from "@/lib/env";

export const inviteTokenCookieName = "crm_invite_token";
export const inviteTokenCookieMaxAgeSeconds = 60 * 60 * 48;
const inviteTokenPattern = /^[A-Za-z0-9_-]{32,256}$/;
const inviteCookieKeyContext = "crm-inglaterra:user-invite-cookie:v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type SealedInviteTokenPayload = {
  token: string;
  expiresAt: number;
};

export function isInviteTokenFormat(value: string) {
  return inviteTokenPattern.test(value);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function inviteCookieKey() {
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${inviteCookieKeyContext}:${requireEnv("ADMIN_SESSION_SECRET")}`),
  );

  return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function sealInviteToken(token: string) {
  if (!isInviteTokenFormat(token)) {
    return null;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload: SealedInviteTokenPayload = {
    token,
    expiresAt: Date.now() + inviteTokenCookieMaxAgeSeconds * 1000,
  };
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    await inviteCookieKey(),
    encoder.encode(JSON.stringify(payload)),
  );

  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function unsealInviteToken(value: string) {
  const [version, iv, encrypted] = value.split(".");

  if (version !== "v1" || !iv || !encrypted) {
    return null;
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(iv),
      },
      await inviteCookieKey(),
      base64UrlToBytes(encrypted),
    );
    const payload = JSON.parse(decoder.decode(decrypted)) as Partial<SealedInviteTokenPayload>;

    if (
      typeof payload.token !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now() ||
      !isInviteTokenFormat(payload.token)
    ) {
      return null;
    }

    return payload.token;
  } catch {
    return null;
  }
}
