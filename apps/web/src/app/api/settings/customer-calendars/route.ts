import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { CalendarNotFoundError, CustomerNotFoundError, setCustomerCalendar } from "@sla/commitments";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { customerId?: string; calendarId?: string | null }
    | null;
  const customerId = body?.customerId;
  if (!customerId || typeof customerId !== "string") {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  const calendarId = body?.calendarId ?? null;
  if (calendarId !== null && typeof calendarId !== "string") {
    return NextResponse.json({ error: "calendarId must be a string or null" }, { status: 400 });
  }

  const prisma = getPrismaClient();
  try {
    await setCustomerCalendar(prisma, session.user.organizationId, customerId, calendarId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CustomerNotFoundError || error instanceof CalendarNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
