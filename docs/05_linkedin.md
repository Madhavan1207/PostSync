# 5_ LinkedIn Integration

## Status: ✅ Live & Working

---

## Overview

LinkedIn is connected via OAuth 2.0 using OpenID Connect. Users authenticate through LinkedIn's official login flow, and their LinkedIn profile is saved to the database. Postelligence uses the `Sign In with LinkedIn using OpenID Connect` product which provides access to profile data and the ability to post content.

---

## How the Connection Works

1. User clicks **Connect** on the LinkedIn card in the dashboard
2. App redirects to `/api/integrations/linkedin/connect`
3. A random `state` UUID is generated and stored in a secure HTTP-only cookie
4. User is redirected to `https://www.linkedin.com/oauth/v2/authorization` with required scopes and `prompt=login`
5. User logs into LinkedIn and grants permissions
6. LinkedIn redirects back to `/auth/linkedin/callback?code=...&state=...`
7. The state is verified against the cookie to prevent CSRF attacks
8. The authorization code is exchanged for an access token
9. The LinkedIn user profile is fetched from `https://api.linkedin.com/v2/userinfo`
10. Account is saved to the `social_accounts` table in Supabase
11. User is redirected to `/dashboard?linkedin=connected`

---

## Auto-Approval Behavior

LinkedIn uses **silent OAuth** when the user is already logged into LinkedIn in the same browser. In this case, LinkedIn skips showing the consent screen and immediately redirects back with the authorization code. This results in the connection appearing to happen "instantly" without any visible LinkedIn page.

**This is intentional and correct behavior.** It is the same pattern used by Buffer, Hootsuite, Later, and every major social media scheduling tool. The connection is fully authenticated and real.

To force the login page to always appear (e.g. for switching accounts):
- The app uses `prompt=login` in the OAuth URL, which forces LinkedIn to show the login page
- If LinkedIn still auto-approves, the user can log out of LinkedIn in their browser first and then connect

---

## Developer App Setup

- **Platform:** LinkedIn Developer Portal — `linkedin.com/developers`
- **App name:** `postelligence`
- **Client ID:** `77pll4k9nhr1ri`
- **App type:** Standalone app

---

## Products Added

| Product | Status |
|---|---|
| Sign In with LinkedIn using OpenID Connect | ✅ Added |
| Share on LinkedIn | ⏳ Requested (awaiting approval) |

**Note:** The "Share on LinkedIn" product is required to publish posts to LinkedIn. It has been requested and is pending LinkedIn's review. Once approved, posting functionality can be implemented.

---

## OAuth Scopes Requested

- `openid` — OpenID Connect authentication
- `profile` — read name, photo, and basic profile
- `email` — read email address
- `w_member_social` — write posts on behalf of the user (requires Share on LinkedIn product)

---

## Redirect URIs

- **Local:** `http://localhost:3000/auth/linkedin/callback` ✅ (LinkedIn accepts localhost)
- **Production:** `https://yourdomain.com/auth/linkedin/callback`

Both must be registered in LinkedIn Developer Portal under:
`App → Auth → Authorized redirect URLs for your app`

---

## Environment Variables

```env
LINKEDIN_CLIENT_ID=77pll4k9nhr1ri
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
```

---

## Files

```
app/api/integrations/linkedin/connect/route.ts     — starts OAuth flow
app/api/integrations/linkedin/callback/route.ts    — handles OAuth callback
app/api/integrations/linkedin/disconnect/route.ts  — disconnects account
app/auth/linkedin/callback/route.ts                — redirect stub
lib/integrations/linkedin.ts                       — OAuth helpers
```

---

## Token Details

- **Access token expiry:** 2 months (5,184,000 seconds)
- **Refresh token:** Not provided by LinkedIn (user must reconnect after 2 months)
- **Token stored in:** `social_accounts.access_token`
- **Expiry stored in:** `social_accounts.token_expires_at`

---

## Deployment Notes

When deploying to production:
1. Go to LinkedIn Developer Portal → `postelligence` app → **Auth** tab
2. Add `https://yourdomain.com/auth/linkedin/callback` to **Authorized redirect URLs**
3. Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in your production environment variables

---

## Pending

- [ ] Wait for LinkedIn to approve the "Share on LinkedIn" product request
- [ ] Once approved, implement post creation using `https://api.linkedin.com/v2/ugcPosts`