"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import { Actions } from "@/actions/client";
import { AuthShell } from "@/components/shared/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const forgotPasswordSchema = Yup.object({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
});

type ForgotPasswordFormValues = Yup.InferType<typeof forgotPasswordSchema>;

export const ForgotPasswordForm = () => {
  const [submitted, setSubmitted] = useState(false);

  const initialValues: ForgotPasswordFormValues = {
    email: "",
  };

  async function handleSubmit(
    values: ForgotPasswordFormValues,
    {
      setSubmitting,
    }: {
      setSubmitting: (isSubmitting: boolean) => void;
    },
  ) {
    // Always succeeds from the caller's perspective — the server responds
    // identically whether or not the email belongs to an account, so
    // there's nothing to branch on here.
    await Actions.PasswordReset.request(values.email);

    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthShell
        title="Check your email"
        description="If an account exists for that email, we've sent a link to reset your password."
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
        <Alert>
          <CheckCircle2 />
          <AlertDescription>The link expires in 1 hour.</AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password"
      description="Enter your email and we'll send you a link to reset your password."
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
        validationSchema={forgotPasswordSchema}
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
                <p id="email-error" className="text-sm text-error">
                  {errors.email}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
};
