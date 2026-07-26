# 8_ Analytics Dashboard — Developer Guide

## What is the Analytics Dashboard?

The Analytics Dashboard is the **unified metrics hub** of Postelligence. It pulls live engagement data from every connected social platform — YouTube, Instagram, Facebook, Threads, Bluesky, LinkedIn — and combines it with Postelligence's own publishing history from the `scheduled_posts` table to give the user a single, honest picture of how their content is performing.

In simple words: instead of opening 6 different apps to check likes, comments, views, and follower counts, the user sees everything in one screen — with charts, per-platform breakdowns, and a filterable list of recent posts.

---

## Files Involved

```text
app/
└── dashboard/
    └── (shell)/
        └── analytics/
            ├── page.tsx              → Server component — fetches data, runs cache logic, passes to client
            ├── AnalyticsClient.tsx   → Client component — all charts, cards, filters, and UI
            └── loading.tsx           → Skeleton loading state (shown while page.tsx fetches data)

app/
└── api/
    └── analytics/
        └── refresh/
            └── route.ts              → POST endpoint — handles both manual and background cache refresh

lib/
└── analytics/
    ├── social-analytics.ts           → Core library — fetches live data from each platform's API
    └── analytics-cache.ts            → Cache layer — reads/writes analytics to the Supabase analytics_cache table
```

---

## How the Full Pipeline Works

```
User navigates to /dashboard/analytics
        ↓
page.tsx (server component) runs
        ↓
1. Verify user is logged in (redirect to / if not)
2. Fetch connected social_accounts from Supabase (with access tokens)
3. Fetch all scheduled_posts for this user from Supabase
        ↓
4. Check the analytics_cache table for this user's cached data
        ↓
        ├─ Cache hit (fresh, < 30 min old)
        │     → Serve cached AnalyticsDashboardData instantly
        │       No platform API calls made. Page loads in < 1s.
        │
        ├─ Cache hit (stale, 30–60 min old)
        │     → Serve stale cached data immediately (page renders fast)
        │       AnalyticsClient detects cacheStale=true and triggers
        │       a background POST /api/analytics/refresh 800ms after render
        │
        └─ Cache miss (> 60 min old or no cache exists)
              → Call getAnalyticsDashboard() — hits all platform APIs in parallel
                Write result to analytics_cache (non-blocking, void'd)
                Serve fresh data
        ↓
5. Strip sensitive tokens (access_token, refresh_token, appPassword)
   before passing accounts to the client component
        ↓
AnalyticsClient renders: metric cards, 3 charts, platform table,
recent posts list, followers chart, best performing post card
```

---

## Part 1 — The Data Layer

### `lib/analytics/social-analytics.ts`

This is the engine. It exports one main function:

```ts
export async function getAnalyticsDashboard(
  accounts: AnalyticsAccount[],
  scheduledPosts: ScheduledPost[]
): Promise<AnalyticsDashboardData>
```

It filters to only `connected` accounts, then calls a `fetchPlatform()` dispatcher for each one **in parallel** (`Promise.all`). Each platform has its own async fetcher.

#### The Data Types

```ts
export type AnalyticsDashboardData = {
  generatedAt: string;          // ISO timestamp of when this data was fetched
  totals: {
    postPerformance: number | null;   // % of scheduled posts that were published
    likes: number | null;
    comments: number | null;
    shares: number | null;
    reach: number | null;
    followers: number | null;
    engagementRate: number | null;   // ((likes + comments + shares) / reach) * 100
  };
  platforms: PlatformAnalytics[];
};

export type PlatformAnalytics = {
  platform: string;            // e.g. "youtube"
  name: string;                // e.g. "YouTube"
  accountName: string;         // the connected account's handle/name
  color: string;               // brand hex color for charts
  tone: string;                // Tailwind badge class for status pills
  connected: boolean;
  fetched: boolean;            // true = live API data was returned
  status: "synced" | "partial" | "unavailable" | "error";
  message: string;             // human-readable status message
  posts: number;               // total posts in scheduled_posts for this platform
  published: number;
  queued: number;
  failed: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  followers: number | null;
  engagementRate: number | null;
  recentPosts: AnalyticsPost[];  // up to 25 recent posts from the live API
};

export type AnalyticsPost = {
  id: string;
  title: string;
  url?: string;
  createdAt?: string;
  platform: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
};
```

#### The `basePlatform()` function — the local fallback baseline

Before any API call is made, `basePlatform()` builds a starter `PlatformAnalytics` object from data Postelligence already owns:

- `posts`, `published`, `queued`, `failed` — counted from `scheduled_posts` filtered to this platform.
- `likes`, `comments`, `shares`, `reach`, `followers` — extracted from the `metadata` JSON column of `social_accounts` (if the platform stores any there).
- `recentPosts` — the published scheduled posts for this platform, mapped to `AnalyticsPost` shape (with `null` engagement since we haven't hit the API yet).

This baseline is passed to every platform fetcher as the `fallback` argument. If the live API call fails or returns no data, the fallback is returned so the user still sees *something* (their post count, their local publishing history).

#### Per-Platform Fetchers

Each fetcher follows the same contract: receives `(account: AnalyticsAccount, fallback: PlatformAnalytics)`, calls the platform's API, and either returns a fully populated `PlatformAnalytics` or returns the fallback with an appropriate `status` and `message`.

**YouTube** (`fetchYouTube`)
1. Refreshes access token if expired (calls `refreshYouTubeAccessToken`).
2. Calls `GET /youtube/v3/channels?part=statistics,contentDetails&id=<channelId>` → gets `subscriberCount`, `viewCount`, and the `uploads` playlist ID.
3. Calls `GET /youtube/v3/playlistItems?playlistId=<uploads>&maxResults=25` → gets up to 25 video IDs.
4. Calls `GET /youtube/v3/videos?part=snippet,statistics&id=<ids>` → gets per-video `likeCount`, `commentCount`, `viewCount`.
5. Returns: likes, comments, reach (view count), subscribers as followers. Shares are `null` (YouTube has no share count API).

**Facebook** (`fetchFacebook`)
1. Calls `GET /<pageId>?fields=fan_count,followers_count` → followers.
2. Calls `GET /<pageId>/published_posts?fields=id,message,permalink_url,created_time,shares,comments.summary,likes.summary&limit=25` → post list with likes/comments/shares.
3. For each post, silently tries `GET /<postId>/insights?metric=post_impressions_unique` → reach per post (fails gracefully if `pages_read_user_content` permission is missing).
4. If any permission error is detected (error codes `#10`, `#100`, `OAuthException`), returns `status: "partial"` with a clear message that Meta app review is needed — does **not** crash.

**Instagram** (`fetchInstagram`)
1. Detects whether the account was connected via Instagram Login (`metadata.login_type === "instagram"`) and switches between `graph.instagram.com` and `graph.facebook.com` accordingly.
2. Calls `GET /<accountId>/media?fields=id,caption,permalink,timestamp,like_count,comments_count&limit=25`.
3. For each media item, silently tries `GET /<mediaId>/insights?metric=reach,impressions,shares,total_interactions` → reach and shares.
4. Returns: likes (`like_count`), comments (`comments_count`), shares and reach from insights.

**Threads** (`fetchThreads`)
1. Calls `GET /v1.0/<accountId>/threads?fields=id,text,timestamp,permalink,like_count,reply_count,repost_count,quote_count,views&limit=25`.
2. Returns: likes (`like_count`), comments (`reply_count`), shares = `repost_count + quote_count`, reach (`views`).

**Bluesky** (`fetchBluesky`)
1. Calls the **public Bluesky API** (no auth token required) — `GET /xrpc/app.bsky.feed.getAuthorFeed?actor=<handle>&limit=50`.
2. Calls `GET /xrpc/app.bsky.actor.getProfile?actor=<handle>` → follower count.
3. Returns: likes (`likeCount`), comments (`replyCount`), shares = `repostCount + quoteCount`, reach is `null` (Bluesky has no view count).

**LinkedIn** (`fetchLinkedIn`)
1. Calls `GET /rest/posts?q=author&author=urn:li:person:<id>&count=20` with `LinkedIn-Version` and `X-Restli-Protocol-Version` headers.
2. For each post, silently tries `GET /rest/socialActions/<encodedId>` → likes and comments per post.
3. If `ACCESS_DENIED` or `r_member_social` errors are detected, returns `status: "partial"` or `"error"` with a message that LinkedIn has restricted this permission to new apps — not a Postelligence bug.
4. Returns: likes, comments. Shares and reach are `null` (LinkedIn API doesn't expose these).

#### Error Handling Philosophy

Every fetcher is wrapped in a `try/catch` inside `fetchPlatform()`. This means:

- If any one platform's API call fails (network error, expired token, rate limit), only that platform shows an error. All other platforms still render normally.
- Permission-specific errors (LinkedIn's `r_member_social`, Meta's `pages_read_user_content`) are detected by string-matching the error message. These get a `"partial"` status instead of `"error"` so the user knows the account is fine but the API is restricted.
- All fetch calls have a **10-second timeout** (via `AbortController`) to prevent a single slow platform from blocking the whole page load.

#### Helper Utilities

```ts
// Safely extracts a number from any depth of a nested object
function getNestedNumber(source, keys)

// Sums an array of nullable numbers — returns null only if ALL values are null
function addNullable(values: Array<number | null>)

// Calculates engagement rate: (likes + comments + shares) / reach * 100
function engagementRate(likes, comments, shares, reach)

// Returns brand color and Tailwind tone class for any platform
function platformStyle(platform)
```

---

## Part 2 — The Cache Layer

### `lib/analytics/analytics-cache.ts`

Fetching live analytics from 6 platform APIs takes several seconds. Doing that on every page load would make the analytics page feel slow. The cache solves this with a **stale-while-revalidate** strategy.

#### The `analytics_cache` Table

```sql
-- Created by supabase/migrations (run if not already present)
CREATE TABLE analytics_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         jsonb NOT NULL,          -- the full AnalyticsDashboardData object
  cached_at    timestamptz NOT NULL,    -- when this data was fetched
  is_refreshing boolean DEFAULT false,  -- prevents duplicate concurrent refreshes
  UNIQUE (user_id)                      -- one cache row per user
);
```

#### TTL Strategy

| Age of cached data | What happens |
|---|---|
| < 30 min (fresh) | Served instantly. No API calls. `cacheStatus = "fresh"`. |
| 30–60 min (stale) | Served instantly. After 800ms, a background `POST /api/analytics/refresh` fires silently. `cacheStatus = "stale"` → `"refreshing"` → `"live"`. |
| > 60 min (expired) | Treated as a cache miss. Fresh data is fetched, blocking the page render. |

#### The Four Cache Functions

```ts
// Returns { hit: false } or { hit: true, data, stale, cachedAt }
async function readAnalyticsCache(userId: string): Promise<CacheResult>

// Upserts a fresh AnalyticsDashboardData into the cache row for this user
async function writeAnalyticsCache(userId: string, analytics: AnalyticsDashboardData)

// Sets is_refreshing = true only if it was false — returns false if already refreshing
// This prevents two concurrent background refreshes from both hammering the platform APIs
async function markCacheRefreshing(userId: string): Promise<boolean>

// Deletes the cache row for this user — called when the user clicks "Refresh"
async function invalidateAnalyticsCache(userId: string)
```

---

## Part 3 — The Server Component (`page.tsx`)

File: `app/dashboard/(shell)/analytics/page.tsx`

This is a Next.js **server component** (no `"use client"` directive). It runs on the server on every navigation to `/dashboard/analytics`, does all the data fetching, and passes results down as props to `AnalyticsClient`.

### What it does, step by step

```ts
// 1. Auth guard
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/");

// 2. Fetch social_accounts with tokens (needed by the analytics library)
const { data: socialAccounts } = await supabase
  .from("social_accounts")
  .select("id, platform, account_id, account_name, ..., access_token, refresh_token, token_expires_at")
  .eq("user_id", user.id);

// 3. Fetch all scheduled posts (needed for post counts and local baselines)
const { data: scheduledPosts } = await supabase
  .from("scheduled_posts")
  .select("*")
  .eq("user_id", user.id)
  .order("scheduled_time", { ascending: false });

// 4. Cache-first strategy
const cached = await readAnalyticsCache(user.id);

if (cached.hit) {
  analytics = cached.data;         // serve from cache
  servedFromCache = true;
  cacheStale = cached.stale;
} else {
  analytics = await getAnalyticsDashboard(accounts, posts);  // fetch fresh
  void writeAnalyticsCache(user.id, analytics);              // cache in background
}

// 5. IMPORTANT: strip sensitive tokens before sending to the client
const publicAccounts = accounts.map(({ access_token, refresh_token, token_expires_at, ...account }) => ({
  ...account,
  metadata: sanitizeMetadata(account.metadata),  // also removes any tokens stored in metadata
}));

// 6. Render the client component with clean data
return <AnalyticsClient
  socialAccounts={publicAccounts}
  posts={posts}
  analytics={analytics}
  servedFromCache={servedFromCache}
  cacheStale={cacheStale}
/>;
```

**Why strip tokens before passing to the client?** Client components become part of the browser's React tree and could be inspected in DevTools. Access tokens must never leave the server. The `sanitizeMetadata` helper specifically removes `access_token`, `refresh_token`, `appPassword`, and `app_password` keys even if they were stored inside the `metadata` JSON column.

### The Shell Layout (`(shell)/layout.tsx`)

The `(shell)` route group wraps all sub-pages including analytics with a shared `DashboardShellClient` — the sidebar and header. `analytics/page.tsx` renders as `children` inside this shell. This means the analytics page gets the sidebar navigation for free without any extra work.

### The Loading Skeleton (`loading.tsx`)

`loading.tsx` is automatically used by Next.js during the time that `page.tsx` is executing on the server (fetching from Supabase and platform APIs). It renders:

- A header skeleton with a fake badge, title, and stat bar.
- 7 metric card skeletons.
- Two chart area skeletons.
- Two list section skeletons.

All using `animate-pulse` and the project's standard off-white `#f0f1eb` placeholder colour. This ensures the page never shows a blank white screen during loading.

---

## Part 4 — The Refresh API Route

File: `app/api/analytics/refresh/route.ts`

```
POST /api/analytics/refresh
Body: { "force": true | false }
```

This route is called in two scenarios:

| Scenario | `force` value | What it does |
|---|---|---|
| User clicks the **Refresh** button | `true` | Calls `invalidateAnalyticsCache()` to delete the cache row, then fetches fresh data from all platforms and writes the new cache. |
| Stale cache detected (background) | `false` | Calls `markCacheRefreshing()` first — if that returns `false` (another refresh is already running), it exits immediately. Otherwise fetches fresh data and writes the new cache. |

The `markCacheRefreshing` mutex prevents the case where the user has two tabs open — both detecting a stale cache and both sending a background refresh at the same time, resulting in double the platform API calls.

On any error during the refresh, the route clears `is_refreshing = false` using the **admin Supabase client** (`lib/supabase/admin.ts`) so the next request can try again. Without this cleanup, a failed refresh would permanently lock out future background refreshes.

---

## Part 5 — The Client Component (`AnalyticsClient.tsx`)

File: `app/dashboard/(shell)/analytics/AnalyticsClient.tsx`

This is a `"use client"` component. It receives already-computed data as props and handles all the interactive UI — filtering, refreshing, and rendering charts.

### Props

```ts
{
  socialAccounts: SocialAccount[];           // connected accounts (no tokens)
  posts: ScheduledPost[];                    // all scheduled posts for this user
  analytics: AnalyticsDashboardData;         // pre-fetched analytics from page.tsx
  servedFromCache?: boolean;                 // true if data came from cache
  cacheStale?: boolean;                      // true if cache is older than 30 min
}
```

### Cache Status State Machine

```
Initial state determined by servedFromCache + cacheStale props:
  servedFromCache=false          → "live"
  servedFromCache=true, stale=false → "fresh"
  servedFromCache=true, stale=true  → "stale"

"stale"
  → 800ms setTimeout fires triggerBackgroundRefresh()
  → setCacheStatus("refreshing")
  → POST /api/analytics/refresh { force: false }
  → router.refresh() (Next.js re-fetches page.tsx server-side silently)
  → setCacheStatus("live")

"live" / "fresh" / "stale"
  → User clicks Refresh button
  → setCacheStatus("refreshing")
  → POST /api/analytics/refresh { force: true }
  → router.refresh()
  → setCacheStatus("live")
```

The four status labels appear as colour-coded pills in the header:

| Status | Pill colour | Meaning |
|---|---|---|
| `"fresh"` | Emerald green | Cached, served instantly, still within 30 min |
| `"stale"` | Amber | Cached, being refreshed in the background right now |
| `"refreshing"` | Blue with spinning icon | Actively fetching from platform APIs |
| `"live"` | Brand green | Just fetched from scratch or after a manual refresh |

### Filter State

```ts
const [trendRange, setTrendRange] = useState<"7D"|"1M"|"3M"|"1Y"|"All">("All");
const [postsFilter, setPostsFilter] = useState<PostsFilter>("all");    // platform filter
const [postsPeriod, setPostsPeriod] = useState<PostsPeriod>("recent"); // time period filter
```

`trendRange` controls the line chart — which posts appear based on their `createdAt` date.

`postsFilter` and `postsPeriod` control the Recent Post Metrics list together. Posts are first filtered by time period, then by platform, then sorted newest-first, then capped at 20 items.

### Computed Values

```ts
// Summary counts shown in the header stats bar
const publishedPosts = posts.filter(p => p.status === "published").length;
const totalPosts = posts.length;
const syncedPlatforms = rows.filter(r => r.fetched).length;
const totalRecentPosts = rows.reduce((s, r) => s + r.recentPosts.length, 0);

// Best performing post — highest combined (likes + comments + shares) across all platforms
const bestPost = allRecentPosts.reduce((best, post) => {
  const score = (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
  const bestScore = (best.likes ?? 0) + (best.comments ?? 0) + (best.shares ?? 0);
  return score > bestScore ? post : best;
});

// Max posts across any platform — used to scale the progress bar widths
const maxPosts = Math.max(1, ...rows.map(r => r.posts));
```

### Chart Data Shapes

All three charts use **Recharts** and pull data from `analytics.platforms` (`rows`).

**Bar Chart — Engagement by Platform**
```ts
const barData = rows
  .filter(r => r.likes !== null || r.comments !== null || r.shares !== null || r.reach !== null)
  .map(r => ({
    name: r.name,          // "YouTube", "Instagram", etc.
    color: r.color,        // brand hex
    Likes: r.likes ?? 0,
    Comments: r.comments ?? 0,
    Shares: r.shares ?? 0,
    Reach: r.reach ?? 0,
  }));
```
Renders only platforms that returned at least one non-null metric. Three bars per platform: Likes (rose), Comments (amber), Shares (violet).

**Pie Chart — Posts by Platform**
```ts
const pieData = rows
  .filter(r => r.posts > 0)
  .map(r => ({ name: r.name, value: r.posts, color: r.color }));
```
Each slice = total post count for that platform. Only platforms with at least one post are included. Uses `innerRadius` and `outerRadius` to render as a donut chart.

**Line Chart — Engagement Trend Across Recent Posts**
```ts
const lineData = [...recentPosts]
  .reverse()            // oldest → newest (left to right)
  .map((post, i) => ({
    name: `#${i + 1}`,  // x-axis label
    title: post.title,  // shown in tooltip
    platform: ...,      // shown in tooltip
    platformColor: ..., // used to colour tooltip header
    Likes: post.likes ?? 0,
    Comments: post.comments ?? 0,
    Shares: post.shares ?? 0,
    Reach: post.reach ?? 0,
    url: post.url,      // so the tooltip could link to the post
  }));
```
Four lines: Likes (rose), Comments (amber), Shares (violet), Reach (cyan dashed). Requires at least 2 data points to render — otherwise shows an `EmptyChart` placeholder. The `trendRange` filter slices this array by `createdAt` date before rendering.

**Followers Bar Chart (sidebar)**
```ts
rows
  .filter(r => r.followers !== null)
  .map(r => ({ name: r.name, Followers: r.followers ?? 0, color: r.color }))
```
Uses `<Cell>` to colour each bar with that platform's brand colour. If no platform has follower data, falls back to a text list instead.

### Custom Tooltips

Three custom tooltip components are defined instead of using Recharts' default:

- `ChartTooltip` — used by the main bar chart and follower bar chart. Shows metric name + value with a coloured dot per series.
- `PieTooltip` — shows platform name + post count.
- `LineChartTooltip` — the most detailed. Shows the post number, platform colour, platform name, and truncated post title in a header section, then each metric (Likes / Comments / Shares / Reach) with its colour indicator below. Reach uses a dashed line indicator to match the chart.

### `PlatformMessage` — Permission Error Component

```ts
function PlatformMessage({ row }: { row: PlatformRow })
```

This component reads a platform row's `status` and `message` and decides which UI to show in the platform table:

- **Amber box with lock icon** — shown when the message mentions `r_member_social`, `pages_read_user_content`, or `Page Public Content Access`. Explains the specific LinkedIn or Meta restriction in plain English, links to the Integrations page to reconnect, and (for Meta) links to the Meta developer docs to start app review.
- **Rose error box** — shown for any `status: "error"` without a recognized permission issue. Shows the raw error message with a link to Integrations.
- **Plain grey text** — shown for `status: "synced"` or `status: "partial"` without a permission issue. Just the status message.

This distinction matters because LinkedIn's `r_member_social` restriction affects **all** third-party apps, not just Postelligence. Surfacing a clear explanation prevents users from thinking their account is broken or that Postelligence has a bug.

### The 7 Metric Cards

```ts
const metricCards = [
  { label: "Post Performance", value: formatPercent(postPerformance), ... },
  { label: "Likes",            value: formatCompact(analytics.totals.likes), ... },
  { label: "Comments",         value: formatCompact(analytics.totals.comments), ... },
  { label: "Shares",           value: formatCompact(analytics.totals.shares), ... },
  { label: "Reach",            value: formatCompact(analytics.totals.reach), ... },
  { label: "Engagement Rate",  value: formatPercent(analytics.totals.engagementRate), ... },
  { label: "Total Followers",  value: formatCompact(analytics.totals.followers), ... },
];
```

Each card shows:
- A coloured icon (lucide-react) in a matching soft-toned background.
- A `CheckCircle2` icon if the metric has real data, a faded pie icon if it's `null`.
- The formatted value (`"—"` if null) and a one-line description.

`formatCompact` uses `Intl.NumberFormat` with `notation: "compact"` — so 14,200 becomes "14.2K" and 1,500,000 becomes "1.5M".

`formatPercent` shows zero decimals if ≥ 10%, one decimal if < 10%, and "—" if null.

### Animations

All major sections are wrapped in `motion.section` or `motion.div` with the shared `fadeUp` variant:

```ts
const fadeUp = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } };
```

The root container uses `staggerChildren: 0.06`, so each section fades in 60ms after the previous one — giving the page a cascading entrance without feeling slow.

The active filter tabs (trend range and posts period) use Framer Motion's `layoutId` to animate a smooth "pill" sliding between buttons when the active selection changes.

The platform progress bars animate from `width: 0` to their computed width on mount.

---

## Part 6 — The Database: `analytics_cache` Table

```sql
-- Run this migration if the table doesn't exist yet
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         jsonb NOT NULL,
  cached_at    timestamptz NOT NULL DEFAULT now(),
  is_refreshing boolean NOT NULL DEFAULT false,
  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read and write their own analytics cache"
  ON public.analytics_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

The `UNIQUE (user_id)` constraint means `upsert` is used instead of `insert` — if a row already exists for the user, it gets updated in place rather than a new one being created.

---

## Platform-by-Platform Analytics Support

| Platform | Likes | Comments | Shares | Reach | Followers | Notes |
|---|---|---|---|---|---|---|
| YouTube | ✅ | ✅ | — | ✅ Views | ✅ Subscribers | Token refresh handled automatically |
| Instagram | ✅ | ✅ | ✅ | ✅ | — | Requires Business/Creator account for insights |
| Facebook | ✅ | ✅ | ✅ | ⚠️ | ✅ | `post_impressions_unique` requires Meta approval |
| Threads | ✅ | ✅ | ✅ Reposts+Quotes | ✅ Views | — | Public API, all fields available |
| Bluesky | ✅ | ✅ | ✅ Reposts+Quotes | — | ✅ | Fully public API, no token needed for reads |
| LinkedIn | ✅ | ✅ | — | — | — | `r_member_social` closed to new apps by LinkedIn |
| Twitter | — | — | — | — | — | Not yet implemented |
| Pinterest | — | — | — | — | — | Not yet implemented |
| Reddit | — | — | — | — | — | Not yet implemented |

---

## Environment Variables Required

The analytics system relies on the same OAuth tokens stored in `social_accounts` — no extra env vars are required specifically for analytics. The variables below must already be set for the respective integrations to work:

```env
# Supabase (required for everything)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # used by the refresh route's error handler

# YouTube (needed for token refresh during analytics)
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=

# Meta (Facebook + Instagram analytics use the same tokens as publishing)
META_GRAPH_VERSION=v23.0

# LinkedIn
LINKEDIN_API_VERSION=202605
```

---

## Common Issues and Fixes

| Issue | Likely Cause | Fix |
|---|---|---|
| Analytics page loads very slowly on first visit | Cache miss — fetching from 6 platform APIs in parallel | Normal on first load. After the first load, cache is written and subsequent loads are instant. |
| LinkedIn shows "error" status | `r_member_social` not approved by LinkedIn | This affects all third-party tools, not just Postelligence. Publishing still works. No fix available until LinkedIn re-opens the permission. |
| Facebook/Instagram shows "partial" | `pages_read_user_content` not approved | Complete Meta app review. Until then, post counts and page profile data still show. |
| Cache is stale but page never refreshes | `is_refreshing` stuck as `true` after a failed refresh | The refresh route clears `is_refreshing` on error. If stuck, delete the row from `analytics_cache` in Supabase SQL Editor: `DELETE FROM analytics_cache WHERE user_id = '<your-user-id>';` |
| `analytics_cache` table doesn't exist | Migration not run | Run the SQL from Part 6 above in Supabase SQL Editor. |
| YouTube token expired, analytics shows error | Token expired and refresh failed | Disconnect and reconnect the YouTube account from the Integrations page. |
| Reach shows "—" for Bluesky | Expected — Bluesky has no view count in its public API | Not a bug. Bluesky does not expose reach/impressions via public API. |
| `data` column in `analytics_cache` is `null` | A previous refresh crashed mid-write | Delete the cache row and refresh manually. |

---

## Quick Interview-Ready Summary

> "The Analytics Dashboard fetches live engagement data — likes, comments, shares, reach, followers — from each connected platform's API in parallel, combines it with Postelligence's own `scheduled_posts` table for local publishing stats, and presents everything in one unified view with bar, pie, and line charts built with Recharts. To avoid slow page loads, we implemented a stale-while-revalidate cache on a Supabase `analytics_cache` table: data under 30 minutes old is served instantly, data between 30 and 60 minutes old is served immediately while a background refresh fires silently, and data older than 60 minutes is fetched fresh. Sensitive OAuth tokens are stripped server-side before the data is passed to the React client component. Platform-specific permission errors — like LinkedIn's `r_member_social` restriction — are detected and surfaced to the user with plain-English explanations rather than raw API error codes, so users understand why data is missing and what they can do about it."

---

*Made by - Siddharth Jagdale*