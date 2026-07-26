# 12_ The Publish Engine — How One Click Posts to 8 Platforms

File: `app/api/posts/publish/route.ts` (~900 lines — the largest single file in the project)

This is the **core feature** of Postelligence: a single API route that takes one post and fans it out to every platform the user selected, each with its own upload/publish quirks.

---

## 1. The Big Picture

```text
Browser (Create page)
   │  FormData: caption, title, mediaUrl, linkUrl, mediaType,
   │            platforms="instagram,linkedin,twitter", attachment(file)
   ▼
POST /api/posts/publish
   │
   ├─ 1. Check user is logged in (Supabase)
   ├─ 2. Validate: must have text/media, must have ≥1 platform
   ├─ 3. Load connected accounts for the selected platforms from social_accounts
   ├─ 4. If a file was attached, upload it ONCE to Supabase Storage → get public URL
   ├─ 5. Loop through each selected platform:
   │     └─ call that platform's publishXxx() function
   └─ 6. Return a result array: [{platform, status, message, id}, ...]
```

The response shape:

```ts
type PublishResult = {
  platform: "instagram" | "facebook" | "linkedin" | "youtube" |
            "twitter" | "threads" | "bluesky" | "pinterest";
  status: "published" | "skipped" | "failed";
  message: string;
  id?: string; // the post's ID on that platform, if successful
};
```

Each platform succeeds or fails **independently** — if Twitter fails but Instagram succeeds, the user sees both outcomes clearly in the Publish modal.

---

## 2. Step-by-Step Walkthrough of the Route Handler

```ts
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const formData = await request.formData();
  const text      = asString(formData.get("caption"));
  const title     = asString(formData.get("title"));
  const mediaUrl  = asString(formData.get("mediaUrl"));
  const linkUrl   = asString(formData.get("linkUrl"));
  const mediaType = asString(formData.get("mediaType")) || "image";
  const platforms = asString(formData.get("platforms")).split(",")...;
  const attachment = getFile(formData);
```

**Why `FormData`?** Because the request can include a real file (image/video). JSON can't carry binary file data, but `multipart/form-data` (which `FormData` produces) can.

### Validation
```ts
if (!text && !mediaUrl && !attachment) {
  return NextResponse.json({ error: "Add post text, a media URL, or an attachment before publishing." }, { status: 400 });
}
if (platforms.length === 0) {
  return NextResponse.json({ error: "Select at least one platform." }, { status: 400 });
}
```
Simple guard clauses — fail fast with a clear message before doing any expensive work.

### Loading connected accounts
```ts
const { data: accounts } = await supabase
  .from("social_accounts")
  .select("platform, account_id, account_name, access_token, refresh_token, metadata")
  .eq("user_id", user.id)
  .eq("status", "connected")
  .in("platform", platforms);
```
Only fetches accounts that are (a) owned by this user, (b) currently `connected`, and (c) actually selected for this post. This is a single efficient query instead of one per platform.

### Uploading the attachment once
```ts
const resolvedMediaUrl = await resolveMediaUrl(attachment, mediaUrl, user.id);
```
If the user attached a file, it's uploaded **once** to Supabase Storage and converted into a public URL (see Section 4). This single URL is then reused for every platform that needs a hosted URL (Facebook, Threads, Instagram, Pinterest), instead of re-uploading the file 4 times.

### The dispatch loop
```ts
for (const platform of platforms) {
  const account = connectedAccounts.find(item => item.platform === platform);
  if (!account) {
    results.push({ platform, status: "skipped", message: "No connected account found." });
    continue;
  }
  results.push(await publishOne(account, text, title, resolvedMediaUrl, linkUrl, mediaType, attachment));
}
```
For each selected platform: if there's no connected account, mark it `"skipped"`. Otherwise, call `publishOne()`.

### `publishOne()` — the dispatcher
```ts
async function publishOne(account, text, title, mediaUrl, linkUrl, mediaType, attachment) {
  if (!account.access_token) {
    return { platform: account.platform, status: "failed", message: "No access token. Reconnect this account." };
  }
  try {
    const id =
      account.platform === "twitter"   ? await publishTwitter(account, text, attachment) :
      account.platform === "linkedin"  ? await publishLinkedIn(account, text, attachment, mediaUrl) :
      account.platform === "bluesky"   ? await publishBluesky(account, text, attachment) :
      account.platform === "facebook"  ? await publishFacebook(account, text, mediaUrl, linkUrl) :
      account.platform === "threads"   ? await publishThreads(account, text, mediaUrl, mediaType) :
      account.platform === "instagram" ? await publishInstagram(account, text, mediaUrl, mediaType) :
      account.platform === "youtube"   ? await publishYouTube(account, text, title, attachment) :
                                          await publishPinterest(account, text, mediaUrl, linkUrl);
    return { platform: account.platform, status: "published", message: "Published successfully.", id };
  } catch (error) {
    return { platform: account.platform, status: "failed", message: error.message };
  }
}
```

This is a clean **ternary dispatch table**: one line per platform, each delegating to its own dedicated function. The `try/catch` ensures one platform's API error never crashes the whole request — it just becomes a `"failed"` result for that platform only.

---

## 3. Shared Helper Functions

These small utilities are used across every platform's publish function, so they're defined once at the top of the file:

| Function | Purpose |
|---|---|
| `asString(value)` | Safely converts a `FormDataEntryValue` to a trimmed string (or `""`). |
| `getFile(formData)` | Pulls the `attachment` field out and confirms it's a real, non-empty `File`. |
| `readJson(response)` | Parses a response body as JSON, falling back to `{ raw: text }` if it's not valid JSON (some APIs return plain text errors). |
| `requireOk(response, label)` | Throws a descriptive `Error` if `response.ok` is false — e.g. `"Twitter publish failed: <reason>"`. This means every platform function can just `await requireOk(...)` and not write its own error-handling boilerplate. |

---

## 4. `resolveMediaUrl()` — Upload Once, Reuse Everywhere

```ts
async function resolveMediaUrl(attachment, fallbackUrl, userId) {
  if (!attachment) return fallbackUrl;

  const supabase = createClient();
  const ext = attachment.name.split(".").pop() || "bin";
  const path = `posts/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("media").upload(path, await attachment.arrayBuffer(), {
    contentType: attachment.type || "application/octet-stream",
    upsert: false,
  });

  if (error) return fallbackUrl; // fall back to whatever URL the user typed manually

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return data.publicUrl;
}
```

**Why this exists:** Some platform APIs (Twitter, LinkedIn, YouTube, Bluesky) accept **raw file bytes** directly — Postelligence uploads the file straight to them. But others (Facebook, Instagram, Threads, Pinterest) require a **publicly fetchable URL** — their servers download the media themselves. Rather than writing separate "upload to storage" logic in 4 different platform functions, it's done **once**, here, and the resulting URL is passed to whichever platform needs it.

---

## 5. Per-Platform Publishing Logic (Summary)

Each platform has wildly different API requirements. Here's what each `publishXxx()` function actually does:

### Twitter / X — `publishTwitter()`
1. If there's an attachment, upload it via `POST /1.1/media/upload.json` (legacy v1.1 media endpoint, base64-encoded) to get a `media_id`.
2. `POST /2/tweets` with `{ text, media: { media_ids: [...] } }`.

### LinkedIn — `publishLinkedIn()`
The most involved flow. LinkedIn's modern **Posts API** requires:
1. **Images:** a 2-step "initialize upload → PUT raw bytes" flow (`uploadLinkedInImage`).
2. **Videos:** a 3-step "initialize → upload in chunks with ETags → finalize" flow (`uploadLinkedInVideo`), since LinkedIn requires chunked uploads for video.
3. Then `POST /rest/posts` with `author: urn:li:person:<id>`, `commentary: text`, and a `content` block referencing the uploaded media URN (or an `article` block if only a `mediaUrl` was provided).

### Bluesky — `publishBluesky()`
The most complex due to the AT Protocol's decentralized design:
1. **Resolve the user's PDS (Personal Data Server) host** — Bluesky accounts can live on different servers, so the code resolves this via the account's DID document (`resolveBlueskyPdsHost`).
2. **Get a valid access token** — tries the stored token first; if a profile check returns 401, refreshes the session using the `refresh_token` (`getBlueskyToken`).
3. **Upload media as a "blob"**:
   - Images: `uploadBlueskyBlob()` — a single `uploadBlob` call.
   - Videos: `uploadBlueskyVideo()` — a multi-step flow involving a *separate* video processing service (`video.bsky.app`), service-auth tokens scoped to specific "audiences" (DIDs), and **polling a job status endpoint** until the video finishes processing (up to 90 seconds).
4. `POST /xrpc/com.atproto.repo.createRecord` with the post text and the embed (image or video blob).

### Facebook — `publishFacebook()`
- If there's media: `POST /{page-id}/photos?url=<mediaUrl>&caption=<text>`.
- If text-only: `POST /{page-id}/feed?message=<text>&link=<linkUrl>`.

### Threads — `publishThreads()`
A **2-step "container" pattern** (same as Instagram, since both are Meta products):
1. `POST /{id}/threads` — create a media "container" with the text/media → returns a `creation_id`.
2. `POST /{id}/threads_publish` with that `creation_id` → actually publishes it.

### Instagram — `publishInstagram()`
Same 2-step container pattern as Threads:
1. `POST /{id}/media` with `image_url` or (`media_type: REELS`, `video_url`) → returns `creation_id`.
2. `POST /{id}/media_publish` with `creation_id`.
**Requires a media URL** — Instagram cannot publish text-only posts.

### YouTube — `publishYouTube()`
1. **Requires a video file** — throws an error otherwise.
2. Checks if the stored access token is expired (`isTokenExpired`) and, if so, calls `refreshStoredYouTubeToken()` to get a new one using the `refresh_token`, then **saves the new tokens back to Supabase** so future posts don't need to refresh again.
3. Builds a raw **multipart/related** HTTP body by hand (metadata JSON part + video bytes part), since this is what YouTube's resumable/multipart upload endpoint expects.
4. `POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`.
5. If the upload returns `401`/`403` (expired token mid-request), it refreshes the token and retries **once**.

### Pinterest — `publishPinterest()`
- Requires a `board_id` stored in the account's `metadata` (set during the connect flow).
- Requires a public image URL (`mediaUrl`).
- `POST /v5/pins` with `{ board_id, title, description, link, media_source: { source_type: "image_url", url } }`.

---

## 6. Token Refresh Pattern (YouTube Example)

This is a good general pattern to understand for any OAuth-based integration:

```ts
function isTokenExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now() + 60_000; // expiring within 60s
}

async function refreshStoredYouTubeToken(account, userId) {
  if (!account.refresh_token) throw new Error("YouTube access expired and no refresh token is stored. Reconnect YouTube.");

  const tokens = await refreshYouTubeAccessToken(account.refresh_token);

  await supabase.from("social_accounts").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || account.refresh_token,
    token_expires_at: getTokenExpiry(tokens.expires_in),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("platform", "youtube").eq("account_id", account.account_id);

  account.access_token = tokens.access_token; // update in-memory copy too
  return tokens.access_token;
}
```

**Why "expiring within 60 seconds" and not just "already expired"?** To avoid a race condition where the token is valid when checked but expires a moment later during the actual upload (which can take a while for large videos). Refreshing slightly early avoids a failed upload partway through.

---

## 7. Why Errors Never Crash the Whole Request

Every platform function is wrapped in `publishOne()`'s `try/catch`. Combined with `requireOk()` throwing descriptive errors, this means:

- A Twitter rate-limit error becomes `{ platform: "twitter", status: "failed", message: "X publish failed: Rate limit exceeded" }`.
- The loop continues to the next platform regardless.
- The user gets a **per-platform report card** instead of one opaque "500 Internal Server Error" for the entire post.

---

## 8. Quick Interview-Ready Summary

> "The publish endpoint accepts a single multipart form containing the post content and a list of target platforms. It loads the user's connected accounts for those platforms in one query, uploads any attached media to Supabase Storage once to get a reusable public URL, then loops through each platform calling a dedicated publish function — Twitter's media upload + tweet API, LinkedIn's chunked video/image upload + Posts API, Bluesky's PDS-resolution and blob/video upload via the AT Protocol, Meta's two-step container pattern for Instagram and Threads, Facebook's feed/photos endpoints, YouTube's multipart resumable upload with automatic token refresh, and Pinterest's pins API. Every platform call is wrapped in its own try/catch, so one platform failing never blocks the others — the response is an array of per-platform results the UI uses to show a publish report."

---

*Made by - Siddharth Jagdale*