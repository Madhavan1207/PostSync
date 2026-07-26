import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBaseClient } from "@supabase/supabase-js";
import { getTokenExpiry, refreshYouTubeAccessToken } from "@/lib/integrations/youtube";
import { canPublish } from "@/lib/workspace/permissions";
import type { WorkspaceRole } from "@/types";
import { publishToDiscordWebhook } from "@/lib/integrations/discord";
import { publishToTelegram } from "@/lib/integrations/telegram";

export const dynamic = "force-dynamic";

type PublishPlatform =
  | "instagram" | "facebook" | "linkedin" | "youtube"
  | "twitter" | "threads" | "bluesky" | "pinterest" | "reddit"
  | "discord" | "telegram";

type StoredAccount = {
  platform: PublishPlatform;
  account_id: string;
  account_name: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at?: string | null;
  metadata: Record<string, unknown> | null;
  // Present when this is a workspace-owned account. When set, the account
  // publishes as the workspace regardless of who clicked Publish/Schedule.
  workspace_id?: string | null;
};

type PublishResult = {
  platform: PublishPlatform;
  status: "published" | "skipped" | "failed";
  message: string;
  id?: string;
};

const graphVersion = process.env.META_GRAPH_VERSION || "v23.0";
const linkedInVersion = process.env.LINKEDIN_API_VERSION || "202605";
const linkedInHeaders = {
  "LinkedIn-Version": linkedInVersion,
  "X-Restli-Protocol-Version": "2.0.0",
};
const blueskyPdsHost = process.env.BLUESKY_PDS_HOST || "bsky.social";
const blueskyPdsUrl = `https://${blueskyPdsHost}`;
const blueskyVideoServiceUrl = "https://video.bsky.app";

type DidDocumentService = {
  id?: string;
  type?: string;
  serviceEndpoint?: string | { uri?: string };
};

type DidDocument = {
  service?: DidDocumentService[];
};

type JsonRecord = Record<string, unknown>;

// Connected-account metadata is stored as free-form JSON, so read individual
// keys through a narrowing helper instead of asserting a shape onto it.
function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

// Async container status shapes returned by the Threads / Instagram Graph APIs
// while media is still being processed.
type ThreadsContainerStatus = {
  status?: string;
  error_message?: string;
};

type InstagramContainerStatus = {
  status_code?: string;
  status?: string;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getFile(formData: FormData) {
  const file = formData.get("attachment");
  return file instanceof File && file.size > 0 ? file : null;
}

function getExtraImageFiles(formData: FormData): File[] {
  return formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
}

// Publishing directly from a saved draft has no raw File objects to attach —
// the draft's extra images (everything past media_urls[0]) are already-uploaded
// Supabase Storage URLs, so the client sends them as a JSON array of strings
// under "extraMediaUrls" instead of "images" files.
function getExtraMediaUrls(formData: FormData): string[] {
  const raw = asString(formData.get("extraMediaUrls"));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
  } catch {
    return [];
  }
}

async function readJson(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { raw: text }; }
}

async function requireOk(response: Response, label: string) {
  const payload = await readJson(response);
  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      payload?.raw ||
      response.statusText;
    throw new Error(`${label}: ${detail}`);
  }
  return payload;
}

// Like requireOk, but also fails if the platform responded 200 with no
// actual media id — that shape means it *looked* successful but nothing
// was really published, which is worse than an honest error because
// nothing downstream catches it.
async function requirePublishedId(response: Response, label: string) {
  const payload = await requireOk(response, label);
  const id = payload?.id as string | undefined;
  if (!id) {
    throw new Error(`${label}: platform returned success with no media ID (${JSON.stringify(payload)}).`);
  }
  return id;
}

function getServiceEndpointHost(endpoint: DidDocumentService["serviceEndpoint"]) {
  const rawEndpoint = typeof endpoint === "string" ? endpoint : endpoint?.uri;
  if (!rawEndpoint) return null;

  try {
    return new URL(rawEndpoint).host;
  } catch {
    return rawEndpoint.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

function getBlueskyErrorDetail(payload: JsonRecord, response: Response) {
  const nestedError = payload?.error;
  if (typeof nestedError === "object" && nestedError && "message" in nestedError) {
    return String((nestedError as { message?: unknown }).message || response.statusText);
  }

  return String(
    payload?.error ||
    payload?.message ||
    payload?.raw ||
    response.statusText
  );
}

function extractExpectedBlueskyAudience(detail: string) {
  const match = detail.match(/should be the user's PDS DID\s+"([^"]+)"/i);
  return match?.[1] || null;
}

function getHostFromDidWeb(didWeb: string) {
  if (!didWeb.startsWith("did:web:")) return null;
  const host = didWeb.slice("did:web:".length).split(":")[0];
  return host ? decodeURIComponent(host) : null;
}

function asJsonRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? value as JsonRecord : {};
}

async function resolveBlueskyPdsHost(did: string): Promise<string> {
  try {
    let didDocumentUrl = "";

    if (did.startsWith("did:plc:")) {
      didDocumentUrl = `https://plc.directory/${did}`;
    } else if (did.startsWith("did:web:")) {
      const parts = did.slice("did:web:".length).split(":").map(decodeURIComponent);
      const host = parts.shift();
      if (host) {
        didDocumentUrl = parts.length
          ? `https://${host}/${parts.join("/")}/did.json`
          : `https://${host}/.well-known/did.json`;
      }
    }

    if (!didDocumentUrl) return blueskyPdsHost;

    const response = await fetch(didDocumentUrl, {
      headers: { Accept: "application/did+json, application/json" },
    });
    if (!response.ok) return blueskyPdsHost;

    const doc = (await response.json()) as DidDocument;
    const pdsService = doc.service?.find((service) =>
      service.id === "#atproto_pds" ||
      service.id?.endsWith("#atproto_pds") ||
      service.type === "AtprotoPersonalDataServer"
    );

    return getServiceEndpointHost(pdsService?.serviceEndpoint) || blueskyPdsHost;
  } catch (error) {
    console.error("Bluesky PDS host resolution failed:", error);
    return blueskyPdsHost;
  }
}

async function getBlueskyAccountPdsHost(account: StoredAccount): Promise<string> {
  const storedHost = account.metadata?.pdsHost || account.metadata?.pds_host;
  if (typeof storedHost === "string" && storedHost.trim()) {
    return storedHost.trim().replace(/^https?:\/\//, "").split("/")[0];
  }

  return await resolveBlueskyPdsHost(account.account_id);
}

// ─── Bluesky: refresh session to get a fresh accessJwt ───────────────────────

async function refreshBlueskySession(refreshJwt: string, pdsUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshJwt}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.accessJwt ?? null;
  } catch {
    return null;
  }
}

async function getBlueskyToken(account: StoredAccount, pdsUrl: string): Promise<string | null> {
  // Try the stored access token first
  if (account.access_token) {
    const check = await fetch(
      `${pdsUrl}/xrpc/app.bsky.actor.getProfile?actor=${account.account_id}`,
      { headers: { Authorization: `Bearer ${account.access_token}` } }
    );
    if (check.ok) return account.access_token;
  }
  // Token expired or invalid — refresh using refresh token
  if (account.refresh_token) {
    const refreshed = await refreshBlueskySession(account.refresh_token, pdsUrl);
    if (refreshed) return refreshed;
    // Refresh also failed — try createSession with app password as last resort
    const meta = account.metadata || {};
    if (meta.handle && meta.appPassword) {
      const sessionRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: meta.handle, password: meta.appPassword }),
      });
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        return session.accessJwt ?? null;
      }
    }
  }
  return null;
}

// ─── Twitter / X ─────────────────────────────────────────────────────────────

async function publishTwitter(account: StoredAccount, text: string, attachment: File | null, images: File[]) {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY!;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET!;
  const accessToken = account.access_token!;
  const accessTokenSecret = account.refresh_token!;

  function percentEncode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  function sign(method: string, url: string, params: Record<string, string>) {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: "1.0",
    };
    const all = { ...params, ...oauthParams };
    const paramString = Object.keys(all).sort()
      .map(k => `${percentEncode(k)}=${percentEncode(all[k])}`).join("&");
    const base = [method, percentEncode(url), percentEncode(paramString)].join("&");
    const key = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
    const sig = createHmac("sha1", key).update(base).digest("base64");
    oauthParams.oauth_signature = sig;
    return "OAuth " + Object.keys(oauthParams).sort()
      .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`).join(", ");
  }

  // Upload media for the OAuth 1.0a upload endpoint, which needs its own
  // signed Authorization header (separate from the v2 tweet POST below).
  async function uploadMedia(file: File): Promise<string | null> {
    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const form = new FormData();
      form.append("media_data", bytes.toString("base64"));
      form.append("media_category", file.type.startsWith("video/") ? "tweet_video" : "tweet_image");
      const auth = sign("POST", uploadUrl, {});
      const payload = await requireOk(
        await fetch(uploadUrl, { method: "POST", headers: { Authorization: auth }, body: form }),
        "X media upload failed"
      );
      return payload?.media_id_string ?? null;
    } catch (err) {
      console.error("X media upload failed:", err);
      return null;
    }
  }

  // X/Twitter posts support up to 4 images (or 1 video) per tweet.
  const filesToUpload = attachment?.type.startsWith("video/")
    ? [attachment]
    : (images.length > 0 ? images : attachment ? [attachment] : []).slice(0, 4);
  const mediaIds = (await Promise.all(filesToUpload.map(uploadMedia))).filter((id): id is string => Boolean(id));

  const tweetUrl = "https://api.twitter.com/2/tweets";
  const body: Record<string, unknown> = { text };
  if (mediaIds.length > 0) body.media = { media_ids: mediaIds };
  const auth = sign("POST", tweetUrl, {});

  const payload = await requireOk(
    await fetch(tweetUrl, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    "X publish failed"
  );
  return payload?.data?.id as string | undefined;
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────
// Uses the current (non-deprecated) Videos API for video and Images API for images.

async function uploadLinkedInImage(accessToken: string, personUrn: string, attachment: File): Promise<string | null> {
  try {
    // Step 1: Initialize upload
    const init = await requireOk(
      await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...linkedInHeaders,
        },
        body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }),
      }),
      "LinkedIn image upload init"
    );

    const uploadUrl: string = init?.value?.uploadUrl;
    const imageUrn: string = init?.value?.image;
    if (!uploadUrl || !imageUrn) throw new Error("LinkedIn image upload init did not return an upload URL.");

    // Step 2: PUT the binary
    const bytes = await attachment.arrayBuffer();
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": attachment.type },
      body: bytes,
    });
    if (!uploadRes.ok) {
      const detail = await uploadRes.text();
      throw new Error(`LinkedIn image upload failed: ${detail || uploadRes.statusText}`);
    }

    return imageUrn;
  } catch (err) {
    console.error("LinkedIn image upload failed:", err);
    throw err;
  }
}

async function uploadLinkedInVideo(accessToken: string, personUrn: string, attachment: File): Promise<string | null> {
  try {
    const fileSizeBytes = attachment.size;

    // Step 1: Initialize upload
    const init = await requireOk(
      await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...linkedInHeaders,
        },
        body: JSON.stringify({
          initializeUploadRequest: {
            owner: personUrn,
            fileSizeBytes,
            uploadCaptions: false,
            uploadThumbnail: false,
          },
        }),
      }),
      "LinkedIn video upload init"
    );

    const videoUrn: string = init?.value?.video;
    const uploadInstructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }> =
      init?.value?.uploadInstructions ?? [];
    const uploadToken: string = init?.value?.uploadToken;
    if (!videoUrn || !uploadInstructions.length) throw new Error("LinkedIn video upload init did not return upload instructions.");

    // Step 2: Upload each chunk
    const bytes = Buffer.from(await attachment.arrayBuffer());
    const eTags: string[] = [];
    for (const instruction of uploadInstructions) {
      const chunk = bytes.slice(instruction.firstByte, instruction.lastByte + 1);
      const chunkRes = await fetch(instruction.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
      });
      if (!chunkRes.ok) {
        const detail = await chunkRes.text();
        throw new Error(`LinkedIn video chunk upload failed: ${detail || chunkRes.statusText}`);
      }
      const eTag = chunkRes.headers.get("ETag") || chunkRes.headers.get("etag") || "";
      eTags.push(eTag);
    }

    // Step 3: Finalize upload
    await requireOk(
      await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...linkedInHeaders,
        },
        body: JSON.stringify({
          finalizeUploadRequest: {
            video: videoUrn,
            uploadToken,
            uploadedPartIds: eTags,
          },
        }),
      }),
      "LinkedIn video finalize"
    );

    return videoUrn;
  } catch (err) {
    console.error("LinkedIn video upload failed:", err);
    throw err;
  }
}

async function publishLinkedIn(account: StoredAccount, text: string, attachment: File | null, mediaUrl: string, images: File[], linkUrl: string) {
  const author = `urn:li:person:${account.account_id}`;
  const token = account.access_token!;

  const isVideo = attachment?.type.startsWith("video/");
  // LinkedIn's Posts API accepts several images per post via
  // content.multiImage — use that whenever more than one image is attached,
  // and fall back to the original single-image shape for exactly one (the
  // known-working path) so single-image posts are unaffected.
  const imageFiles = images.length > 0 ? images : (attachment && !isVideo ? [attachment] : []);
  const hasMedia = Boolean(isVideo && attachment) || imageFiles.length > 0;

  // LinkedIn's API can attach EITHER a media object OR an article/link — never
  // both in the same post. If media is attached, a link can't become a rich
  // card, so fold it into the visible text instead of silently dropping it.
  const commentaryText = linkUrl && hasMedia ? [text.trim(), linkUrl.trim()].filter(Boolean).join("\n\n") : text;

  // Build the post body
  const postBody: Record<string, unknown> = {
    author,
    lifecycleState: "PUBLISHED",
    visibility: "PUBLIC",
    commentary: commentaryText,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
  };

  if (isVideo && attachment) {
    const videoUrn = await uploadLinkedInVideo(token, author, attachment);
    postBody.content = { media: { title: text.slice(0, 100) || attachment.name || "Postelligence video", id: videoUrn } };
  } else if (imageFiles.length > 1) {
    const imageUrns = (await Promise.all(imageFiles.map((file) => uploadLinkedInImage(token, author, file))))
      .filter((urn): urn is string => Boolean(urn));
    if (imageUrns.length > 0) {
      postBody.content = { multiImage: { images: imageUrns.map((id) => ({ id })) } };
    }
  } else if (imageFiles.length === 1) {
    const imageUrn = await uploadLinkedInImage(token, author, imageFiles[0]);
    postBody.content = { media: { id: imageUrn } };
  } else if (linkUrl) {
    // The dedicated Link URL field — a genuine "share this link" article card.
    postBody.content = { article: { source: linkUrl, title: text.slice(0, 100) || linkUrl } };
  } else if (mediaUrl) {
    // Hosted media URL fallback (no file upload, no explicit link) — treated as article/link share.
    postBody.content = { article: { source: mediaUrl, title: text.slice(0, 100) } };
  }

  const payload = await requireOk(
    await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
          ...linkedInHeaders,
      },
      body: JSON.stringify(postBody),
    }),
    "LinkedIn publish failed"
  );

  return payload?.id as string | undefined;
}

// ─── Bluesky ──────────────────────────────────────────────────────────────────

async function uploadBlueskyBlob(accessToken: string, attachment: File, pdsUrl: string): Promise<{ ref: unknown; mimeType: string } | null> {
  try {
    const bytes = await attachment.arrayBuffer();
    const payload = await requireOk(
      await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": attachment.type || "application/octet-stream",
        },
        body: bytes,
      }),
      "Bluesky blob upload"
    );
    return payload?.blob ? { ref: payload.blob, mimeType: attachment.type } : null;
  } catch (err) {
    console.error("Bluesky blob upload failed:", err);
    return null;
  }
}

async function getBlueskyVideoServiceToken(accessToken: string, pdsUrls: string[], audience: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 60 * 30;
  let lastError: unknown = null;

  for (const pdsUrl of pdsUrls) {
    try {
      const url = new URL(`${pdsUrl}/xrpc/com.atproto.server.getServiceAuth`);
      url.searchParams.set("aud", audience);
      url.searchParams.set("lxm", "com.atproto.repo.uploadBlob");
      url.searchParams.set("exp", String(exp));

      const payload = await requireOk(
        await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        "Bluesky video service auth failed"
      );

      if (!payload?.token) throw new Error("Bluesky video service did not return an upload token.");
      return payload.token as string;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bluesky video service auth failed.");
}

async function postBlueskyVideoUpload(serviceToken: string, did: string, attachment: File, bytes: ArrayBuffer) {
  // Route through Supabase Edge Function (Seoul) for better connectivity to video.bsky.app
  // Direct upload from India causes 502 due to poor bunny.net CDN routing
  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bluesky-video-upload`;

  const formData = new FormData();
  formData.set("serviceToken", serviceToken);
  formData.set("did", did);
  formData.set("video", new Blob([bytes], { type: attachment.type || "video/mp4" }), attachment.name || "postelligence-video.mp4");

  const res = await fetch(edgeFnUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: formData,
  });

  return res;
}

async function uploadBlueskyVideo(accessToken: string, did: string, attachment: File, refreshToken?: string | null, callerPdsUrl?: string, handle?: string, appPassword?: string): Promise<unknown> {
  // Route entirely through Supabase Edge Function to avoid 502s from India
  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/bluesky-video-upload`;
  const pdsUrl = callerPdsUrl || blueskyPdsUrl;

  const formData = new FormData();
  formData.set("accessToken", accessToken);
  formData.set("did", did);
  formData.set("pdsUrl", pdsUrl);
  formData.set("video", attachment, attachment.name || "postelligence-video.mp4");
  // Pass app credentials so edge function can create a fresh session for getServiceAuth
  if (refreshToken) formData.set("refreshToken", refreshToken);
  if (handle) formData.set("handle", handle);
  if (appPassword) formData.set("appPassword", appPassword);

  const res = await fetch(edgeFnUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error("Bluesky video service (video.bsky.app) is temporarily unavailable. Please try again in a few minutes.");
    }
    throw new Error(`Bluesky video upload failed: ${err.error || res.statusText}`);
  }

  return await res.json();

  // Legacy code below kept for reference - replaced by edge function routing
  const bytes = await attachment.arrayBuffer();
  const resolvedPdsHost = await resolveBlueskyPdsHost(did);
  const resolvedPdsUrl = `https://${resolvedPdsHost}`;
  const pdsUrls = Array.from(new Set([resolvedPdsUrl, blueskyPdsUrl]));
  const videoServiceAudience = "did:web:video.bsky.app";
  const audienceQueue = [videoServiceAudience];

  let uploadResponse: Response | null = null;
  let uploadPayload = {} as JsonRecord;
  const triedAudiences = new Set<string>();

  while (audienceQueue.length > 0) {
    const audienceStr = audienceQueue.shift();
    if (!audienceStr) continue;
    const audience = audienceStr as string;
    if (triedAudiences.has(audience)) continue;
    triedAudiences.add(audience);

    const serviceToken = await getBlueskyVideoServiceToken(accessToken, pdsUrls, audience);
    const res = await postBlueskyVideoUpload(serviceToken, did, attachment, bytes);
    uploadResponse = res;
    uploadPayload = await readJson(res);

    if (res.ok) break;

    const expectedAudienceRaw = extractExpectedBlueskyAudience(getBlueskyErrorDetail(uploadPayload, res));
    if (expectedAudienceRaw) {
      const expectedAudience = expectedAudienceRaw as string;
      if (!triedAudiences.has(expectedAudience)) {
        const expectedPdsHost = getHostFromDidWeb(expectedAudience);
        if (expectedPdsHost) {
          const expectedPdsUrl = `https://${expectedPdsHost}`;
          if (!pdsUrls.includes(expectedPdsUrl)) pdsUrls.unshift(expectedPdsUrl);
        }
        audienceQueue.unshift(expectedAudience);
        continue;
      }
    }

    break;
  }

  if (!uploadResponse?.ok) {
    const status = uploadResponse?.status;
    const detail = uploadResponse
      ? getBlueskyErrorDetail(uploadPayload, uploadResponse as Response)
      : "No upload response was returned.";
    // 502/503/504 = Bluesky video service is temporarily down
    if (status === 502 || status === 503 || status === 504) {
      throw new Error("Bluesky video service (video.bsky.app) is temporarily unavailable. Please try again in a few minutes.");
    }
    throw new Error(`Bluesky video upload failed: ${detail}`);
  }

  const initialJobStatus = asJsonRecord(uploadPayload.jobStatus);
  let blob = uploadPayload.blob || initialJobStatus.blob;
  const rawJobId = uploadPayload.jobId || initialJobStatus.jobId;
  const jobId: string = typeof rawJobId === "string" ? (rawJobId as string) : "";

  for (let attempt = 0; !blob && jobId && attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const statusUrl = new URL(`${blueskyVideoServiceUrl}/xrpc/app.bsky.video.getJobStatus`);
    statusUrl.searchParams.set("jobId", jobId);
    const statusResponse = await fetch(statusUrl);
    const statusPayload = await readJson(statusResponse);

    if (!statusResponse.ok) {
      const detail = statusPayload?.error || statusPayload?.message || statusPayload?.raw || statusResponse.statusText;
      if (detail === "already_exists" && statusPayload?.blob) {
        blob = statusPayload.blob;
        break;
      }
      throw new Error(`Bluesky video processing failed: ${detail}`);
    }

    const jobStatus = statusPayload?.jobStatus || statusPayload;
    if (jobStatus?.blob) {
      blob = jobStatus.blob;
      break;
    }
    if (jobStatus?.state === "JOB_STATE_FAILED" || jobStatus?.state === "failed") {
      throw new Error(jobStatus?.error || "Bluesky video processing failed.");
    }
  }

  if (!blob) throw new Error("Bluesky video processing timed out before a playable video was ready.");
  return blob;
}

async function publishBluesky(account: StoredAccount, text: string, attachment: File | null, images: File[]) {
  const pdsHost = await getBlueskyAccountPdsHost(account);
  const pdsUrl = `https://${pdsHost}`;
  // Always get a fresh/valid token
  const token = await getBlueskyToken(account, pdsUrl);
  if (!token) throw new Error("Bluesky session expired. Please reconnect your Bluesky account.");

  const record: Record<string, unknown> = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
  };

  const isVideo = attachment?.type.startsWith("video/");
  // Bluesky posts support up to 4 images per post.
  const imageFiles = (images.length > 0 ? images : (attachment && !isVideo ? [attachment] : [])).slice(0, 4);

  if (isVideo && attachment) {
    const metaPdsHost = getMetadataString(account.metadata, "pdsHost");
    const correctPdsUrl = metaPdsHost ? `https://${metaPdsHost}` : pdsUrl;
    const videoBlob = await uploadBlueskyVideo(
      token,
      account.account_id,
      attachment,
      account.refresh_token,
      correctPdsUrl,
      getMetadataString(account.metadata, "handle"),
      getMetadataString(account.metadata, "appPassword")
    );
    record.embed = {
      $type: "app.bsky.embed.video",
      video: videoBlob,
      aspectRatio: { width: 16, height: 9 },
    };
  } else if (imageFiles.length > 0) {
    const blobs = await Promise.all(imageFiles.map((file) => uploadBlueskyBlob(token, file, pdsUrl)));
    const embedImages = blobs
      .filter((b): b is { ref: unknown; mimeType: string } => Boolean(b))
      .map((b) => ({ image: b.ref, alt: "" }));
    if (embedImages.length > 0) {
      record.embed = { $type: "app.bsky.embed.images", images: embedImages };
    }
  }

  const payload = await requireOk(
    await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repo: account.account_id,
        collection: "app.bsky.feed.post",
        record,
      }),
    }),
    "Bluesky publish failed"
  );

  return payload?.uri as string | undefined;
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

async function publishFacebook(account: StoredAccount, text: string, mediaUrl: string, linkUrl: string, mediaType: string, mediaUrls: string[]) {
  const token = account.access_token || "";
  const base = `https://graph.facebook.com/${graphVersion}/${account.account_id}`;
  // Facebook's /videos and /photos endpoints don't accept a rich "link"
  // param the way /feed does — without this, a link URL would silently
  // vanish whenever media was attached. Fold it into the visible text
  // instead so it's never lost (Facebook auto-links plain URLs in text).
  const textWithLink = linkUrl ? [text.trim(), linkUrl.trim()].filter(Boolean).join("\n\n") : text;
  const isVideo = mediaType === "video" || Boolean(mediaUrl && /\.(mp4|mov|webm|avi|m4v)(\?|$)/i.test(mediaUrl));

  // Video: /videos endpoint + file_url param
  if (mediaUrl && isVideo) {
    const params = new URLSearchParams({ access_token: token, file_url: mediaUrl });
    if (textWithLink) params.set("description", textWithLink);
    const payload = await requireOk(
      await fetch(`${base}/videos`, { method: "POST", body: params }),
      "Facebook video publish failed"
    );
    return payload?.id as string | undefined;
  }

  // Multiple images: upload each unpublished, then attach them all to one
  // feed post so they show as a single multi-photo post, not separate ones.
  const imageUrls = mediaType === "image" ? mediaUrls.filter(Boolean) : [];
  if (imageUrls.length > 1) {
    const photoIds = (await Promise.all(imageUrls.map(async (url) => {
      const params = new URLSearchParams({ access_token: token, url, published: "false" });
      const payload = await requireOk(
        await fetch(`${base}/photos`, { method: "POST", body: params }),
        "Facebook photo upload failed"
      );
      return payload?.id as string | undefined;
    }))).filter((id): id is string => Boolean(id));

    if (photoIds.length > 0) {
      const feedParams = new URLSearchParams({ access_token: token, message: textWithLink });
      photoIds.forEach((id, i) => feedParams.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
      const payload = await requireOk(
        await fetch(`${base}/feed`, { method: "POST", body: feedParams }),
        "Facebook publish failed"
      );
      return payload?.id as string | undefined;
    }
  }

  // Image: /photos endpoint + url param
  if (mediaUrl && mediaType === "image") {
    const params = new URLSearchParams({ access_token: token, url: mediaUrl });
    if (textWithLink) params.set("caption", textWithLink);
    const payload = await requireOk(
      await fetch(`${base}/photos`, { method: "POST", body: params }),
      "Facebook publish failed"
    );
    return payload?.id as string | undefined;
  }

  // Text / link only: /feed — uses Facebook's native "link" param for a
  // proper rich preview card since there's no media competing for the slot.
  const params = new URLSearchParams({ access_token: token, message: text });
  if (linkUrl) params.set("link", linkUrl);
  const payload = await requireOk(
    await fetch(`${base}/feed`, { method: "POST", body: params }),
    "Facebook publish failed"
  );
  return payload?.id as string | undefined;
}

// ─── Threads ──────────────────────────────────────────────────────────────────

async function publishThreads(account: StoredAccount, text: string, mediaUrl: string, mediaType: string, mediaUrls: string[]) {
  const token = account.access_token || "";
  const userId = account.account_id;
  const statusParams = new URLSearchParams({ access_token: token, fields: "status,error_message" });

  async function waitForThreadsContainer(containerId: string, isVideo: boolean): Promise<void> {
    const maxPolls = isVideo ? 30 : 10;
    const delayMs = isVideo ? 5000 : 2000;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        const statusRes = await fetch(`https://graph.threads.net/${containerId}?${statusParams}`);
        const status = await statusRes.json() as ThreadsContainerStatus;
        if (status.status === "FINISHED") return;
        if (status.status === "ERROR") throw new Error(`Threads media processing failed: ${status.error_message || "unknown"}`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Threads media processing failed")) throw e;
      }
    }
    throw new Error("Threads media did not finish processing in time.");
  }

  const imageUrls = mediaType === "image" ? mediaUrls.filter(Boolean) : [];
  if (imageUrls.length > 1) {
    const carouselUrls = imageUrls.slice(0, 20);
    const childIds = (await Promise.all(carouselUrls.map(async (url) => {
      const params = new URLSearchParams({
        access_token: token,
        is_carousel_item: "true",
        media_type: "IMAGE",
        image_url: url,
      });
      const child = await requireOk(
        await fetch(`https://graph.threads.net/${userId}/threads`, { method: "POST", body: params }),
        "Threads carousel item creation failed"
      );
      return child?.id as string | undefined;
    }))).filter((id): id is string => Boolean(id));

    if (childIds.length > 1) {
      // Wait for each child container to finish processing before creating parent CAROUSEL container
      for (const childId of childIds) {
        await waitForThreadsContainer(childId, false);
      }

      const carouselParams = new URLSearchParams({
        access_token: token,
        media_type: "CAROUSEL",
        children: childIds.join(","),
        text,
      });
      const container = await requireOk(
        await fetch(`https://graph.threads.net/${userId}/threads`, { method: "POST", body: carouselParams }),
        "Threads carousel creation failed"
      );
      await waitForThreadsContainer(container.id, false);
      const publishRes = await fetch(`https://graph.threads.net/${userId}/threads_publish`, {
        method: "POST",
        body: new URLSearchParams({ access_token: token, creation_id: container.id }),
      });
      return await requirePublishedId(publishRes, "Threads publish failed");
    }
  }

  const createParams = new URLSearchParams({ access_token: token, text });
  if (mediaUrl) {
    createParams.set("media_type", mediaType === "video" ? "VIDEO" : "IMAGE");
    createParams.set(mediaType === "video" ? "video_url" : "image_url", mediaUrl);
  } else {
    createParams.set("media_type", "TEXT");
  }

  const container = await requireOk(
    await fetch(`https://graph.threads.net/${userId}/threads`, {
      method: "POST", body: createParams,
    }),
    "Threads container creation failed"
  );

  const publishParams = new URLSearchParams({ access_token: token, creation_id: container.id });

  if (mediaType !== "video") {
    // Images/text: poll until FINISHED before publishing instead of a flat delay —
    // publishing before the container is ready either gets rejected or silently
    // produces nothing visible, which is why this looked "random".
    let mediaFinished = !mediaUrl; // pure text posts have no container to wait on
    for (let i = 0; i < 10 && !mediaFinished; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const statusRes = await fetch(`https://graph.threads.net/${container.id}?${statusParams}`);
        const status = await statusRes.json() as ThreadsContainerStatus;
        if (status.status === "FINISHED") { mediaFinished = true; break; }
        if (status.status === "ERROR") throw new Error(`Threads media processing failed: ${status.error_message || "unknown"}`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Threads media processing failed")) throw e;
        // transient fetch error — keep polling
      }
    }
    if (!mediaFinished) throw new Error("Threads media did not finish processing in time.");

    const publishRes = await fetch(`https://graph.threads.net/${userId}/threads_publish`, {
      method: "POST", body: publishParams,
    });
    return await requirePublishedId(publishRes, "Threads publish failed");
  }

  // Video: this used to poll and publish inside an un-awaited `(async () => {...})()`
  // IIFE, returning the container id immediately while the real publish call ran
  // "in the background". On a serverless request handler, once this function
  // returns and the HTTP response is sent, the runtime can freeze or tear down
  // the instance at any moment — so that background work frequently never got to
  // run the actual threads_publish call. The post looked "published" (a plausible
  // id came back and the request succeeded) but nothing was ever posted. Await
  // the whole thing instead, same as the image/text path above.
  let finished = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const statusRes = await fetch(`https://graph.threads.net/${container.id}?${statusParams}`);
      const status = await statusRes.json() as ThreadsContainerStatus;
      if (status.status === "FINISHED") { finished = true; break; }
      if (status.status === "ERROR") throw new Error(`Threads video processing failed: ${status.error_message || "unknown"}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Threads video processing failed")) throw e;
      // transient fetch error — keep polling
    }
  }
  if (!finished) throw new Error("Threads video did not finish processing in time.");

  const publishRes = await fetch(`https://graph.threads.net/${userId}/threads_publish`, {
    method: "POST", body: publishParams,
  });
  return await requirePublishedId(publishRes, "Threads publish failed");
}

// ─── Instagram ────────────────────────────────────────────────────────────────

async function publishInstagram(account: StoredAccount, text: string, mediaUrl: string, mediaType: string, mediaUrls: string[]) {
  const token = account.access_token || "";
  const userId = account.account_id;
  // Direct Instagram Login → graph.instagram.com
  // Meta/Facebook Page-linked → graph.facebook.com
  const isDirectLogin = account.metadata?.login_type === "instagram";
  const base = isDirectLogin
    ? `https://graph.instagram.com/${graphVersion}`
    : `https://graph.facebook.com/${graphVersion}`;

  const statusParams = new URLSearchParams({ access_token: token, fields: "status_code,status" });

  async function waitForContainer(containerId: string): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${base}/${containerId}?${statusParams}`);
      const status = await statusRes.json() as InstagramContainerStatus;
      if (status.status_code === "FINISHED") return;
      if (status.status_code === "ERROR") throw new Error(`Instagram media processing failed: ${status.status || "unknown"}`);
    }
    throw new Error("Instagram media did not finish processing in time.");
  }

  // Carousel: 2-10 images posted together as one swipeable post.
  const imageUrls = mediaType === "image" ? mediaUrls.filter(Boolean) : [];
  if (imageUrls.length > 1) {
    const carouselUrls = imageUrls.slice(0, 10);
    const childIds = (await Promise.all(carouselUrls.map(async (url) => {
      const params = new URLSearchParams({ access_token: token, image_url: url, is_carousel_item: "true" });
      const res = await fetch(`${base}/${userId}/media`, { method: "POST", body: params });
      if (!res.ok) return undefined;
      const child = await res.json() as { id?: string };
      return child?.id;
    }))).filter((id): id is string => Boolean(id));

    if (childIds.length > 1) {
      // Wait for each child container to finish processing before creating parent CAROUSEL container
      for (const childId of childIds) {
        await waitForContainer(childId);
      }

      const carouselParams = new URLSearchParams({ access_token: token, media_type: "CAROUSEL", caption: text });
      childIds.forEach((id: string, i: number) => carouselParams.set(`children[${i}]`, id));
      const container = await requireOk(
        await fetch(`${base}/${userId}/media`, { method: "POST", body: carouselParams }),
        "Instagram carousel creation failed"
      );
      await waitForContainer(container.id);
      const publishRes = await fetch(`${base}/${userId}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ access_token: token, creation_id: container.id }),
      });
      return await requirePublishedId(publishRes, "Instagram publish failed");
    }
  }

  if (!mediaUrl) throw new Error("Instagram requires a public image or video URL.");

  const createParams = new URLSearchParams({ access_token: token, caption: text });
  if (mediaType === "video") {
    createParams.set("media_type", "REELS");
    createParams.set("video_url", mediaUrl);
    // Without this, a Reel only shows in the Reels tab, not the main profile
    // grid/feed — which is usually where people check first.
    createParams.set("share_to_feed", "true");
  } else {
    createParams.set("image_url", mediaUrl);
  }

  let containerFetchRes = await fetch(`${base}/${userId}/media`, { method: "POST", body: createParams });
  if (!containerFetchRes.ok) {
    const errText = await containerFetchRes.text();
    if (mediaType === "video" && (errText.includes("2207009") || errText.includes("aspect ratio"))) {
      console.warn("Instagram Reel share_to_feed rejected due to aspect ratio, retrying as standard Reel...");
      createParams.delete("share_to_feed");
      containerFetchRes = await fetch(`${base}/${userId}/media`, { method: "POST", body: createParams });
    }
    if (!containerFetchRes.ok) {
      const finalErrText = await containerFetchRes.text().catch(() => errText);
      if (finalErrText.includes("2207009") || finalErrText.includes("aspect ratio")) {
        throw new Error("Instagram image aspect ratio is not supported (error 2207009). Instagram requires feed images to be between 4:5 (0.8) and 1.91:1 aspect ratio. Please crop your image.");
      }
      throw new Error(`Instagram container creation failed: ${finalErrText}`);
    }
  }
  const container = await containerFetchRes.json() as { id: string };

  const publishParams = new URLSearchParams({ access_token: token, creation_id: container.id });

  if (mediaType !== "video") {
    // Images: poll until FINISHED, 2s intervals, max 20s total. Must gate on the
    // result — calling media_publish while the container is still IN_PROGRESS
    // either gets rejected or returns a success-looking response for a container
    // that never finishes.
    await waitForContainer(container.id);
    const publishRes = await fetch(`${base}/${userId}/media_publish`, { method: "POST", body: publishParams });
    return await requirePublishedId(publishRes, "Instagram publish failed");
  }

  // Video (Reels): this used to poll and publish inside an un-awaited
  // `(async () => {...})()` IIFE, returning the *container* id immediately as
  // if that were success. Once this function returns and the HTTP response is
  // sent, a serverless instance can be frozen or torn down at any point — so
  // that "background" polling loop frequently never got to call media_publish
  // at all. The row would show "published" with a plausible-looking id, but
  // Instagram never actually received a publish call. Await the whole thing.
  let finished = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(`${base}/${container.id}?${statusParams}`);
    const status = await statusRes.json() as InstagramContainerStatus;
    if (status.status_code === "FINISHED") { finished = true; break; }
    if (status.status_code === "ERROR") throw new Error(`Instagram media processing failed: ${status.status || "unknown"}`);
  }
  if (!finished) throw new Error("Instagram video did not finish processing in time.");

  const publishRes = await fetch(`${base}/${userId}/media_publish`, { method: "POST", body: publishParams });
  return await requirePublishedId(publishRes, "Instagram publish failed");
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

async function refreshStoredYouTubeToken(account: StoredAccount, userId: string) {
  if (!account.refresh_token) {
    throw new Error("YouTube access expired and no refresh token is stored. Reconnect YouTube.");
  }

  const tokens = await refreshYouTubeAccessToken(account.refresh_token);
  const nextAccessToken = tokens.access_token;
  const nextRefreshToken = tokens.refresh_token || account.refresh_token;
  const nextExpiry = getTokenExpiry(tokens.expires_in);

  const supabase = await createClient();
  // Workspace-owned accounts are matched by workspace_id — updating by
  // userId here would silently fail to persist the refreshed token for
  // whichever member happens to be publishing, since they don't own the row.
  let updateQuery = supabase
    .from("social_accounts")
    .update({
      access_token: nextAccessToken,
      refresh_token: nextRefreshToken,
      token_expires_at: nextExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("platform", "youtube")
    .eq("account_id", account.account_id);
  updateQuery = account.workspace_id
    ? updateQuery.eq("workspace_id", account.workspace_id)
    : updateQuery.eq("user_id", userId).is("workspace_id", null);
  const { error } = await updateQuery;

  if (error) {
    console.error("YouTube token update failed:", error.message);
  }

  account.access_token = nextAccessToken;
  account.refresh_token = nextRefreshToken;
  account.token_expires_at = nextExpiry;
  return nextAccessToken;
}

function isTokenExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now() + 60_000;
}

async function uploadYouTubeVideo(accessToken: string, attachment: File, metadata: Record<string, unknown>) {
  const boundary = `postelligence-${crypto.randomUUID()}`;
  const videoBytes = Buffer.from(await attachment.arrayBuffer());
  const metadataPart = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
  const filePartHeader = Buffer.from(`--${boundary}\r\nContent-Type: ${attachment.type || "application/octet-stream"}\r\n\r\n`);
  const closing = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([metadataPart, filePartHeader, videoBytes, closing]);

  return await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
}

async function publishYouTube(account: StoredAccount, text: string, title: string, attachment: File | null, userId: string) {
  // No attachment — skip gracefully. The UI already warned the user.
  if (!attachment) {
    return { skipped: true, reason: "No video attached. YouTube was skipped. Use YouTube Studio to post text or image content." };
  }
  // Image attachment — YouTube API does not support community posts. Skip gracefully.
  if (attachment.type.startsWith("image/")) {
    return { skipped: true, reason: "YouTube doesn't support image posts via the API. YouTube was skipped. Use YouTube Studio to post images." };
  }
  // Non-video, non-image file — skip.
  if (!attachment.type.startsWith("video/")) {
    return { skipped: true, reason: "YouTube only supports video uploads. The attached file type is not supported." };
  }

  const metadata = {
    snippet: { title: title || text.slice(0, 90) || "Postelligence video", description: text, categoryId: "22" },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };

  let accessToken = account.access_token || "";
  if (!accessToken || isTokenExpired(account.token_expires_at)) {
    accessToken = await refreshStoredYouTubeToken(account, userId);
  }

  let response = await uploadYouTubeVideo(accessToken, attachment, metadata);
  if (response.status === 401 || response.status === 403) {
    accessToken = await refreshStoredYouTubeToken(account, userId);
    response = await uploadYouTubeVideo(accessToken, attachment, metadata);
  }

  const payload = await requireOk(response, "YouTube publish failed");
  return payload?.id as string | undefined;
}

// ─── Pinterest ────────────────────────────────────────────────────────────────

async function getOrCreatePinterestBoardId(token: string): Promise<string> {
  try {
    const listRes = await fetch("https://api.pinterest.com/v5/boards?page_size=25", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const boards = data.items || [];
      if (boards.length > 0 && boards[0].id) {
        return boards[0].id;
      }
    }
  } catch (err) {
    console.warn("[Pinterest] Failed to fetch boards:", err);
  }

  try {
    const createRes = await fetch("https://api.pinterest.com/v5/boards", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Postelligence Pins",
        description: "Created automatically by Postelligence for pin publishing."
      })
    });
    if (createRes.ok) {
      const data = await createRes.json();
      if (data?.id) return data.id;
    }
  } catch (err) {
    console.warn("[Pinterest] Failed to create board:", err);
  }

  throw new Error("Pinterest requires a board to publish pins. Please create a board on Pinterest first.");
}

async function publishPinterest(
  account: StoredAccount,
  text: string,
  mediaUrl: string,
  linkUrl: string,
  mediaType: string,
  mediaUrls: string[]
) {
  let boardId = (account.metadata?.board_id || account.metadata?.default_board_id) as string | undefined;
  if (!boardId) {
    boardId = await getOrCreatePinterestBoardId(account.access_token || "");
  }
  if (!mediaUrl) throw new Error("Pinterest requires a public image or video URL to create a Pin.");

  const validUrls = mediaUrls.filter(Boolean);
  let mediaSource: Record<string, unknown>;

  if (mediaType === "image" && validUrls.length > 1) {
    const carouselItems = validUrls.slice(0, 5).map((url) => ({ url }));
    mediaSource = {
      source_type: "multiple_image_urls",
      items: carouselItems,
    };
  } else if (mediaType === "video") {
    mediaSource = {
      source_type: "video_url",
      url: mediaUrl,
    };
  } else {
    mediaSource = {
      source_type: "image_url",
      url: mediaUrl,
    };
  }

  const payload = await requireOk(
    await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        board_id: boardId,
        title: text.slice(0, 100) || "Postelligence Pin",
        description: text.slice(0, 800),
        link: linkUrl || undefined,
        media_source: mediaSource,
      }),
    }),
    "Pinterest publish failed"
  );
  return payload?.id as string | undefined;
}

// ─── Supabase Storage upload → public URL ────────────────────────────────────
// For platforms that need a hosted URL (Facebook, Threads, Instagram, Pinterest)
// we upload the local attachment once and reuse the public URL.

async function resolveMediaUrl(
  attachment: File | null,
  fallbackUrl: string,
  userId: string
): Promise<string> {
  if (!attachment) return fallbackUrl;

  try {
    const supabase = await createClient();
    const ext = attachment.name.split(".").pop() || "bin";
    const path = `posts/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const arrayBuffer = await attachment.arrayBuffer();
    const { error } = await supabase.storage
      .from("media")
      .upload(path, arrayBuffer, {
        contentType: attachment.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage upload error:", error.message);
      return fallbackUrl;
    }

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("resolveMediaUrl failed:", err);
    return fallbackUrl;
  }
}

// Uploads every image in `images` to durable storage and returns all of
// their public URLs — used for platforms whose API takes public URLs
// rather than raw files (Facebook, Instagram) so multi-image posts have
// more than one URL to work with.
async function resolveMediaUrls(
  images: File[],
  fallbackUrl: string,
  userId: string
): Promise<string[]> {
  if (images.length === 0) return fallbackUrl ? [fallbackUrl] : [];
  const urls = await Promise.all(images.map((file) => resolveMediaUrl(file, "", userId)));
  const resolved = urls.filter(Boolean);
  return resolved.length > 0 ? resolved : (fallbackUrl ? [fallbackUrl] : []);
}
// ─── Reddit ───────────────────────────────────────────────────────────────────

async function publishReddit(account: StoredAccount, text: string, title: string, mediaUrl: string) {
  const subreddit = (account.metadata?.default_subreddit as string) || `u_${account.account_name}`;
  const body: Record<string, string> = {
    sr: subreddit,
    kind: mediaUrl ? "link" : "self",
    title: title || text.slice(0, 300) || "Postelligence post",
    resubmit: "true",
    nsfw: "false",
    spoiler: "false",
  };
  if (mediaUrl) {
    body.url = mediaUrl;
  } else {
    body.text = text;
  }

  const payload = await requireOk(
    await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Postelligence/1.0",
      },
      body: new URLSearchParams(body),
    }),
    "Reddit publish failed"
  );
  return payload?.jquery?.[10]?.[3]?.[0] as string | undefined;
}
async function publishDiscord(account: StoredAccount, text: string, attachment: File | null, mediaUrl: string | null, images: File[]) {
  const webhookUrl = account.access_token;
  if (!webhookUrl) throw new Error("Discord webhook URL is missing.");
  return await publishToDiscordWebhook(webhookUrl, text, mediaUrl, attachment, images);
}

async function publishTelegram(account: StoredAccount, text: string, mediaUrl: string | null, mediaUrls: string[]) {
  const token = account.access_token;
  const chatId = getMetadataString(account.metadata, "chatId") || account.account_id;
  if (!token || !chatId) throw new Error("Telegram access token or Chat ID is missing.");
  return await publishToTelegram(token, chatId, text, mediaUrl, mediaUrls, account.metadata || undefined);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function publishOne(
  account: StoredAccount,
  text: string,
  title: string,
  mediaUrl: string,
  linkUrl: string,
  mediaType: string,
  attachment: File | null,
  userId: string,
  images: File[],
  mediaUrls: string[]
): Promise<PublishResult> {
  if (!account.access_token) {
    return { platform: account.platform, status: "failed", message: "No access token. Reconnect this account." };
  }

  try {
    const id =
      account.platform === "twitter"   ? await publishTwitter(account, text, attachment, images) :
      account.platform === "linkedin"  ? await publishLinkedIn(account, text, attachment, mediaUrl, images, linkUrl) :
      account.platform === "bluesky"   ? await publishBluesky(account, text, attachment, images) :
      account.platform === "facebook"  ? await publishFacebook(account, text, mediaUrl, linkUrl, mediaType, mediaUrls) :
      account.platform === "threads"   ? await publishThreads(account, text, mediaUrl, mediaType, mediaUrls) :
      account.platform === "instagram" ? await publishInstagram(account, text, mediaUrl, mediaType, mediaUrls) :
      account.platform === "youtube"   ? await publishYouTube(account, text, title, attachment, userId) :
      account.platform === "reddit"    ? await publishReddit(account, text, title, mediaUrl) :
      account.platform === "discord"   ? await publishDiscord(account, text, attachment, mediaUrl, images) :
      account.platform === "telegram"  ? await publishTelegram(account, text, mediaUrl, mediaUrls) :
                                         await publishPinterest(account, text, mediaUrl, linkUrl, mediaType, mediaUrls);

    // Handle graceful skip (e.g. YouTube without video)
    if (id && typeof id === "object" && "skipped" in id) {
      return { platform: account.platform, status: "skipped" as const, message: (id as { reason: string }).reason };
    }

    return { platform: account.platform, status: "published", message: "Published successfully.", id: id as string | undefined };
  } catch (error) {
    return {
      platform: account.platform,
      status: "failed",
      message: error instanceof Error ? error.message : "Publishing failed.",
    };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
// Fetch a hosted media URL and convert it to a File object for platform upload
async function fetchMediaUrlAsFile(mediaUrl: string, mediaType: string): Promise<File | null> {
  if (!mediaUrl) return null;
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const urlPath = mediaUrl.split("?")[0];
    const ext = urlPath.split(".").pop() || "bin";
    const mimeType = mediaType === "video"
      ? (ext === "mov" ? "video/quicktime" : "video/mp4")
      : (ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg");
    const fileName = `media.${ext}`;
    return new File([buffer], fileName, { type: mimeType });
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const isServiceRole = authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;

  let supabase = await createClient();
  let user = null;

  if (isServiceRole) {
    const targetUserId = request.headers.get("X-User-Id");
    if (targetUserId) {
      const baseClient = createBaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { data: { user: foundUser } } = await baseClient.auth.admin.getUserById(targetUserId);
      user = foundUser;
      supabase = baseClient;
    }
  } else {
    const { data: { user: authedUser } } = await supabase.auth.getUser();
    user = authedUser;
  }

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const formData = await request.formData();
  const text      = asString(formData.get("caption"));
  const title     = asString(formData.get("title"));
  const mediaUrl  = asString(formData.get("mediaUrl"));
  const linkUrl   = asString(formData.get("linkUrl"));
  const platforms = asString(formData.get("platforms")).split(",").map(p => p.trim()).filter(Boolean) as PublishPlatform[];
  // Present only when publishing from a Team Workspace draft — in that case
  // the post must always go out through the workspace's connected accounts,
  // never the individual member's personal accounts, no matter who clicks
  // Publish Now. Absent, this is the solo-user flow and behaves exactly as
  // it always has.
  const workspaceId = asString(formData.get("workspace_id")) || null;
  const workspaceDraftId = asString(formData.get("workspace_draft_id")) || null;
  const uploadedAttachment = getFile(formData);
  const extraImageFiles = getExtraImageFiles(formData);
  const extraMediaUrls = getExtraMediaUrls(formData);
  const attachment = uploadedAttachment ?? (mediaUrl ? await fetchMediaUrlAsFile(mediaUrl, asString(formData.get("mediaType"))) : null);
  // Extra images can arrive either as raw files (Compose, freshly attached) or as
  // already-uploaded URLs (Publish Now on a saved draft/workspace draft) — fetch
  // the URL ones down to Files here so both paths end up in the same `images` array.
  const extraUrlFiles = extraMediaUrls.length > 0
    ? (await Promise.all(extraMediaUrls.map((url) => fetchMediaUrlAsFile(url, "image")))).filter((f): f is File => f !== null)
    : [];
  // Every attached image, primary + extras, in the order they were added —
  // this is what makes multi-image posts actually post more than one image.
  const images: File[] = attachment?.type.startsWith("image/")
    ? [attachment, ...extraImageFiles, ...extraUrlFiles]
    : [...extraImageFiles, ...extraUrlFiles];
  // Derive mediaType from actual file MIME — more reliable than the tab value
  const mediaType = attachment?.type.startsWith("video/") ? "video"
    : attachment?.type.startsWith("image/") ? "image"
    : images.length > 0 ? "image"
    : asString(formData.get("mediaType")) || "image";

  if (attachment && (mediaType === "video" || attachment.type.startsWith("video/"))) {
    if (attachment.size > 45 * 1024 * 1024) {
      const sizeMB = (attachment.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `Attached video file size (${sizeMB} MB) exceeds the 45 MB maximum limit. Please compress your video.` },
        { status: 400 }
      );
    }
  }

  if (!text && !mediaUrl && !attachment) {
    return NextResponse.json({ error: "Add post text, a media URL, or an attachment before publishing." }, { status: 400 });
  }
  if (platforms.length === 0) {
    return NextResponse.json({ error: "Select at least one platform." }, { status: 400 });
  }

  if (workspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!membership) return NextResponse.json({ error: "Not a member of this workspace." }, { status: 403 });
    if (!canPublish(membership.role as WorkspaceRole)) {
      return NextResponse.json({ error: "Only managers and owners can publish or schedule for this workspace." }, { status: 403 });
    }
  }

  const accountQuery = supabase
    .from("social_accounts")
    .select("platform, account_id, account_name, access_token, refresh_token, metadata, workspace_id")
    .eq("status", "connected")
    .in("platform", platforms);

  const { data: accounts, error } = workspaceId
    ? await accountQuery.eq("workspace_id", workspaceId)
    : await accountQuery.eq("user_id", user.id).is("workspace_id", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const connectedAccounts = (accounts || []) as StoredAccount[];

  // Platforms that need a public URL (can't accept a file directly)
  const needsPublicUrl = platforms.some(p => ["facebook", "threads", "instagram", "pinterest", "reddit", "telegram"].includes(p));

  // Start storage upload in parallel with anything that doesn't need it
  // This saves the full upload time for direct-upload platforms (LinkedIn, Bluesky, YouTube, Twitter)
  const resolvedMediaUrlPromise = needsPublicUrl
    ? resolveMediaUrl(attachment, mediaUrl, user.id)
    : Promise.resolve(mediaUrl);
  const resolvedMediaUrlsPromise = needsPublicUrl
    ? resolveMediaUrls(images, mediaUrl, user.id)
    : Promise.resolve(mediaUrl ? [mediaUrl] : []);

  // Platforms that upload the file directly (don't need to wait for storage)
  const directPlatforms = ["twitter", "linkedin", "bluesky", "youtube"];

  // Publish all platforms in parallel
  const resultPromises = platforms.map(async (platform) => {
    const account = connectedAccounts.find(item => item.platform === platform);
    if (!account) {
      return { platform, status: "skipped" as const, message: "No connected account found." };
    }
    // Direct-upload platforms don't wait for storage URL
    const resolvedUrl = directPlatforms.includes(platform)
      ? mediaUrl
      : await resolvedMediaUrlPromise;
    const resolvedUrls = directPlatforms.includes(platform)
      ? (mediaUrl ? [mediaUrl] : [])
      : await resolvedMediaUrlsPromise;
    return publishOne(account, text, title, resolvedUrl, linkUrl, mediaType, attachment, user.id, images, resolvedUrls);
  });

  const results = await Promise.all(resultPromises);
  const published = results.filter(r => r.status === "published").length;

  const publishedPlatforms = results
    .filter((result) => result.status === "published")
    .map((result) => result.platform);

  if (publishedPlatforms.length > 0) {
    const historyRow = {
      user_id: user.id,
      workspace_id: workspaceId,
      workspace_draft_id: workspaceDraftId,
      title: title || text.slice(0, 80) || "Published post",
      description: text,
      media_urls: mediaUrl ? [mediaUrl] : [],
      platforms: publishedPlatforms,
      scheduled_time: new Date().toISOString(),
      status: "published",
      platform_results: results,
    };

    const { error: historyError } = await supabase
      .from("scheduled_posts")
      .insert(historyRow);

    if (historyError && historyError.message.includes("platform_results")) {
      const legacyHistoryRow = { ...historyRow } as Record<string, unknown>;
      delete legacyHistoryRow.platform_results;
      await supabase.from("scheduled_posts").insert(legacyHistoryRow);
    } else if (historyError) {
      console.error("[Publish] Failed to save publish history", historyError);
    }
  }

  return NextResponse.json({ ok: published > 0, published, results });
}
