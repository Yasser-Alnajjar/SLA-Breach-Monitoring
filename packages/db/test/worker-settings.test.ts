import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "../generated/prisma/client";
import {
  ACTIVE_POLL_SAFETY_DIVISOR,
  deriveWorkerStatus,
  getMinimumConfiguredSlaTargetMinutes,
  getOrCreateWorkerSettings,
  MAX_ACTIVE_POLL_INTERVAL_MS,
  MAX_RECONCILIATION_INTERVAL_MS,
  MIN_ACTIVE_POLL_INTERVAL_MS,
  MIN_RECONCILIATION_INTERVAL_MS,
  recordWorkerCycleOutcome,
  recordWorkerNextRun,
  saveWorkerSettings,
  validateWorkerSettingsInput,
  WorkerSettingsValidationError,
  type WorkerSettingsRecord,
} from "../src/worker-settings";

const ORIGINAL_ACTIVE_ENV = process.env.WORKER_ACTIVE_POLL_MS;
const ORIGINAL_RECONCILIATION_ENV = process.env.WORKER_RECONCILIATION_MS;

beforeEach(() => {
  delete process.env.WORKER_ACTIVE_POLL_MS;
  delete process.env.WORKER_RECONCILIATION_MS;
});

afterEach(() => {
  process.env.WORKER_ACTIVE_POLL_MS = ORIGINAL_ACTIVE_ENV;
  process.env.WORKER_RECONCILIATION_MS = ORIGINAL_RECONCILIATION_ENV;
});

/**
 * Minimal in-memory stand-in for `PrismaClient`, scoped to exactly the
 * `workerSettings`/`sLAPolicyVersion` operations this module's functions
 * call. Both `upsert` branches here always send a complete `create`/`update`
 * payload (no optional-field trickiness like `email-settings.ts`'s
 * password), so a real `upsert` and this fake behave identically.
 */
function createFakePrisma(slaVersions: { policyId: string; version: number; targets: unknown }[] = []) {
  let row: WorkerSettingsRecord | null = null;
  // Real Postgres returns `null` (not `undefined`) for a nullable column a
  // `create` didn't mention — mirror that so this fake behaves like the
  // real thing for the fields `recordWorkerCycleOutcome` leaves unset.
  const nullableDefaults = {
    lastHeartbeatAt: null,
    lastActivePollAt: null,
    lastActivePollFailures: null,
    lastReconciliationAt: null,
    lastReconciliationFailures: null,
    nextActivePollAt: null,
    nextReconciliationAt: null,
  };

  const workerSettings = {
    async upsert({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) {
      row = row === null ? ({ ...nullableDefaults, ...create } as unknown as WorkerSettingsRecord) : { ...row, ...update };
      return row;
    },
  };

  const sLAPolicyVersion = {
    async findMany() {
      return [...slaVersions].sort((a, b) => a.version - b.version);
    },
  };

  return { workerSettings, sLAPolicyVersion } as unknown as PrismaClient;
}

describe("validateWorkerSettingsInput", () => {
  it("accepts a value within bounds with no SLA policies configured", () => {
    expect(validateWorkerSettingsInput({ activePollIntervalMs: 60_000, reconciliationIntervalMs: 3_600_000 }, null)).toBeNull();
  });

  it("rejects an active interval below the minimum", () => {
    const error = validateWorkerSettingsInput(
      { activePollIntervalMs: MIN_ACTIVE_POLL_INTERVAL_MS - 1, reconciliationIntervalMs: MIN_RECONCILIATION_INTERVAL_MS },
      null,
    );
    expect(error).toMatch(/Active monitoring interval/);
  });

  it("rejects an active interval above the maximum", () => {
    const error = validateWorkerSettingsInput(
      { activePollIntervalMs: MAX_ACTIVE_POLL_INTERVAL_MS + 1, reconciliationIntervalMs: MAX_RECONCILIATION_INTERVAL_MS },
      null,
    );
    expect(error).toMatch(/Active monitoring interval/);
  });

  it("rejects a reconciliation interval outside its bounds", () => {
    expect(
      validateWorkerSettingsInput({ activePollIntervalMs: 60_000, reconciliationIntervalMs: MIN_RECONCILIATION_INTERVAL_MS - 1 }, null),
    ).toMatch(/Reconciliation interval/);
    expect(
      validateWorkerSettingsInput({ activePollIntervalMs: 60_000, reconciliationIntervalMs: MAX_RECONCILIATION_INTERVAL_MS + 1 }, null),
    ).toMatch(/Reconciliation interval/);
  });

  it("rejects reconciliation shorter than the active interval, even when both are within their own bounds", () => {
    const error = validateWorkerSettingsInput({ activePollIntervalMs: 600_000, reconciliationIntervalMs: 300_000 }, null);
    expect(error).toMatch(/must not be shorter/);
  });

  it("rejects a non-integer interval", () => {
    expect(validateWorkerSettingsInput({ activePollIntervalMs: 1000.5, reconciliationIntervalMs: 3_600_000 }, null)).not.toBeNull();
  });

  it("rejects an active interval too long for the shortest configured SLA target", () => {
    // A 15-minute target divided by the safety divisor caps the active poll well below 15 minutes.
    const minTargetMinutes = 15;
    const maxSafeMs = Math.floor((minTargetMinutes * 60_000) / ACTIVE_POLL_SAFETY_DIVISOR);

    expect(validateWorkerSettingsInput({ activePollIntervalMs: maxSafeMs, reconciliationIntervalMs: 3_600_000 }, minTargetMinutes)).toBeNull();
    expect(
      validateWorkerSettingsInput({ activePollIntervalMs: maxSafeMs + 1_000, reconciliationIntervalMs: 3_600_000 }, minTargetMinutes),
    ).toMatch(/too long for the shortest configured SLA target/);
  });
});

describe("deriveWorkerStatus", () => {
  const base: WorkerSettingsRecord = {
    activePollIntervalMs: 60_000,
    reconciliationIntervalMs: 3_600_000,
    lastHeartbeatAt: null,
    lastActivePollAt: null,
    lastActivePollFailures: null,
    lastReconciliationAt: null,
    lastReconciliationFailures: null,
    nextActivePollAt: null,
    nextReconciliationAt: null,
  };

  it("is stopped when there is no heartbeat yet", () => {
    expect(deriveWorkerStatus(base)).toBe("stopped");
  });

  it("is stopped when the heartbeat is older than the staleness threshold", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    const settings = { ...base, lastHeartbeatAt: new Date("2026-01-01T00:00:00Z") }; // 10 min ago, interval is 1 min
    expect(deriveWorkerStatus(settings, now)).toBe("stopped");
  });

  it("is running when the heartbeat is fresh and the last cycles had no failures", () => {
    const now = new Date("2026-01-01T00:00:30Z");
    const settings = {
      ...base,
      lastHeartbeatAt: new Date("2026-01-01T00:00:00Z"),
      lastActivePollFailures: 0,
      lastReconciliationFailures: 0,
    };
    expect(deriveWorkerStatus(settings, now)).toBe("running");
  });

  it("is degraded when the heartbeat is fresh but the last active poll had failures", () => {
    const now = new Date("2026-01-01T00:00:30Z");
    const settings = { ...base, lastHeartbeatAt: new Date("2026-01-01T00:00:00Z"), lastActivePollFailures: 2 };
    expect(deriveWorkerStatus(settings, now)).toBe("degraded");
  });
});

describe("getMinimumConfiguredSlaTargetMinutes", () => {
  it("returns null when no organization has any SLA policy version", async () => {
    const prisma = createFakePrisma([]);
    expect(await getMinimumConfiguredSlaTargetMinutes(prisma)).toBeNull();
  });

  it("uses only the latest version per policy, across all policies", async () => {
    const prisma = createFakePrisma([
      { policyId: "p1", version: 1, targets: [{ kind: "first_response", minutes: 15 }] },
      // p1's latest version raised its target to 30 — the stale v1 target of 15 must not win.
      { policyId: "p1", version: 2, targets: [{ kind: "first_response", minutes: 30 }] },
      { policyId: "p2", version: 1, targets: [{ kind: "resolution", minutes: 480 }] },
    ]);
    expect(await getMinimumConfiguredSlaTargetMinutes(prisma)).toBe(30);
  });

  it("ignores malformed targets instead of throwing", async () => {
    const prisma = createFakePrisma([{ policyId: "p1", version: 1, targets: "not-an-array" }]);
    expect(await getMinimumConfiguredSlaTargetMinutes(prisma)).toBeNull();
  });
});

describe("getOrCreateWorkerSettings", () => {
  it("seeds the row from WORKER_ACTIVE_POLL_MS/WORKER_RECONCILIATION_MS on first call", async () => {
    process.env.WORKER_ACTIVE_POLL_MS = "5000";
    process.env.WORKER_RECONCILIATION_MS = "3600000";
    const prisma = createFakePrisma();

    const settings = await getOrCreateWorkerSettings(prisma);
    expect(settings.activePollIntervalMs).toBe(5000);
    expect(settings.reconciliationIntervalMs).toBe(3_600_000);
  });

  it("falls back to hardcoded defaults when the env vars are unset or invalid", async () => {
    process.env.WORKER_ACTIVE_POLL_MS = "not-a-number";
    const prisma = createFakePrisma();

    const settings = await getOrCreateWorkerSettings(prisma);
    expect(settings.activePollIntervalMs).toBe(5 * 60_000);
    expect(settings.reconciliationIntervalMs).toBe(60 * 60_000);
  });
});

describe("saveWorkerSettings", () => {
  it("persists a valid pair of intervals", async () => {
    const prisma = createFakePrisma();
    const settings = await saveWorkerSettings(prisma, { activePollIntervalMs: 30_000, reconciliationIntervalMs: 600_000 });
    expect(settings.activePollIntervalMs).toBe(30_000);
    expect(settings.reconciliationIntervalMs).toBe(600_000);
  });

  it("throws WorkerSettingsValidationError instead of persisting an invalid pair", async () => {
    const prisma = createFakePrisma();
    await expect(saveWorkerSettings(prisma, { activePollIntervalMs: 1, reconciliationIntervalMs: 600_000 })).rejects.toThrow(
      WorkerSettingsValidationError,
    );
  });

  it("rejects an active interval unsafe for the platform's shortest configured SLA target", async () => {
    const prisma = createFakePrisma([{ policyId: "p1", version: 1, targets: [{ kind: "first_response", minutes: 10 }] }]);
    // 10 minutes / 4 = 150,000ms max safe — 5 minutes is well above that.
    await expect(saveWorkerSettings(prisma, { activePollIntervalMs: 300_000, reconciliationIntervalMs: 3_600_000 })).rejects.toThrow(
      /too long for the shortest configured SLA target/,
    );
  });
});

describe("recordWorkerCycleOutcome", () => {
  it("advances the heartbeat and the per-kind run timestamp on a completed cycle", async () => {
    const prisma = createFakePrisma();
    await getOrCreateWorkerSettings(prisma);

    await recordWorkerCycleOutcome(prisma, "active_set_poll", 0);
    const settings = await getOrCreateWorkerSettings(prisma);

    expect(settings.lastHeartbeatAt).not.toBeNull();
    expect(settings.lastActivePollAt).not.toBeNull();
    expect(settings.lastActivePollFailures).toBe(0);
    expect(settings.lastReconciliationAt).toBeNull();
  });

  it("advances only the heartbeat when the cycle threw (failureCount null)", async () => {
    const prisma = createFakePrisma();
    await getOrCreateWorkerSettings(prisma);

    await recordWorkerCycleOutcome(prisma, "reconciliation_sweep", null);
    const settings = await getOrCreateWorkerSettings(prisma);

    expect(settings.lastHeartbeatAt).not.toBeNull();
    expect(settings.lastReconciliationAt).toBeNull();
    expect(settings.lastReconciliationFailures).toBeNull();
  });
});

describe("recordWorkerNextRun", () => {
  it("persists the given time under the matching kind's field, leaving the other kind untouched", async () => {
    const prisma = createFakePrisma();
    const nextActive = new Date("2026-01-01T00:05:00Z");

    await recordWorkerNextRun(prisma, "active_set_poll", nextActive);
    const settings = await getOrCreateWorkerSettings(prisma);

    expect(settings.nextActivePollAt).toEqual(nextActive);
    expect(settings.nextReconciliationAt).toBeNull();
  });

  it("overwrites a previously recorded next-run time for the same kind", async () => {
    const prisma = createFakePrisma();

    await recordWorkerNextRun(prisma, "reconciliation_sweep", new Date("2026-01-01T01:00:00Z"));
    const updated = new Date("2026-01-01T02:00:00Z");
    await recordWorkerNextRun(prisma, "reconciliation_sweep", updated);

    const settings = await getOrCreateWorkerSettings(prisma);
    expect(settings.nextReconciliationAt).toEqual(updated);
  });
});
