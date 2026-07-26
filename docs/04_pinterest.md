# 4_ Pinterest Integration

## Status: ⚠️ Waiting — Trial Access Approval Pending

---

## Overview

Pinterest is connected via OAuth 2.0 using Pinterest's v5 API. The app has been created on the Pinterest Developer Platform and the redirect URI has been registered. However, Pinterest requires **trial access approval** before providing the App Secret Key, which is needed to complete the OAuth token exchange.

---

## How the Connection Works (Once Approved)

1. User clicks **Connect** on the Pinterest card in the dashboard
2. App redirects to `/api/integrations/pinterest/connect`
3. A random `state` UUID is generated and stored in a secure HTTP-only cookie
4. User is redirected to `https://www.pinterest.com/oauth/` with required scopes
5. User logs into Pinterest (if not already) and grants permissions
6. Pinterest redirects back to `/auth/pinterest/callback?code=...&state=...`
7. The state is verified against the cookie to prevent CSRF attacks
8. The authorization code is exchanged for an access token and refresh token
9. The Pinterest user account info is fetched
10. Account is saved to the `social_accounts` table in Supabase
11. User is redirected to `/dashboard?pinterest=connected`

---

## Current Blocking Issue — Trial Access Pending

**Problem:** The Pinterest developer app has been created and configured, but the **App Secret Key** is unavailable. The dashboard shows:

> "Unavailable while trial access pending"

**Root cause:** Pinterest requires all new apps to go through a **trial access review** before they can use the full OAuth API. During the trial period, the App Secret is withheld and only limited "Production limited" access tokens can be generated.

**Fix:**
- Wait for Pinterest to approve trial access (typically a few hours to 1 business day)
- Once approved, the App Secret will become visible in the developer dashboard
- Copy the secret and add it to `.env.local`

---

## Developer App Setup

- **Platform:** Pinterest Developer Platform — `developers.pinterest.com`
- **App ID:** `1579076`
- **App Secret:** ⏳ Pending trial access approval
- **API version:** v5

---

## OAuth Scopes Requested

- `boards:read` — read user boards
- `boards:write` — create and manage boards
- `pins:read` — read pins
- `pins:write` — create and manage pins
- `user_accounts:read` — read user account info

---

## Redirect URIs

- **Local:** `http://localhost:3000/auth/pinterest/callback` ✅ (Pinterest accepts localhost)
- **Production:** `https://yourdomain.com/auth/pinterest/callback`

Pinterest explicitly states in their dashboard:
> "Redirect URIs must use https, an app-specific scheme or http with localhost."

This means Pinterest is **one of the few platforms that accepts localhost** redirect URIs, so the connection should work locally once the App Secret is available.

---

## Environment Variables

```env
PINTEREST_APP_ID=1579076
PINTEREST_APP_SECRET=your_secret_once_approved
```

---

## Files

```
app/api/integrations/pinterest/connect/route.ts     — starts OAuth flow
app/api/integrations/pinterest/callback/route.ts    — handles OAuth callback
app/api/integrations/pinterest/disconnect/route.ts  — disconnects account
app/auth/pinterest/callback/route.ts                — redirect stub
lib/integrations/pinterest.ts                       — OAuth helpers
```

---

## Steps Once Trial Access is Approved

1. Go to `developers.pinterest.com → My Apps → postelligence`
2. The App Secret field will now show the secret (click the eye icon to reveal)
3. Copy the secret
4. Add to `.env.local`:
   ```
   PINTEREST_APP_ID=1579076
   PINTEREST_APP_SECRET=your_secret_here
   ```
5. Restart the dev server
6. Test the connection on localhost

---

## Deployment Notes

When deploying to production:
1. Go to Pinterest Developer Platform → your app → **Configure** tab
2. Add `https://yourdomain.com/auth/pinterest/callback` to **Redirect URIs**
3. Set `PINTEREST_APP_ID` and `PINTEREST_APP_SECRET` in your production environment variables

---

## Action Required

- [ ] Wait for Pinterest trial access approval email
- [ ] Copy App Secret from Pinterest dashboard
- [ ] Add `PINTEREST_APP_SECRET` to `.env.local`
- [ ] Test the connection locally
