"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getSessionFromCookie } from "@/lib/auth/session";
import { getRequestContext } from "@/lib/auth/request-ip";
import { getActiveUserByEmail } from "@/lib/queries/auth";
import { recordAuthAuditEventBestEffort } from "@/lib/queries/audit";

export async function logout() {
  const session = await getSessionFromCookie();

  if (session) {
    try {
      const [user, requestContext] = await Promise.all([
        getActiveUserByEmail(session.email),
        getRequestContext(),
      ]);

      await recordAuthAuditEventBestEffort({
        eventType: "logout",
        reason: "user_logout",
        usuarioId: user?.id,
        email: session.email,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent,
      });
    } catch (error) {
      console.error("Failed to prepare logout audit event.", error);
    }
  }

  await clearSessionCookie();
  redirect("/login");
}
