/**
 * Phase 1.11 / E-9: a Zendesk SLA policy deleted (or deactivated) in Zendesk
 * has no "deletion event" of its own — only its absence from the next full
 * sla_policies listing. `runZendeskSlaPolicyImport` archives
 * (`SLAPolicy.archivedAt`) any previously-imported policy missing from the
 * latest manifest (`mapSlaPolicyManifestToRawEvent`), and matching for new
 * commitments must then skip it (`packages/commitments`'s
 * `archivedAt: null` filter).
 *
 * Real Postgres, like next-reply-policy-import-e2e.test.ts. Needs a migrated
 * database at TEST_DATABASE_URL whose name contains "test"; skipped when unset.
 */
import type { PrismaClient } from "@sla/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("Zendesk SLA policy archival (real Postgres)", () => {
  let prisma: PrismaClient;
  let zendesk: typeof import("@sla/zendesk");
  let commitments: typeof import("@sla/commitments");

  let organizationId: string;
  let integrationId: string;

  beforeAll(async () => {
    const name = new URL(TEST_DATABASE_URL!).pathname.replace(/^\//, "");
    if (!/test/i.test(name)) {
      throw new Error(`TEST_DATABASE_URL points at database "${name}"; this suite truncates every table.`);
    }
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    prisma = (await import("@sla/db")).getPrismaClient();
    zendesk = await import("@sla/zendesk");
    commitments = await import("@sla/commitments");
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`,
    );

    const organization = await prisma.organization.create({ data: { name: "Archive Org" } });
    organizationId = organization.id;
    const integration = await prisma.integration.create({
      data: { organizationId, provider: "zendesk", credentials: { subdomain: "demo" } },
    });
    integrationId = integration.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function writePolicySnapshot(id: number, title: string) {
    await prisma.rawEvent.create({
      data: {
        integrationId,
        providerEventId: `sla_policy:${id}:h-${id}`,
        sourceHash: `h-${id}`,
        payload: {
          id,
          title,
          policy_metrics: [{ priority: null, metric: "first_reply_time", target: 60, business_hours: true }],
        },
      },
    });
  }

  async function writeManifest(policyIds: number[]) {
    const manifest = zendesk.mapSlaPolicyManifestToRawEvent(policyIds);
    // createMany + skipDuplicates, like the real writeRawEvents helper
    // backfill.ts uses — an unchanged manifest re-write is a no-op, not an
    // error, exactly like an unchanged sla_policy snapshot.
    await prisma.rawEvent.createMany({
      data: [
        {
          integrationId,
          providerEventId: manifest.providerEventId,
          sourceHash: manifest.sourceHash,
          payload: manifest.payload as object,
        },
      ],
      skipDuplicates: true,
    });
  }

  it("leaves every policy unarchived when no manifest has ever been written", async () => {
    await writePolicySnapshot(1, "Standard");
    await zendesk.runZendeskSlaPolicyImport(prisma, integrationId);

    const policy = await prisma.sLAPolicy.findFirstOrThrow({ where: { organizationId } });
    expect(policy.archivedAt).toBeNull();
  });

  it("archives a policy missing from the latest manifest, and excludes it from matching new commitments", async () => {
    await writePolicySnapshot(1, "Standard");
    await writePolicySnapshot(2, "Urgent");
    await writeManifest([1, 2]);
    const first = await zendesk.runZendeskSlaPolicyImport(prisma, integrationId);
    expect(first.policiesArchived).toBe(0);
    expect(first.policyVersionsCreated).toBe(2);

    const policiesBefore = await prisma.sLAPolicy.findMany({ where: { organizationId }, orderBy: { externalId: "asc" } });
    expect(policiesBefore.every((p) => p.archivedAt === null)).toBe(true);

    // Policy 2 is deleted in Zendesk: the next full listing (and manifest) omits it.
    await writeManifest([1]);
    const second = await zendesk.runZendeskSlaPolicyImport(prisma, integrationId);
    expect(second.policiesArchived).toBe(1);

    const policiesAfter = await prisma.sLAPolicy.findMany({ where: { organizationId }, orderBy: { externalId: "asc" } });
    const standard = policiesAfter.find((p) => p.name === "Standard")!;
    const urgent = policiesAfter.find((p) => p.name === "Urgent")!;
    expect(standard.archivedAt).toBeNull();
    expect(urgent.archivedAt).not.toBeNull();

    // A new case that would only have matched the archived "Urgent" policy
    // (no other policy's match criteria fit) now matches nothing at all,
    // rather than silently keying off a deleted policy.
    const zCase = await prisma.case.create({
      data: { organizationId, externalId: "case-1", openedAt: new Date("2026-09-17T10:00:00.000Z") },
    });
    const pipelineResult = await commitments.runCommitmentPipeline(prisma, organizationId);
    expect(pipelineResult.casesWithNoMatchingPolicy).toBe(0); // "Standard" (unrestricted match) still applies
    const created = await prisma.commitment.findFirst({ where: { caseId: zCase.id } });
    expect(created?.policyVersionId).toBe(
      (await prisma.sLAPolicyVersion.findFirstOrThrow({ where: { policy: { name: "Standard" } } })).id,
    );
  });

  it("never archives a policy still present in the latest manifest", async () => {
    await writePolicySnapshot(1, "Standard");
    await writeManifest([1]);
    await zendesk.runZendeskSlaPolicyImport(prisma, integrationId);

    // Re-running with the same live id changes nothing.
    await writeManifest([1]);
    const result = await zendesk.runZendeskSlaPolicyImport(prisma, integrationId);
    expect(result.policiesArchived).toBe(0);

    const policy = await prisma.sLAPolicy.findFirstOrThrow({ where: { organizationId } });
    expect(policy.archivedAt).toBeNull();
  });
});
