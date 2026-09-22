"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { AuthShell } from "@/components/shared/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvitationPreview } from "@/lib/types/invitations";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: InvitationPreview };

export const AcceptInviteForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoad({ status: "error", message: "This invitation link is missing its token." });
      return;
    }
    let cancelled = false;
    Actions.Invitations.previewInvite(token).then(({ ok, body }) => {
      if (cancelled) return;
      if (!ok) {
        setLoad({ status: "error", message: body.error ?? "This invitation link is invalid or has expired." });
        return;
      }
      setLoad({ status: "ready", preview: body });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (load.status !== "ready") return;
    setSubmitting(true);
    setSubmitError(null);

    const { ok, body } = await Actions.Invitations.acceptInvite({ token, name, password });
    if (!ok) {
      setSubmitError(body.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    const signInResult = await Actions.Auth.signIn(load.preview.email, password);
    setSubmitting(false);

    if (!signInResult.ok) {
      router.push("/sign-in");
      return;
    }

    router.push("/dashboard");
  }

  if (load.status === "loading") {
    return (
      <AuthShell title="Accept invitation" description="Checking your invitation…" footer={null}>
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  if (load.status === "error") {
    return (
      <AuthShell
        title="Accept invitation"
        description="This invitation could not be used."
        footer={
          <p>
            <a href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
              Go to sign in
            </a>
          </p>
        }
      >
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{load.message}</AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  const { preview } = load;

  if (preview.alreadyRegistered) {
    return (
      <AuthShell
        title="Accept invitation"
        description={`${preview.email} already has an account.`}
        footer={null}
      >
        <Alert>
          <AlertCircle />
          <AlertDescription>Sign in with that email instead of accepting this invitation.</AlertDescription>
        </Alert>
        <Button className="mt-4 w-full" onClick={() => router.push("/sign-in")}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Accept invitation"
      description={`You've been invited to join ${preview.organizationName}.`}
      footer={
        <p>
          Already have an account?{" "}
          <a href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={preview.email} disabled readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Joining…" : `Join ${preview.organizationName}`}
        </Button>
      </form>
    </AuthShell>
  );
};
