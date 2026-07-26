export const DIRECT_INSTAGRAM_PLATFORM = "instagram";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages"
];

export type InstagramTokenResponse = {
  access_token: string;
  user_id?: string | number;
  permissions?: string;
};

export type InstagramLongLivedTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type InstagramProfile = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  account_type?: string;
};

function getGraphVersion() {
  return process.env.INSTAGRAM_GRAPH_VERSION || process.env.META_GRAPH_VERSION || "v23.0";
}

function getClientConfig() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Instagram API credentials are missing. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET to .env.local."
    );
  }

  return { appId, appSecret };
}

export function getInstagramRedirectUri(origin: string) {
  return `${origin}/auth/instagram/callback`;
}

export function buildInstagramOAuthUrl(origin: string, state: string) {
  const { appId } = getClientConfig();
  const url = new URL("https://www.instagram.com/oauth/authorize");

  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", getInstagramRedirectUri(origin));
  url.searchParams.set("state", state);
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("force_authentication", "1");
  url.searchParams.set("enable_fb_login", "0");

  return url;
}

export async function exchangeInstagramCode(origin: string, code: string) {
  const { appId, appSecret } = getClientConfig();
  const body = new URLSearchParams();

  body.set("client_id", appId);
  body.set("client_secret", appSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", getInstagramRedirectUri(origin));
  body.set("code", code);

  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Instagram token exchange failed: ${responseBody}`);
  }

  return (await response.json()) as InstagramTokenResponse;
}

export async function exchangeForLongLivedInstagramToken(accessToken: string) {
  const { appSecret } = getClientConfig();
  const url = new URL("https://graph.instagram.com/access_token");

  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);

  if (!response.ok) {
    return { access_token: accessToken } satisfies InstagramLongLivedTokenResponse;
  }

  return (await response.json()) as InstagramLongLivedTokenResponse;
}

export async function fetchInstagramProfile(accessToken: string) {
  const url = new URL(`https://graph.instagram.com/${getGraphVersion()}/me`);

  url.searchParams.set("fields", "id,username,name,profile_picture_url,account_type");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Instagram profile lookup failed: ${body}`);
  }

  return (await response.json()) as InstagramProfile;
}

export function getInstagramTokenExpiry(expiresIn?: number) {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}
