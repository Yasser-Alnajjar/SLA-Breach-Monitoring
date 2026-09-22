"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import { Actions } from "@/actions/client";
import { AuthShell } from "@/components/shared/auth-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signUpSchema = Yup.object({
  organizationName: Yup.string().required("Organization name is required"),
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
});

type SignUpFormValues = Yup.InferType<typeof signUpSchema>;

export const SignUpForm = () => {
  const router = useRouter();

  const initialValues: SignUpFormValues = {
    organizationName: "",
    email: "",
    password: "",
  };

  async function handleSubmit(
    values: SignUpFormValues,
    { setSubmitting, setStatus }: FormikHelpers<SignUpFormValues>,
  ) {
    setStatus(undefined);

    const { ok, body } = await Actions.Auth.signUp({
      organizationName: values.organizationName,
      email: values.email,
      password: values.password,
    });

    if (!ok) {
      setStatus(body.error ?? "Something went wrong");
      setSubmitting(false);
      return;
    }

    const signInResult = await Actions.Auth.signIn(
      values.email,
      values.password,
    );

    setSubmitting(false);

    if (!signInResult.ok) {
      router.push("/sign-in");
      return;
    }

    router.push("/onboarding");
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={signUpSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched, isSubmitting, status }) => (
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
          <Form className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="organizationName">Organization name</Label>

              <Field name="organizationName">
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
                    id="organizationName"
                    placeholder="Acme, Inc."
                    aria-invalid={Boolean(
                      touched.organizationName && errors.organizationName,
                    )}
                    aria-describedby={
                      touched.organizationName && errors.organizationName
                        ? "organization-name-error"
                        : undefined
                    }
                  />
                )}
              </Field>

              {touched.organizationName && errors.organizationName && (
                <p
                  id="organization-name-error"
                  className="text-sm text-destructive"
                >
                  {errors.organizationName}
                </p>
              )}
            </div>

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
              <Label htmlFor="password">Password</Label>

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

            {status && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Creating account…" : "Sign up"}
            </Button>
          </Form>
        </AuthShell>
      )}
    </Formik>
  );
};
