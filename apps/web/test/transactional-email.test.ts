import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.fn();

vi.mock("@sla/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

const { loadTransactionalEmailConfig, sendTransactionalEmail, TransactionalEmailNotConfiguredError } = await import(
  "../src/lib/transactional-email"
);

const TRANSACTIONAL_VARS = [
  "TRANSACTIONAL_SMTP_HOST",
  "TRANSACTIONAL_SMTP_PORT",
  "TRANSACTIONAL_SMTP_SECURITY",
  "TRANSACTIONAL_SMTP_USER",
  "TRANSACTIONAL_SMTP_PASSWORD",
  "TRANSACTIONAL_SMTP_FROM",
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of TRANSACTIONAL_VARS) {
    ORIGINAL_ENV[name] = process.env[name];
    delete process.env[name];
  }
  sendEmailMock.mockReset();
});

afterEach(() => {
  for (const name of TRANSACTIONAL_VARS) {
    if (ORIGINAL_ENV[name] === undefined) delete process.env[name];
    else process.env[name] = ORIGINAL_ENV[name];
  }
});

function setConfiguredEnv() {
  process.env.TRANSACTIONAL_SMTP_HOST = "smtp.transactional.example.com";
  process.env.TRANSACTIONAL_SMTP_USER = "transactional-user";
  process.env.TRANSACTIONAL_SMTP_PASSWORD = "transactional-password";
  process.env.TRANSACTIONAL_SMTP_FROM = "no-reply@example.com";
}

describe("loadTransactionalEmailConfig", () => {
  it("throws TransactionalEmailNotConfiguredError naming every missing variable when nothing is set", () => {
    let caught: unknown;
    try {
      loadTransactionalEmailConfig();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TransactionalEmailNotConfiguredError);
    expect((caught as Error).message).toContain("TRANSACTIONAL_SMTP_HOST");
    expect((caught as Error).message).toContain("TRANSACTIONAL_SMTP_USER");
    expect((caught as Error).message).toContain("TRANSACTIONAL_SMTP_PASSWORD");
    expect((caught as Error).message).toContain("TRANSACTIONAL_SMTP_FROM");
  });

  it("throws naming only the specific variables that are missing", () => {
    setConfiguredEnv();
    delete process.env.TRANSACTIONAL_SMTP_PASSWORD;

    let caught: unknown;
    try {
      loadTransactionalEmailConfig();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TransactionalEmailNotConfiguredError);
    const message = (caught as Error).message;
    expect(message).toContain("TRANSACTIONAL_SMTP_PASSWORD");
    expect(message).not.toContain("TRANSACTIONAL_SMTP_HOST,");
    expect(message).not.toContain("TRANSACTIONAL_SMTP_USER,");
  });

  it("returns a valid EmailConfig with default port/security when only the required variables are set", () => {
    setConfiguredEnv();

    const config = loadTransactionalEmailConfig();

    expect(config).toEqual({
      host: "smtp.transactional.example.com",
      port: 587,
      security: "starttls",
      user: "transactional-user",
      password: "transactional-password",
      from: "no-reply@example.com",
    });
  });

  it("honors an explicit port and security when set", () => {
    setConfiguredEnv();
    process.env.TRANSACTIONAL_SMTP_PORT = "465";
    process.env.TRANSACTIONAL_SMTP_SECURITY = "ssl_tls";

    const config = loadTransactionalEmailConfig();

    expect(config.port).toBe(465);
    expect(config.security).toBe("ssl_tls");
  });
});

describe("sendTransactionalEmail", () => {
  it("loads the config and sends through the shared @sla/email transport", async () => {
    setConfiguredEnv();
    sendEmailMock.mockResolvedValue(undefined);

    await sendTransactionalEmail({
      to: ["invitee@example.com"],
      subject: "You've been invited",
      text: "Join the team.",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const [config, message] = sendEmailMock.mock.calls[0]!;
    expect(config).toEqual({
      host: "smtp.transactional.example.com",
      port: 587,
      security: "starttls",
      user: "transactional-user",
      password: "transactional-password",
      from: "no-reply@example.com",
    });
    expect(message).toEqual({
      to: ["invitee@example.com"],
      subject: "You've been invited",
      text: "Join the team.",
    });
  });

  it("throws TransactionalEmailNotConfiguredError and never calls sendEmail when unconfigured", async () => {
    await expect(
      sendTransactionalEmail({ to: ["invitee@example.com"], subject: "Hi", text: "Hi" }),
    ).rejects.toBeInstanceOf(TransactionalEmailNotConfiguredError);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("propagates a delivery failure from sendEmail rather than swallowing it", async () => {
    setConfiguredEnv();
    sendEmailMock.mockRejectedValue(new Error("connection refused"));

    await expect(
      sendTransactionalEmail({ to: ["invitee@example.com"], subject: "Hi", text: "Hi" }),
    ).rejects.toThrow("connection refused");
  });
});
