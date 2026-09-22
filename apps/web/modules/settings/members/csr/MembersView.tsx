"use client";

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
      <div>
        <h1 className="text-lg font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Manage who has access to this organization.
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
