import { NextResponse } from "next/server";
import { z } from "zod";
import { runScheduler } from "@/lib/scheduler/auto-publisher";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams } from "@/lib/validation/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * This is the Vercel cron target (`vercel.json`, every 2 minutes), so the schema
 * must not reject the cron's own request: `secret` is the only param the handler
 * reads and it stays optional, and unknown keys are stripped rather than
 * rejected, so any header/param Vercel adds passes straight through.
 *
 * `secret` is compared against `CRON_SECRET`; bounding its length just stops an
 * unbounded string reaching the comparison. It is never logged.
 *
 * POST reads no query params and no body — it authenticates purely from the
 * `authorization` header — so there is nothing to validate there.
 */
const SchedulerRunQuery = z.object({
  secret: z.string().max(512).optional(),
});

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const userAgent = request.headers.get("user-agent") || "";
  const parsedQuery = parseSearchParams(request.url, SchedulerRunQuery);
  if (!parsedQuery.success) return parsedQuery.response;
  const providedSecret =
    authHeader?.replace(/^Bearer\s+/i, "") || parsedQuery.data.secret || null;
  const isVercelCron = userAgent.includes("vercel-cron") || request.headers.get("x-vercel-cron") === "1";

  if (cronSecret && providedSecret !== cronSecret && !isVercelCron) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!cronSecret && !isVercelCron) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runScheduler();
    return NextResponse.json({ ok: true, ...result, ran: new Date().toISOString() });
  } catch (error) {
    console.error("[Scheduler] Run failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduler failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.replace(/^Bearer\s+/i, "");

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!cronSecret) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runScheduler();
    return NextResponse.json({ ok: true, ...result, ran: new Date().toISOString() });
  } catch (error) {
    console.error("[Scheduler] Run failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduler failed." },
      { status: 500 }
    );
  }
}
