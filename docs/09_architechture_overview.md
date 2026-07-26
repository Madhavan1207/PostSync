# 9_ Postelligence — Architecture & Project Overview

## 1. What is Postelligence?

Postelligence is a **social media management dashboard**. A user logs in once, connects their social media accounts (Instagram, Facebook, LinkedIn, X/Twitter, Threads, Bluesky, Pinterest, YouTube), and from a single screen can:

- Write **one post** (text + image/video).
- Choose **which platforms** to publish it to.
- Click **Publish**, and Postelligence sends that post to every selected platform's API at the same time.

In simple words: instead of opening 8 different apps and posting the same content 8 times, you do it once from Postelligence.

---

## 2. Tech Stack (and why each piece is used)

| Layer | Technology | Why it's used |
|---|---|---|
| Framework | **Next.js (App Router)** | Lets us write both the frontend (React pages) and backend (API routes) in the same project. |
| Language | **TypeScript** | Adds type-checking to JavaScript so we catch mistakes (like a typo'd field name) before running the app. |
| Styling | **Tailwind CSS** | Utility classes (`flex`, `rounded-xl`, `text-sm`) instead of writing separate CSS files for everything. |
| Animations | **Framer Motion** | Smooth fade/slide animations for cards, modals, sidebars. |
| Icons | **lucide-react** | A consistent icon set used across the whole dashboard. |
| Auth & Database | **Supabase** | Handles user login (Google OAuth) and stores connected social accounts in a Postgres database. |
| File storage | **Supabase Storage** | Stores images/videos the user uploads so platforms like Facebook/Instagram can fetch them via a public URL. |
| Package manager | **Yarn** (v1 Classic) | Deterministic installs via a committed `yarn.lock`. |

---

## 3. High-Level Folder Structure

```text
Postelligence/
├── app/                          → Next.js App Router (pages + API routes)
│   ├── page.tsx                  → Landing / login page
│   ├── layout.tsx                → Root HTML layout, wraps every page
│   ├── auth/
│   │   ├── callback/route.ts     → Supabase Google login callback
│   │   └── <platform>/callback/  → OAuth redirect "stubs" for each social platform
│   ├── dashboard/
│   │   ├── page.tsx              → Main dashboard (server component, fetches data)
│   │   ├── DashboardClient.tsx   → The actual interactive dashboard UI (client component)
│   │   └── create/page.tsx       → Dedicated "Create Post" page
│   └── api/
│       ├── integrations/<platform>/connect|callback|disconnect/route.ts
│       └── posts/publish/route.ts → The "publish to all platforms" engine
├── components/
│   ├── login-button.tsx          → "Continue with Google" button
│   ├── sign-out-button.tsx
│   ├── email-auth-form.tsx
│   └── ui/                       → Reusable UI pieces (Button, Badge, GlassPanel)
├── lib/
│   ├── supabase/
│   │   ├── client.ts             → Supabase client for the browser
│   │   └── server.ts             → Supabase client for the server (reads cookies)
│   └── integrations/
│       ├── social-accounts.ts          → Shared types + helper functions
│       ├── local-social-accounts.ts    → Fallback storage when Supabase table is missing
│       ├── youtube.ts, twitter.ts, ... → One file per platform (OAuth URL builders, API calls)
├── supabase/migrations/          → SQL files that create the database tables
└── docs/                          → This documentation folder
```

---

## 4. The Two Big Jobs of the App

Postelligence solves two completely separate problems, and it's important to understand they don't overlap:

### Job 1 — "Who are you?" (Authentication)
Handled by **Supabase Auth + Google Login**. This answers: *is this a real, logged-in Postelligence user?*
→ Explained in `02-authentication-and-supabase.md`.

### Job 2 — "Which social accounts can we post on your behalf?" (Integrations)
Handled by **separate OAuth flows per platform** (YouTube, Meta, Twitter, etc). Each platform has its own developer app, its own tokens, and its own rules. Postelligence stores these tokens in the `social_accounts` table.
→ Each platform has its own doc (`04-twitter.md`, `05-threads.md`, `META_INTEGRATION_GUIDE.md`, etc).

**Key idea:** Logging into Postelligence with Google does *not* automatically connect your YouTube/Gmail account for posting. Those are two different permission grants, done at two different times, for two different purposes.

---

## 5. End-to-End Request Flow (Big Picture)

```text
┌──────────────┐      1. Login with Google      ┌──────────────┐
│   Browser     │ ──────────────────────────────▶│   Supabase    │
│  (Next.js UI) │ ◀────────────────────────────── │     Auth      │
└──────┬───────┘      session cookie set         └──────────────┘
       │
       │ 2. Visit /dashboard
       ▼
┌──────────────────────────┐
│ app/dashboard/page.tsx     │  (Server Component)
│  - reads logged-in user    │
│  - fetches social_accounts │
│    table from Supabase     │
└──────────┬─────────────────┘
           │ passes data as props
           ▼
┌──────────────────────────┐
│ DashboardClient.tsx        │  (Client Component — interactive UI)
│  - shows connected accounts│
│  - "Connect" buttons        │
│  - Draft Composer           │
└──────────┬─────────────────┘
           │ 3. user clicks "Connect Instagram"
           ▼
┌──────────────────────────────────────┐
│ /api/integrations/instagram/connect    │ → redirects to Instagram's OAuth page
└──────────────────────────────────────┘
           │ 4. user approves on Instagram
           ▼
┌──────────────────────────────────────┐
│ /api/integrations/instagram/callback   │
│  - exchanges code for access token     │
│  - saves row in social_accounts table  │
└──────────────────────────────────────┘
           │
           ▼
   redirected back to /dashboard?instagram=connected

           │ 5. user writes a post and clicks "Publish"
           ▼
┌──────────────────────────────────────┐
│ POST /api/posts/publish                │
│  - reads connected accounts             │
│  - uploads attachment to Supabase       │
│    Storage (if any)                     │
│  - calls each platform's API            │
│  - returns success/failure per platform │
└──────────────────────────────────────┘
```

---

## 6. Where to Read Next

| If you want to understand... | Read this doc |
|---|---|
| How login works (Google + Supabase) | `02-authentication-and-supabase.md` |
| How the `social_accounts` database table is structured | `02-authentication-and-supabase.md` |
| How the Dashboard & Create Post page UI works | `03-dashboard-ui.md` |
| How a single click publishes to 8 platforms at once | `09-publish-engine.md` |
| How a specific platform (Twitter, LinkedIn, etc.) is connected | The numbered file for that platform (e.g. `04-twitter.md`) |

---

*Made by - Siddharth Jagdale*
