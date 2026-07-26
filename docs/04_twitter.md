# 4_ X / Twitter Integration

## Status: ⚠️ Blocked — Phone Number Verification Required

---

## Overview

Twitter/X is connected via OAuth 2.0 with PKCE (Proof Key for Code Exchange). PKCE is the modern, secure OAuth flow that doesn't require storing a client secret on the client side. The code is fully implemented but the connection is currently blocked by a Twitter account requirement.

---

## How the Connection Works

1. User clicks **Connect** on the X / Twitter card in the dashboard
2. App redirects to `/api/integrations/twitter/connect`
3. A PKCE `code_verifier` (random string) and `code_challenge` (SHA-256 hash of verifier) are generated
4. A random `state` UUID is generated
5. Both the state and code verifier are stored in a secure HTTP-only cookie
6. User is redirected to `https://twitter.com/i/oauth2/authorize` with the code challenge
7. User logs into Twitter and grants permissions
8. Twitter redirects back to `/auth/twitter/callback?code=...&state=...`
9. The state is verified against the cookie to prevent CSRF attacks
10. The authorization code is exchanged for tokens using the code verifier
11. The Twitter user profile is fetched
12. Account is saved to the `social_accounts` table in Supabase
13. User is redirected to `/dashboard?twitter=connected`

---

## Current Blocking Issue — Phone Number Required

**Problem:** When clicking Connect, the Twitter OAuth consent screen shows a **completely blank black page** instead of the login/permission screen.

**Root cause:** Twitter requires the developer account (`@RishiDembla1`) to have a **verified phone number** before OAuth flows work. Without it, Twitter silently blocks the consent screen from loading.

**Fix:**
1. Go to `twitter.com`
2. Navigate to **Settings → Your account → Account information → Phone**
3. Add and verify a phone number
4. Try connecting again — the OAuth consent screen should load normally

---

## localhost vs 127.0.0.1

Twitter **does not accept `http://localhost`** as a redirect URI but **does accept `http://127.0.0.1`**.

- **Registered redirect URI:** `http://127.0.0.1:3000/auth/twitter/callback`
- When testing locally, always open the app at `http://127.0.0.1:3000` not `http://localhost:3000`

The code handles this automatically — `getTwitterRedirectUri()` in `lib/integrations/twitter.ts` replaces `localhost` with `127.0.0.1` for local development.

---

## Developer App Setup

- **Platform:** X Developer Portal — `developer.twitter.com`
- **App name:** `postelligence1`
- **App ID:** `33039318`
- **Access tier:** Pay Per Use
- **OAuth version:** OAuth 2.0 with PKCE

---

## OAuth Scopes Requested

- `tweet.read` — read tweets
- `tweet.write` — create and delete tweets
- `users.read` — read user profile info
- `offline.access` — get refresh tokens for long-lived access

---

## User Authentication Settings

In the X Developer Portal under your app:
- **App permissions:** Read and write
- **Type of App:** Web App
- **Callback URI:** `http://127.0.0.1:3000/auth/twitter/callback`
- **Website URL:** `http://localhost:3000`

---

## Environment Variables

```env
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
```

---

## Files

```
app/api/integrations/twitter/connect/route.ts     — starts OAuth 2.0 PKCE flow
app/api/integrations/twitter/callback/route.ts    — handles OAuth callback
app/api/integrations/twitter/disconnect/route.ts  — disconnects account
app/auth/twitter/callback/route.ts                — redirect stub
lib/integrations/twitter.ts                       — PKCE + OAuth helpers
```

---

## Deployment Notes

When deploying to production:
1. Go to X Developer Portal → `postelligence1` → **User authentication settings**
2. Add `https://yourdomain.com/auth/twitter/callback` as an additional Callback URI
3. Set `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` in your production environment variables
4. Both localhost (127.0.0.1) and production URIs can be registered at the same time

---

## Action Required Before Testing

- [ ] Add verified phone number to `@RishiDembla1` Twitter account
- [ ] Re-test the connection after phone number is verified
