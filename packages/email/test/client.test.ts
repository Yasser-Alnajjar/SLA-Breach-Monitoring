import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailConfig } from "../src/types";

const verifyMock = vi.fn();
const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ verify: verifyMock, sendMail: sendMailMock }));

vi.mock("nodemailer", () => ({
  default: { createTransport: (...args: unknown[]) => createTransportMock(...args) },
}));

const { sendEmail, verifyEmailConfig } = await import("../src/client");

const baseConfig: EmailConfig = {
  host: "smtp.example.com",
  port: 587,
  security: "starttls",
  user: "sla@example.com",
  password: "hunter2",
  from: "sla@example.com",
  fromName: null,
};

beforeEach(() => {
  createTransportMock.mockClear();
  verifyMock.mockReset().mockResolvedValue(true);
  sendMailMock.mockReset().mockResolvedValue({ messageId: "1" });
});

describe("createTransporter security mapping (via verifyEmailConfig/sendEmail)", () => {
  it("maps starttls to secure:false without ignoring TLS", async () => {
    await verifyEmailConfig(baseConfig);
    const options = createTransportMock.mock.calls[0][0] as Record<string, unknown>;
    expect(options.secure).toBe(false);
    expect(options.ignoreTLS).toBeUndefined();
    expect(options.port).toBe(587);
  });

  it("maps ssl_tls to secure:true", async () => {
    await verifyEmailConfig({ ...baseConfig, port: 465, security: "ssl_tls" });
    const options = createTransportMock.mock.calls[0][0] as Record<string, unknown>;
    expect(options.secure).toBe(true);
    expect(options.port).toBe(465);
  });

  it("maps none to secure:false and ignoreTLS:true", async () => {
    await verifyEmailConfig({ ...baseConfig, security: "none" });
    const options = createTransportMock.mock.calls[0][0] as Record<string, unknown>;
    expect(options.secure).toBe(false);
    expect(options.ignoreTLS).toBe(true);
  });

  it("never infers security from the port", async () => {
    // Port 465 with STARTTLS is unusual but must not be silently upgraded to implicit TLS.
    await verifyEmailConfig({ ...baseConfig, port: 465, security: "starttls" });
    const options = createTransportMock.mock.calls[0][0] as Record<string, unknown>;
    expect(options.secure).toBe(false);
  });

  it("sets connection/greeting/socket timeouts so a dead host fails fast", async () => {
    await verifyEmailConfig(baseConfig);
    const options = createTransportMock.mock.calls[0][0] as Record<string, unknown>;
    expect(options.connectionTimeout).toBeGreaterThan(0);
    expect(options.greetingTimeout).toBeGreaterThan(0);
    expect(options.socketTimeout).toBeGreaterThan(0);
  });

  it("passes the username/password as SMTP auth", async () => {
    await verifyEmailConfig(baseConfig);
    const options = createTransportMock.mock.calls[0][0] as { auth: { user: string; pass: string } };
    expect(options.auth).toEqual({ user: "sla@example.com", pass: "hunter2" });
  });
});

describe("verifyEmailConfig", () => {
  it("resolves when the transporter authenticates successfully", async () => {
    await expect(verifyEmailConfig(baseConfig)).resolves.toBeUndefined();
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("propagates an authentication failure", async () => {
    verifyMock.mockRejectedValueOnce(new Error("Invalid login: 535 authentication failed"));
    await expect(verifyEmailConfig(baseConfig)).rejects.toThrow("Invalid login");
  });

  it("propagates a connection failure", async () => {
    verifyMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:587"));
    await expect(verifyEmailConfig(baseConfig)).rejects.toThrow("ECONNREFUSED");
  });
});

describe("sendEmail", () => {
  it("sends with the from address when no fromName is set", async () => {
    await sendEmail(baseConfig, { to: ["a@example.com"], subject: "Subject", text: "Body" });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "sla@example.com",
      to: ["a@example.com"],
      subject: "Subject",
      text: "Body",
    });
  });

  it("formats a quoted display name into the From header when fromName is set", async () => {
    await sendEmail({ ...baseConfig, fromName: "SLA Alerts" }, { to: ["a@example.com"], subject: "S", text: "B" });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"SLA Alerts" <sla@example.com>' }),
    );
  });

  it("includes the html body when the message has one", async () => {
    await sendEmail(baseConfig, { to: ["a@example.com"], subject: "S", text: "B", html: "<p>B</p>" });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: "B", html: "<p>B</p>" }),
    );
  });

  it("omits the html field entirely when the message has no html body", async () => {
    await sendEmail(baseConfig, { to: ["a@example.com"], subject: "S", text: "B" });
    expect(sendMailMock.mock.calls[0][0]).not.toHaveProperty("html");
  });

  it("propagates a send failure without swallowing it", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("Message rejected: spam"));
    await expect(sendEmail(baseConfig, { to: ["a@example.com"], subject: "S", text: "B" })).rejects.toThrow(
      "Message rejected",
    );
  });
});
