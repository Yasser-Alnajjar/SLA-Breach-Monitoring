"use client";

import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
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

const signInSchema = Yup.object({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
});

type SignInFormValues = Yup.InferType<typeof signInSchema>;

export const SignInForm = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Seconds remaining in a server-imposed cooldown.
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const [cooldownReason, setCooldownReason] = useState<
    "RATE_LIMITED" | "AUTH_THROTTLED" | null
  >(null);

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

  const initialValues: SignInFormValues = {
    email: "",
    password: "",
  };

  async function handleSubmit(
    values: SignInFormValues,
    {
      setSubmitting: setFormikSubmitting,
    }: {
      setSubmitting: (isSubmitting: boolean) => void;
    },
  ) {
    if (inCooldown) {
      setFormikSubmitting(false);
      return;
    }

    setError(null);

    const result = await Actions.Auth.signIn(values.email, values.password);

    setFormikSubmitting(false);

    if (!result.ok) {
      if (
        (result.error === "RATE_LIMITED" ||
          result.error === "AUTH_THROTTLED") &&
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
      <Formik
        initialValues={initialValues}
        validationSchema={signInSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>

              <Field name="email">
                {({
                  field,
                }: {
                  field: {
                    name: string;
                    value: string;
                    onChange: React.ChangeEventHandler<HTMLInputElement>;
                    onBlur: React.FocusEventHandler<HTMLInputElement>;
                  };
                }) => (
                  <Input
                    {...field}
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    aria-invalid={Boolean(touched.email && errors.email)}
                    aria-describedby={
                      touched.email && errors.email ? "email-error" : undefined
                    }
                  />
                )}
              </Field>

              {touched.email && errors.email && (
                <p id="email-error" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>

                <a
                  href="/forgot-password"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              <Field name="password">
                {({
                  field,
                }: {
                  field: {
                    name: string;
                    value: string;
                    onChange: React.ChangeEventHandler<HTMLInputElement>;
                    onBlur: React.FocusEventHandler<HTMLInputElement>;
                  };
                }) => (
                  <Input
                    {...field}
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(touched.password && errors.password)}
                    aria-describedby={
                      touched.password && errors.password
                        ? "password-error"
                        : undefined
                    }
                  />
                )}
              </Field>

              {touched.password && errors.password && (
                <p id="password-error" className="text-sm text-destructive">
                  {errors.password}
                </p>
              )}
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
                  Please try again in{" "}
                  {formatCooldownSentence(cooldownSeconds ?? 0)}.
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || inCooldown}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="animate-spin" />}

              {inCooldown
                ? `Try again in ${formatCooldownClock(cooldownSeconds ?? 0)}`
                : isSubmitting
                  ? "Signing in…"
                  : "Sign in"}
            </Button>
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
};
