import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeForTokens, yahooRedirectUri } from "@/lib/yahoo/oauth";

function backHome(request: NextRequest, yahooStatus: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("yahoo", yahooStatus);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", request.url));

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("yahoo_oauth_state")?.value;
  const verifier = cookieStore.get("yahoo_pkce_verifier")?.value;
  cookieStore.delete({ name: "yahoo_oauth_state", path: "/api/yahoo" });
  cookieStore.delete({ name: "yahoo_pkce_verifier", path: "/api/yahoo" });

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return backHome(request, "denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    return backHome(request, "invalid");
  }

  try {
    await exchangeCodeForTokens(session.user.id, code, verifier, yahooRedirectUri(request.nextUrl.origin));
  } catch (err) {
    console.error("Yahoo token exchange failed", err);
    return backHome(request, "error");
  }
  return backHome(request, "connected");
}
