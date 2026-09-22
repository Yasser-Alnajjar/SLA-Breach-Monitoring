import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeploymentSmtpNotConfiguredError, loadDeploymentSmtpConfig } from "../src/deployment-config";

const DEPLOYMENT_VARS = [
  "DEPLOYMENT_SMTP_HOST",
  "DEPLOYMENT_SMTP_PORT",
  "DEPLOYMENT_SMTP_SECURITY",
  "DEPLOYMENT_SMTP_USER",
  "DEPLOYMENT_SMTP_PASSWORD",
  "DEPLOYMENT_SMTP_FROM",
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of DEPLOYMENT_VARS) {
    ORIGINAL_ENV[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of DEPLOYMENT_VARS) {
    if (ORIGINAL_ENV[name] === undefined) delete process.env[name];
    else process.env[name] = ORIGINAL_ENV[name];
  }
});

function setConfiguredEnv() {
  process.env.DEPLOYMENT_SMTP_HOST = "smtp.deployment.example.com";
  process.env.DEPLOYMENT_SMTP_USER = "deployment-user";
  process.env.DEPLOYMENT_SMTP_PASSWORD = "deployment-password";
  process.env.DEPLOYMENT_SMTP_FROM = "no-reply@example.com";
}

describe("loadDeploymentSmtpConfig", () => {
  it("throws DeploymentSmtpNotConfiguredError naming every missing variable when nothing is set", () => {
    let caught: unknown;
    try {
      loadDeploymentSmtpConfig();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DeploymentSmtpNotConfiguredError);
    expect((caught as Error).message).toContain("DEPLOYMENT_SMTP_HOST");
    expect((caught as Error).message).toContain("DEPLOYMENT_SMTP_USER");
    expect((caught as Error).message).toContain("DEPLOYMENT_SMTP_PASSWORD");
    expect((caught as Error).message).toContain("DEPLOYMENT_SMTP_FROM");
  });

  it("throws naming only the specific variables that are missing", () => {
    setConfiguredEnv();
    delete process.env.DEPLOYMENT_SMTP_PASSWORD;

    let caught: unknown;
    try {
      loadDeploymentSmtpConfig();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DeploymentSmtpNotConfiguredError);
    const message = (caught as Error).message;
    expect(message).toContain("DEPLOYMENT_SMTP_PASSWORD");
    expect(message).not.toContain("DEPLOYMENT_SMTP_HOST,");
    expect(message).not.toContain("DEPLOYMENT_SMTP_USER,");
  });

  it("returns a valid EmailConfig with default port/security when only the required variables are set", () => {
    setConfiguredEnv();

    const config = loadDeploymentSmtpConfig();

    expect(config).toEqual({
      host: "smtp.deployment.example.com",
      port: 587,
      security: "starttls",
      user: "deployment-user",
      password: "deployment-password",
      from: "no-reply@example.com",
    });
  });

  it("honors an explicit port and security when set", () => {
    setConfiguredEnv();
    process.env.DEPLOYMENT_SMTP_PORT = "465";
    process.env.DEPLOYMENT_SMTP_SECURITY = "ssl_tls";

    const config = loadDeploymentSmtpConfig();

    expect(config.port).toBe(465);
    expect(config.security).toBe("ssl_tls");
  });
});
