# 21_ Scheduled Posts — Developer Guide

## What is Scheduled Posts?

Scheduled Posts lets users write a post, pick a future date and time, and have the app automatically publish it to LinkedIn, YouTube, and Bluesky at exactly that time — without the user needing to be online.

The entire scheduling pipeline runs inside Supabase (Edge Function + pg_cron) so no Next.js server or Vercel deployment is needed for the automatic publishing to work.

---

## How the Full Pipeline Works

```
User clicks "Confirm Schedule"
        ↓
For LinkedIn video → immediately pre-uploads video to LinkedIn API
                  → saves linkedin_media_urn in scheduled_posts table
For YouTube video → immediately uploads video to YouTube as PRIVATE
                  → saves youtube_video_id in scheduled_posts table
For images/text   → just saves the media URL as-is
        ↓
Row inserted into scheduled_posts with status = "pending"
        ↓
Supabase pg_cron runs every minute (* * * * *)
        ↓
Triggers auto-publish Edge Function
        ↓
Edge Function finds all rows where:
  status = "pending" AND scheduled_time <= NOW()
        ↓
For LinkedIn  → posts using saved linkedin_media_urn (no re-upload)
For YouTube   → refreshes token → flips saved video from private → public
For Bluesky   → uploads image or video fresh at publish time
        ↓
Updates status = "published" (or "failed" if something went wrong)
```

---

## Prerequisites — Complete Checklist

Before a teammate can run this feature smoothly on their machine or deploy it, every item below must be done.

---

### 1. Supabase Tables

Run these migrations in order in Supabase SQL Editor if not already done:

**Migration 003** — Creates `scheduled_posts`, `drafts`, `media_library` tables:
```sql
-- Already in: supabase/migrations/003_create_drafts_library_scheduled.sql
-- Run this file in Supabase SQL Editor if tables don't exist
```

**Add LinkedIn URN column** (if not already added):
```sql
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS linkedin_media_urn text DEFAULT NULL;
```

**Add YouTube Video ID column** (if not already added):
```sql
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS youtube_video_id text DEFAULT NULL;
```

**Verify all columns exist:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scheduled_posts'
ORDER BY ordinal_position;
```

Expected columns: `id`, `user_id`, `title`, `description`, `media_urls`, `platforms`, `scheduled_time`, `status`, `created_at`, `updated_at`, `linkedin_media_urn`, `youtube_video_id`

---

### 2. Supabase Edge Function

The auto-publish edge function must be deployed. Run this in your terminal from the project root:

```bash
npx supabase functions deploy auto-publish --project-ref atbiednsiybijfkvairg
```

This deploys `supabase/functions/auto-publish/index.ts`.

**To verify it's deployed:**
- Go to Supabase Dashboard → Edge Functions
- You should see `auto-publish` listed with a green status

**To test it manually:**
```bash
curl -X POST https://atbiednsiybijfkvairg.supabase.co/functions/v1/auto-publish \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

It should return `{"message":"No due posts"}` if nothing is scheduled, or a list of processed posts.

---

### 3. Supabase pg_cron Setup (One-Time)

This makes the edge function run automatically. Do this once per Supabase project.

**Step 1** — Enable the pg_cron and pg_net extensions:
- Supabase Dashboard → Database → Extensions
- Search for `pg_cron` → Enable
- Search for `pg_net` → Enable

**Step 2** — Create the cron job (run in Supabase SQL Editor):

> 💡 **Single Unified Scheduler.** Supabase `pg_cron` runs every minute (`* * * * *`) directly calling the `auto-publish` Supabase Edge Function. Migration `015_atomic_claim_scheduled_posts.sql` protects post publishing via `claim_due_scheduled_posts()` (`FOR UPDATE SKIP LOCKED`).

```sql
select cron.schedule(
  'auto-publish-every-minute',
  '* * * * *',   -- runs every minute
  $$
  select net.http_post(
    url := 'https://atbiednsiybijfkvairg.supabase.co/functions/v1/auto-publish',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) as result;
  $$
);
```

Replace `YOUR_SERVICE_ROLE_KEY` with your actual service role key from Supabase Dashboard → Settings → API.

**If you previously had the staggered odd-minutes job set up**, remove it first so the two don't overlap:
```sql
SELECT cron.unschedule('auto-publish-odd-minutes');
```

**To verify cron is running:**
```sql
SELECT * FROM cron.job;
```

**To check cron execution history:**
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

**To remove the cron job if needed:**
```sql
SELECT cron.unschedule('auto-publish-odd-minutes');
```

---

### 4. Supabase Edge Function Secrets

The YouTube token refresh requires Google OAuth credentials set as Supabase secrets.

**If you have owner/admin access to the Supabase project:**
```bash
npx supabase secrets set YOUTUBE_CLIENT_ID=your_client_id --project-ref atbiednsiybijfkvairg
npx supabase secrets set YOUTUBE_CLIENT_SECRET=your_client_secret --project-ref atbiednsiybijfkvairg
```

**If you do NOT have secrets access:**
The credentials are currently hardcoded as fallback values in `supabase/functions/auto-publish/index.ts`. This works but is not recommended for production. Ask the project owner to set the secrets properly.

---

### 5. Google Cloud Console Setup (YouTube)

This must be done once for the entire project — not per teammate.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select your project (or create one)
3. Go to **APIs & Services → Library** → enable **YouTube Data API v3**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3000/auth/youtube/callback` (for local dev)
   - `https://yourdomain.com/auth/youtube/callback` (for production)
7. Copy the **Client ID** and **Client Secret** into your `.env.local`

**Critical — OAuth Scopes required:**

When setting up the OAuth consent screen, add these scopes:
- `https://www.googleapis.com/auth/youtube`
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.force-ssl`

⚠️ **If you change scopes after users have already connected YouTube, they MUST disconnect and reconnect their YouTube account. The old token will not have the new scopes no matter what you do in code.**

---

### 6. LinkedIn App Setup

1. Go to [linkedin.com/developers](https://www.linkedin.com/developers)
2. Create an app or use existing
3. Add products: **Share on LinkedIn**, **Sign In with LinkedIn using OpenID Connect**
4. Redirect URLs: `http://localhost:3000/auth/linkedin/callback`
5. Copy **Client ID** and **Client Secret** into `.env.local`

---

### 7. Environment Variables

Create a `.env.local` file in the project root with all of these:

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://atbiednsiybijfkvairg.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cron protection
CRON_SECRET=any_random_string_you_choose

# YouTube / Google OAuth
YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret

# LinkedIn
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Bluesky (no OAuth — uses handle + app password per user)
# No env vars needed for Bluesky
```

Get values from:
- **Supabase keys** → Supabase Dashboard → Settings → API
- **YouTube keys** → Google Cloud Console → Credentials
- **LinkedIn keys** → LinkedIn Developer Portal → Your App → Auth

---

### 8. Running Locally

```bash
# Install dependencies
yarn install

# Start the dev server
yarn dev
```

The app runs at `http://localhost:3000`.

⚠️ **Important:** When running locally, the pg_cron job in Supabase still fires automatically on its odd-minute schedule — it calls the deployed Supabase Edge Function, not your local server. So scheduled posts will still publish (at most ~1–2 minutes late, worst case) even when your laptop is off and Vercel's even-minute cron hasn't run, as long as the edge function is deployed.

The only thing that needs your local server running is the **pre-upload step** (when the user clicks Confirm Schedule). The actual auto-publishing at scheduled time is fully handled by Supabase.

---

## Platform-Specific Behaviour

### LinkedIn
| Media Type | What happens at schedule time |
|---|---|
| Text only | Published directly via LinkedIn API |
| Image | Uploaded to LinkedIn at schedule time, then posted |
| Video | Pre-uploaded to LinkedIn when user clicks schedule → saved as `linkedin_media_urn` → posted using URN at scheduled time (no re-upload) |

### YouTube
| Media Type | What happens at schedule time |
|---|---|
| Video | Pre-uploaded to YouTube as PRIVATE when user clicks schedule → saved as `youtube_video_id` → flipped to PUBLIC at scheduled time |
| Image | ❌ Not supported — YouTube API does not support image posts (community posts require special YouTube Partner access) |

### Bluesky
| Media Type | What happens at schedule time |
|---|---|
| Text only | Published directly via Bluesky API |
| Image | Uploaded and posted at scheduled time |
| Video | ⚠️ **Not supported for scheduled posts** — Bluesky video upload requires a live server connection at upload time and their video service (`video.bsky.app`) frequently returns 502 errors making it unreliable for scheduling. Videos can still be published **immediately** (not scheduled) via the Publish Now button, but scheduling a video to Bluesky is not supported. |

#### Why Bluesky video scheduling is not supported

Bluesky's video upload works differently from LinkedIn and YouTube:
- LinkedIn and YouTube let you pre-upload a video and get back a stable ID/URN that can be used hours later at publish time
- Bluesky requires the full video bytes to be streamed to `video.bsky.app` at the exact moment of posting — there is no "pre-upload and get an ID" API
- This means for scheduled posts, the edge function would need to re-download the full video from Supabase Storage and re-upload it to Bluesky at the scheduled time
- Bluesky's video service is also frequently unavailable (502 Bad Gateway) making this unreliable for automated scheduling

**Current behaviour:** If a user selects Bluesky + video and schedules it, the edge function will attempt the upload at scheduled time. If `video.bsky.app` is down at that moment, the post will fail. Use **Publish Now** for Bluesky videos instead.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Posts stay as `pending` forever | pg_cron not set up OR Edge Function not deployed | Set up pg_cron (Step 3) and deploy edge function (Step 2) |
| YouTube post shows `Failed` but video is actually public | Edge function crashed after making video public, before updating status | Run: `UPDATE scheduled_posts SET status = 'published' WHERE status = 'failed' AND youtube_video_id IS NOT NULL;` |
| YouTube: `insufficientPermissions` | OAuth token missing `youtube.force-ssl` scope | User must disconnect and reconnect YouTube after the scope was added to the app |
| YouTube: `token refresh failed` | `YOUTUBE_CLIENT_ID` or `YOUTUBE_CLIENT_SECRET` not set as Supabase secrets | Set secrets via CLI or Supabase Dashboard → Edge Functions → Manage Secrets |
| LinkedIn: video posts only send text | `linkedin_media_urn` column missing | Run the ALTER TABLE migration above |
| LinkedIn: `linkedin_media_urn` is NULL in DB | Pre-upload not happening — old `DashboardClient.tsx` deployed | Redeploy Next.js with updated `DashboardClient.tsx` |
| Bluesky: `502 Bad Gateway` on video | Bluesky's video server temporarily down | Wait a few minutes and retry — this is on Bluesky's side |
| Bluesky: scheduled video post failed | Bluesky has no pre-upload API — video must be uploaded live at publish time | Use **Publish Now** instead of scheduling for Bluesky videos |
| Bluesky: `Unauthorized` on video service token | Video service uses a separate token from the post token | Fixed in latest `publish/route.ts` — token is refreshed before video upload |
| Bluesky: `Unauthorized` on video upload | Stored access token expired before video upload | Fixed in latest `publish/route.ts` — refreshes token before video upload |
| Cron not firing | `pg_net` extension not enabled | Enable `pg_net` in Supabase Dashboard → Database → Extensions |
| Edge function logs show no errors but posts stay pending | Cron job calling wrong URL | Verify URL in `cron.job` table matches your project ref |
| A post takes up to ~2 minutes longer than scheduled to publish | Normal — pg_cron (odd minutes) and Vercel cron (even minutes) are staggered by design, not overlapping | Not a bug; if tighter timing is needed, revert both to `* * * * *` (accepting the redundant overlap `claim_due_scheduled_posts()` already handles safely) |
| Both schedulers firing on the same minute | Old `auto-publish-every-minute` pg_cron job never unscheduled, or `vercel.json` still says `"* * * * *"` | Run `SELECT cron.unschedule('auto-publish-every-minute');` and confirm `vercel.json` has `"*/2 * * * *"` |

---

## Checking Logs

**Edge Function logs:**
Supabase Dashboard → Edge Functions → auto-publish → Logs

**Cron job history:**
```sql
SELECT jobid, command, status, start_time, end_time, return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

**All failed scheduled posts:**
```sql
SELECT id, title, platforms, youtube_video_id, linkedin_media_urn, scheduled_time
FROM scheduled_posts
WHERE status = 'failed'
ORDER BY created_at DESC;
```

**Reset a failed post to retry:**
```sql
UPDATE scheduled_posts
SET status = 'pending', scheduled_time = NOW() + INTERVAL '1 minute'
WHERE id = 'your-post-id-here';
```
