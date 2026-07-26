import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRouteParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the item first to delete from storage
  const { data: item, error: fetchError } = await supabase
    .from("media_library")
    .select("file_url, user_id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Extract storage path from URL and delete from storage
  try {
    const url = new URL(item.file_url);
    const pathParts = url.pathname.split("/media-library/");
    if (pathParts[1]) {
      const { error: storageError } = await supabase.storage.from("media-library").remove([pathParts[1]]);
      if (storageError) {
        return NextResponse.json({ error: storageError.message }, { status: 500 });
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not parse storage URL." },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("media_library")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
