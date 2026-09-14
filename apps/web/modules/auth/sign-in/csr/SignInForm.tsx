"use client";

import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Actions } from "@/actions/client";
import { AuthShell } from "@/components/shared/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCooldownClock,
  formatCooldownSentence,
} from "@/lib/auth-rate-limit";

export const SignInForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Seconds remaining in a server-imposed cooldown — null means no cooldown
  // is active. Counts down locally from the `retryAfterSeconds` the server
  // already computed; a page refresh resets this display, but the server
  // stays authoritative and keeps rejecting the attempt until its own
  // window actually elapses. Two distinct sources share this same display:
  // the IP-wide rate limit (roadmap step 30) and the per-identity
  // progressive throttle after repeated failed attempts — `cooldownReason`
  // only changes the copy shown, not the countdown mechanics.
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const [cooldownReason, setCooldownReason] = useState<"RATE_LIMITED" | "AUTH_THROTTLED" | null>(
    null,
  );

  useEffect(() => {
    if (cooldownSeconds === null) return;
    if (cooldownSeconds <= 0) {
      setCooldownSeconds(null);
      setCooldownReason(null);
      return;
    }
    const timer = setTimeout(
      () => setCooldownSeconds((seconds) => (seconds ?? 1) - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const inCooldown = cooldownSeconds !== null && cooldownSeconds > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (inCooldown) return;
    setSubmitting(true);
    setError(null);

    const result = await Actions.Auth.signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      if (
        (result.error === "RATE_LIMITED" || result.error === "AUTH_THROTTLED") &&
        "retryAfterSeconds" in result
      ) {
        setCooldownReason(result.error);
        setCooldownSeconds(result.retryAfterSeconds);
      } else {
        setError("Incorrect email or password");
      }
      return;
    }

    router.push("/dashboard");
  }

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back — pick up where you left off."
      footer={
        <p>
          Need an account?{" "}
          <a
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {inCooldown && (
          <Alert variant="warning">
            <Clock />
            <AlertDescription>
              {cooldownReason === "AUTH_THROTTLED"
                ? "Too many failed login attempts."
                : "Too many login attempts."}{" "}
              Please try again in {formatCooldownSentence(cooldownSeconds ?? 0)}.
            </AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          disabled={submitting || inCooldown}
          className="w-full"
        >
          {submitting && <Loader2 className="animate-spin" />}
          {inCooldown
            ? `Try again in ${formatCooldownClock(cooldownSeconds ?? 0)}`
            : submitting
              ? "Signing in…"
              : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
};
