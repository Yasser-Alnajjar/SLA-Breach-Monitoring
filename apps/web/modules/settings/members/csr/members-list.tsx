"use client";

import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganizationMemberSummary } from "@/lib/types/members";

import { MemberRow } from "./member-row";

interface MembersListProps {
  members: OrganizationMemberSummary[];
  currentUserId: string;
  onSaved: () => void;
}

export function MembersList({
  members,
  currentUserId,
  onSaved,
}: MembersListProps) {
  return (
    <Card className="p-6">
      <CardHeader className="flex flex-row items-center gap-3 p-0">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-4" />
        </span>

        <div>
          <CardTitle className="text-base font-medium">Members</CardTitle>
          <p className="text-sm text-muted-foreground">
            {members.length}{" "}
            {members.length === 1 ? "person has" : "people have"} access.
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-5">
        <ul className="divide-y">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.id === currentUserId}
              onSaved={onSaved}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
