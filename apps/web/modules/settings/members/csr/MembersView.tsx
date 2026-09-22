"use client";

import { AlertCircle, CheckCircle2, Loader2, Mail, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PendingInvitation } from "@/lib/types/invitations";
import type { OrganizationMemberSummary } from "@/lib/types/members";
import type { UserRole } from "@/lib/types/user";
import { formatDateTime } from "@/lib/format";

interface MembersViewProps {
  invitations: PendingInvitation[];
  members: OrganizationMemberSummary[];
  currentUserId: string;
}

interface InviteResult {
  ok: boolean;
  message?: string;
  error?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function MemberRow({
  member,
  isSelf,
  onSaved,
}: {
  member: OrganizationMemberSummary;
  isSelf: boolean;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<UserRole>(member.role);
  const [savingRole, setSavingRole] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleDirty = role !== member.role;

  async function handleSaveRole() {
    setSavingRole(true);
    setError(null);

    const { ok, body } = await Actions.Members.updateRole(member.id, role);
    setSavingRole(false);

    if (!ok) {
      setError(body.error ?? "Failed to update role");
      setRole(member.role);
      return;
    }

    onSaved();
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);

    const { ok, error: removeError } = await Actions.Members.remove(member.id);
    setRemoving(false);

    if (!ok) {
      setError(removeError ?? "Failed to remove member");
      return;
    }

    onSaved();
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {member.name ?? member.email}
            {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {member.name ? `${member.email} · ` : ""}Joined {formatDate(member.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
          {roleDirty && (
            <Button type="button" size="sm" onClick={handleSaveRole} disabled={savingRole}>
              {savingRole && <Loader2 className="animate-spin" />}
              {savingRole ? "Saving…" : "Save"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            disabled={isSelf || removing}
            title={isSelf ? "You can't remove yourself" : undefined}
          >
            {removing ? <Loader2 className="animate-spin" /> : <X />}
            Remove
          </Button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </li>
  );
}

export function MembersView({ invitations, members, currentUserId }: MembersViewProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setResult(null);

    const { ok, body } = await Actions.Invitations.invite(email.trim());
    setInviting(false);

    if (!ok) {
      setResult({
        ok: false,
        error: body.error ?? "Failed to send invitation",
      });
      return;
    }

    setEmail("");
    setResult({
      ok: true,
      message: body.resent ? "Invitation resent." : "Invitation sent.",
    });
    router.refresh();
  }

  async function handleRevoke(invitationId: string) {
    setRevokingId(invitationId);
    await Actions.Invitations.revoke(invitationId);
    setRevokingId(null);
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

      <Card className="p-6">
        <CardHeader className="flex flex-row items-center gap-3 p-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base font-medium">Members</CardTitle>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "person has" : "people have"} access.
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
                onSaved={() => router.refresh()}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader className="flex flex-row items-center gap-3 p-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base font-medium">
              Invite a member
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              They&apos;ll get an email with a single-use link to join, expiring
              in 7 days.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-5">
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@example.com"
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={inviting}>
              {inviting && <Loader2 className="animate-spin" />}
              {inviting ? "Sending…" : "Send invitation"}
            </Button>
          </form>
          {result && (
            <Alert
              variant={result.ok ? "success" : "destructive"}
              className="mt-3"
            >
              {result.ok ? <CheckCircle2 /> : <AlertCircle />}
              <AlertDescription>
                {result.ok ? result.message : result.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
