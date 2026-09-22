"use client";

import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IUser } from "@/lib/types/user";

interface EmailCardProps {
  user: IUser;
}

interface Result {
  ok: boolean;
  message?: string;
  error?: string;
}

export function EmailCard({ user }: EmailCardProps) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<Result | null>(null);

  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [changeResult, setChangeResult] = useState<Result | null>(null);
  const [showChangeForm, setShowChangeForm] = useState(false);

  async function handleResend() {
    setResending(true);
    setResendResult(null);
    const { ok, body } = await Actions.Profile.resendVerification();
    setResending(false);
    setResendResult(
      ok
        ? { ok: true, message: "Verification email sent — check your inbox." }
        : { ok: false, error: body.error ?? "Failed to send verification email" },
    );
  }

  async function handleChangeSubmit(event: FormEvent) {
    event.preventDefault();
    setChanging(true);
    setChangeResult(null);

    const { ok, body } = await Actions.Profile.requestEmailChange({ newEmail, currentPassword });
    setChanging(false);

    if (!ok) {
      setChangeResult({ ok: false, error: body.error ?? "Failed to request email change" });
      return;
    }

    setCurrentPassword("");
    setChangeResult({ ok: true, message: `Check ${newEmail} for a link to confirm this change.` });
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
            <Mail className="size-4" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold">Email</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">The address you sign in with and receive notifications at.</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Label>Current email</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm">{user.email}</span>
              <Badge variant={user.emailVerifiedAt ? "success" : "warning"}>
                {user.emailVerifiedAt ? "Verified" : "Unverified"}
              </Badge>
            </div>
          </div>
          {!user.emailVerifiedAt && (
            <Button type="button" variant="outline" size="sm" disabled={resending} onClick={handleResend}>
              {resending && <Loader2 className="animate-spin" />}
              {resending ? "Sending…" : "Resend verification"}
            </Button>
          )}
        </div>

        {resendResult && (
          <Alert variant={resendResult.ok ? "success" : "destructive"}>
            {resendResult.ok ? <CheckCircle2 /> : <AlertCircle />}
            <AlertDescription>{resendResult.ok ? resendResult.message : resendResult.error}</AlertDescription>
          </Alert>
        )}

        {!showChangeForm && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowChangeForm(true)}>
            Change email
          </Button>
        )}

        {showChangeForm && (
          <form onSubmit={handleChangeSubmit} className="space-y-4 border-t pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-email">New email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-change-current-password">Current password</Label>
              <Input
                id="email-change-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {changeResult && (
              <Alert variant={changeResult.ok ? "success" : "destructive"}>
                {changeResult.ok ? <CheckCircle2 /> : <AlertCircle />}
                <AlertDescription>{changeResult.ok ? changeResult.message : changeResult.error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowChangeForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={changing || !newEmail || !currentPassword}>
                {changing && <Loader2 className="animate-spin" />}
                {changing ? "Sending…" : "Send confirmation link"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
