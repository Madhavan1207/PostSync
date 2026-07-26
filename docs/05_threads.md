# 5_ Threads Integration

## Status: ⏳ Deploy Only — Not Working on Localhost

---

## Overview

Threads is connected via Meta's Threads API using OAuth 2.0. It uses a separate Threads app registered on the Meta Developer Portal under the "Access the Threads API" use case. The connection cannot be tested locally because Meta rejects `localhost` redirect URIs for the Threads API.

---

## How the Connection Works (Once Deployed)

1. User clicks **Connect** on the Threads card in the dashboard
2. App redirects to `/api/integrations/threads/connect`
3. A random `state` UUID is generated and stored in a secure HTTP-only cookie
4. User is redirected to `https://threads.net/oauth/authorize` with required scopes
5. User logs into Threads (if not already) and grants permissions
6. Threads redirects back to `/auth/threads/callback?code=...&state=...`
7. The state is verified against the cookie to prevent CSRF attacks
8. The short-lived code is exchanged for a short-lived access token
9. The short-lived token is exchanged for a long-lived token (60 days)
10. The Threads user profile is fetched
11. Account is saved to the `social_accounts` table in Supabase
12. User is redirected to `/dashboard?threads=connected`

---

## Why It Doesn't Work on Localhost

Meta's Threads API **does not accept `localhost` redirect URIs**. When attempting to add `http://localhost:3000/auth/threads/callback` in the Meta dashboard under:

`Use cases → Access the Threads API → Settings → Redirect Callback URLs`

Meta throws the error:
> "Form can't be saved. Please verify all information is entered correctly and try again."

The Redirect Callback URLs field resets after the failed save. This is the same restriction as Instagram — Meta only allows HTTPS URLs with real domains for OAuth callbacks.

---

## Developer App Setup

- **Platform:** Meta Developer Portal — `developers.facebook.com`
- **App name:** `postelligence2`
- **Threads App ID:** `1025230530064554`
- **Threads App Secret:** Stored in `.env.local`
- **Use case:** Access the Threads API

---

## OAuth Scopes Requested

- `threads_basic` — read basic profile info
- `threads_content_publish` — publish content to Threads
- `threads_manage_replies` — manage replies
- `threads_read_replies` — read replies

---

## Token Flow

Threads uses a **two-step token exchange**:

1. **Short-lived token** — obtained from the initial code exchange, valid for 1 hour
2. **Long-lived token** — obtained by exchanging the short-lived token, valid for 60 days

The long-lived token is what gets stored in the database.

---

## Redirect URIs

- **Local:** ❌ Not supported by Meta
- **Production:** `https://yourdomain.com/auth/threads/callback`

---

## Environment Variables

```env
THREADS_APP_ID=1025230530064554
THREADS_APP_SECRET=your_threads_app_secret
```

---

## Files

```
app/api/integrations/threads/connect/route.ts     — starts OAuth flow
app/api/integrations/threads/callback/route.ts    — handles OAuth callback + token exchange
app/api/integrations/threads/disconnect/route.ts  — disconnects account
app/auth/threads/callback/route.ts                — redirect stub
lib/integrations/threads.ts                       — OAuth + token helpers
```

---

## Deployment Steps

1. Go to Meta Developer Portal → `postelligence2` app
2. Navigate to **Use cases → Access the Threads API → Settings**
3. Under **Redirect Callback URLs**, add: `https://yourdomain.com/auth/threads/callback`
4. Click Save
5. Set environment variables in your production hosting platform:
   ```
   THREADS_APP_ID=1025230530064554
   THREADS_APP_SECRET=your_secret
   ```
6. Deploy and test the connection

---

## Notes

- The Threads API is relatively new and still evolving
- Threads uses `graph.threads.net` as its API base (separate from `graph.facebook.com`)
- Token refresh is done by calling `graph.threads.net/refresh_access_token`
