import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@sla/db";
import { overridePolicyTargets, PolicyNotFoundError } from "../src/override";

interface PolicyRow {
  id: string;
  organizationId: string;
}

interface VersionRow {
  id: string;
  policyId: string;
  version: number;
  match: unknown;
  targets: unknown;
  pauseOnStates: string[];
  calendarVersionId: string;
  warnAtPercent: number[];
  effectiveFrom: Date;
}

/**
 * In-memory stand-in for the two Prisma delegates `overridePolicyTargets`
 * touches. Honors the `where`/`orderBy` shapes it actually passes, so a
 * query that stopped scoping by `organizationId` would find the other
 * tenant's policy here too.
 */
function fakePrisma(policies: PolicyRow[], versions: VersionRow[]) {
  const created: VersionRow[] = [];
  const prisma = {
    sLAPolicy: {
      findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
        policies.find((p) => p.id === where.id && p.organizationId === where.organizationId) ?? null,
    },
    sLAPolicyVersion: {
      findFirst: async ({ where, orderBy }: { where: { policyId: string }; orderBy: { version: "desc" } }) => {
        expect(orderBy).toEqual({ version: "desc" });
        const rows = versions.filter((v) => v.policyId === where.policyId).sort((a, b) => b.version - a.version);
        return rows[0] ?? null;
      },
      create: async ({ data }: { data: Omit<VersionRow, "id"> }) => {
        const row = { id: `ver_${versions.length + created.length + 1}`, ...data };
        created.push(row);
        return row;
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, created };
}

function version(overrides: Partial<VersionRow> & Pick<VersionRow, "id" | "version">): VersionRow {
  return {
    policyId: "pol_1",
    match: { priority: ["urgent"] },
    targets: [
      { kind: "first_response", minutes: 60 },
      { kind: "resolution", minutes: 480 },
    ],
    pauseOnStates: ["pending_customer"],
    calendarVersionId: "calv_1",
    warnAtPercent: [50, 80, 95],
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const policies: PolicyRow[] = [
  { id: "pol_1", organizationId: "org_a" },
  { id: "pol_other", organizationId: "org_b" },
];

describe("overridePolicyTargets", () => {
  it("appends a version with the new targets and carries everything else over from the latest version", async () => {
    const { prisma, created } = fakePrisma(policies, [
      version({ id: "ver_1", version: 1, calendarVersionId: "calv_old", warnAtPercent: [90] }),
      version({ id: "ver_2", version: 2 }),
    ]);

    const before = Date.now();
    const result = await overridePolicyTargets(prisma, "org_a", "pol_1", [
      { kind: "first_response", minutes: 30 },
      { kind: "resolution", minutes: 240 },
    ]);

    expect(result).toEqual({ created: true, version: { id: "ver_3", version: 3 } });
    expect(created).toHaveLength(1);
    const row = created[0]!;
    expect(row).toMatchObject({
      policyId: "pol_1",
      version: 3,
      match: { priority: ["urgent"] },
      targets: [
        { kind: "first_response", minutes: 30 },
        { kind: "resolution", minutes: 240 },
      ],
      pauseOnStates: ["pending_customer"],
      calendarVersionId: "calv_1",
      warnAtPercent: [50, 80, 95],
      source: "override",
    });
    expect(row.effectiveFrom.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("writes nothing and returns the current version when the targets are unchanged", async () => {
    const { prisma, created } = fakePrisma(policies, [version({ id: "ver_2", version: 2 })]);

    const result = await overridePolicyTargets(prisma, "org_a", "pol_1", [
      { kind: "first_response", minutes: 60 },
      { kind: "resolution", minutes: 480 },
    ]);

    expect(result).toEqual({ created: false, version: { id: "ver_2", version: 2 } });
    expect(created).toHaveLength(0);
  });

  it("treats the same targets in a different order as unchanged", async () => {
    const { prisma, created } = fakePrisma(policies, [version({ id: "ver_2", version: 2 })]);

    const result = await overridePolicyTargets(prisma, "org_a", "pol_1", [
      { kind: "resolution", minutes: 480 },
      { kind: "first_response", minutes: 60 },
    ]);

    expect(result.created).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("creates a version when a target kind is dropped, not just when minutes change", async () => {
    const { prisma, created } = fakePrisma(policies, [version({ id: "ver_2", version: 2 })]);

    const result = await overridePolicyTargets(prisma, "org_a", "pol_1", [{ kind: "resolution", minutes: 480 }]);

    expect(result.created).toBe(true);
    expect(created[0]!.targets).toEqual([{ kind: "resolution", minutes: 480 }]);
  });

  it("throws PolicyNotFoundError for another organization's policy and writes nothing", async () => {
    const { prisma, created } = fakePrisma(policies, [version({ id: "ver_x", version: 1, policyId: "pol_other" })]);

    await expect(
      overridePolicyTargets(prisma, "org_a", "pol_other", [{ kind: "resolution", minutes: 1 }]),
    ).rejects.toBeInstanceOf(PolicyNotFoundError);
    expect(created).toHaveLength(0);
  });

  it("throws PolicyNotFoundError for an unknown policy id", async () => {
    const { prisma } = fakePrisma(policies, []);

    await expect(
      overridePolicyTargets(prisma, "org_a", "pol_missing", [{ kind: "resolution", minutes: 1 }]),
    ).rejects.toThrow("SLA policy pol_missing not found");
  });

  it("throws PolicyNotFoundError when the policy exists but has no versions", async () => {
    const { prisma, created } = fakePrisma(policies, []);

    await expect(
      overridePolicyTargets(prisma, "org_a", "pol_1", [{ kind: "resolution", minutes: 1 }]),
    ).rejects.toBeInstanceOf(PolicyNotFoundError);
    expect(created).toHaveLength(0);
  });

  it("appends a version with a next_reply target alongside first_response and resolution", async () => {
    const { prisma, created } = fakePrisma(policies, [version({ id: "ver_2", version: 2 })]);

    const result = await overridePolicyTargets(prisma, "org_a", "pol_1", [
      { kind: "first_response", minutes: 60 },
      { kind: "resolution", minutes: 480 },
      { kind: "next_reply", minutes: 30 },
    ]);

    expect(result.created).toBe(true);
    expect(result.version.version).toBe(3);
    expect(created[0]!.targets).toEqual([
      { kind: "first_response", minutes: 60 },
      { kind: "resolution", minutes: 480 },
      { kind: "next_reply", minutes: 30 },
    ]);
  });
});
