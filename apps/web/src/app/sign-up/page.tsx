"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SignUpPage() {
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

    const response = await fetch("/api/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationName, email, password }),
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    const signInResult = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (signInResult?.error) {
      router.push("/sign-in");
      return;
    }

    router.push("/onboarding");
  }

  return (
    <main className="auth-page">
      <h1>Create your account</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Organization name
          <input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
          />
        </label>
        <label>
          Work email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p>
        Already have an account? <a href="/sign-in">Sign in</a>
      </p>
    </main>
  );
}
