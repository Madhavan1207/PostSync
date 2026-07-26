# 3_ Dashboard UI & the Create Post Page

This doc explains how the visual dashboard is built, how navigation works, and — specifically — how the **Draft Composer / Create Post** experience is structured as its **own dedicated page** (not a popup or a section squeezed into the dashboard home screen).

---

## 1. The Two Pages Involved

| Route | File | Purpose |
|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` → `DashboardClient.tsx` | The home screen: overview cards, connected platforms, AI suggestions, scheduled posts. |
| `/dashboard/create` | `app/dashboard/create/page.tsx` → `DashboardClient.tsx` (with a flag) | The **Create Post** screen — composer, platform picker, publish modal. |

Both routes are **server components** that:
1. Check if a user is logged in (`redirect("/")` if not).
2. Fetch the user's `social_accounts` from Supabase (or the local fallback).
3. Pass everything down as props to `DashboardClient`.

```ts
// app/dashboard/create/page.tsx
export default async function CreatePostPage({ searchParams }: CreatePageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: socialAccounts, error } = await supabase
    .from("social_accounts")
    .select("...")
    .eq("user_id", user.id);

  return <DashboardClient user={user} socialAccounts={...} ... />;
}
```

---

## 2. Why One Component (`DashboardClient`) Serves Two Pages

`DashboardClient.tsx` is a large client component containing **all** the shared dashboard chrome:
- The collapsible left **sidebar** (logo, nav links, user avatar).
- The top **header bar** (search, notifications, avatar dropdown).
- The **platform connection cards** (Instagram, YouTube, etc.).
- The **Composer** (title, caption, tags, attachments, platform selector).
- The **Publish modal**.

Instead of duplicating all of this sidebar/header/platform logic in two separate files, both `/dashboard` and `/dashboard/create` render the *same* `DashboardClient`, which internally decides what to show based on the **current URL / active nav item**.

### How "Create" becomes its own page (not a popup)

Earlier in development, clicking **"Create"** in the sidebar, or **"New Post"** on the dashboard, simply toggled a piece of state (`activeNav === "create"`) and revealed the composer **inside the same dashboard page** — so it looked like a section appearing/disappearing on the home screen.

This was changed so that:

1. The sidebar's **"Create"** nav item is a real link to **`/dashboard/create`** (a separate route), not a state toggle.
2. The **"New Post"** button in the Command Center and the **"Quick create"** floating button also navigate to `/dashboard/create`.
3. `DashboardClient` checks the current route (or an `initialView` prop) — when it's the Create route, it renders **only** the composer layout (two-column: composer + upcoming scheduled posts), hiding the overview cards, platform grid, AI copilot section, etc.
4. The Create page gets its **own header** with a **back arrow (`←`) to `/dashboard`**, so navigation feels like a proper separate screen, not a hidden tab.

### Why this is "more logical"

- **Separation of concerns**: the home screen is for *monitoring* (status, analytics, scheduled posts). The Create screen is for *focused writing* — no distractions.
- **Browser-native navigation**: users can bookmark `/dashboard/create`, hit the back button, or open it in a new tab — none of which worked when it was just a state toggle.
- **Cleaner code paths**: each page's server component only fetches what it needs and can independently add page-specific `searchParams` (e.g. OAuth redirect statuses) without affecting the other page.

---

## 3. Sidebar Navigation

The sidebar (`navItems` array) lists every section of the app:

```ts
const navItems = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "create", label: "Create", icon: PenLine },
  { id: "calendar", label: "Calendar", icon: CalendarClock },
  { id: "library", label: "Library", icon: Library },
  { id: "ai-tools", label: "AI Studio", icon: Sparkles, badge: "New" },
  { id: "analytics", label: "Analytics", icon: LineChart },
  { id: "automation", label: "Automation", icon: Repeat2 },
  { id: "accounts", label: "Integrations", icon: Link2 },
  { id: "team", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Support", icon: LifeBuoy }
];
```

Each item:
- Has an `icon` from `lucide-react`.
- Highlights itself (`bg-[#eaf3ed]`, colored left bar) when active.
- The **"Create"** item routes to `/dashboard/create`. Clicking any other item that hasn't been built yet simply keeps the user on the Overview content (these are placeholders for future features — see `10-future-improvements.md`).

The sidebar is **collapsible**: a chevron button toggles `sidebarOpen`, animating its width between `w-64` (expanded, shows labels) and `w-[4.5rem]` (collapsed, icons only) using Framer Motion's `transition`.

---

## 4. The Composer (Draft Post Form)

The composer is a single card containing:

| Field | State variable | Purpose |
|---|---|---|
| Post title | `postTitle` | Internal label / YouTube video title |
| Caption | `caption` | The main text of the post |
| Mood | `mood` | Optional tone/emoji descriptor appended to caption |
| Tags | `tags` | Comma-separated hashtags, auto-prefixed with `#` |
| Link URL | `linkUrl` | External link (used by LinkedIn/Facebook/Pinterest) |
| Location | `location` | Appended to caption as "Location: ..." |
| Media URL | `mediaUrl` | A hosted image/video URL (alternative to uploading a file) |
| Attachment | `attachment` (File) | A local file the user uploads directly |

### Media type tabs
```ts
const [activeTab, setActiveTab] = useState<"image" | "video" | "reel">("image");
```
This controls how the post is framed (affects YouTube/Threads/Instagram media type logic in the publish step). Uploading a video automatically switches the tab to `"video"`.

### Platform selector
A row of pill buttons — one per platform — using `togglePlatform(id)` to add/remove a platform from `selectedPlatforms`. Disconnected platforms are shown faded (`opacity-50`) but still clickable (so the user sees what they *could* connect).

### Action buttons
- **Save draft** → writes the whole form state to `localStorage` under `"postelligence-draft"`.
- **Schedule** → currently also calls `saveDraft` (scheduling logic is a planned improvement).
- **Publish** → opens the **Publish modal**, which calls `POST /api/posts/publish`.

---

## 5. The Publish Modal

A confirmation dialog (Framer Motion `AnimatePresence`) that:
1. Lists every selected platform with its logo and connection status.
2. On "Confirm and publish", calls `publishPost()`, which builds a `FormData` object (caption, title, media, platforms, attachment) and `POST`s it to `/api/posts/publish`.
3. Displays a **per-platform result** (✅ published, ❌ failed, ⏭️ skipped) once the API responds.
4. Offers **"Save draft"** (if nothing published yet) or **"Clear draft"** (if at least one platform succeeded).

The actual publishing logic lives entirely in the API route — see `09-publish-engine.md`.

---

## 6. Reusable UI Components

| Component | File | Used for |
|---|---|---|
| `Button` | `components/ui/button.tsx` | Primary/secondary/danger/ghost buttons with consistent sizing |
| `Badge` | `components/ui/badge.tsx` | Small status pills (e.g. "Live", "Offline", "+18%") |
| `GlassPanel` | `components/ui/glass-panel.tsx` | Frosted-glass card style used for dashboard sections |

Keeping these in `components/ui/` means every card, button, and badge across the dashboard looks consistent without repeating Tailwind class strings everywhere.

---

## 7. Quick Interview-Ready Summary

> "The dashboard and the Create Post screen share one large client component for consistency, but live on separate Next.js routes — `/dashboard` and `/dashboard/create`. The sidebar's Create link, the Command Center's 'New Post' button, and the floating 'Quick create' button all navigate to the dedicated `/dashboard/create` route instead of toggling a section on the home page. This gives the composer its own focused, distraction-free page with proper browser navigation (back button, bookmarking), while the home dashboard stays focused on monitoring connected accounts and scheduled activity."

---

*Made by - Siddharth Jagdale*