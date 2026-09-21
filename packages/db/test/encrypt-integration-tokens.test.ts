import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "../generated/prisma/client";
import { decryptCredentials, decryptToken, isEncryptedToken } from "../src/integration-credentials";
import { encryptIntegrationTokens } from "../src/scripts/encrypt-integration-tokens";

const ORIGINAL_ENCRYPTION_KEY = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "test-integration-token-secret";
});

afterEach(() => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
});

/**
 * Minimal in-memory stand-in for the two models this script touches —
 * `integration` and `slackIntegration` — a fake injected at the same seam
 * `encryptIntegrationTokens` already takes `prisma` through.
 */
function createFakePrisma(
  integrationRows: { id: string; credentials: unknown }[],
  slackRows: { id: string; accessToken: string }[],
) {
  const integrations = new Map(integrationRows.map((row) => [row.id, { ...row }]));
  const slackIntegrations = new Map(slackRows.map((row) => [row.id, { ...row }]));

  return {
    prisma: {
      integration: {
        async findMany() {
          return [...integrations.values()].map((row) => ({ id: row.id, credentials: row.credentials }));
        },
        async update({ where, data }: { where: { id: string }; data: { credentials: unknown } }) {
          const existing = integrations.get(where.id);
          if (!existing) throw new Error("Record to update not found.");
          const next = { ...existing, credentials: data.credentials };
          integrations.set(where.id, next);
          return next;
        },
      },
      slackIntegration: {
        async findMany() {
          return [...slackIntegrations.values()].map((row) => ({ id: row.id, accessToken: row.accessToken }));
        },
        async update({ where, data }: { where: { id: string }; data: { accessToken: string } }) {
          const existing = slackIntegrations.get(where.id);
          if (!existing) throw new Error("Record to update not found.");
          const next = { ...existing, accessToken: data.accessToken };
          slackIntegrations.set(where.id, next);
          return next;
        },
      },
    } as unknown as PrismaClient,
    integrations,
    slackIntegrations,
  };
}

describe("encryptIntegrationTokens", () => {
  it("encrypts every plaintext Integration and SlackIntegration row", async () => {
    const { prisma, integrations, slackIntegrations } = createFakePrisma(
      [
        {
          id: "int-1",
          credentials: { subdomain: "acme", accessToken: "access-1", refreshToken: "refresh-1", tokenType: "bearer", scope: "read" },
        },
        {
          id: "int-2",
          credentials: { accessToken: "access-2", tokenType: "Bearer" },
        },
      ],
      [{ id: "slack-1", accessToken: "slack-access-1" }],
    );

    const result = await encryptIntegrationTokens(prisma);

    expect(result).toEqual({ integrationsEncrypted: 2, slackIntegrationsEncrypted: 1 });

    const row1 = integrations.get("int-1")!.credentials as { accessToken: string; refreshToken: string };
    expect(isEncryptedToken(row1.accessToken)).toBe(true);
    expect(isEncryptedToken(row1.refreshToken)).toBe(true);
    expect(decryptCredentials(row1)).toEqual({
      subdomain: "acme",
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tokenType: "bearer",
      scope: "read",
    });

    const row2 = integrations.get("int-2")!.credentials as { accessToken: string };
    expect(isEncryptedToken(row2.accessToken)).toBe(true);
    expect(decryptToken(row2.accessToken)).toBe("access-2");

    const slackRow = slackIntegrations.get("slack-1")!;
    expect(isEncryptedToken(slackRow.accessToken)).toBe(true);
    expect(decryptToken(slackRow.accessToken)).toBe("slack-access-1");
  });

  it("skips rows whose tokens are already encrypted", async () => {
    const { prisma, integrations, slackIntegrations } = createFakePrisma(
      [{ id: "int-1", credentials: { accessToken: "access-1", tokenType: "bearer" } }],
      [{ id: "slack-1", accessToken: "slack-access-1" }],
    );

    const first = await encryptIntegrationTokens(prisma);
    expect(first).toEqual({ integrationsEncrypted: 1, slackIntegrationsEncrypted: 1 });

    const afterFirstRun = {
      integration: integrations.get("int-1")!.credentials,
      slack: slackIntegrations.get("slack-1")!.accessToken,
    };

    const second = await encryptIntegrationTokens(prisma);
    expect(second).toEqual({ integrationsEncrypted: 0, slackIntegrationsEncrypted: 0 });

    // A second run makes zero writes — the exact same ciphertext survives,
    // not merely equivalent plaintext (re-encrypting would produce a
    // different ciphertext, since AES-GCM uses a random IV).
    expect(integrations.get("int-1")!.credentials).toEqual(afterFirstRun.integration);
    expect(slackIntegrations.get("slack-1")!.accessToken).toBe(afterFirstRun.slack);
  });

  it("leaves a row with no credentials (never connected) untouched", async () => {
    const { prisma, integrations } = createFakePrisma([{ id: "int-1", credentials: null }], []);

    const result = await encryptIntegrationTokens(prisma);

    expect(result.integrationsEncrypted).toBe(0);
    expect(integrations.get("int-1")!.credentials).toBeNull();
  });

  it("encrypts only accessToken when refreshToken is absent (e.g. Intercom/Linear/some GitHub tokens)", async () => {
    const { prisma, integrations } = createFakePrisma(
      [{ id: "int-1", credentials: { accessToken: "access-1", tokenType: "Bearer" } }],
      [],
    );

    await encryptIntegrationTokens(prisma);

    const row = integrations.get("int-1")!.credentials as { accessToken: string; refreshToken?: string };
    expect(isEncryptedToken(row.accessToken)).toBe(true);
    expect(row.refreshToken).toBeUndefined();
  });
});
