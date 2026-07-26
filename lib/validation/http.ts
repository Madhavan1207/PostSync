import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Request-input validation for route handlers.
 *
 * Every handler validates its inputs at the boundary, before any value reaches a
 * database query or a third-party API. Handlers previously destructured
 * `await req.json()` directly, which meant a malformed or hostile body reached
 * Supabase as-is.
 *
 * Each helper returns a discriminated union:
 *
 *   const parsed = await parseJsonBody(req, Schema);
 *   if (!parsed.success) return parsed.response;
 *   parsed.data // fully typed, validated
 *
 * Errors come back in one shape so clients can rely on it:
 *   400 { error: "Invalid request body", details: { "field.path": "message" } }
 */

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

/** Flattens zod issues into a `path -> message` map. */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    // Keep the first error per field — the most relevant one for a form.
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

function invalid(message: string, error: z.ZodError): NextResponse {
  return NextResponse.json(
    { error: message, details: toFieldErrors(error) },
    { status: 400 },
  );
}

/**
 * Validates a JSON request body.
 *
 * Also handles a malformed/absent body: `req.json()` throws on invalid JSON, which
 * would otherwise surface as an unhandled 500.
 */
export async function parseJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S,
  options?: {
    /**
     * Overrides the top-level `error` string. Use it where a route already shows
     * the user a specific message ("Handle and app password are required.") so
     * adding validation does not degrade that copy. Field-level `details` are
     * still returned alongside it.
     */
    message?: string;
  },
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: options?.message ?? "Request body must be valid JSON." },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      response: invalid(options?.message ?? "Invalid request body", result.error),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Validates a JSON body that may legitimately be absent.
 *
 * An empty or unparseable body is treated as `{}` and validated as such, so a
 * schema of all-optional fields accepts a bodyless request. Use this only where
 * "no body" is a meaningful request (a POST whose fields are all optional flags);
 * prefer `parseJsonBody` everywhere else, so a malformed body is still a 400.
 */
export async function parseOptionalJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  if (raw === null || raw === undefined) raw = {};

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, response: invalid("Invalid request body", result.error) };
  }
  return { success: true, data: result.data };
}

/**
 * Validates URL query parameters.
 *
 * Values arrive as strings, so schemas should use `z.coerce` for numbers/booleans
 * or the shared helpers in `./schemas`.
 */
export function parseSearchParams<S extends z.ZodType>(
  url: string | URL,
  schema: S,
): ParseResult<z.infer<S>> {
  const searchParams =
    url instanceof URL ? url.searchParams : new URL(url).searchParams;

  // Repeated keys collapse to the last value, matching `searchParams.get()`.
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      response: invalid("Invalid query parameters", result.error),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Validates dynamic route segments (`params`).
 *
 * Guards against IDs that are not well-formed — an unvalidated segment
 * interpolated into a query is a needless risk, and a bad UUID should be a clean
 * 400 rather than a database error.
 */
export function parseRouteParams<S extends z.ZodType>(
  params: unknown,
  schema: S,
): ParseResult<z.infer<S>> {
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      success: false,
      response: invalid("Invalid route parameters", result.error),
    };
  }
  return { success: true, data: result.data };
}
