"use client";

import { Loader2, X } from "lucide-react";

import { Actions } from "@/actions/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingInvitation } from "@/lib/types/invitations";
import { formatDateTime } from "@/lib/format";
import { useState } from "react";

interface PendingInvitationsProps {
  invitations: PendingInvitation[];
  onRevoked: () => void;
}

export function PendingInvitations({
  invitations,
  onRevoked,
}: PendingInvitationsProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(invitationId: string) {
    setRevokingId(invitationId);

    await Actions.Invitations.revoke(invitationId);

    setRevokingId(null);
    onRevoked();
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle className="text-base font-medium">
          Pending invitations
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 pt-5">
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending invitations.
          </p>
        ) : (
          <ul className="divide-y">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{invitation.email}</p>

                  <p className="text-xs text-muted-foreground">
                    Sent {formatDateTime(invitation.createdAt)} · expires{" "}
                    {formatDateTime(invitation.expiresAt)}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRevoke(invitation.id)}
                  disabled={revokingId === invitation.id}
                >
                  {revokingId === invitation.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <X />
                  )}
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
