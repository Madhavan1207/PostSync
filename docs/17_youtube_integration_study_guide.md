# 17_ Postelligence YouTube Integration Study Guide

This guide explains how YouTube account connection was integrated into Postelligence from scratch. It follows the code currently running on `http://localhost:3000`.

The integration is separate from Google login:

- **Supabase Google login** authenticates a person into Postelligence.
- **YouTube OAuth** grants an already-authenticated Postelligence user permission to access and manage a YouTube channel.

Never use the YouTube connection flow as a replacement for application authentication.

## 1. What Was Built

The completed integration allows an authenticated user to:

1. Click **Connect YouTube** in the existing Connected Accounts dashboard panel.
2. Authorize Postelligence through Google OAuth.
3. Grant YouTube read and upload permissions.
4. Return to Postelligence through a secure callback.
5. Exchange Google's short-lived authorization code for access and refresh tokens.
6. Fetch the user's YouTube channel name, ID, thumbnail, and metadata.
7. Store the connection.
8. See the connected channel in the dashboard.
9. Disconnect the channel.

No additional npm application dependencies were required. The implementation uses:

- Next.js route handlers
- Supabase authentication and database APIs
- Native `fetch`
- Node.js `crypto`, `fs`, and `path`

## 2. High-Level Architecture

```text
Dashboard UI
   |
   | Click "Connect YouTube"
   v
GET /api/integrations/youtube/connect
   |
   | Validate logged-in Supabase user
   | Create random OAuth state
   | Save state in HTTP-only cookie
   v
Google OAuth consent screen
   |
   | User grants YouTube scopes
   v
GET /auth/youtube/callback?code=...&state=...
   |
   | Validate logged-in user and OAuth state
   | Exchange code for tokens
   | Fetch YouTube channel
   | Save account in Supabase or encrypted local fallback
   v
/dashboard?youtube=connected
```

## 3. Google Cloud Configuration

### Required Google services

Inside the Google Cloud project:

1. Enable **YouTube Data API v3**.
2. Configure the Google Auth Platform consent screen.
3. Create an OAuth 2.0 Client with application type **Web application**.
4. Add your Google account as a test user if the app is in testing mode.

### Authorized JavaScript origin

```text
http://localhost:3000
```

### Authorized redirect URI

```text
http://localhost:3000/auth/youtube/callback
```

The redirect URI must match exactly. A different path, protocol, hostname, or port causes `redirect_uri_mismatch`.

### Environment variables

The project reads credentials only on the server from `.env.local`:

```env
YOUTUBE_CLIENT_ID=your_web_application_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_web_application_oauth_client_secret
```

The client ID normally ends with:

```text
.apps.googleusercontent.com
```

The client secret often begins with:

```text
GOCSPX-
```

Never prefix these variables with `NEXT_PUBLIC_`. Doing so would expose them to browser JavaScript.

After changing `.env.local`, restart the Next.js server.

## 4. Requested YouTube Permissions

The scopes are defined in `lib/integrations/youtube.ts`:

```ts
export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload"
];
```

### `youtube.readonly`

Allows Postelligence to read the authenticated user's YouTube account and channel information.

### `youtube.upload`

Allows Postelligence to upload and manage videos on behalf of the user.

Only request scopes the product actually needs. More powerful scopes increase user concern and Google verification requirements.

## 5. File Structure

```text
app/
  api/integrations/youtube/
    connect/route.ts
    callback/route.ts
    disconnect/route.ts
  auth/youtube/callback/route.ts
  dashboard/
    DashboardClient.tsx
    dashboard.module.css
    page.tsx

lib/integrations/
  youtube.ts
  social-accounts.ts
  local-social-accounts.ts

supabase/migrations/
  001_create_social_accounts.sql
```

## 6. Step-by-Step OAuth Flow

### Step 1: Dashboard starts the connection

In `app/dashboard/DashboardClient.tsx`, the button changes the browser location:

```ts
const connectYouTube = () => {
  window.location.href = "/api/integrations/youtube/connect";
};
```

OAuth is a full-page redirect flow, so changing `window.location.href` is appropriate.

### Step 2: Connect route validates the user

`app/api/integrations/youtube/connect/route.ts`:

1. Creates a Supabase server client.
2. Calls `supabase.auth.getUser()`.
3. Redirects unauthenticated users to `/`.
4. Creates a cryptographically random `state`.
5. Builds the Google authorization URL.
6. Saves the state and user ID in an HTTP-only cookie.
7. Redirects the browser to Google.

The state cookie is configured with:

- `httpOnly: true`: browser JavaScript cannot read it.
- `sameSite: "lax"`: allows the top-level OAuth callback while limiting cross-site cookie use.
- Ten-minute expiry: stale OAuth attempts expire quickly.
- `secure: true` when using HTTPS.

### Step 3: OAuth URL is generated

`lib/integrations/youtube.ts` builds this request:

```ts
url.searchParams.set("client_id", clientId);
url.searchParams.set("redirect_uri", getYouTubeRedirectUri(origin));
url.searchParams.set("response_type", "code");
url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
url.searchParams.set("state", state);
url.searchParams.set("access_type", "offline");
url.searchParams.set("prompt", "consent");
url.searchParams.set("include_granted_scopes", "true");
```

Important parameters:

- `response_type=code`: uses the authorization-code flow.
- `access_type=offline`: asks Google for a refresh token.
- `prompt=consent`: makes Google show consent and helps obtain a refresh token.
- `state`: protects the callback against CSRF and session confusion.

### Step 4: User approves permissions

Google shows:

- Manage your YouTube videos.
- View your YouTube account.

After approval, Google redirects to:

```text
http://localhost:3000/auth/youtube/callback?code=...&state=...
```

### Step 5: Callback alias forwards to the callback handler

Google Cloud is configured with `/auth/youtube/callback`.

`app/auth/youtube/callback/route.ts` re-exports the main callback handler:

```ts
export { dynamic, GET } from "@/app/api/integrations/youtube/callback/route";
```

This keeps the external callback URL clean while keeping integration API code grouped together.

### Step 6: Callback validates state and user

`app/api/integrations/youtube/callback/route.ts` validates:

1. Google did not return an OAuth error.
2. Both `code` and `state` exist.
3. The Postelligence user is still logged in.
4. The returned state matches the HTTP-only state cookie.
5. The state cookie belongs to the current user.

The state cookie is deleted after the callback.

### Step 7: Authorization code is exchanged for tokens

The callback calls `exchangeYouTubeCode()` from `lib/integrations/youtube.ts`.

It sends a server-to-server POST request to:

```text
https://oauth2.googleapis.com/token
```

Request fields:

```text
client_id
client_secret
code
grant_type=authorization_code
redirect_uri
```

Google returns:

- `access_token`: short-lived token used for YouTube API calls.
- `refresh_token`: long-lived token used to obtain new access tokens.
- `expires_in`: access-token lifetime.
- `scope`: approved scopes.

The client secret and token exchange must happen on the backend, never in browser code.

### Step 8: Channel information is fetched

The app requests:

```text
GET https://www.googleapis.com/youtube/v3/channels
    ?part=snippet,contentDetails,statistics
    &mine=true
```

The access token is sent as:

```http
Authorization: Bearer ACCESS_TOKEN
```

The response is transformed into:

```ts
{
  id: channel.id,
  name: channel.snippet.title,
  thumbnailUrl: channel.snippet.thumbnails.high.url,
  raw: channel
}
```

### Step 9: Account connection is stored

The callback first attempts to save the connection in Supabase's `social_accounts` table.

For the current localhost setup, if that table is unavailable, the app uses an encrypted local fallback in:

```text
.postelligence-data/social-accounts.json
```

The local fallback:

- Is server-only.
- Encrypts access and refresh tokens with AES-256-GCM.
- Derives its encryption key from the YouTube client secret.
- Is excluded from Git.
- Lets the localhost demo work before the Supabase migration is applied.

For production, use a managed database and a dedicated secret-management or encryption strategy. Do not depend on local filesystem storage in serverless or multi-instance deployments.

### Step 10: Dashboard displays the connection

`app/dashboard/page.tsx`:

1. Verifies the logged-in Supabase user.
2. Attempts to load accounts from Supabase.
3. Uses the local encrypted account store when the Supabase table is unavailable.
4. Passes the accounts to `DashboardClient`.

`DashboardClient.tsx` finds the connected YouTube account:

```ts
const youtubeAccount = getConnectedYouTubeAccount(socialAccounts);
```

The existing YouTube row then displays:

- Channel thumbnail
- Channel name
- Connected state
- Disconnect button

## 7. Disconnect Flow

The dashboard sends:

```http
DELETE /api/integrations/youtube/disconnect
```

The backend:

1. Verifies the current Supabase user.
2. Clears tokens and marks the Supabase account disconnected.
3. Falls back to updating local encrypted storage if Supabase is unavailable.
4. Returns `{ "ok": true }`.
5. Redirects the UI to `/dashboard?youtube=disconnected`.

This disconnects the account inside Postelligence. A production implementation may also revoke the Google token using Google's token-revocation endpoint.

## 8. Reusable Social Account Model

The Supabase migration creates a platform-neutral table:

```sql
create table public.social_accounts (
  id uuid primary key,
  user_id uuid references auth.users(id),
  platform text not null,
  account_id text not null,
  account_name text not null,
  account_avatar_url text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  status text,
  metadata jsonb,
  connected_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
```

This structure can support YouTube, Instagram, Facebook, LinkedIn, X, Pinterest, and future integrations.

The migration also enables Row Level Security so authenticated users can only access their own account rows.

Production improvement: encrypt access and refresh tokens before storing them. Row Level Security controls row access but does not itself encrypt column values.

## 9. Security Decisions

### Implemented

- OAuth client secret remains server-side.
- Access and refresh tokens remain server-side.
- OAuth state is random and validated.
- State is stored in an HTTP-only cookie.
- OAuth attempts expire after ten minutes.
- Callback requires an authenticated Postelligence user.
- Local tokens are encrypted with AES-256-GCM.
- `.env.local` and `.postelligence-data` are Git-ignored.
- Supabase migration uses Row Level Security.

### Required before production

- Rotate any client secret that was shared through chat, screenshots, or logs.
- Use HTTPS.
- Store production tokens using managed encryption or a secret manager.
- Revoke Google tokens during disconnect.
- Add refresh-token rotation logic.
- Add rate limiting and structured audit logging.
- Configure Google OAuth branding, privacy policy, terms, and verification.
- Move the OAuth app from testing to production when ready.

## 10. Running and Testing

### Install

```powershell
yarn install
```

### Type check

```powershell
node_modules\.bin\tsc.cmd --noEmit
```

### Production build

```powershell
node_modules\.bin\next.cmd build
```

### Run locally

```powershell
node_modules\.bin\next.cmd start --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://localhost:3000/dashboard
```

### Manual test checklist

1. Log in to Postelligence.
2. Open the dashboard.
3. Confirm YouTube displays **Connect YouTube**.
4. Click Connect YouTube.
5. Confirm Google's URL uses the correct client ID.
6. Confirm the requested scopes include `youtube.readonly` and `youtube.upload`.
7. Approve the permissions.
8. Confirm the browser returns to `/dashboard?youtube=connected`.
9. Confirm the dashboard shows the channel name and Disconnect button.
10. Reload the dashboard and confirm the connected state persists.
11. Click Disconnect and confirm the row returns to the connect state.

## 11. Common Errors

### `redirect_uri_mismatch`

Cause: Google Cloud redirect URI does not exactly match the application.

Required value:

```text
http://localhost:3000/auth/youtube/callback
```

### `invalid_client`

Cause: wrong client ID or client secret.

Fix:

- Copy both values from the same Google OAuth Web application client.
- Remove accidental spaces or extra characters.
- Restart Next.js after editing `.env.local`.

### Access blocked or app not verified

Cause: OAuth app is in testing mode, the account is not a test user, or Google requires verification.

Fix: add the Google account under Google Auth Platform test users and configure the consent screen.

### No YouTube channel returned

Cause: the selected Google account does not have a YouTube channel.

Fix: create a channel or select another Google account.

### Supabase table missing

For localhost, the app falls back to encrypted local storage.

For production, execute:

```text
supabase/migrations/001_create_social_accounts.sql
```

### Connection disappears after deployment

Cause: local filesystem fallback is not durable across serverless deployments or multiple instances.

Fix: use the Supabase table or another persistent database.

## 12. Extending the Integration to Upload Videos

The current integration requests `youtube.upload`, but it does not yet implement the upload UI or API route.

A future upload route would:

1. Read the authenticated user's connected YouTube account.
2. Refresh the access token if expired.
3. Validate video metadata and file size.
4. Upload through YouTube's resumable upload API.
5. Store upload progress and the resulting video ID.
6. Return publishing status to the dashboard.

Avoid accepting large video uploads directly through a short-lived serverless function. Use object storage, background jobs, resumable uploads, and a publishing queue.

## 13. Key Lessons

1. Authentication and platform authorization are different concerns.
2. OAuth secrets and token exchange belong on the backend.
3. `state` validation is mandatory for a secure OAuth flow.
4. Redirect URIs must match exactly.
5. Refresh tokens make long-lived integrations possible.
6. Platform-specific API code should be isolated from reusable social-account storage.
7. Local encrypted storage is useful for development, but production needs durable managed storage.
8. A scalable integration UI should reuse the application's existing Connected Accounts patterns.
