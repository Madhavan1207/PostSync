import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseRouteParams } from "@/lib/validation/http";

export const dynamic = "force-dynamic";

/**
 * NOT a UUID. `workspace_invites.token` is
 * `text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex')`
 * (migration 008), i.e. always exactly 64 lowercase hex characters, and nothing
 * ever inserts an explicit token.
 */
const InviteTokenParams = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/, "Invalid invite token."),
});

// ── GET /api/workspace/invite/[token] ───────────────────────
// Validate an invite token and return workspace info
// Used to show the "You've been invited to X workspace" page
export async function GET(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const parsedParams = parseRouteParams(await props.params, InviteTokenParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .select("*, workspace:workspaces(id, name)")
    .eq("token", params.token)
    .eq("accepted", false)
    .eq("rejected", false)
    .gte("expires_at", new Date().toISOString())
    .single();

  if (error || !invite) {
    return NextResponse.json(
      { error: "Invite not found or has expired." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    invite: {
      id:           invite.id,
      email:        invite.email,
      role:         invite.role,
      token:        invite.token,
      expires_at:   invite.expires_at,
      workspace:    invite.workspace,
    },
  });
}