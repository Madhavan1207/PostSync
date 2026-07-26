import { Inngest } from "inngest";

export interface SchedulePostEventData {
  postId?: string;
  scheduledTime: string; // ISO string timestamp (e.g. "2026-07-25T15:00:00Z")
  workspaceId?: string;
}

if (process.env.NODE_ENV === "development") {
  process.env.INNGEST_DEV = "1";
}

// Initialize the Inngest client with App ID
export const inngest = new Inngest({
  id: "post-sync",
  isDev: process.env.NODE_ENV === "development",
});

/**
 * Helper function to send a scheduled post event to Inngest.
 * Inngest will sleep until `scheduledTime` and then execute post publishing.
 */
export async function schedulePostWithInngest(data: SchedulePostEventData) {
  try {
    await inngest.send({
      name: "post/scheduled",
      data: {
        postId: data.postId,
        scheduledTime: data.scheduledTime,
        workspaceId: data.workspaceId,
      },
    });
    console.log("[Inngest] Scheduled post event sent successfully", data);
  } catch (error) {
    console.error("[Inngest] Failed to send scheduled post event", error);
  }
}
