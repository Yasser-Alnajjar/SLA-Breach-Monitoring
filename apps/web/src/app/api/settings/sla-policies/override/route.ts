import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@sla/db";
import type { CommitmentKind } from "@sla/core";
import { overridePolicyTargets, PolicyNotFoundError } from "@sla/commitments";
import { authOptions } from "@/lib/auth";

const VALID_KINDS: CommitmentKind[] = ["first_response", "resolution", "next_reply"];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { policyId?: string; targets?: { kind?: string; minutes?: number }[] }
    | null;
  const policyId = body?.policyId;
  const rawTargets = body?.targets;

  if (!policyId || typeof policyId !== "string") {
    return NextResponse.json({ error: "policyId is required" }, { status: 400 });
  }
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    return NextResponse.json({ error: "targets must be a non-empty array" }, { status: 400 });
  }

  const seenKinds = new Set<string>();
  const targets: { kind: CommitmentKind; minutes: number }[] = [];
  for (const target of rawTargets) {
    const kind = target?.kind;
    const minutes = target?.minutes;
    if (typeof kind !== "string" || !VALID_KINDS.includes(kind as CommitmentKind) || seenKinds.has(kind)) {
      return NextResponse.json({ error: "each target must have a unique, valid kind" }, { status: 400 });
    }
    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes <= 0) {
      return NextResponse.json({ error: "each target's minutes must be a positive integer" }, { status: 400 });
    }
    seenKinds.add(kind);
    targets.push({ kind: kind as CommitmentKind, minutes });
  }

  const prisma = getPrismaClient();
  try {
    const result = await overridePolicyTargets(prisma, session.user.organizationId, policyId, targets);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PolicyNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
