"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, UserPlus, Settings, LogOut, Trash2,
  MoreVertical, Check, RefreshCw, Link2, XCircle, Clock
} from "lucide-react";
import MemberAvatar from "@/components/workspace/MemberAvatar";
import RoleBadge from "@/components/workspace/RoleBadge";
import ActivityFeed from "@/components/workspace/ActivityFeed";
import WorkspaceSocialAccounts from "@/components/workspace/WorkspaceSocialAccounts";
import TeamComposeClient from "@/components/workspace/TeamComposeClient";
import TeamScheduleClient from "@/components/workspace/TeamScheduleClient";
import type {
  Workspace, WorkspaceMember, WorkspaceRole,
  WorkspaceActivityLog, WorkspaceInvite
} from "@/types";
import { ASSIGNABLE_ROLES, getRoleLabel } from "@/lib/workspace/permissions";

interface Props {
  workspace:    Workspace;
  members:      WorkspaceMember[];
  invites:      WorkspaceInvite[];
  activityLogs: (WorkspaceActivityLog & { label: string })[];
  currentRole:  WorkspaceRole;
  currentUserId: string;
  currentUser:  { email?: string | null; user_metadata?: { full_name?: string; avatar_url?: string; name?: string } };
  blueskyStatus?: string | null;
  blueskyMessage?: string | null;
}

export default function TeamClient({
  workspace,
  members: initialMembers,
  invites: initialInvites,
  activityLogs,
  currentRole,
  currentUserId,
  currentUser,
  blueskyStatus,
  blueskyMessage,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // A "draftId" in the URL always means "open this draft in Compose", which is
  // why it outranks any other ?tab= value here.
  const initialTab = (searchParams.get("tab") === "compose" || searchParams.get("draftId")) ? "compose"
    : searchParams.get("tab") === "schedule" ? "schedule"
    : searchParams.get("tab") === "members" ? "members"
    : searchParams.get("tab") === "accounts" ? "accounts"
    : searchParams.get("tab") === "activity" ? "activity"
    : "compose";
  const [tab, setTab]               = useState<"compose" | "schedule" | "members" | "activity" | "accounts">(initialTab);
  const [editDraftId, setEditDraftId] = useState<string | null>(searchParams.get("draftId"));

  // Keep the tab/edit target in sync if the URL changes (e.g. clicking
  // "Edit" on a workspace draft again while already on this page). Adjusting
  // during render rather than in an effect avoids rendering one frame against
  // the stale tab before correcting it.
  const [syncedParams, setSyncedParams] = useState(searchParams);
  if (syncedParams !== searchParams) {
    setSyncedParams(searchParams);
    const urlTab = searchParams.get("tab");
    const urlDraftId = searchParams.get("draftId");
    if (urlTab === "compose" || urlDraftId) setTab("compose");
    setEditDraftId(urlDraftId);
  }
  const [members, setMembers]       = useState(initialMembers);
  const [invites, setInvites]       = useState(initialInvites);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("creator");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError]     = useState<string | null>(null);
  const [inviteSent, setInviteSent]       = useState<string | null>(null); // email of the invite just sent
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // ── Edit team name/profile (owner only) ────────────────────
  const [workspaceInfo, setWorkspaceInfo] = useState(workspace);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(workspace.name);
  const [editDescription, setEditDescription] = useState(workspace.description || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ── Leave workspace (non-owner) ─────────────────────────────
  const [leaving, setLeaving] = useState(false);

  const isOwner = currentRole === "owner";

  // ── Invite member ──────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const res  = await fetch(`/api/workspace/${workspace.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      setInvites((prev) => [...prev, data.invite]);
      // No token to hand out — the invite shows up as a notification for
      // that person to accept or reject directly, the same way GitHub
      // repo/org invites work.
      setInviteSent(inviteEmail.trim());
      setInviteEmail("");
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  // ── Cancel pending invite ──────────────────────────────────
  const handleCancelInvite = async (inviteId: string) => {
    setCancelingInviteId(inviteId);
    setInviteError(null);
    try {
      const res = await fetch(`/api/workspace/${workspace.id}/invites/${inviteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel invite");
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to cancel invite");
    } finally {
      setCancelingInviteId(null);
    }
  };

  // ── Change role ────────────────────────────────────────────
  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    setActionLoading(memberId);
    setError(null);
    try {
      const res  = await fetch(`/api/workspace/${workspace.id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change role");
      setMembers((prev) =>
        prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change role");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Remove member ──────────────────────────────────────────
  const handleRemove = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the workspace?`)) return;
    setActionLoading(memberId);
    setError(null);
    try {
      const res  = await fetch(`/api/workspace/${workspace.id}/members/${memberId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Save team name/profile ──────────────────────────────────
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setProfileError("Team name is required.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch(`/api/workspace/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update team profile");
      setWorkspaceInfo(data.workspace);
      setEditingProfile(false);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Failed to update team profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Delete workspace ───────────────────────────────────────
  const handleDeleteWorkspace = async () => {
    if (!confirm(`Delete workspace "${workspaceInfo.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/workspace/${workspace.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete workspace");
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete workspace");
    }
  };

  // ── Leave workspace (any non-owner member) ─────────────────
  const handleLeaveWorkspace = async () => {
    if (!confirm(`Leave "${workspaceInfo.name}"? You'll lose access until someone re-invites you.`)) return;
    setLeaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/${workspace.id}/leave`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave workspace");
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to leave workspace");
      setLeaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl w-full space-y-6 pb-12">

      {/* Workspace Info Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        {!editingProfile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-black flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{workspaceInfo.name}</h1>
                <p className="text-sm text-gray-500">
                  {members.length} member{members.length !== 1 ? "s" : ""} · Your role: <span className="font-medium">{getRoleLabel(currentRole)}</span>
                </p>
                {workspaceInfo.description && (
                  <p className="mt-1 text-sm text-gray-600">{workspaceInfo.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isOwner && (
                <button
                  onClick={() => {
                    setEditName(workspaceInfo.name);
                    setEditDescription(workspaceInfo.description || "");
                    setProfileError(null);
                    setEditingProfile(true);
                  }}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Edit
                </button>
              )}
              {isOwner && (
                <button
                  onClick={handleDeleteWorkspace}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Edit Team Profile</h3>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Team name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Team profile / description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                placeholder="What's this workspace for?"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>
            {profileError && <p className="text-xs text-red-500">{profileError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-gray-800 transition-colors"
              >
                {savingProfile ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setEditingProfile(false)}
                disabled={savingProfile}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-2xl bg-[#1f2528]/5 p-1.5 border border-[#1f2528]/8">
        {(["compose", "schedule", "members", "accounts", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setEditDraftId(null);
              window.history.replaceState(null, "", `/team?tab=${t}`);
            }}
            className={`shrink-0 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap capitalize ${
              tab === t
                ? "bg-white text-[#1f2528] shadow-sm border border-[#1f2528]/10"
                : "text-slate-500 hover:text-[#1f2528]"
            }`}
          >
            {t === "compose" ? "Compose" : t === "schedule" ? "Schedule" : t === "members" ? "Members" : t === "accounts" ? "Accounts" : "Activity Log"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Compose Tab */}
      {tab === "compose" && (
        <TeamComposeClient
          workspaceId={workspace.id}
          currentRole={currentRole}
          user={currentUser}
          blueskyStatus={blueskyStatus}
          blueskyMessage={blueskyMessage}
          editDraftId={editDraftId}
        />
      )}

      {/* Schedule Tab */}
      {tab === "schedule" && (
        <TeamScheduleClient workspaceId={workspace.id} currentRole={currentRole} />
      )}

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-4">

          {/* Invite Button */}
          {isOwner && (
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          )}

          {/* Invite Form */}
          {showInvite && isOwner && (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Invite a Member</h3>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{getRoleLabel(r)}</option>
                  ))}
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-gray-800 transition-colors"
                >
                  {inviteLoading ? "..." : "Send"}
                </button>
              </div>

              {inviteError && (
                <p className="text-xs text-red-500">{inviteError}</p>
              )}

              {/* Sent confirmation — invite is now a notification, not a token to hand out */}
              {inviteSent && (
                <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                  <p className="text-xs font-medium text-green-700">
                    Invite sent to {inviteSent}. They&apos;ll see a notification to accept or decline it.
                  </p>
                </div>
              )}

              {/* Pending / declined invites */}
              {invites.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">Pending Invites</p>
                  <div className="space-y-1.5">
                    {invites.map((inv) => (
                      <div key={inv.id} className={`flex items-center justify-between text-xs rounded-xl border px-3 py-2 ${
                        inv.rejected ? "bg-red-50/60 border-red-100" : "bg-white border-gray-100"
                      }`}>
                        <span className="text-gray-700">{inv.email}</span>
                        <div className="flex items-center gap-2">
                          {/* Owner-visible status — without this, a declined
                              invite looked identical to a still-pending one,
                              so there was no way to tell someone had
                              actually responded (and said no). */}
                          {inv.rejected ? (
                            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                              <XCircle className="h-3 w-3" />Declined
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              <Clock className="h-3 w-3" />Pending
                            </span>
                          )}
                          <RoleBadge role={inv.role} size="sm" />
                          <button
                            onClick={() => handleCancelInvite(inv.id)}
                            disabled={cancelingInviteId === inv.id}
                            title={inv.rejected ? "Remove declined invite" : "Cancel invite"}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {cancelingInviteId === inv.id
                              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />
                            }
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Member List */}
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              const isTargetOwner = member.role === "owner";
              return (
                <div key={member.id} className="flex items-center justify-between px-5 py-4">
                  <MemberAvatar member={member} showRole={true} showEmail={true} />

                  {/* Actions — owner only, not for self or other owner */}
                  {isOwner && !isCurrentUser && !isTargetOwner && (
                    <div className="flex items-center gap-2 ml-4">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as WorkspaceRole)}
                        disabled={actionLoading === member.id}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black bg-white"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{getRoleLabel(r)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemove(member.id, member.full_name || member.email || "member")}
                        disabled={actionLoading === member.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {actionLoading === member.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  )}

                  {isCurrentUser && !isOwner && (
                    <button
                      onClick={handleLeaveWorkspace}
                      disabled={leaving}
                      className="flex items-center gap-1.5 ml-4 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      {leaving ? "Leaving..." : "Leave"}
                    </button>
                  )}

                  {isCurrentUser && isOwner && (
                    <span className="text-xs text-gray-400 ml-4">You (owner) · Dismiss the workspace to leave</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === "accounts" && (
        <WorkspaceSocialAccounts workspaceId={workspace.id} currentRole={currentRole} />
      )}

      {tab === "activity" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <ActivityFeed logs={activityLogs} />
        </div>
      )}
    </div>
  );
}
