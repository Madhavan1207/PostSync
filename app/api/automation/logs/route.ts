import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/validation/http";
import { uuid } from "@/lib/validation/schemas";

type AutomationLogStatus = "pending" | "approved" | "rejected" | "published" | "failed";

/**
 * Which fields are meaningful depends entirely on `action`, so this is a
 * discriminated union rather than a bag of optionals: it stops an `edit` from
 * smuggling in a `status`, or an `approve` from rewriting the caption.
 *
 * `status` mirrors the `automation_logs.status` CHECK constraint.
 *
 * `caption` (`text NOT NULL`) and `mediaUrl` (`text NOT NULL DEFAULT ''`) use
 * plain optional strings rather than `optionalString()` — the edit UI must be
 * able to clear either one, and `optionalString()` would turn a deliberate ""
 * into "leave unchanged".
 */
const automationLogStatus = z.enum([
  "pending",
  "approved",
  "rejected",
  "published",
  "failed",
]) satisfies z.ZodType<AutomationLogStatus>;

const AutomationLogActionBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reject"),
    logId: uuid,
  }),
  z.object({
    action: z.literal("approve"),
    logId: uuid,
    status: automationLogStatus.optional(),
    scheduledPostId: uuid.optional(),
  }),
  z.object({
    action: z.literal("edit"),
    logId: uuid,
    caption: z.string().trim().max(10_000).optional(),
    mediaUrl: z
      .union([z.literal(""), z.string().trim().max(2_048).url("Must be a valid URL.")])
      .optional(),
  }),
]);

// Partial `automation_logs` row — only the columns this endpoint ever writes.
interface AutomationLogUpdate {
  status?: AutomationLogStatus;
  scheduled_post_id?: string;
  caption?: string;
  media_url?: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("automation_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, AutomationLogActionBody);
  if (!parsed.success) return parsed.response;
  const body = parsed.data;
  const logId = body.logId;

  try {
    const updateData: AutomationLogUpdate = {};

    if (body.action === "reject") {
      updateData.status = "rejected";
    } else if (body.action === "approve") {
      updateData.status = body.status || "approved";
      if (body.scheduledPostId) {
        updateData.scheduled_post_id = body.scheduledPostId;
      }
    } else {
      if (body.caption !== undefined) updateData.caption = body.caption;
      if (body.mediaUrl !== undefined) updateData.media_url = body.mediaUrl;
    }

    const { data, error } = await supabase
      .from("automation_logs")
      .update(updateData)
      .eq("id", logId)
      .eq("user_id", user.id) // Ensure security
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ log: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: message || "Invalid request payload" }, { status: 400 });
  }
}
