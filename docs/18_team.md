# 18_ Team Workspaces — Developer Guide

## What is a Team Workspace?

A Team Workspace is Postelligence's collaborative mode, sitting alongside the solo (personal) mode. Instead of one person drafting, scheduling, and publishing alone, a workspace has multiple members with different roles — someone writes content, someone approves and schedules it, someone reviews performance — all inside the same shared social accounts, drafts, calendar, and analytics.

Solo and team functionality are deliberately kept in separate clients (`TeamComposeClient.tsx`, `TeamScheduleClient.tsx`, etc.) so team-specific logic (roles, approvals, comments) never leaks into the simpler solo flows.

---

## Roles

Every workspace member has exactly one role, stored on `workspace_members.role`:

| Role | Summary |
|---|---|
| **Owner** | Full access to everything. The only role that can manage members, change roles, transfer ownership, or delete the workspace. There is exactly one Owner per workspace (the creator). |
| **Manager** | Operational lead. Approves/rejects drafts, manages the schedule, connects/disconnects the workspace's social accounts, oversees submitted reports. Cannot manage members or the workspace itself. |
| **Creator** | Content author. Creates and edits drafts, submits them for approval. Does not see Team Analytics or Reports. |
| **Analyst** | Reporting specialist. Views Team Analytics, writes Observations & Recommendations, and submits the official Team Analytics report. Does not touch drafts or scheduling. |

Roles are checked centrally in `lib/workspace/permissions.ts` — every permission in the app is one small function there (`canPublish`, `canApprove`, `canManageMembers`, `canExportReports`, etc.), each returning a boolean for a given `WorkspaceRole`. API routes and UI components both call into this file rather than re-implementing role checks, so the rules can't drift between the server and the client.

### Permission matrix

| Action | Owner | Manager | Creator | Analyst |
|---|:---:|:---:|:---:|:---:|
| Create / edit / delete drafts | ✅ | ✅ (edit/delete only) | ✅ (own drafts) | ❌ |
| Submit draft for approval | ✅ | ✅ | ✅ | ❌ |
| Approve / reject drafts | ✅ | ✅ | ❌ | ❌ |
| Manage schedule (reschedule/cancel) | ✅ | ✅ | ❌ | ❌ |
| Connect/disconnect social accounts | ✅ | ✅ | ❌ | ❌ |
| Comment on drafts | ✅ | ✅ | ✅ | ❌ |
| View personal analytics | ✅ | ✅ | ✅ | ✅ |
| View Team Analytics | ✅ | ✅ | ❌ | ✅ |
| Write report Observations/Recommendations | ✅ | ❌ | ❌ | ✅ |
| Export / submit official report | ✅ | ❌ | ❌ | ✅ |
| View submitted Reports section | ✅ | ✅ | ❌ | ✅ (own only) |
| Manage/archive any submitted report | ✅ | ✅ | ❌ | ❌ |
| Request changes on a submitted report | ✅ | ✅ | ❌ | ❌ |
| Invite / remove members, change roles | ✅ | ❌ | ❌ | ❌ |
| Transfer ownership / delete workspace | ✅ | ❌ | ❌ | ❌ |

Assignable roles when inviting someone are `manager`, `creator`, and `analyst` (`ASSIGNABLE_ROLES` in `permissions.ts`) — you can't invite a second Owner; ownership only changes hands via transfer.

---

## Database

All team tables live in migration `008_team_workspace.sql`, extended by `012`, `013`, `014`, `016`, and `017`.

### Core tables (`008_team_workspace.sql`)

| Table | Purpose |
|---|---|
| `workspaces` | One row per team. `owner_id`, `name`, and (since migration 017) an optional `description` shown as the team's profile blurb. |
| `workspace_members` | Join table: `workspace_id` + `user_id` + `role`. Unique per (workspace, user). |
| `workspace_invites` | Pending invites: `email`, `role`, a unique `token`, `invited_by`, `accepted`, and a 7-day `expires_at`. |
| `workspace_drafts` | Team drafts — separate from personal drafts. Carries the approval lifecycle: `status` (`draft` → `pending_approval` → `approved`/`rejected` → `scheduled` → `published`), `reviewed_by`, `reviewed_at`, `rejection_reason`, plus the same `linkedin_media_urn` / `youtube_video_id` pre-upload fields used by solo scheduling. |
| `workspace_draft_comments` | Threaded comments on a draft, used for review feedback. |
| `workspace_activity_log` | Append-only audit trail: `user_id`, `action`, `entity_type`, `entity_id`, `metadata` (jsonb). Powers the `ActivityFeed` component. |
| `scheduled_posts.workspace_id` | Nullable FK added so the same scheduling/publishing pipeline (see `schedule.md`) works for both solo and team posts. |

### Extended tables

| Migration | Adds |
|---|---|
| `012_workspace_social_accounts.sql` | Workspace-owned social accounts, separate from a user's personal connections — accounts belong to the team, not an individual member. |
| `013_workspace_analytics_cache.sql` | Cached analytics per workspace, mirroring the solo `analytics_cache` table so Team Analytics doesn't hit rate-limited platform APIs on every page load. |
| `014_workspace_report_reviews.sql` | `workspace_report_reviews` — the Analyst's in-progress Observations & Recommendations for a given date range, keyed by `(workspace_id, range_from, range_to)`. This is the *working draft* of a report. |
| `016_workspace_reports_and_notifications.sql` | `workspace_reports` — the **official, submitted** snapshot of a report (executive summary, observations, recommendations, charts, analytics — all frozen at submission time so it can't silently change under the Owner/Manager later). Also adds `workspace_notifications`, the in-app notification feed. |
| `017_workspace_profile_and_leave.sql` | Adds `workspaces.description`, and an RLS policy letting a non-owner member delete their own membership row (leave workspace) — owners must use the transfer/delete-workspace flow instead. |

### Report lifecycle

```
Analyst reviews Team Analytics
        ↓
Writes Observations & Recommendations → saved to workspace_report_reviews (draft, editable)
        ↓
Clicks "Submit Report"
        ↓
Full snapshot (summary, observations, recommendations, charts_data, analytics_data)
written to workspace_reports, status = "submitted"
        ↓
Owner/Manager notified (workspace_notifications, type = report_submitted)
        ↓
Owner/Manager can:
  → view / download the report, or
  → "Request Changes" → status = "changes_requested" → Analyst notified
        → Analyst edits and resubmits
  → Archive → status = "archived"
```

`workspace_reports` is intentionally immutable-until-changes-requested: once submitted, live analytics can keep moving, but the report itself stays exactly as it was at submission time.

---

## Row Level Security

Every workspace table follows the same coarse-grained pattern: RLS gates on **workspace membership** (`workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`), and fine-grained rules (who can approve, who can submit a report, who can archive) are enforced in the API route using the `lib/workspace/permissions.ts` helpers — the same pattern used across `014`, `016`, and `017`.

A few RLS specifics worth knowing:
- **`workspace_notifications` has no INSERT policy** for the authenticated role. Notifications are written by the API route using the service-role admin client, because the sender (e.g. an Analyst submitting a report) usually isn't the recipient (the Owner) — a normal RLS check can't authorize writing another user's row. See `notifyWorkspaceUsers()` in `lib/workspace/notifications.ts`.
- **Leaving a workspace** (`workspace_members_leave` policy, migration 017) lets any member delete their own row — except the Owner, who must transfer ownership or delete the workspace instead.
- **Members/invites management** (`members_insert`, `members_update`, `invites_insert`, etc.) is restricted at the RLS layer itself (not just the API layer) to `owner`/`manager`, since these are structural, high-trust operations.

---

## Key Files

| Layer | File |
|---|---|
| Permissions | `lib/workspace/permissions.ts` |
| Notifications | `lib/workspace/notifications.ts` |
| Activity logging | `lib/workspace/activity-logger.ts` |
| Report export (CSV/PDF) | `lib/workspace/report-export.ts` |
| Team page | `app/(shell)/team/TeamClient.tsx` |
| Team compose | `components/workspace/TeamComposeClient.tsx` |
| Team schedule | `components/workspace/TeamScheduleClient.tsx` |
| Reports panel | `components/workspace/ReportsPanel.tsx` |
| Team analytics dashboard | `components/workspace/TeamAnalyticsDashboard.tsx` |
| Activity feed | `components/workspace/ActivityFeed.tsx` |
| Draft comments | `components/workspace/CommentThread.tsx` |
| Role badge, member avatar | `components/workspace/RoleBadge.tsx`, `MemberAvatar.tsx` |
| Workspace social accounts | `components/workspace/WorkspaceSocialAccounts.tsx` |
| Workspace API routes | `app/api/workspace/**` (members, invites, drafts, reports, analytics, activity, transfer, leave) |

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| New member can't see any drafts | `workspace_members` row missing or invite not yet accepted | Check `workspace_invites.accepted` and confirm a matching `workspace_members` row exists |
| Analyst can't submit a report | Trying to submit from a role other than `owner`/`analyst` | Only Owner and Analyst pass `canSubmitReport()` — confirm the member's role |
| Owner/Manager not notified of a new report | `workspace_notifications` insert silently failed | Check server logs — `notifyWorkspaceUsers()` swallows notification errors on purpose so a notification failure never blocks the report submission itself |
| Member can't leave workspace | Member is the Owner | Owners must transfer ownership first, or delete the workspace — they can't "leave" per migration 017's policy |
| Instagram routes to Facebook's OAuth in team section | Known historical bug (already fixed) | Confirm the latest `WorkspaceSocialAccounts.tsx` / connect routes are deployed |
| Duplicate scheduled workspace posts | Two schedulers claiming the same row | Already handled by `claim_due_scheduled_posts()` (migration 015) — see `schedule.md` for the staggered pg_cron/Vercel cron setup |