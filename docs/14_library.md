# 14_ Media Library — Developer Guide

## What is Media Library?

The Media Library is a centralized storage system where all uploaded images and videos are saved and organized per user. Instead of re-uploading the same file every time they create a post, users can browse previously uploaded media and reuse it across multiple posts, drafts, and scheduled posts.

It acts as a personal asset manager inside the app — every file uploaded anywhere in the app (dashboard, drafts, scheduled posts) gets saved here automatically.

---

## Database

### Table: `media_library`

Created by migration `003_create_drafts_library_scheduled.sql`.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `user_id` | uuid | Foreign key → `auth.users.id` |
| `file_name` | text | Original filename of the uploaded file |
| `file_url` | text | Public Supabase Storage URL |
| `file_type` | text | MIME type e.g. `image/jpeg`, `video/mp4` |
| `file_size` | bigint | File size in bytes |
| `created_at` | timestamptz | Auto-set on insert |

### Row Level Security (RLS)
```sql
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own media"
ON media_library FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## Supabase Storage Setup

### Bucket: `media-library`

This bucket must be created manually in Supabase before the app works.

**Steps:**
1. Go to Supabase Dashboard → Storage
2. Click **New Bucket**
3. Name it exactly: `media-library`
4. Set it to **Public** (so files can be accessed via URL without auth)
5. Set file size limit to at least **500 MB** (for video support)
6. Allowed MIME types: `image/*,video/*`

### Storage Path Structure
Files are stored under:
```
media-library/{user_id}/{timestamp}_{filename}
```

Example:
```
media-library/abc123-uuid/1718700000000_myvideo.mp4
```

### Storage Policy (RLS)
```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media-library' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-library');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'media-library' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## API Routes

### `POST /api/media-library/upload`
Uploads a file to Supabase Storage and saves a record to the `media_library` table.

**Body:** `multipart/form-data`
- `file` — the actual file
- `mediaType` — `"image"` or `"video"`

**Response:**
```json
{
  "url": "https://...supabase.co/storage/v1/object/public/media-library/...",
  "id": "uuid",
  "file_name": "myvideo.mp4",
  "file_type": "video/mp4",
  "file_size": 10485760
}
```

### `GET /api/media-library`
Returns all media items for the authenticated user, ordered by `created_at` descending.

**Response:**
```json
{
  "media": [
    {
      "id": "uuid",
      "file_name": "photo.jpg",
      "file_url": "https://...",
      "file_type": "image/jpeg",
      "file_size": 204800,
      "created_at": "2026-06-18T..."
    }
  ]
}
```

### `DELETE /api/media-library/[id]`
Deletes the media record from the table AND removes the file from Supabase Storage.

---

## Frontend Flow

1. User attaches a file in the post editor
2. File is uploaded immediately to `media-library` bucket
3. Public URL is returned and shown as a preview
4. A record is inserted into the `media_library` table
5. User navigates to **Dashboard → Library**
6. All past uploads are shown in a grid (images as thumbnails, videos as previews)
7. User clicks any item → URL is inserted into the current post editor
8. User can also delete items from the library

---

## File Size & Type Limits

| Type | Recommended Max Size | Notes |
|---|---|---|
| Images | 10 MB | JPEG, PNG, GIF, WebP supported |
| Videos | 500 MB | MP4, MOV, WebM supported |

For LinkedIn video pre-upload, LinkedIn itself limits videos to **5 GB** and **15 minutes**.
For YouTube video upload, YouTube limits depend on account verification status (default 15 minutes / ~128 GB).
For Bluesky video upload, Bluesky limits videos to **50 MB**.

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
| Upload fails with 400 | Bucket doesn't exist | Create `media-library` bucket in Supabase Storage |
| File URL returns 400/403 | Bucket is private | Set bucket to Public in Supabase Storage settings |
| Video preview broken | File too large for browser | Normal — file still uploaded, just can't preview in browser |
| Library shows empty after upload | RLS policy missing on `media_library` table | Run the RLS SQL above |
| Delete fails | Storage policy missing | Run the storage DELETE policy SQL above |
| Bluesky video upload fails with 502 | Bluesky's video server temporarily down | Wait a few minutes and retry — it's on Bluesky's end |