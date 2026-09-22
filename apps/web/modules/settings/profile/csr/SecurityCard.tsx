"use client";

import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SaveResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export function SecurityCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setResult(null);

    const { ok, body } = await Actions.Profile.changePassword({
      currentPassword,
      newPassword,
    });

    setSaving(false);

    if (!ok) {
      setResult({ ok: false, error: body.error ?? "Failed to change password" });
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setResult({ ok: true, message: "Password updated. Signing you out…" });

    // A password change invalidates every live session for this account,
    // including this one (roadmap 5.7's `User.sessionVersion` — see
    // `auth.ts`) — the next request this tab makes would fail anyway, so
    // sign out proactively and send the user to sign in with the new
    // password, rather than letting them hit a confusing 401 first.
    await signOut({ callbackUrl: "/sign-in" });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
            <KeyRound className="size-4" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold">Security</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Change the password used to sign in to this account.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 py-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={mismatch}
              />
            </div>
          </div>

          {mismatch && (
            <p className="text-xs text-destructive">Passwords don&apos;t match.</p>
          )}

          {result && (
            <Alert variant={result.ok ? "success" : "destructive"}>
              {result.ok ? <CheckCircle2 /> : <AlertCircle />}
              <AlertDescription>
                {result.ok ? result.message : result.error}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!canSubmit || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
