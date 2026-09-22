"use client";

import { AlertCircle, CheckCircle2, Loader2, Mail, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PendingInvitation } from "@/lib/types/invitations";

interface MembersViewProps {
  invitations: PendingInvitation[];
}

interface InviteResult {
  ok: boolean;
  message?: string;
  error?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Invitations only — 5.2's scope. Listing/changing roles/removing already-
 * accepted members is Phase 5 task 5.3, built on top of this same page.
 */
export function MembersView({ invitations }: MembersViewProps) {
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
      setResult({ ok: false, error: body.error ?? "Failed to send invitation" });
      return;
    }

    setEmail("");
    setResult({ ok: true, message: body.resent ? "Invitation resent." : "Invitation sent." });
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
        <p className="text-sm text-muted-foreground">Invite people to this organization.</p>
      </div>

      <Card className="p-6">
        <CardHeader className="flex flex-row items-center gap-3 p-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base font-medium">Invite a member</CardTitle>
            <p className="text-sm text-muted-foreground">
              They&apos;ll get an email with a single-use link to join, expiring in 7 days.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-5">
          <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
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
            <Alert variant={result.ok ? "success" : "destructive"} className="mt-3">
              {result.ok ? <CheckCircle2 /> : <AlertCircle />}
              <AlertDescription>{result.ok ? result.message : result.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-base font-medium">Pending invitations</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-5">
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <ul className="divide-y">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {formatDate(invitation.createdAt)} · expires {formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevoke(invitation.id)}
                    disabled={revokingId === invitation.id}
                  >
                    {revokingId === invitation.id ? <Loader2 className="animate-spin" /> : <X />}
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
