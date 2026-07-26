import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { disconnectLocalMetaAccounts } from "@/lib/integrations/local-social-accounts";

/** Only the two Meta-family platforms may be disconnected through this route. */
const metaPlatform = z.enum(["facebook", "instagram"]);

export const dynamic = "force-dynamic";

function getMetaPlatform(request: Request) {
  const raw = new URL(request.url).searchParams.get("platform");
  const parsed = metaPlatform.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function DELETE(request: Request) {
  const platform = getMetaPlatform(request);

  if (!platform) {
    return NextResponse.json({ error: "A valid Meta platform is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("social_accounts")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      status: "disconnected",
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) {
    await disconnectLocalMetaAccounts(user.id, platform);
  }

  return NextResponse.json({ ok: true });
}
