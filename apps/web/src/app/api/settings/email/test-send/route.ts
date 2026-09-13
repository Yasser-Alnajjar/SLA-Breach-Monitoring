import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getEmailSettings, getPrismaClient } from "@sla/db";
import { sendEmail } from "@sla/email";
import { authOptions } from "@/lib/auth";
import { emailSettingsInputSchema, smtpErrorMessage } from "@/lib/email-settings";

/**
 * Sends a real message through the SMTP server the request describes, to
 * the currently signed-in user — distinct from `test-connection` because
 * authentication succeeding is not proof delivery will (a relay can accept
 * a login and still reject or silently drop the actual send). Same
 * password-fallback rule as `test-connection`: a blank password in the
 * request body falls back to the organization's already-saved one.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!session.user.email) {
    return NextResponse.json({ ok: false, error: "Your account has no email address to send a test to." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = emailSettingsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  let password = parsed.data.password;
  if (!password) {
    const saved = await getEmailSettings(prisma, session.user.organizationId).catch(() => null);
    password = saved?.password;
  }
  if (!password) {
    return NextResponse.json(
      { ok: false, error: "SMTP is not configured for this organization." },
      { status: 400 },
    );
  }

  const config = {
    host: parsed.data.host,
    port: parsed.data.port,
    security: parsed.data.security,
    user: parsed.data.username,
    password,
    from: parsed.data.fromEmail,
    fromName: parsed.data.fromName ?? null,
  };

  try {
    await sendEmail(config, {
      to: [session.user.email],
      subject: "SLA Breach Monitoring — Test Email",
      text: "This is a test email confirming your SMTP configuration for SLA Breach Monitoring is working correctly.\n\nIf you received this, at-risk and breach alerts will be delivered to this organization's users the same way.",
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: smtpErrorMessage(error, password) }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: `Test email sent to ${session.user.email}.` });
}
