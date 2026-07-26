import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams } from "@/lib/validation/http";
import { PLATFORM_CONFIG } from "@/types";

const SearchQuery = z.object({
  q: z.string().trim().min(2, "Search for at least 2 characters.").max(100),
});

/**
 * Escapes characters that are *syntax* inside a PostgREST `or()` filter.
 *
 * The filter is built as a string (`title.ilike.%term%,description.ilike.%term%`),
 * so a comma, dot or parenthesis in user input would be parsed as filter grammar
 * rather than as text. `%` and `_` are LIKE wildcards and are escaped so a search
 * for them matches literally.
 */
function escapeFilterValue(value: string) {
  return value.replace(/[%_]/g, "\\$&").replace(/[,.()"']/g, " ");
}

export const dynamic = "force-dynamic";

// GET /api/search?q=... — powers the Topbar search bar.
// Searches, across everything the user has access to:
//   - Personal drafts (title/description)
//   - Personal scheduled + published posts (title/description)
//   - Team/workspace drafts, scheduled + published posts, for every
//     workspace the user is a member of (title/description)
//   - Media Library files (file name)
//   - Platform names (e.g. typing "instagram" surfaces every post,
//     personal or team, that includes Instagram as a target platform)
// Text matching also naturally covers hashtags — "#launch" or "launch"
// both match a caption containing "#launch" since it's a substring search.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A query shorter than 2 characters is a normal state for a search-as-you-type
  // box, not a client error — return empty results rather than a 400.
  const parsed = parseSearchParams(req.nextUrl, SearchQuery);
  if (!parsed.success) return NextResponse.json({ results: [] });

  const q = parsed.data.q;
  const like = `%${escapeFilterValue(q)}%`;
  const textFilter = `title.ilike.${like},description.ilike.${like}`;

  // Platform-name matching: if the query matches (or is matched by) a
  // known platform's id/name, also pull in posts targeting that platform,
  // even if the query text never appears in the caption itself.
  const matchedPlatforms = PLATFORM_CONFIG
    .filter((p) => p.id.includes(q.toLowerCase()) || p.name.toLowerCase().includes(q.toLowerCase()))
    .map((p) => p.id);

  // Workspaces the user belongs to, so team content search covers all of them.
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspace:workspaces(name)")
    .eq("user_id", user.id);

  const workspaceIds = (memberships || []).map((m) => m.workspace_id);
  const workspaceNameById = new Map(
    (memberships || []).map((m) => [
      m.workspace_id,
      (m.workspace as unknown as { name?: string } | null)?.name || "Team",
    ])
  );

  // 1. Personal drafts
  let draftsQuery = supabase
    .from("drafts")
    .select("id, title, description, platforms, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(8);
  draftsQuery = matchedPlatforms.length
    ? draftsQuery.or(`${textFilter},platforms.ov.{${matchedPlatforms.join(",")}}`)
    : draftsQuery.or(textFilter);

  // 2. Personal scheduled + published posts (no status filter — this
  //    table already holds both scheduled and published posts)
  let scheduledQuery = supabase
    .from("scheduled_posts")
    .select("id, title, description, platforms, status, scheduled_time")
    .eq("user_id", user.id)
    .is("workspace_id", null)
    .order("scheduled_time", { ascending: false })
    .limit(8);
  scheduledQuery = matchedPlatforms.length
    ? scheduledQuery.or(`${textFilter},platforms.ov.{${matchedPlatforms.join(",")}}`)
    : scheduledQuery.or(textFilter);

  // 3. Media Library (file name only)
  const mediaQuery = supabase
    .from("media_library")
    .select("id, file_name, file_type, uploaded_at")
    .eq("user_id", user.id)
    .ilike("file_name", like)
    .order("uploaded_at", { ascending: false })
    .limit(8);

  // 4. Team/workspace drafts, scheduled + published posts — across every
  //    workspace the user belongs to (one unified table covers all three).
  //    If the user isn't in any workspace, skip this query entirely.
  let workspaceQuery = supabase
    .from("workspace_drafts")
    .select("id, workspace_id, title, description, platforms, status, scheduled_time, updated_at")
    .in("workspace_id", workspaceIds.length ? workspaceIds : ["00000000-0000-0000-0000-000000000000"])
    .order("updated_at", { ascending: false })
    .limit(10);
  workspaceQuery = matchedPlatforms.length
    ? workspaceQuery.or(`${textFilter},platforms.ov.{${matchedPlatforms.join(",")}}`)
    : workspaceQuery.or(textFilter);

  const [
    { data: drafts },
    { data: scheduled },
    { data: media },
    { data: workspaceDrafts },
  ] = await Promise.all([draftsQuery, scheduledQuery, mediaQuery, workspaceQuery]);

  const results = [
    ...(drafts || []).map((d) => ({
      id: d.id,
      type: "draft" as const,
      title: d.title || "Untitled draft",
      snippet: (d.description || "").slice(0, 80),
      href: `/create?draftId=${d.id}`,
    })),
    ...(scheduled || []).map((s) => ({
      id: s.id,
      type: s.status === "published" ? ("published" as const) : ("scheduled" as const),
      title: s.title || "Untitled post",
      snippet: (s.description || "").slice(0, 80),
      href: `/calendar?open=${s.id}`,
    })),
    ...(media || []).map((m) => ({
      id: m.id,
      type: "media" as const,
      title: m.file_name,
      snippet: m.file_type === "video" ? "Video" : "Image",
      href: `/library?open=${m.id}`,
    })),
    ...(workspaceDrafts || []).map((w) => ({
      id: w.id,
      type: "team" as const,
      title: w.title || "Untitled post",
      snippet: `${workspaceNameById.get(w.workspace_id) || "Team"} · ${(w.description || "").slice(0, 60)}`,
      href: `/team?tab=compose&draftId=${w.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
