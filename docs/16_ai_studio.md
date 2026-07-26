# 16_ AI Studio — Developer Guide

## What is AI Studio?

AI Studio is the in-app content creation assistant. It lives at `/dashboard/ai-studio` (sidebar item **AI Studio**, tagged "New") and is split into two tools:

1. **Text Generation** — 8 copywriting tools (captions, hashtags, hooks, CTAs, content ideas, content calendar, rewrite, repurpose), powered by **Google Gemini**.
2. **Image Generator** — text-to-image generation, powered by **Hugging Face Inference Providers**, with results saved automatically to the **Media Library**.

Both tools live in a single client component: `app/dashboard/(shell)/ai-studio/AIStudioClient.tsx`, switching between a "Text" tab and an "Image" tab. Each tool has its own backend route under `app/api/ai/`.

---

## Part 1 — Text Generation

### What it does

Generates social-media copy from a short topic description (or rewrites/repurposes content the user pastes in). The user never talks to Gemini directly — the route builds a tailored prompt per tool and sends that to Gemini on the user's behalf.

### Available Modes

| Mode | UI Label | Description | Needs existing content? | Multi-platform? |
|---|---|---|---|---|
| `caption` | Caption Generator | AI-written captions for any platform | No | No |
| `hashtags` | Hashtag Generator | Ranked hashtags by popularity tier (Popular / Medium / Niche) | No | No |
| `hooks` | Social Hooks | Scroll-stopping opening lines | No | No |
| `cta` | CTA Generator | Calls-to-action that convert | No | No |
| `content-ideas` | Content Ideas | Fresh ideas for a niche/brand | No | No |
| `content-calendar` | Content Calendar | 7-day posting plan | No | Yes (`targetPlatforms`) |
| `rewrite` | Rewrite Content | Transforms existing posts into 3+ alternate versions | Yes (`existingContent`) | No |
| `repurpose` | Repurpose Content | Adapts one piece of content for multiple platforms | Yes (`existingContent`) | Yes (`targetPlatforms`) |

Each mode has its own hand-written prompt template inside `buildPrompt()` in `app/api/ai/generate/route.ts` — e.g. the `cta` prompt explicitly asks for 8–12 word, action-oriented CTAs across types like Follow/Save/Comment/Share, with examples; the `content-calendar` prompt asks for a 7-day plan with post type, platform, content idea, caption hook, and best posting time per day.

### Model

| Setting | Value |
|---|---|
| Provider | Google Gemini |
| Model | `gemini-2.5-flash` |
| Endpoint | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` |
| Temperature | `0.85` |
| topK / topP | `40` / `0.95` |
| Max output tokens | `2048` |
| Safety settings | Blocks medium+ harassment and hate speech categories |

### API Route

#### `POST /api/ai/generate`

**Body (JSON):**
```json
{
  "mode": "caption",
  "topic": "Launching my new productivity app that helps remote teams stay focused",
  "platform": "instagram",
  "tone": "Professional",
  "count": 5
}
```

For `rewrite` and `repurpose`, send `existingContent` instead of `topic`. For `content-calendar` and `repurpose`, you can also send `targetPlatforms: string[]`.

**Response:**
```json
{
  "result": "1. ...\n2. ...\n3. ...",
  "mode": "caption"
}
```

**Errors:**

| Status | Body | Cause |
|---|---|---|
| 401 | `{"error":"Unauthorized"}` | No authenticated Supabase session |
| 400 | `{"error":"mode is required"}` | `mode` missing from the request |
| 500 | `{"error":"Gemini API key not configured"}` | `GEMINI_API_KEY` missing in `.env.local` |
| 500 | `{"error":"No content generated"}` | Gemini returned no candidates (often a safety-filter block) |
| (Gemini's status) | `{"error": "<Gemini's own message>"}` | The Gemini API call itself failed (bad key, quota, etc.) |
| 500 | `{"error":"Internal server error"}` | Unexpected exception — check server logs |

### Frontend Flow

1. User opens **AI Studio** from the sidebar (`/dashboard/ai-studio`) — defaults to the Text tab.
2. Picks one of the 8 tools on the left (sets `activeToolId`).
3. Types a topic, or pastes existing content for Rewrite/Repurpose.
4. Optionally sets **Tone** (Professional, Casual, Witty, Inspirational, Educational, Bold, Friendly, Luxury), a target **Platform**, result **Count**, or **Target Platforms** (calendar/repurpose only).
5. Clicks **Generate** → `POST /api/ai/generate`.
6. The raw text result is split into sections (by numbered list items, headings, or bold markers) and rendered as individual cards.
7. Every card shows a **Copy** button below it so the user can copy that one caption/hashtag-set/hook/etc. on its own.
8. A **Copy all** button at the top copies the full, unformatted result.

### Environment Variables Required

```dotenv
GEMINI_API_KEY=your_google_generative_ai_api_key
```

Get a key from [Google AI Studio → Get API Key](https://aistudio.google.com/apikey).

### Common Issues

| Issue | Cause | Fix |
|---|---|---|
| "Gemini API key not configured" | `GEMINI_API_KEY` missing, or added after the dev server was already running | Add the key to `.env.local` and **restart** `yarn dev` — Next.js only reads `.env.local` at startup |
| "No content generated" | Gemini's safety filter blocked the response | Rephrase the topic to avoid sensitive wording, then retry |
| 429 / quota error | Free-tier Gemini quota exceeded | Wait for quota reset, or use a key on a paid Gemini tier |
| Result isn't numbered / doesn't split into cards | Gemini didn't follow the formatting instruction exactly | Regenerate — the splitter falls back gracefully but cleanly numbered output displays best |
| 401 Unauthorized | Supabase session expired | Log in again |

---

## Part 2 — Image Generator

### What it does

Generates an image from a text prompt, style, and aspect ratio, then **automatically saves the result to the user's Media Library** so it can be reused later when creating a post (see `library.md` and the "Attach from Library" picker in the Create tab).

### Styles

| id | Label | Prompt modifier appended |
|---|---|---|
| `photorealistic` | Photorealistic 📷 | `photorealistic, 8k, professional photography, sharp focus, detailed` |
| `illustration` | Illustration 🎨 | `digital illustration, vector art style, vibrant colors, flat design` |
| `minimalist` | Minimalist ⬜ | `minimalist design, clean lines, simple shapes, modern aesthetic, white background` |
| `3d` | 3D Render 🧊 | `3d render, octane render, volumetric lighting, cinematic, high quality` |
| `watercolor` | Watercolor 💧 | `watercolor painting, soft edges, artistic, beautiful color wash` |
| `cinematic` | Cinematic 🎬 | `cinematic photography, movie poster style, dramatic lighting, epic composition` |

### Aspect Ratios

| id | Label | Dimensions sent to the model | Best for |
|---|---|---|---|
| `square` | 1:1 Square | 1024 × 1024 | Instagram, Facebook |
| `portrait` | 4:5 Portrait | 768 × 1024 | Instagram, Pinterest |
| `landscape` | 16:9 Landscape | 1024 × 576 | YouTube, LinkedIn |

### Model & Provider

| Setting | Value |
|---|---|
| Provider | Hugging Face — **Inference Providers** (current router-based API) |
| Model | `black-forest-labs/FLUX.1-schnell` |
| Endpoint | `https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell` |
| Inference steps | `4` (schnell is distilled for fast, few-step generation) |

> **History note:** This route originally called the legacy `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0` endpoint. Hugging Face's free serverless Inference API no longer reliably serves GPU diffusion models like SDXL — calls to it typically fail at the connection level rather than returning a clean HTTP error, which surfaced in the UI as a generic "Internal server error." The route now uses the current Inference Providers router with FLUX.1-schnell, which is actively served on the free tier.

### API Route

#### `POST /api/ai/image-generate`

**Body (JSON):**
```json
{
  "prompt": "A boy with a book",
  "style": "photorealistic",
  "aspectRatio": "square"
}
```

**Response (success):**
```json
{
  "imageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "prompt": "A boy with a book, photorealistic, 8k, professional photography, sharp focus, detailed, social media content, high quality",
  "savedToLibrary": true,
  "libraryItem": {
    "id": "uuid",
    "user_id": "uuid",
    "file_name": "ai-generated-1750000000000.png",
    "file_url": "https://...supabase.co/storage/v1/object/public/media-library/...",
    "file_type": "image",
    "file_size": 482931,
    "content_hash": "sha256-hash-of-the-image-bytes",
    "uploaded_at": "2026-06-24T10:15:00.000Z"
  }
}
```

If the auto-save step fails, image generation still succeeds — `savedToLibrary` is `false` and a `libraryError` string is included instead of `libraryItem`, but `imageUrl` is always returned when generation worked.

**Errors:**

| Status | Body | Cause |
|---|---|---|
| 401 | `{"error":"Unauthorized"}` | No authenticated Supabase session |
| 400 | `{"error":"Prompt is required"}` | Prompt missing or under 3 characters |
| 500 | `{"error":"Hugging Face API token not configured"}` | `HUGGINGFACE_API_TOKEN` missing in `.env.local` |
| 503 | `{"error":"Image model is warming up. Please try again in 20-30 seconds."}` | FLUX.1-schnell cold-starting on Hugging Face's shared infra |
| (HF's status) | `{"error":"Image generation failed. Please try again."}` | Any other non-OK response from Hugging Face |
| 500 | `{"error":"Image generation failed: <message>"}` | Unexpected exception (e.g. network failure) — check server logs |

### Auto-Save to Media Library

After Hugging Face returns the raw image bytes, the route:

1. Computes a SHA-256 hash of the bytes (same dedup pattern used by manual uploads).
2. Uploads the PNG to the existing `media-library` Supabase Storage bucket at `{user_id}/{timestamp}-{random}.png`.
3. Inserts a row into the `media_library` table — `file_name: "ai-generated-{timestamp}.png"`, `file_type: "image"`.
4. Returns the public URL as `libraryItem.file_url`.

This reuses the same bucket, table, and RLS policies already documented in `library.md` — no new table or bucket is created. If the storage upload succeeds but the database insert fails, the uploaded file is removed (rolled back) so storage and the database never disagree.

### Frontend Flow

1. User switches to the **Image** tab inside AI Studio.
2. Types a prompt, picks a **Style** and an **Aspect Ratio**.
3. Clicks **Generate Image** → `POST /api/ai/image-generate`.
4. The image renders immediately from the returned base64 data URL — no extra round trip needed.
5. A green **"Saved to Library"** badge appears (links to `/dashboard/library`) if the auto-save succeeded; otherwise an amber warning is shown, but the image is still usable/downloadable.
6. User can click **Download** to save the PNG locally.
7. Later, from the **Create** tab, the same image can be pulled into a post via the **"Attach from Library"** picker beside the Attach Video/Media button.

### Environment Variables Required

```dotenv
HUGGINGFACE_API_TOKEN=hf_your_token_here
```

Get a token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens). The token needs the **"Make calls to Inference Providers"** permission — plain read-only tokens are sometimes rejected.

### Common Issues

| Issue | Cause | Fix |
|---|---|---|
| "Internal server error" with no further detail | An exception was thrown before a clean HTTP error could be returned — usually a network-level failure calling Hugging Face | Check the terminal running `yarn dev` right after generating — the real error is logged via `console.error("Image generate error:", err)` |
| "Hugging Face API token not configured" | `HUGGINGFACE_API_TOKEN` missing, or added after the dev server was already running | Add it to `.env.local` and **restart** `yarn dev` |
| 401/403 from Hugging Face | Token doesn't have the Inference Providers permission | Regenerate the token at huggingface.co/settings/tokens with that permission checked |
| "Image model is warming up" (503) | FLUX.1-schnell is cold-starting on Hugging Face's shared GPU pool | Wait 20–30 seconds and retry |
| Image generates but doesn't show up in the Library | The auto-save step failed (storage or database error) | Check `libraryError` in the response / server logs; confirm the `media-library` bucket and its RLS policies (see `library.md`) are set up |
| Old/forked code still fails constantly | Still pointing at the deprecated `api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0` endpoint | Update to the current router endpoint and model shown above |

---

## Shared Notes

- Both routes require an authenticated Supabase session — they call `createClient()` then `supabase.auth.getUser()` and return `401 Unauthorized` if there's no user.
- Neither route persists *text* results anywhere — captions/hashtags/etc. exist only in the browser until copied. Only the Image Generator persists anything server-side (via the Media Library auto-save).
- Both `GEMINI_API_KEY` and `HUGGINGFACE_API_TOKEN` are read once per request via `process.env`, so any change to `.env.local` requires a dev server restart to take effect.
