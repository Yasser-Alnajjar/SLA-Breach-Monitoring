import type { EmailSecurity, EmailSettingsStatus } from "@sla/db";

export type { EmailSecurity, EmailSettingsStatus };

export const EMAIL_SECURITY_OPTIONS: { value: EmailSecurity; label: string }[] = [
  { value: "none", label: "None" },
  { value: "starttls", label: "STARTTLS" },
  { value: "ssl_tls", label: "SSL/TLS" },
];
