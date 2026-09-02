"use server";

import { cookies } from "next/headers";
import { inviteTokenCookieName } from "@/lib/auth/invite-cookie";
import { getRequestContext } from "@/lib/auth/request-ip";
import {
  consumeSealedInviteToken,
  type AcceptInviteActionState,
} from "@/lib/auth/accept-invite-action";

async function getInviteCookieStore() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

function clearInviteTokenCookie(cookieStore: Awaited<ReturnType<typeof cookies>> | null) {
  cookieStore?.set(inviteTokenCookieName, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/accept-invite",
    maxAge: 0,
  });
}

export async function acceptInviteAction(
  _previousState: AcceptInviteActionState,
  _formData: FormData,
): Promise<AcceptInviteActionState> {
  const cookieStore = await getInviteCookieStore();
  return consumeSealedInviteToken({
    sealedToken: cookieStore?.get(inviteTokenCookieName)?.value,
    requestContext: await getRequestContext(),
    clearInviteToken: () => clearInviteTokenCookie(cookieStore),
  });
}
