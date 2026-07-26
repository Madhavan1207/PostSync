import { z } from "zod";

/**
 * Server environment validation.
 *
 * Twenty-odd call sites read env vars as `process.env.X!`. The non-null assertion
 * satisfies TypeScript but does nothing at runtime: a missing variable arrives as
 * `undefined` and fails much later, as a confusing third-party error (an unhelpful
 * Supabase auth failure, an OAuth "invalid_client") rather than a clear
 * configuration message.
 *
 * These helpers validate lazily — at first use, not at import — deliberately.
 * Validating at module load would run during `next build`, where integration
 * secrets are legitimately absent, and would break the build for a variable no
 * built page needs.
 */

/** Variables the application cannot function without. */
const CoreEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a URL."),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required for admin database access."),
});

let coreCache: z.infer<typeof CoreEnv> | null = null;

/**
 * Validates and returns the core server env, caching after the first success.
 * Throws a single message naming every missing/invalid variable.
 */
export function getCoreEnv() {
  if (coreCache) return coreCache;

  const result = CoreEnv.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${problems}`);
  }

  coreCache = result.data;
  return coreCache;
}

/**
 * Reads a single required variable, with a message that names it.
 *
 * For optional integrations (a platform the operator has not configured), prefer
 * reading `process.env.X` directly and handling absence — an unconfigured
 * platform should degrade, not throw.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

/**
 * Reads the credentials for one OAuth integration.
 * Returns `null` when the platform is not configured, so callers can report
 * "platform not connected" instead of crashing.
 */
export function getOptionalOAuthCredentials(
  idVar: string,
  secretVar: string,
): { clientId: string; clientSecret: string } | null {
  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
