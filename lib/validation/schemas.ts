import { z } from "zod";
import type {
  ScheduledPostStatus,
  WorkspaceDraftStatus,
  WorkspaceRole,
} from "@/types";

/**
 * Shared validation primitives.
 *
 * Domain enums mirror the unions in `types/index.ts`. The `satisfies` assertions
 * below make that link a compile-time guarantee: if a union there gains a member,
 * the corresponding schema here fails to compile until it is updated, so the two
 * cannot silently drift.
 */

/** Supabase primary keys are UUIDs; reject anything else before it reaches a query. */
export const uuid = z.string().uuid("Must be a valid ID.");

/** Trimmed, non-empty string with an explicit upper bound. */
export const nonEmptyString = (max = 5_000) =>
  z.string().trim().min(1, "This field is required.").max(max, `Must be ${max} characters or fewer.`);

/** Optional string that treats "" as absent rather than as a value. */
export const optionalString = (max = 5_000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

export const isoDateTime = z.iso.datetime({
  offset: true,
  message: "Must be an ISO 8601 date-time.",
});

export const httpUrl = z
  .string()
  .url("Must be a valid URL.")
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "Must be an http(s) URL.",
  });

export const emailAddress = z.string().trim().toLowerCase().email("Must be a valid email address.");

// ── Domain enums ─────────────────────────────────────────────────────────────

export const platformId = z.enum([
  "linkedin",
  "youtube",
  "bluesky",
  "instagram",
  "facebook",
  "twitter",
  "threads",
  "pinterest",
  "reddit",
  "discord",
  "telegram",
]);
export type PlatformId = z.infer<typeof platformId>;

export const workspaceRole = z.enum([
  "owner",
  "manager",
  "creator",
  "analyst",
]) satisfies z.ZodType<WorkspaceRole>;

export const scheduledPostStatus = z.enum([
  "pending",
  "publishing",
  "published",
  "failed",
  "cancelled",
]) satisfies z.ZodType<ScheduledPostStatus>;

export const workspaceDraftStatus = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "failed",
]) satisfies z.ZodType<WorkspaceDraftStatus>;

// ── Query-parameter helpers ──────────────────────────────────────────────────
// Query values are always strings, so these coerce before validating.

export const queryUuid = uuid;

export const queryInt = (opts?: { min?: number; max?: number; default?: number }) => {
  let schema = z.coerce.number().int();
  if (opts?.min !== undefined) schema = schema.min(opts.min);
  if (opts?.max !== undefined) schema = schema.max(opts.max);
  return opts?.default !== undefined ? schema.default(opts.default) : schema;
};

/** Accepts "true"/"false"/"1"/"0" as produced by query strings. */
export const queryBoolean = z
  .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
  .transform((v) => v === "true" || v === "1");

/** Standard pagination, bounded so a client cannot request an unlimited page. */
export const paginationQuery = z.object({
  limit: queryInt({ min: 1, max: 100, default: 20 }).optional(),
  offset: queryInt({ min: 0, default: 0 }).optional(),
});

// ── Common route-parameter shapes ────────────────────────────────────────────

export const idParams = z.object({ id: uuid });
