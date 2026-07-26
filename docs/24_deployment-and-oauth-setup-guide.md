# 24_ Postelligence Production Deployment & OAuth Configuration Guide

This document provides a comprehensive record of all deployment settings, domain configurations, environment variables, and social platform OAuth redirect URIs required to run Postelligence in production at **`https://postelligence.vercel.app`**.

---

## 1. Primary Application Domains

* **Live Production Domain:** `https://postelligence.vercel.app`
* **Local Development Domain:** `https://localhost:3000`
* **Privacy Policy URL (OAuth Live Verification):** `https://postelligence.vercel.app/privacy`

---

## 2. Platform-by-Platform OAuth Settings

### A. Meta / Facebook Developers (`developers.facebook.com`)
* **App Name:** `postsync final`
* **App Settings → Basic:**
  * **App Domains:** `postelligence.vercel.app`
  * **Privacy Policy URL:** `https://postelligence.vercel.app/privacy`
* **Facebook Login for Business → Settings:**
  * **Valid OAuth Redirect URIs:**
    * `https://postelligence.vercel.app/auth/meta/callback`
    * `https://localhost:3000/auth/meta/callback`
  * **Deauthorize Callback URL:** `https://postelligence.vercel.app/api/integrations/threads/deauthorize`
  * **Data Deletion Request Callback URL:** `https://postelligence.vercel.app/api/integrations/threads/data-deletion`

---

### B. Instagram API (Meta Developer Console)
* **Use Cases → Manage messaging & content on Instagram / API setup with Instagram login:**
  * **OAuth Redirect URIs:**
    * `https://postelligence.vercel.app/auth/instagram/callback`
    * `https://postelligence.vercel.app/auth/meta/callback`
  * **Deauthorize Callback URL:** `https://postelligence.vercel.app/api/integrations/threads/deauthorize`
  * **Data Deletion Request URL:** `https://postelligence.vercel.app/api/integrations/threads/data-deletion`

---

### C. Threads API (Meta Developer Console)
* **Use Cases → Threads API → Settings:**
  * **Redirect URIs:**
    * `https://postelligence.vercel.app/auth/threads/callback`
    * `https://localhost:3000/auth/threads/callback`
  * **Uninstall Callback URL:** `https://postelligence.vercel.app/api/integrations/threads/deauthorize`
  * **Data Deletion Request Callback URL:** `https://postelligence.vercel.app/api/integrations/threads/data-deletion`

---

### D. YouTube / Google Cloud Console (`console.cloud.google.com`)
* **APIs & Services → Credentials → OAuth 2.0 Client IDs:**
  * **Authorized JavaScript Origins:**
    * `https://postelligence.vercel.app`
    * `https://localhost:3000`
  * **Authorized Redirect URIs:**
    * `https://postelligence.vercel.app/auth/youtube/callback`
    * `https://localhost:3000/auth/youtube/callback`

---

### E. LinkedIn Developer Portal (`linkedin.com/developers`)
* **My Apps → [Your App] → Auth:**
  * **Authorized Redirect URLs for your app:**
    * `https://postelligence.vercel.app/auth/linkedin/callback`
    * `https://localhost:3000/auth/linkedin/callback`
  * **Products Enabled:**
    * *Share on LinkedIn*
    * *Sign In with LinkedIn using OpenID Connect*

---

### F. Twitter / X Developer Portal (`developer.twitter.com`)
* **Projects & Apps → [Your App] → User Authentication Settings:**
  * **App Info → Callback URLs:**
    * `https://postelligence.vercel.app/auth/twitter/callback`
    * `https://localhost:3000/auth/twitter/callback`
  * **Website URL:** `https://postelligence.vercel.app`
  * **Terms of Service / Privacy Policy URL:** `https://postelligence.vercel.app/privacy`

---

### G. Pinterest Developer Console (`developers.pinterest.com`)
* **My Apps → [Your App] → Redirect URIs:**
  * `https://postelligence.vercel.app/auth/pinterest/callback`
  * `https://localhost:3000/auth/pinterest/callback`

---

## 3. Vercel Environment Variables (`.env`)

Ensure the following variables are configured in **Vercel Project Settings → Environment Variables**:

| Variable | Production Value |
| :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | `https://postelligence.vercel.app` |
| `YOUTUBE_REDIRECT_URI` | `https://postelligence.vercel.app/auth/youtube/callback` |
| `INSTAGRAM_REDIRECT_URI` | `https://postelligence.vercel.app/auth/instagram/callback` |
| `TWITTER_REDIRECT_URI` | `https://postelligence.vercel.app/auth/twitter/callback` |
| `THREADS_REDIRECT_URI` | `https://postelligence.vercel.app/auth/threads/callback` |
| `LINKEDIN_REDIRECT_URI` | `https://postelligence.vercel.app/auth/linkedin/callback` |
| `PINTEREST_REDIRECT_URI` | `https://postelligence.vercel.app/auth/pinterest/callback` |
| `NODE_ENV` | `production` |

---

## 4. Inngest Background Scheduler Sync

* **Inngest Cloud Dashboard:** `app.inngest.com`
* **Synced App Endpoint:** `https://postelligence.vercel.app/api/inngest`
* **Webhook Signing Check:** Handled automatically via `NODE_ENV === "production"` HMAC signature validation in `lib/inngest/client.ts`.

---

## 5. Verification Checklist

- [x] All 7 platforms connect successfully on `https://postelligence.vercel.app/integrations`
- [x] Privacy policy returns HTTP 200 at `https://postelligence.vercel.app/privacy`
- [x] Inngest background event sync active at `https://postelligence.vercel.app/api/inngest`
- [x] Mobile drawer and platform mosaic UI validated on mobile/tablet screen sizes
