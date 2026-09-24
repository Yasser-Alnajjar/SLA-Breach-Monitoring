"use client";

import { SettingsSectionHeader } from "@/components/settings/section-header";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PendingInvitation } from "@/lib/types/invitations";
import type { OrganizationMemberSummary } from "@/lib/types/members";

import { MembersList } from "./members-list";
import { InviteMemberForm } from "./invite-member-form";
import { PendingInvitations } from "./pending-invitations";

interface MembersViewProps {
  invitations: PendingInvitation[];
  members: OrganizationMemberSummary[];
  currentUserId: string;
}

export function MembersView({
  invitations,
  members,
  currentUserId,
}: MembersViewProps) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        eyebrow="Access control"
        title="Members & Roles"
        description="Manage who has access to this organization."
      />

      <div className="bg-surface-container-low flex items-start gap-2 rounded-lg p-4">
        <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
        <p className="text-on-surface-variant text-xs">
          Roles in Elapsed are strictly{" "}
          <strong className="text-on-surface">Owner</strong> and{" "}
          <strong className="text-on-surface">Member</strong>. Owners control
          connections and configuration; Members have read-only access to all
          dashboards, cases, and exports.
        </p>
      </div>

      <MembersList
        members={members}
        currentUserId={currentUserId}
        onSaved={refresh}
      />

      <InviteMemberForm onInvited={refresh} />

      <PendingInvitations invitations={invitations} onRevoked={refresh} />
    </div>
  );
}
