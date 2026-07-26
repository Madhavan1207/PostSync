# 14_ Meta Facebook and Instagram Integration Guide

This document explains how the Meta and Instagram integrations work in this project, how to set them up from scratch, and which credentials each flow uses.

## What We Built

The app supports two separate OAuth flows:

- Facebook Pages through Meta/Facebook Login using `META_APP_ID` and `META_APP_SECRET`.
- Instagram professional accounts through Instagram API with Instagram Login using `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.

The connection is handled through these files:

- `lib/integrations/meta.ts` builds Meta OAuth URLs and calls the Graph API.
- `app/api/integrations/meta/connect/route.ts` starts the OAuth flow.
- `app/auth/meta/callback/route.ts` exposes the callback URL registered with Meta.
- `app/api/integrations/meta/callback/route.ts` exchanges the OAuth code, fetches Pages, fetches linked Instagram accounts, and saves records.
- `app/api/integrations/meta/disconnect/route.ts` disconnects Facebook and Instagram records.
- `lib/integrations/instagram.ts` builds direct Instagram OAuth URLs and calls the Instagram Graph API.
- `app/api/integrations/instagram/connect/route.ts` starts the direct Instagram OAuth flow.
- `app/auth/instagram/callback/route.ts` exposes the direct Instagram callback URL.
- `app/api/integrations/instagram/callback/route.ts` exchanges the Instagram OAuth code and saves the Instagram account.
- `app/dashboard/DashboardClient.tsx` shows connected accounts and connection status.

## Meta App Setup From Scratch

1. Create a Meta developer app at the Meta for Developers dashboard.
2. Add Facebook Login for Business or the Facebook Login product.
3. Configure a valid OAuth redirect URL:

```text
http://127.0.0.1:3000/auth/meta/callback
```

For production, also add your production domain:

```text
https://your-domain.com/auth/meta/callback
```

4. Add these Facebook/Meta environment variables to `.env.local`:

```env
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_GRAPH_VERSION=v23.0
```

5. Request or enable these permissions:

```text
pages_show_list
pages_read_engagement
pages_manage_posts
business_management
instagram_basic
instagram_content_publish
```

For local testing, the Facebook user should usually be added as an app admin, developer, or tester in the Meta app dashboard.

## Instagram App Setup

1. In the Meta developer app, open Instagram > API setup with Instagram login.
2. Add the Instagram redirect URL:

```text
http://localhost:3000/auth/instagram/callback
```

If you run the app through `127.0.0.1`, also add:

```text
http://127.0.0.1:3000/auth/instagram/callback
```

3. Add the required permissions shown in the Instagram API setup screen.
4. Put the Instagram app ID and secret in `.env.local`:

```env
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_GRAPH_VERSION=v23.0
INSTAGRAM_REDIRECT_URI=http://localhost:3000/auth/instagram/callback
```

5. Restart the dev server after editing `.env.local`.

## Why These Permissions Are Needed

- `pages_show_list`: lets the app list Facebook Pages the user can access.
- `pages_read_engagement`: lets the app read Page metadata and engagement-related data.
- `pages_manage_posts`: lets the app publish posts to a Page.
- `business_management`: helps Meta return Pages managed through Meta Business Suite or business assets.
- `instagram_basic`: lets the app read basic Instagram business account information.
- `instagram_content_publish`: lets the app publish content to eligible Instagram business accounts.

The important fix was adding `business_management`. Without it, Meta can return an empty `data: []` from `/me/accounts` even when the user has a Page, especially when the Page is controlled through Meta Business Suite.

## Facebook OAuth Flow

1. The user clicks Connect Facebook in the dashboard.
2. The app sends the browser to:

```text
/api/integrations/meta/connect?platform=facebook
```

3. The connect route checks that the user is signed in with Supabase.
4. It creates a random OAuth `state` value and stores it in an HTTP-only cookie.
5. It builds the Meta OAuth URL with:

```text
scope=pages_show_list,pages_read_engagement,pages_manage_posts,business_management,instagram_basic,instagram_content_publish
auth_type=rerequest
response_type=code
```

6. Meta asks the user to approve access.
7. Meta redirects back to:

```text
/auth/meta/callback
```

8. That route forwards to the API callback implementation.
9. The callback validates the OAuth `state` cookie.
10. The callback exchanges the short-lived code for a user access token.
11. The callback exchanges that token for a longer-lived Meta token when possible.
12. The app calls:

```text
GET /me/accounts
```

with fields:

```text
id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}
```

13. The app saves each Facebook Page as a `facebook` account.
14. The user returns to `/dashboard` with a success or error message.

## Instagram OAuth Flow

1. The user clicks Connect Instagram in the dashboard.
2. The app sends the browser to:

```text
/api/integrations/instagram/connect
```

3. The connect route checks that the user is signed in with Supabase.
4. It creates a random OAuth `state` value and stores it in an HTTP-only cookie.
5. It builds the Instagram OAuth URL with:

```text
scope=instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages
response_type=code
enable_fb_login=0
force_authentication=1
```

6. Instagram asks the user to approve access.
7. Instagram redirects back to:

```text
/auth/instagram/callback
```

8. The callback validates the OAuth `state` cookie.
9. The callback exchanges the short-lived code for an Instagram access token.
10. The app exchanges that token for a longer-lived Instagram token when possible.
11. The app fetches the Instagram profile and saves it as an `instagram` account.
12. The user returns to `/dashboard` with a success or error message.

## Where Accounts Are Saved

The main storage target is the Supabase `social_accounts` table.

Each connected Facebook Page stores:

- `platform`: `facebook`
- `account_id`: Facebook Page ID
- `account_name`: Facebook Page name
- `account_avatar_url`: Page picture URL
- `access_token`: Page access token
- `scopes`: Meta scopes requested by the app
- `metadata`: full Page payload from Meta
- `status`: `connected`

Each connected Instagram account stores:

- `platform`: `instagram`
- `account_id`: Instagram account ID
- `account_name`: Instagram username or name
- `account_avatar_url`: Instagram profile picture URL
- `access_token`: the Instagram access token
- `metadata.login_type`: `instagram`
- `status`: `connected`

If Supabase saving fails, the app falls back to the local encrypted store in:

```text
.postelligence-data/social-accounts.json
```

## The Page-Not-Returned Fix

The original issue was:

```text
No Facebook Pages were returned. Make sure your Facebook account manages a Page.
```

That happened because the app was calling `/me/accounts`, but Meta was not returning any Pages. The code now handles this better in three ways:

1. It requests `business_management`, which is often needed for Business Suite-managed Pages.
2. It sends `auth_type=rerequest`, so Meta asks again for scopes that were missing or previously declined.
3. If `/me/accounts` still returns no Pages, it calls `/me/permissions` and shows which scopes were not granted.

The new error message is more useful because it can say exactly which permission Meta did not grant.

## Dashboard UI Updates

The dashboard now reads connected Facebook, Instagram, and YouTube accounts from `socialAccounts`.

The platform cards, connected account list, upcoming posts, and publish modal now use real brand-style SVG logos for:

- Instagram
- Facebook
- LinkedIn
- X
- YouTube
- Pinterest

This replaced the older placeholder text and emoji-style icons.

## Common Debug Checklist

If Meta connects but Pages do not show:

1. Confirm the Facebook user has full control or admin access to the Page in Meta Business Suite.
2. Confirm the Page was selected in the Facebook permission dialog.
3. Disconnect and reconnect Meta so `auth_type=rerequest` can ask for permissions again.
4. Confirm the Meta app has these permissions configured:

```text
pages_show_list
pages_read_engagement
pages_manage_posts
business_management
instagram_basic
instagram_content_publish
```

5. Confirm the redirect URL in Meta exactly matches:

```text
http://127.0.0.1:3000/auth/meta/callback
```

6. Check the dashboard error message. If it lists missing scopes, those permissions were not granted by Meta.
7. If Instagram does not connect, confirm the direct Instagram redirect URL is configured in Instagram > API setup with Instagram login.

If Instagram authorization fails, confirm the Instagram app has the requested `instagram_business_*` permissions enabled and that `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` are from the Instagram API setup screen, not the Facebook Login setup.

## Useful Local Commands

Run the app:

```bash
npm.cmd run dev
```

Build and type-check:

```bash
npm.cmd run build
```

Local dashboard:

```text
http://127.0.0.1:3000/dashboard
```

Start Meta connection manually:

```text
http://127.0.0.1:3000/api/integrations/meta/connect
```

Start Instagram connection manually:

```text
http://127.0.0.1:3000/api/integrations/instagram/connect
```
