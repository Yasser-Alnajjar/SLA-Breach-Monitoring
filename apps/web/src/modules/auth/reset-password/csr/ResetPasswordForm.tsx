"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { Actions } from "@/actions/client";
import { AuthShell } from "@/components/shared/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const resetPasswordSchema = Yup.object({
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
});

type ResetPasswordFormValues = Yup.InferType<typeof resetPasswordSchema>;

export const ResetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValues: ResetPasswordFormValues = {
    password: "",
  };

  async function handleSubmit(
    values: ResetPasswordFormValues,
    {
      setSubmitting,
    }: {
      setSubmitting: (isSubmitting: boolean) => void;
    },
  ) {
    setError(null);

    const { ok, body } = await Actions.PasswordReset.confirm({
      token,
      password: values.password,
    });

    setSubmitting(false);

    if (!ok) {
      setError(body.error ?? "This link is invalid or has expired.");
      return;
    }

    setSubmitted(true);
  }

  if (!token) {
    return (
      <AuthShell
        title="Reset password"
        description="This reset link is missing its token."
        footer={
          <p>
            <a
              href="/forgot-password"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Request a new link
            </a>
          </p>
        }
      >
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            Open the link from your email again, or request a new one.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  if (submitted) {
    return (
      <AuthShell
        title="Password reset"
        description="Your password has been changed."
        footer={null}
      >
        <Alert>
          <CheckCircle2 />
          <AlertDescription>
            You can now sign in with your new password.
          </AlertDescription>
        </Alert>

        <Button className="mt-4 w-full" onClick={() => router.push("/sign-in")}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      description="Choose a new password for your account."
      footer={
        <p>
          <a
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to sign in
          </a>
        </p>
      }
    >
      <Formik
        initialValues={initialValues}
        validationSchema={resetPasswordSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>

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
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
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
                <AlertDescription>
                  {error}{" "}
                  <a
                    href="/forgot-password"
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    Request a new link
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Resetting…" : "Reset password"}
            </Button>
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
};
