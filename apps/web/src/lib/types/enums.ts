export enum IntegrationProvider {
  zendesk = "zendesk",
  jira = "jira",
  linear = "linear",
  intercom = "intercom",
  github = "github",
}

export enum IntegrationStatus {
  connected = "connected",
  disconnected = "disconnected",
  reauth_required = "reauth_required",
  permission_denied = "permission_denied",
}

export enum CaseLinkMethod {
  official_link = "official_link",
  remote_link = "remote_link",
  pattern = "pattern",
  manual = "manual",
}

export enum LinkConfidence {
  certain = "certain",
  probable = "probable",
}

export enum LegKind {
  support = "support",
  engineering = "engineering",
  waiting_customer = "waiting_customer",
  unknown = "unknown",
}

export enum LegConfidence {
  certain = "certain",
  inferred = "inferred",
  unknown = "unknown",
}

export enum CommitmentKind {
  first_response = "first_response",
  resolution = "resolution",
}

export enum CommitmentStatus {
  on_track = "on_track",
  at_risk = "at_risk",
  met = "met",
  breached = "breached",
  cancelled = "cancelled",
}
