import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { createNativeCalendar, WeeklyWindowValidationError } from "@sla/commitments";
import { authOptions } from "@/lib/auth";
import { parseHolidays, parseTimezone, parseWeekly } from "@/lib/calendar-validation";
import { ValidationError } from "@/lib/sla-policy-validation";

/** Creates a native business calendar (task 4.6, D12). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { name?: string; timezone?: unknown; weekly?: unknown; holidays?: unknown }
    | null;

  if (!body?.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const timezone = parseTimezone(body.timezone);
    const weekly = parseWeekly(body.weekly ?? []);
    const holidays = parseHolidays(body.holidays ?? []);

    const prisma = getPrismaClient();
    const result = await createNativeCalendar(prisma, session.user.organizationId, body.name.trim(), {
      timezone,
      weekly,
      holidays,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof WeeklyWindowValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
