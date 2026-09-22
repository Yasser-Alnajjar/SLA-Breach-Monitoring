import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import { CalendarNotFoundError, updateCalendar, WeeklyWindowValidationError, type UpdateCalendarInput } from "@sla/commitments";
import { authOptions } from "@/lib/auth";
import { parseHolidays, parseTimezone, parseWeekly } from "@/lib/calendar-validation";
import { ValidationError } from "@/lib/sla-policy-validation";

/** Edits a calendar (task 4.6, D1b) — works on both a native and an imported calendar. Every edit appends a new version; nothing here ever touches an already-created commitment. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { name?: string; timezone?: unknown; weekly?: unknown; holidays?: unknown }
    | null;

  try {
    const input: UpdateCalendarInput = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      input.name = body.name.trim();
    }
    if (body?.timezone !== undefined) input.timezone = parseTimezone(body.timezone);
    if (body?.weekly !== undefined) input.weekly = parseWeekly(body.weekly);
    if (body?.holidays !== undefined) input.holidays = parseHolidays(body.holidays);

    const prisma = getPrismaClient();
    const result = await updateCalendar(prisma, session.user.organizationId, id, input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof WeeklyWindowValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CalendarNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
