# 10_ Drafts — Developer Guide

## What is Drafts?

Drafts is a feature that lets users save their in-progress posts without publishing or scheduling them. A draft preserves everything — the title, caption, hashtags, platform selection, and media URL — so the user can come back later, pick up where they left off, and either publish immediately or schedule for later.

Think of it as an autosave + manual save system for post creation.

---

## Database

### Table: `drafts`

Created by migration `003_create_drafts_library_scheduled.sql`.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `user_id` | uuid | Foreign key → `auth.users.id` |
| `title` | text | Post title |
| `description` | text | Caption / post body text |
| `media_urls` | text[] | Array of Supabase Storage URLs |
| `platforms` | text[] | e.g. `["linkedin", "bluesky"]` |
| `created_at` | timestamptz | Auto-set on insert |
| `updated_at` | timestamptz | Auto-set on update |

### Row Level Security (RLS)
RLS must be enabled on the `drafts` table. Users can only read and write their own drafts:
```sql
-- Enable RLS
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- Policy: users see only their own drafts
CREATE POLICY "Users can manage their own drafts"
ON drafts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## API Routes

### `POST /api/drafts`
Saves a new draft.

**Body (JSON):**
```json
{
  "title": "My Post Title",
  "description": "Caption text with #hashtags",
  "media_urls": ["https://...supabase.co/storage/v1/..."],
  "platforms": ["linkedin", "bluesky"]
}
```

**Response:**
```json
{ "draft": { "id": "uuid", "title": "...", ... } }
```

### `GET /api/drafts`
Returns all drafts for the authenticated user, ordered by `updated_at` descending.

### `PATCH /api/drafts/[id]`
Updates an existing draft (any fields).

### `DELETE /api/drafts/[id]`
Deletes a draft permanently.

---

## Frontend Flow

1. User writes a post in the dashboard editor
2. Clicks **Save Draft** → calls `POST /api/drafts`
3. A green toast confirms "Draft saved!"
4. User navigates to **Dashboard → Drafts**
5. Drafts are listed with title, preview, platforms, and date
6. Clicking a draft loads it back into the editor (title, caption, media URL, platforms all restored)
7. User can then publish immediately or open the schedule modal

---

## Media Handling

Drafts store **Supabase Storage URLs**, not the actual files. When a user attaches an image or video:
- The file is uploaded to Supabase Storage bucket `media-library` first
- The returned public URL is saved in `media_urls`
- The draft stores only that URL

This means if a file is deleted from storage, the draft's media preview will break. Do not delete files from storage while drafts reference them.

---

## Environment Variables Required

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Common Issues

| Issue | Cause | Fix |
|---|---|---|
| Draft saves but media doesn't show | Storage bucket not public | Set `media-library` bucket to public in Supabase Storage settings |
| 401 on save | User not authenticated | Ensure Supabase auth session is active |
| Draft loads but platforms not selected | `platforms` array empty | Check that platforms were selected before saving |
| RLS error on fetch | RLS policy missing | Run the RLS SQL above |