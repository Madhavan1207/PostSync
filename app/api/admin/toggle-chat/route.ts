import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/guard";
import { parseJsonBody } from "@/lib/validation/http";

/**
 * Strict boolean: previously any truthy value flipped the flag, so the string
 * "false" would have enabled chat support.
 */
const ToggleChatBody = z.object({ enabled: z.boolean() });

export async function POST(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied) return denied;

    const parsed = await parseJsonBody(req, ToggleChatBody);
    if (!parsed.success) return parsed.response;

    const isChatEnabled = parsed.data.enabled;

    // 1. Always write to local config file (guaranteed success for local dev/prod server runtime)
    try {
      const configPath = path.join(process.cwd(), "support_settings.json");
      fs.writeFileSync(configPath, JSON.stringify({ chatSupportEnabled: isChatEnabled }), "utf8");
    } catch (err) {
      console.error("Failed to write to local support_settings.json file:", err);
    }

    // 2. Write to Supabase Database (if table exists)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      await supabase
        .from("system_settings")
        .upsert({
          key: "chat_support_enabled",
          value: isChatEnabled
        });
    } catch (dbErr) {
      console.warn("Could not save toggle state to database table (migration might not be run):", dbErr);
    }

    return NextResponse.json({ success: true, chatSupportEnabled: isChatEnabled });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: message || "Failed to toggle system setting" }, { status: 500 });
  }
}
