"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Actions } from "@/actions/client";
import { AuthShell } from "@/components/shared/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type State =
  | { status: "verifying" }
  | { status: "error"; message: string }
  | { status: "verified"; email: string };

export const VerifyEmailStatus = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<State>({ status: "verifying" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "This verification link is missing its token." });
      return;
    }
    let cancelled = false;
    Actions.EmailVerification.confirm(token).then(({ ok, body }) => {
      if (cancelled) return;
      if (!ok) {
        setState({ status: "error", message: body.error ?? "This verification link is invalid or has expired." });
        return;
      }
      setState({ status: "verified", email: body.email });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === "verifying") {
    return (
      <AuthShell title="Verify email" description="Confirming your email…" footer={null}>
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  if (state.status === "error") {
    return (
      <AuthShell
        title="Verify email"
        description="This link could not be used."
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
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Email verified" description={`${state.email} is now confirmed.`} footer={null}>
      <Alert>
        <CheckCircle2 />
        <AlertDescription>You're all set.</AlertDescription>
      </Alert>
      <Button className="mt-4 w-full" onClick={() => (window.location.href = "/dashboard")}>
        Go to dashboard
      </Button>
    </AuthShell>
  );
};
