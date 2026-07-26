import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createBaseClient } from "@supabase/supabase-js";
import { schedulePostWithInngest } from "@/lib/inngest/client";
import { createHash } from "crypto";
import { uuid } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * This endpoint is reached by a human clicking a button in an approval email
 * (see `automation/trigger`), so it answers with a rendered HTML page, never
 * JSON. Validation therefore uses `safeParse` directly instead of
 * `parseSearchParams` — the shared helper returns a JSON 400, which would strand
 * the approver on a blank page.
 *
 * `token` is the sha256 approval token minted in `automation/trigger`, so it is
 * always 64 lowercase hex characters. It is bounded by length and charset here
 * and is deliberately never echoed into a response or a log line.
 */
const ExternalApproveQuery = z.object({
  logId: uuid,
  action: z.enum(["publish", "schedule", "reject"]),
  token: z.string().regex(/^[a-f0-9]{64}$/, "Invalid approval token."),
});

function getNextPostTime(postTimeStr: string): Date {
  const [h, m, s] = postTimeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, s || 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawParams = {
    logId: searchParams.get("logId"),
    action: searchParams.get("action"),
    token: searchParams.get("token"),
  };

  // Preserved verbatim: a link that lost its query string still reports
  // "Missing parameters" exactly as before.
  if (!rawParams.logId || !rawParams.action || !rawParams.token) {
    return renderHtmlResponse("Missing parameters", false);
  }

  const parsedParams = ExternalApproveQuery.safeParse(rawParams);
  if (!parsedParams.success) {
    // Deliberately generic, and deliberately not echoing the token back.
    return renderHtmlResponse(
      "This approval link is not valid. Please use the buttons in the original approval email.",
      false,
    );
  }
  const { logId, action, token } = parsedParams.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const adminSupabase = createBaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. Fetch the log entry
    const { data: log, error: logErr } = await adminSupabase
      .from("automation_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logErr || !log) {
      return renderHtmlResponse("Log entry not found.", false);
    }

    if (log.status !== "pending") {
      return renderHtmlResponse(`This draft has already been processed (Status: ${log.status}).`, false);
    }

    // 2. Cryptographic token verification
    const expectedToken = createHash("sha256")
      .update(logId + log.user_id + serviceRoleKey)
      .digest("hex");

    if (token !== expectedToken) {
      return renderHtmlResponse("Security token validation failed. Access denied.", false);
    }

    // 3. Process actions
    if (action === "reject") {
      const { error: rejectErr } = await adminSupabase
        .from("automation_logs")
        .update({ status: "rejected" })
        .eq("id", logId);

      if (rejectErr) throw rejectErr;

      return renderHtmlResponse("Success! This trend draft has been discarded.", true);
    }

    // Fetch user automation settings to get Posting Time and target platforms
    const { data: settings } = await adminSupabase
      .from("automation_settings")
      .select("*")
      .eq("user_id", log.user_id)
      .single();

    if (action === "publish") {
      // Approve and publish immediately
      const publishUrl = `${req.nextUrl.origin}/api/posts/publish`;
      const platforms = (settings?.platforms || []).join(",");

      const formData = new FormData();
      formData.append("caption", log.caption);
      formData.append("title", log.trend_title);
      formData.append("mediaUrl", log.media_url);
      formData.append("mediaType", "image");
      formData.append("platforms", platforms);

      const pubRes = await fetch(publishUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "X-User-Id": log.user_id,
        },
        body: formData,
      });

      const pubData = await pubRes.json();

      if (!pubRes.ok || !pubData.ok) {
        throw new Error(pubData.error || "Publishing failed");
      }

      // Update log to published
      await adminSupabase
        .from("automation_logs")
        .update({ status: "published" })
        .eq("id", logId);

      return renderHtmlResponse("Success! Your post has been published live to your social channels.", true);
    }

    if (action === "schedule") {
      // Approve and schedule for target posting time
      const postTime = settings?.post_time || "09:00:00";
      const targetTime = getNextPostTime(postTime);

      const { data: post, error: postErr } = await adminSupabase
        .from("scheduled_posts")
        .insert({
          user_id: log.user_id,
          title: log.trend_title,
          description: log.caption,
          media_urls: log.media_url ? [log.media_url] : [],
          platforms: settings?.platforms || [],
          scheduled_time: targetTime.toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (postErr) throw postErr;

      // Dispatch event to Inngest to sleep until scheduledTime and publish automatically
      await schedulePostWithInngest({ postId: post.id, scheduledTime: targetTime.toISOString() });

      // Update log to approved referencing scheduled_post_id
      await adminSupabase
        .from("automation_logs")
        .update({
          status: "approved",
          scheduled_post_id: post.id,
        })
        .eq("id", logId);

      const formattedTime = targetTime.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      return renderHtmlResponse(`Success! Your post has been approved and scheduled for ${formattedTime}.`, true);
    }

    return renderHtmlResponse("Unsupported action.", false);

  } catch (err: unknown) {
    console.error("External Approval Action Error:", err);
    const detail = err instanceof Error && err.message ? err.message : String(err);
    return renderHtmlResponse(`Failed to process action: ${detail}`, false);
  }
}

function renderHtmlResponse(message: string, success: boolean) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Postelligence Approval Panel</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #f6f7f1;
          color: #1f2528;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
        }
        .card {
          background-color: white;
          border: 1px solid rgba(31, 37, 40, 0.1);
          border-radius: 24px;
          padding: 40px;
          text-align: center;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 12px 40px rgba(31, 37, 40, 0.05);
        }
        .icon {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 20px;
          font-weight: 800;
          margin: 0 0 10px 0;
          letter-spacing: -0.02em;
        }
        p {
          font-size: 14px;
          color: #5a656c;
          line-height: 1.5;
          margin: 0 0 24px 0;
          font-weight: 500;
        }
        .btn {
          display: inline-block;
          background-color: #2f7867;
          color: white;
          text-decoration: none;
          padding: 12px 24px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 12px;
          transition: background-color 150ms;
        }
        .btn:hover {
          background-color: #255f52;
        }
        .error-icon {
          color: #e11d48;
        }
        .success-icon {
          color: #10b981;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon ${success ? "success-icon" : "error-icon"}">
          ${success ? "✓" : "⚠"}
        </div>
        <h1>${success ? "Action Completed" : "Action Failed"}</h1>
        <p>${message}</p>
        <a href="https://localhost:3000/dashboard" class="btn">Go to Dashboard</a>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
