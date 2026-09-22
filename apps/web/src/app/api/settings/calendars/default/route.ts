import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { CalendarNotFoundError, setOrganizationDefaultCalendar } from "@sla/commitments";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { calendarId?: string | null } | null;
  const calendarId = body?.calendarId ?? null;
  if (calendarId !== null && typeof calendarId !== "string") {
    return NextResponse.json({ error: "calendarId must be a string or null" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  try {
    await setOrganizationDefaultCalendar(prisma, session.user.organizationId, calendarId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CalendarNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
