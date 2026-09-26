import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { buildAuthorizeUrl, createPkcePair, yahooRedirectUri } from "@/lib/yahoo/oauth";

// Starts the Yahoo "connect" flow for an already-signed-in (Discord) user. The PKCE
// verifier and state live in short-lived httpOnly cookies until the callback.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", request.url));

  const { verifier, challenge } = createPkcePair();
  const state = randomBytes(24).toString("base64url");

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/api/yahoo",
    maxAge: 600,
  };
  cookieStore.set("yahoo_pkce_verifier", verifier, cookieOptions);
  cookieStore.set("yahoo_oauth_state", state, cookieOptions);

  return NextResponse.redirect(buildAuthorizeUrl(yahooRedirectUri(request.nextUrl.origin), state, challenge));
}
