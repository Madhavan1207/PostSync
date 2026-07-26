import { z } from "zod";

/**
 * Validation for OAuth query parameters.
 *
 * These routes must NOT return a 400 on bad input. An OAuth callback is reached by
 * the provider redirecting the user's browser, so the only sane failure mode is to
 * redirect onward with an error message — a JSON 400 would strand the user on a
 * blank page mid-connect. Every helper here therefore *degrades* rather than
 * rejects: an invalid value is reported as absent, and the route's existing
 * "missing OAuth data" branch handles it exactly as before.
 *
 * What validation buys us here is bounding: an over-long or control-character
 * laden `code`/`state`/`error` never reaches a token exchange, a cookie
 * comparison, or a redirect message.
 */

/** Authorization codes are opaque and provider-specific; bound rather than shape. */
const codeSchema = z.string().min(1).max(2048);

/** CSRF state we generated ourselves — a UUID or short opaque token. */
const stateSchema = z.string().min(1).max(512);

/**
 * Provider error identifiers (`access_denied`, `invalid_scope`, …). Restricted to
 * a safe character set because this value is interpolated into a user-facing
 * redirect message.
 */
const errorCodeSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.:\- ]+$/, "Unrecognised OAuth error code.");

/** Human-readable provider text; control characters collapsed to spaces. */
const errorDescriptionSchema = z
  .string()
  .min(1)
  .max(512)
  .transform((v) =>
    v
      .split("")
      .map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch))
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
  );

/** Returns the validated value, or null when absent or invalid. */
function readParam<S extends z.ZodType>(
  params: URLSearchParams,
  key: string,
  schema: S,
): z.infer<S> | null {
  const raw = params.get(key);
  if (raw === null) return null;
  const result = schema.safeParse(raw);
  return result.success ? result.data : null;
}

export type OAuthCallbackParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
};

/**
 * Reads the standard OAuth 2.0 callback parameters, validated and bounded.
 *
 * A value that fails validation comes back as `null`, so a caller's existing
 * `if (!code || !state)` guard fires and redirects as it always did.
 */
export function readOAuthCallbackParams(url: URL): OAuthCallbackParams {
  const params = url.searchParams;
  return {
    code: readParam(params, "code", codeSchema),
    state: readParam(params, "state", stateSchema),
    error: readParam(params, "error", errorCodeSchema),
    errorDescription: readParam(params, "error_description", errorDescriptionSchema),
  };
}

/** OAuth 1.0a request token / verifier, as used by the Twitter flow. */
const oauth1TokenSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/, "Unrecognised OAuth token.");

export type OAuth1CallbackParams = {
  oauthToken: string | null;
  oauthVerifier: string | null;
  error: string | null;
};

/**
 * Reads OAuth 1.0a callback parameters (Twitter), validated and bounded.
 * As with OAuth 2, an invalid value reads as null so the caller's existing
 * redirect-on-missing branch handles it.
 */
export function readOAuth1CallbackParams(url: URL): OAuth1CallbackParams {
  const params = url.searchParams;
  return {
    oauthToken: readParam(params, "oauth_token", oauth1TokenSchema),
    oauthVerifier: readParam(params, "oauth_verifier", oauth1TokenSchema),
    error: readParam(params, "error", errorCodeSchema),
  };
}

/**
 * Reads an optional `workspaceId` query parameter as a UUID.
 *
 * Returns `{ present: false }` when absent (the personal-account flow), or
 * `{ present: true, valid: false }` when malformed — previously a malformed value
 * was interpolated straight into a Supabase `.eq("workspace_id", …)`, where a
 * non-UUID raises a Postgres type error rather than a clean failure.
 */
export function readWorkspaceIdParam(
  url: URL,
):
  | { present: false }
  | { present: true; valid: true; workspaceId: string }
  | { present: true; valid: false } {
  const raw = url.searchParams.get("workspaceId");
  if (raw === null || raw === "") return { present: false };

  const result = z.string().uuid().safeParse(raw);
  if (!result.success) return { present: true, valid: false };
  return { present: true, valid: true, workspaceId: result.data };
}
