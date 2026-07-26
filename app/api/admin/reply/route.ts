import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/guard";
import { parseJsonBody } from "@/lib/validation/http";
import { uuid } from "@/lib/validation/schemas";

/** One entry in a support ticket thread, as stored in `support_tickets.messages`. */
const TicketMessage = z.object({
  sender: z.enum(["user", "admin"]),
  text: z.string().trim().min(1, "A message cannot be empty.").max(5_000),
  time: z.string().min(1).max(64),
});

/**
 * `messages` replaces the whole thread, so it is bounded to stop an oversized
 * array being written into the row. Statuses match those the support and admin
 * UIs compare against.
 */
const AdminReplyBody = z.object({
  ticketId: uuid,
  messages: z.array(TicketMessage).max(500, "Too many messages in one thread."),
  status: z.enum(["open", "pending", "in_progress", "resolved", "completed"]).optional(),
});

export async function POST(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied) return denied;

    const parsed = await parseJsonBody(req, AdminReplyBody);
    if (!parsed.success) return parsed.response;
    const { ticketId, messages, status } = parsed.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data, error } = await supabase
      .from("support_tickets")
      .update({
        messages,
        status: status || "in_progress"
      })
      .eq("id", ticketId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ticket: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: message || "Failed to update support ticket" }, { status: 500 });
  }
}
