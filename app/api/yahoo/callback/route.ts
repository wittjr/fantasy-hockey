import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeForTokens, yahooRedirectUri } from "@/lib/yahoo/oauth";

function backHome(request: NextRequest, yahooStatus: string, detail?: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("yahoo", yahooStatus);
  if (detail) url.searchParams.set("yahooDetail", detail.slice(0, 300));
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
  const yahooError = params.get("error");
  if (yahooError) {
    const description = params.get("error_description");
    console.error("Yahoo authorize returned an error", yahooError, description);
    return backHome(request, "denied", description ? `${yahooError}: ${description}` : yahooError);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !expectedState || !verifier || state !== expectedState) {
    const reason = !code
      ? "no authorization code returned"
      : !expectedState || !verifier
        ? "sign-in cookies missing (expired, or the flow started on a different address)"
        : "state mismatch";
    console.error("Yahoo callback rejected:", reason);
    return backHome(request, "invalid", reason);
  }

  try {
    await exchangeCodeForTokens(session.user.id, code, verifier, yahooRedirectUri(request.nextUrl.origin));
  } catch (err) {
    console.error("Yahoo token exchange failed", err);
    return backHome(request, "error", err instanceof Error ? err.message : String(err));
  }
  return backHome(request, "connected");
}
