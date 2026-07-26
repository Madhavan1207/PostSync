# 3_ Bluesky Integration

## Status: ✅ Live & Working

---

## Overview

Bluesky uses a completely different authentication model from all other platforms. Instead of OAuth, Bluesky uses the **AT Protocol** with **App Passwords**. There is no developer app to register, no OAuth redirect, and no client credentials needed. Users simply generate an app password from their Bluesky account settings and enter it in Postelligence.

---

## How the Connection Works

1. User clicks **Connect** on the Bluesky card in the dashboard
2. A modal appears asking for:
   - **Bluesky handle** (e.g. `yourname.bsky.social`)
   - **App password** (generated at `bsky.app → Settings → App Passwords`)
3. User submits the form
4. Postelligence sends a `POST` request to `/api/integrations/bluesky/connect` with the handle and app password
5. The API calls `https://bsky.social/xrpc/com.atproto.server.createSession` with the credentials
6. Bluesky returns an `accessJwt` and `refreshJwt`
7. The user's profile is fetched using the access token
8. Account is saved to the `social_accounts` table in Supabase
9. The modal closes and the card updates to show the connected account

---

## What is an App Password?

An app password is a separate password specifically for third-party apps. It gives the app access to your Bluesky account without exposing your main account password. App passwords can be revoked at any time from Bluesky settings.

**How to generate one:**
1. Go to `bsky.app`
2. Click your profile → **Settings**
3. Navigate to **App Passwords**
4. Click **Add App Password**
5. Give it a name (e.g. "Postelligence")
6. Copy the generated password (shown only once)

---

## No Developer App Required

Unlike every other platform in Postelligence, Bluesky requires **zero setup on the developer side**. There is no:
- App registration
- Client ID or Secret
- OAuth redirect URI
- API approval process

This makes Bluesky the easiest platform to connect and the only one that works entirely within the modal without any browser redirect.

---

## API Details

- **Session creation endpoint:** `https://bsky.social/xrpc/com.atproto.server.createSession`
- **Profile fetch endpoint:** `https://bsky.social/xrpc/app.bsky.actor.getProfile`
- **Protocol:** AT Protocol (atproto)

---

## Token Storage

- `access_token` → stores the `accessJwt` (short-lived)
- `refresh_token` → stores the `refreshJwt` (long-lived)
- `token_expires_at` → null (Bluesky manages expiry internally)
- `metadata.handle` → stores the user's Bluesky handle for display

---

## Environment Variables

None required — Bluesky uses user-provided credentials.

---

## Files

```
app/api/integrations/bluesky/connect/route.ts     — accepts POST with handle + app password
app/api/integrations/bluesky/disconnect/route.ts  — disconnects account
lib/integrations/bluesky.ts                       — session + profile helpers
```

---

## Notes

- No auth callback route needed since there is no OAuth redirect
- The connection modal is built directly into `DashboardClient.tsx`
- Bluesky tokens may expire — future improvement would be to auto-refresh using the `refreshJwt`
- Works perfectly on localhost since there are no redirect URI restrictions
