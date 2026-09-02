import { redirect } from "next/navigation";
import { unsealInviteToken } from "@/lib/auth/invite-cookie";
import { acceptUserInvite, genericInviteRejectionMessage } from "@/lib/queries/invites";

export type AcceptInviteActionState = {
  error?: string;
};

export type AcceptInviteRequestContext = {
  ip: string;
  userAgent: string;
};

export async function consumeSealedInviteToken({
  sealedToken,
  requestContext,
  clearInviteToken,
}: {
  sealedToken?: string;
  requestContext: AcceptInviteRequestContext;
  clearInviteToken: () => void;
}): Promise<AcceptInviteActionState> {
  const token = sealedToken ? await unsealInviteToken(sealedToken) : null;

  if (!token) {
    clearInviteToken();

    return { error: genericInviteRejectionMessage };
  }

  const result = await acceptUserInvite({ token, requestContext });

  if (!result.accepted) {
    clearInviteToken();

    return { error: genericInviteRejectionMessage };
  }

  clearInviteToken();

  redirect("/login?invite=accepted");
}
