import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient, EmailSettingsCredentials } from "@sla/db";
import type { NotificationCandidate } from "@sla/commitments";
import { postMessage } from "@sla/slack";
import { sendEmail } from "@sla/email";
import { getEmailSettings, EmailSettingsUnreadableError } from "@sla/db";
import { runNotificationPipeline } from "../src/dispatch";

vi.mock("@sla/slack", () => ({ postMessage: vi.fn() }));
vi.mock("@sla/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@sla/db", () => ({
  getEmailSettings: vi.fn(),
  EmailSettingsUnreadableError: class EmailSettingsUnreadableError extends Error {},
}));

const postMessageMock = vi.mocked(postMessage);
const sendEmailMock = vi.mocked(sendEmail);
const getEmailSettingsMock = vi.mocked(getEmailSettings);

const emailSettings: EmailSettingsCredentials = {
  host: "smtp.example.com",
  port: 587,
  security: "starttls",
  username: "sla",
  password: "secret",
  fromEmail: "sla@example.com",
  fromName: null,
};

/** The `@sla/email` `EmailConfig` shape `dispatch.ts` builds from `emailSettings` above. */
const expectedEmailConfig = {
  host: "smtp.example.com",
  port: 587,
  security: "starttls",
  user: "sla",
  password: "secret",
  from: "sla@example.com",
  fromName: null,
};

function candidate(overrides: Partial<NotificationCandidate> = {}): NotificationCandidate {
  return {
    commitmentId: "cmt_1",
    caseId: "case_1",
    kind: "resolution",
    status: "at_risk",
    threshold: 80,
    remainingMinutes: 45,
    ...overrides,
  };
}

interface FakePrismaOptions {
  slack?: { channelId: string | null; accessToken: string } | null;
  users?: { email: string }[];
  existingNotifications?: { commitmentId: string; threshold: number }[];
  cases?: { id: string; externalId: string; subject?: string | null; customer: { name: string } | null }[];
  createImpl?: () => Promise<unknown>;
}

function fakePrisma(options: FakePrismaOptions = {}) {
  const {
    slack = null,
    users = [],
    existingNotifications = [],
    cases = [{ id: "case_1", externalId: "4821", subject: null, customer: { name: "Acme Co." } }],
    createImpl,
  } = options;

  return {
    slackIntegration: { findUnique: vi.fn().mockResolvedValue(slack) },
    user: { findMany: vi.fn().mockResolvedValue(users) },
    notification: {
      findMany: vi.fn().mockResolvedValue(existingNotifications),
      create: vi.fn(createImpl ?? (() => Promise.resolve({}))),
    },
    case: { findMany: vi.fn().mockResolvedValue(cases) },
  } as unknown as PrismaClient;
}

beforeEach(() => {
  postMessageMock.mockReset().mockResolvedValue(undefined);
  sendEmailMock.mockReset().mockResolvedValue(undefined);
  getEmailSettingsMock.mockReset().mockResolvedValue(null);
});

describe("runNotificationPipeline", () => {
  it("does nothing for an empty candidate list", async () => {
    const prisma = fakePrisma();
    const result = await runNotificationPipeline(prisma, "org_1", []);
    expect(result).toEqual({ notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: [] });
    expect(prisma.slackIntegration.findUnique).not.toHaveBeenCalled();
  });

  it("skips every candidate when neither Slack nor email is configured", async () => {
    const prisma = fakePrisma({ slack: null });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate(), candidate({ commitmentId: "cmt_2" })]);
    expect(result.notificationsSkipped).toBe(2);
    expect(result.notificationsSent).toBe(0);
    expect(postMessageMock).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("treats a Slack integration without a channelId as not ready", async () => {
    const prisma = fakePrisma({ slack: { channelId: null, accessToken: "xoxb-1" } });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);
    expect(result.notificationsSkipped).toBe(1);
    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it("sends via Slack only when email is not configured", async () => {
    const prisma = fakePrisma({ slack: { channelId: "C123", accessToken: "xoxb-1" } });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(postMessageMock).toHaveBeenCalledWith("xoxb-1", "C123", expect.stringContaining("#4821"));
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(result.notificationsSent).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { commitmentId: "cmt_1", threshold: 80, channel: "slack" },
    });
  });

  it("skips email when a row exists but the organization has no recipients", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    const prisma = fakePrisma({ slack: { channelId: "C123", accessToken: "xoxb-1" }, users: [] });
    await runNotificationPipeline(prisma, "org_1", [candidate()]);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("skips email when the settings row is present but undecryptable, without crashing", async () => {
    getEmailSettingsMock.mockRejectedValue(new EmailSettingsUnreadableError(new Error("bad key")));
    const prisma = fakePrisma({ slack: null, users: [{ email: "a@example.com" }] });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(result.notificationsSkipped).toBe(1);
  });

  it("propagates an unexpected error from loading email settings instead of swallowing it", async () => {
    getEmailSettingsMock.mockRejectedValue(new Error("database connection lost"));
    const prisma = fakePrisma({ slack: { channelId: "C123", accessToken: "xoxb-1" } });
    await expect(runNotificationPipeline(prisma, "org_1", [candidate()])).rejects.toThrow("database connection lost");
  });

  it("sends via both channels, using the organization's SMTP configuration, and records a combined channel string", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      users: [{ email: "a@example.com" }, { email: "b@example.com" }],
    });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(getEmailSettingsMock).toHaveBeenCalledWith(prisma, "org_1");
    expect(postMessageMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expectedEmailConfig,
      expect.objectContaining({
        to: ["a@example.com", "b@example.com"],
        subject: expect.stringContaining("#4821"),
        html: expect.stringContaining("#4821"),
      }),
    );
    expect(result.notificationsSent).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { commitmentId: "cmt_1", threshold: 80, channel: "slack,email" },
    });
  });

  it("includes the ticket's subject in the HTML email when the case has one", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    const prisma = fakePrisma({
      slack: null,
      users: [{ email: "a@example.com" }],
      cases: [{ id: "case_1", externalId: "4821", subject: "Payment webhook failing", customer: { name: "Acme Co." } }],
    });
    await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expectedEmailConfig,
      expect.objectContaining({ html: expect.stringContaining("Payment webhook failing") }),
    );
  });

  it("links the HTML email to the ticket when an appUrl is configured", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    const prisma = fakePrisma({
      slack: null,
      users: [{ email: "a@example.com" }],
      cases: [{ id: "case_1", externalId: "4821", customer: { name: "Acme Co." } }],
    });
    await runNotificationPipeline(prisma, "org_1", [candidate()], { appUrl: "https://app.example.com" });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expectedEmailConfig,
      expect.objectContaining({ html: expect.stringContaining("https://app.example.com/cases/case_1") }),
    );
  });

  it("omits the ticket link when no appUrl is configured", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    const prisma = fakePrisma({ slack: null, users: [{ email: "a@example.com" }] });
    await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expectedEmailConfig,
      expect.objectContaining({ html: expect.not.stringContaining("View ticket") }),
    );
  });

  it("keeps Slack delivery independent of email failing", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    sendEmailMock.mockRejectedValueOnce(new Error("connection refused"));
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      users: [{ email: "a@example.com" }],
    });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    expect(result.notificationsSent).toBe(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { commitmentId: "cmt_1", threshold: 80, channel: "slack" },
    });
  });

  it("skips a candidate already recorded for that (commitmentId, threshold) — dedup unchanged", async () => {
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      existingNotifications: [{ commitmentId: "cmt_1", threshold: 80 }],
    });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(result.notificationsSkipped).toBe(1);
    expect(result.notificationsSent).toBe(0);
    expect(postMessageMock).not.toHaveBeenCalled();
    expect(prisma.case.findMany).not.toHaveBeenCalled();
  });

  it("only re-attempts the candidates not already recorded", async () => {
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      existingNotifications: [{ commitmentId: "cmt_1", threshold: 80 }],
      cases: [{ id: "case_1", externalId: "4821", customer: { name: "Acme Co." } }],
    });
    const result = await runNotificationPipeline(prisma, "org_1", [
      candidate(),
      candidate({ commitmentId: "cmt_2", threshold: 95 }),
    ]);

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    expect(result.notificationsSkipped).toBe(1);
    expect(result.notificationsSent).toBe(1);
  });

  it("still counts the candidate as sent when only one of two channels delivers", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    postMessageMock.mockRejectedValueOnce(new Error("channel_not_found"));
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      users: [{ email: "a@example.com" }],
    });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(result.notificationsSent).toBe(1);
    expect(result.notificationsFailed).toEqual([]);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { commitmentId: "cmt_1", threshold: 80, channel: "email" },
    });
  });

  it("records a failure with a combined error message when every channel fails", async () => {
    getEmailSettingsMock.mockResolvedValue(emailSettings);
    postMessageMock.mockRejectedValueOnce(new Error("channel_not_found"));
    sendEmailMock.mockRejectedValueOnce(new Error("connection refused"));
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      users: [{ email: "a@example.com" }],
    });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(result.notificationsSent).toBe(0);
    expect(result.notificationsFailed).toEqual([
      { commitmentId: "cmt_1", threshold: 80, error: "slack: channel_not_found; email: connection refused" },
    ]);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("treats a unique-constraint race on create as skipped rather than failed", async () => {
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      createImpl: () => Promise.reject(Object.assign(new Error("duplicate"), { code: "P2002" })),
    });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(result.notificationsSent).toBe(0);
    expect(result.notificationsSkipped).toBe(1);
    expect(result.notificationsFailed).toEqual([]);
  });

  it("propagates a create error that is not a unique-constraint violation", async () => {
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      createImpl: () => Promise.reject(new Error("connection lost")),
    });
    await expect(runNotificationPipeline(prisma, "org_1", [candidate()])).rejects.toThrow("connection lost");
  });

  it("silently drops a candidate whose case has since been deleted", async () => {
    const prisma = fakePrisma({ slack: { channelId: "C123", accessToken: "xoxb-1" }, cases: [] });
    const result = await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(postMessageMock).not.toHaveBeenCalled();
    expect(result.notificationsSent).toBe(0);
    expect(result.notificationsFailed).toEqual([]);
  });

  it("omits the customer clause when the case has none", async () => {
    const prisma = fakePrisma({
      slack: { channelId: "C123", accessToken: "xoxb-1" },
      cases: [{ id: "case_1", externalId: "4821", customer: null }],
    });
    await runNotificationPipeline(prisma, "org_1", [candidate()]);

    expect(postMessageMock).toHaveBeenCalledWith("xoxb-1", "C123", expect.not.stringContaining("for "));
  });
});
