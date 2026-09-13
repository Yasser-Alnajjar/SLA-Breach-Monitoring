"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { AuthShell } from "@/components/shared/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const SignUpForm = () => {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { ok, body } = await Actions.Auth.signUp({
      organizationName,
      email,
      password,
    });

    if (!ok) {
      setError(body.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    const signInResult = await Actions.Auth.signIn(email, password);
    setSubmitting(false);

    if (signInResult?.error) {
      router.push("/sign-in");
      return;
    }
    console.log("signUp", ok, body);
    console.log("signInResult", signInResult);

    router.push("/onboarding");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Set up your organization in under a minute."
      footer={
        <p>
          Already have an account?{" "}
          <a
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="organizationName">Organization name</Label>
          <Input
            id="organizationName"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
            placeholder="Acme, Inc."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
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
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>
    </AuthShell>
  );
};
