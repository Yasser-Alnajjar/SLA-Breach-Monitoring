/** SMTP credentials for the org-independent, ops-configured email transport. */
export interface EmailConfig {
  host: string;
  port: number;
  /** True for an implicit-TLS port (typically 465); false negotiates STARTTLS on ports like 587. */
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
}
