import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { yahooConnections } from "@/lib/db/schema";

// Yahoo app is registered as a PUBLIC client: PKCE is mandatory and there is no client
// secret, so token requests authenticate with client_id + code_verifier only.
const AUTHORIZE_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

// Refresh a little early so a token doesn't expire between the check and the API call.
const EXPIRY_SKEW_MS = 60_000;

export function yahooClientId(): string {
  const id = process.env.YAHOO_CLIENT_ID;
  if (!id) throw new Error("YAHOO_CLIENT_ID is not set");
  return id;
}

/**
 * Must exactly match the redirect URI registered on the Yahoo app. Yahoo rejects plain
 * http://localhost, so YAHOO_REDIRECT_URI lets local dev point at an HTTPS tunnel instead
 * of the request's own origin.
 */
export function yahooRedirectUri(requestOrigin: string): string {
  return process.env.YAHOO_REDIRECT_URI ?? `${requestOrigin}/api/yahoo/callback`;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(redirectUri: string, state: string, codeChallenge: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", yahooClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  xoauth_yahoo_guid?: string;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: yahooClientId(), ...params }),
  });
  if (!res.ok) {
    throw new Error(`Yahoo token request failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TokenResponse>;
}

async function saveTokens(userId: string, token: TokenResponse, redirectUri: string): Promise<string> {
  const values = {
    redirectUri,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    ...(token.xoauth_yahoo_guid ? { yahooGuid: token.xoauth_yahoo_guid } : {}),
  };
  await db
    .insert(yahooConnections)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: yahooConnections.userId, set: values });
  return token.access_token;
}

export async function exchangeCodeForTokens(
  userId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<void> {
  const token = await requestToken({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  await saveTokens(userId, token, redirectUri);
}

export async function getYahooConnection(userId: string) {
  const [row] = await db.select().from(yahooConnections).where(eq(yahooConnections.userId, userId));
  return row ?? null;
}

export async function disconnectYahoo(userId: string): Promise<void> {
  await db.delete(yahooConnections).where(eq(yahooConnections.userId, userId));
}

export class YahooNotConnectedError extends Error {
  constructor() {
    super("Yahoo account not connected");
  }
}

/** Returns a usable access token for the user, refreshing (and persisting) it when expired. */
export async function getYahooAccessToken(userId: string): Promise<string> {
  const conn = await getYahooConnection(userId);
  if (!conn) throw new YahooNotConnectedError();
  if (conn.expiresAt.getTime() - EXPIRY_SKEW_MS > Date.now()) return conn.accessToken;

  const token = await requestToken({
    grant_type: "refresh_token",
    refresh_token: conn.refreshToken,
    redirect_uri: conn.redirectUri,
  });
  return saveTokens(userId, token, conn.redirectUri);
}
