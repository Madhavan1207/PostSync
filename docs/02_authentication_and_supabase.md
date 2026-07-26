# 2_ Authentication & Supabase — How Login and Data Storage Work

## 1. What Problem This Solves

Before a user can connect social accounts or publish posts, Postelligence needs to know **"who is using the app right now?"**. This is handled entirely by **Supabase Auth**, using **Google Sign-In**.

This is completely separate from the per-platform connections (Twitter, YouTube, etc.) — see `01-architecture-overview.md` for that distinction.

---

## 2. What is Supabase (in simple terms)?

Supabase is a backend-as-a-service. For this project it gives us three things, all from one account:

1. **Authentication** — handles Google login, sessions, and cookies.
2. **Postgres Database** — stores the `social_accounts` table (which platforms each user has connected, and their tokens).
3. **Storage** — stores images/videos users attach to posts, so they can be shared via a public URL.

---

## 3. The Two Supabase Clients

Because Next.js code can run in **two places** — the user's browser, and the server — there are two ways to talk to Supabase. Both live in `lib/supabase/`.

### `lib/supabase/client.ts` — Browser client
```ts
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
```
Used inside `"use client"` components (e.g. the login button) where code runs in the user's browser.

### `lib/supabase/server.ts` — Server client
```ts
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: { get, set, remove }
  });
}
```
Used inside Server Components and API routes. It reads the session from **cookies** sent by the browser, so the server knows who's logged in without the browser sending anything extra.

**Rule of thumb:** if the file starts with `"use client"`, use `client.ts`. If it's a `page.tsx` without that directive, or a `route.ts` file, use `server.ts`.

---

## 4. The Login Flow, Step by Step

### Step 1 — User clicks "Continue with Google"
File: `components/login-button.tsx`

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${origin}/auth/callback` }
});
```

This tells Supabase: *"send this user to Google's login screen, and once they're done, bring them back to `/auth/callback`."*

### Step 2 — Google shows its consent screen
The user picks their Google account and approves basic profile access (name, email, avatar).

### Step 3 — Google redirects back with a `code`
Google sends the browser to:
```
https://yourapp.com/auth/callback?code=xxxxx
```

### Step 4 — The callback route exchanges the code for a session
File: `app/auth/callback/route.ts`

```ts
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
```

What happens here:
- The temporary `code` is exchanged with Supabase for a real **session** (access token + refresh token).
- Supabase automatically stores this session in **HTTP-only cookies** on the response.
- The user is redirected to `/` (home), now fully logged in.

### Step 5 — Every future request is "authenticated" automatically
Because the session lives in cookies, any Server Component or API route can call:

```ts
const { data: { user } } = await supabase.auth.getUser();
```

If `user` is `null`, nobody is logged in (and pages like `/dashboard` redirect to `/`). If `user` exists, you have their `id`, `email`, and Google profile info (`user_metadata.full_name`, `avatar_url`).

---

## 5. The `social_accounts` Database Table

This is the **single most important table** in the whole project. Every connected social platform (Instagram, YouTube, LinkedIn, etc.) is stored here as one row.

File: `supabase/migrations/001_create_social_accounts.sql`

```sql
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,              -- e.g. "instagram", "youtube"
  account_id text not null,            -- the ID on that platform
  account_name text not null,          -- display name / handle
  account_avatar_url text,             -- profile picture
  access_token text,                   -- used to call that platform's API
  refresh_token text,                  -- used to get a new access_token when it expires
  token_expires_at timestamptz,
  scopes text[] default '{}',          -- what permissions were granted
  status text not null default 'connected',  -- 'connected' | 'disconnected' | 'expired'
  metadata jsonb not null default '{}'::jsonb, -- platform-specific extra data
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, account_id)
);
```

### Reading this table like a beginner

- **One row = one connected account on one platform, for one user.** A user could have 8 rows (one per platform).
- `user_id` ties every row back to the logged-in Supabase user. This is how Postelligence knows "these are *your* accounts, not someone else's."
- `access_token` / `refresh_token` are the secret keys that let Postelligence post on your behalf. They come from each platform's OAuth flow (see `04-twitter.md`, `META_INTEGRATION_GUIDE.md`, etc).
- `metadata` is a flexible JSON "junk drawer" — e.g. Pinterest stores a `board_id` here, Bluesky stores its `pdsHost`.
- `unique (user_id, platform, account_id)` means you can't accidentally save the same account twice.

### Row Level Security (RLS)

```sql
alter table public.social_accounts enable row level security;

create policy "Users can read their own social accounts"
  on public.social_accounts for select
  using (auth.uid() = user_id);
```

**In simple terms:** Even though every user's data lives in the *same table*, Postgres enforces that a user can only `select`/`insert`/`update`/`delete` rows where `user_id` matches their own logged-in ID. This is a database-level security guarantee — even if there were a bug in the app's code, another user's tokens could never leak through a normal query.

---

## 6. Supabase Storage — Where Uploaded Media Goes

File: `supabase/migrations/002_create_media_bucket.sql`

```sql
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
```

This creates a **public bucket called `media`**. When a user attaches an image/video to a post:

1. The file is uploaded to `media/posts/<user_id>/<random-name>.<ext>`.
2. Supabase gives back a **public URL** for that file.
3. That public URL is what gets sent to platforms like Facebook, Instagram, Threads, and Pinterest — because their APIs require a URL they can fetch the media from, not a raw file upload.

The policies ensure:
- Users can only upload into **their own folder** (`posts/<their-user-id>/...`).
- Anyone (including external platform servers) can **read/download** from the bucket — required for the platforms to fetch the media.
- Users can delete only their own uploads.

This is used inside `app/api/posts/publish/route.ts` via the `resolveMediaUrl()` function — covered in `09-publish-engine.md`.

---

## 7. The "Local Fallback" Safety Net

File: `lib/integrations/local-social-accounts.ts`

If, for some reason, the `social_accounts` table doesn't exist yet (e.g. migrations weren't run on a fresh setup), the app doesn't crash. Instead:

- It falls back to storing connected accounts in an **encrypted local JSON file** (`.postelligence-data/social-accounts.json`) on the server's disk.
- Tokens are encrypted using Node's built-in `crypto` module before being written to disk.

This is purely a **developer convenience / fallback for local testing** — in production, the real Supabase table should always be used. You can see this fallback being checked in `app/dashboard/page.tsx`:

```ts
const { data: socialAccounts, error: socialAccountsError } = await supabase
  .from("social_accounts")
  .select("...")
  .eq("user_id", user.id);

const localSocialAccounts = socialAccountsError
  ? await getLocalSocialAccounts(user.id)
  : [];
```

---

## 8. Environment Variables Needed for Auth

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

These are **public/anon keys** — safe to expose to the browser (hence `NEXT_PUBLIC_` prefix). They only allow access governed by RLS policies, never raw admin access.

---

## 9. Quick Interview-Ready Summary

> "Postelligence uses Supabase for authentication via Google OAuth. When a user logs in, Supabase stores their session in HTTP-only cookies, so every server-side request can verify who's logged in via `supabase.auth.getUser()`. Separately, we maintain a `social_accounts` table — one row per connected social platform per user — protected by Row Level Security so users can only ever see their own data. Media files attached to posts are uploaded to a public Supabase Storage bucket, which gives us a public URL that we hand off to platform APIs like Facebook and Instagram."

---

*Made by - Siddharth Jagdale*