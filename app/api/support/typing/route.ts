import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { parseJsonBody } from "@/lib/validation/http";
import { uuid } from "@/lib/validation/schemas";

/**
 * `role` must be an enum, not a string: it is used as a computed key
 * (`{ ...currentTyping, [role]: !!isTyping }`) written straight into the
 * `support_tickets.typing_status` jsonb column, whose shape is
 * `{"user": boolean, "admin": boolean}`. An arbitrary `role` would let a caller
 * graft unbounded extra keys onto that object.
 */
const SupportTypingBody = z.object({
  ticketId: uuid,
  role: z.enum(["user", "admin"]),
  isTyping: z.boolean(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, SupportTypingBody);
  if (!parsed.success) return parsed.response;
  const { ticketId, role, isTyping } = parsed.data;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Fetch current typing status
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("typing_status")
      .eq("id", ticketId)
      .single();

    const currentTyping = ticket?.typing_status || { user: false, admin: false };
    const updatedTyping = {
      ...currentTyping,
      [role]: !!isTyping
    };

    const { error } = await supabase
      .from("support_tickets")
      .update({ typing_status: updatedTyping })
      .eq("id", ticketId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: message || "Failed to update typing state" }, { status: 500 });
  }
}
