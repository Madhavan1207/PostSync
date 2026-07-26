import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { runScheduler } from "@/lib/scheduler/auto-publisher";

/**
 * Inngest Function: Publish Scheduled Post
 * Triggered when a "post/scheduled" event is sent.
 * Sleeps in Inngest cloud until `scheduledTime` and then publishes the post.
 */
export const publishScheduledPost = inngest.createFunction(
  {
    id: "publish-scheduled-post",
    name: "Publish Scheduled Social Post",
    triggers: [{ event: "post/scheduled" }],
  },
  async ({ event, step }) => {
    const eventData = event.data as { scheduledTime?: string; postId?: string };
    const scheduledTime = eventData?.scheduledTime;
    const postId = eventData?.postId;

    // Step 1: Sleep until the target scheduled publish time
    if (scheduledTime) {
      await step.sleepUntil("wait-for-target-publish-time", scheduledTime);
    }

    // Step 2: Invoke the auto-publisher engine to claim & publish the post
    const result = await step.run("execute-publisher", async () => {
      console.log(`[Inngest] Executing publisher for post ID: ${postId || "all due"}`);
      return await runScheduler();
    });

    return {
      success: true,
      postId: postId || null,
      ranAt: new Date().toISOString(),
      result,
    };
  }
);

/**
 * Inngest Function: Hourly Safety Check (Optional Fallback)
 * Runs once every hour to ensure no orphaned pending posts are missed.
 */
export const hourlySafetyCheck = inngest.createFunction(
  {
    id: "hourly-safety-check",
    name: "Hourly Posts Safety Check",
    triggers: [{ cron: "0 * * * *" }],
  },
  async ({ step }) => {
    return await step.run("check-due-posts", async () => {
      console.log("[Inngest] Running hourly safety check...");
      return await runScheduler();
    });
  }
);

// Create and export Next.js API route handlers for GET, POST, and PUT
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [publishScheduledPost, hourlySafetyCheck],
});
