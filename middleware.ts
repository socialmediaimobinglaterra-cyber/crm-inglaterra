import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  inviteTokenCookieMaxAgeSeconds,
  inviteTokenCookieName,
  isInviteTokenFormat,
  sealInviteToken,
} from "@/lib/auth/invite-cookie";

export async function middleware(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  const response = token
    ? NextResponse.redirect(new URL("/accept-invite", request.url))
    : NextResponse.next();

  if (token) {
    const sealedToken = isInviteTokenFormat(token) ? await sealInviteToken(token) : null;

    response.cookies.set(inviteTokenCookieName, sealedToken ?? "", {
      httpOnly: true,
      secure:
        request.nextUrl.protocol === "https:" ||
        process.env.NODE_ENV === "production" ||
        process.env.VERCEL_ENV === "production",
      sameSite: "lax",
      path: "/accept-invite",
      maxAge: sealedToken ? inviteTokenCookieMaxAgeSeconds : 0,
    });
  }

  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");

  return response;
}

export const config = {
  matcher: ["/accept-invite"],
};
