import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailConfig } from "@sla/email";

const sendEmailMock = vi.fn();
const loadDeploymentSmtpConfigMock = vi.fn();

class FakeDeploymentSmtpNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Deployment SMTP is not configured: missing ${missing.join(", ")}`);
    this.name = "DeploymentSmtpNotConfiguredError";
  }
}

vi.mock("@sla/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  loadDeploymentSmtpConfig: () => loadDeploymentSmtpConfigMock(),
  DeploymentSmtpNotConfiguredError: FakeDeploymentSmtpNotConfiguredError,
}));

const { sendTransactionalEmail } = await import("../src/lib/transactional-email");

const CONFIGURED: EmailConfig = {
  host: "smtp.deployment.example.com",
  port: 587,
  security: "starttls",
  user: "deployment-user",
  password: "deployment-password",
  from: "no-reply@example.com",
};

beforeEach(() => {
  sendEmailMock.mockReset();
  loadDeploymentSmtpConfigMock.mockReset();
});

describe("sendTransactionalEmail", () => {
  it("loads the deployment SMTP config and sends through the shared @sla/email transport", async () => {
    loadDeploymentSmtpConfigMock.mockReturnValue(CONFIGURED);
    sendEmailMock.mockResolvedValue(undefined);

    await sendTransactionalEmail({
      to: ["invitee@example.com"],
      subject: "You've been invited",
      text: "Join the team.",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(CONFIGURED, {
      to: ["invitee@example.com"],
      subject: "You've been invited",
      text: "Join the team.",
    });
  });

  it("propagates a not-configured error and never calls sendEmail", async () => {
    loadDeploymentSmtpConfigMock.mockImplementation(() => {
      throw new FakeDeploymentSmtpNotConfiguredError(["DEPLOYMENT_SMTP_HOST"]);
    });

    await expect(
      sendTransactionalEmail({ to: ["invitee@example.com"], subject: "Hi", text: "Hi" }),
    ).rejects.toBeInstanceOf(FakeDeploymentSmtpNotConfiguredError);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("propagates a delivery failure from sendEmail rather than swallowing it", async () => {
    loadDeploymentSmtpConfigMock.mockReturnValue(CONFIGURED);
    sendEmailMock.mockRejectedValue(new Error("connection refused"));

    await expect(
      sendTransactionalEmail({ to: ["invitee@example.com"], subject: "Hi", text: "Hi" }),
    ).rejects.toThrow("connection refused");
  });
});
