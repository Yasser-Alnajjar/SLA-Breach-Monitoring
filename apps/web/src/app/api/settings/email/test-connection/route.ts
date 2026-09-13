import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getEmailSettings, getPrismaClient } from "@sla/db";
import { verifyEmailConfig } from "@sla/email";
import { authOptions } from "@/lib/auth";
import { emailSettingsInputSchema, smtpErrorMessage } from "@/lib/email-settings";

/**
 * Authenticates against the SMTP server the request describes, without
 * saving anything — lets the settings form validate credentials before
 * "Save Configuration" is pressed. `password` is optional in the request
 * body: the form never re-populates a saved password (see
 * `EmailNotificationsCard`), so a blank password here falls back to the
 * organization's already-saved one, letting an admin test after editing
 * only the host/port/etc.
 *
 * Only ever performs an SMTP handshake (never returns response bodies or
 * proxies arbitrary content back to the caller) — not a general-purpose
 * network probe, just enough surface to say "did this authenticate".
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

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
      { ok: false, error: "Enter the SMTP password to test the connection." },
      { status: 400 },
    );
  }

  try {
    await verifyEmailConfig({
      host: parsed.data.host,
      port: parsed.data.port,
      security: parsed.data.security,
      user: parsed.data.username,
      password,
      from: parsed.data.fromEmail,
      fromName: parsed.data.fromName ?? null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: smtpErrorMessage(error, password) }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: "Connected and authenticated with the SMTP server." });
}
