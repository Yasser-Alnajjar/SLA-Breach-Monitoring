import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import {
  CalendarNotFoundError,
  CustomerIdsNotFoundError,
  NotANativePolicyError,
  PolicyNotFoundError,
  updateNativePolicy,
  type UpdateNativePolicyInput,
} from "@sla/commitments";
import { authOptions } from "@/lib/auth";
import { parseMatch, parseTargets, parseWarnAtPercent, ValidationError } from "@/lib/sla-policy-validation";

/** Edits a native policy (task 4.4, D1) — every edit appends a new version; nothing here ever touches an active commitment. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        match?: unknown;
        targets?: unknown;
        // Omitted: leave the calendar untouched. A string: pin this
        // calendar. `null`: explicitly switch to "use the organization's
        // default calendar" (4i).
        calendarId?: string | null;
        warnAtPercent?: unknown;
      }
    | null;

  try {
    const input: UpdateNativePolicyInput = {};
    if (body?.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
      }
      input.name = body.name.trim();
    }
    if (body?.match !== undefined) input.match = parseMatch(body.match);
    if (body?.targets !== undefined) input.targets = parseTargets(body.targets);
    if (body?.calendarId !== undefined) {
      if (body.calendarId !== null && typeof body.calendarId !== "string") {
        return NextResponse.json({ error: "calendarId must be a string or null" }, { status: 400 });
      }
      input.calendarId = body.calendarId;
    }
    if (body?.warnAtPercent !== undefined) input.warnAtPercent = parseWarnAtPercent(body.warnAtPercent);

    const prisma = getPrismaClient();
    const result = await updateNativePolicy(prisma, session.user.organizationId, id, input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CalendarNotFoundError || error instanceof CustomerIdsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PolicyNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NotANativePolicyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
