/** Formats a signed minute count as "1d 2h 3m", dropping leading zero units. */
export function formatMinutes(totalMinutes: number): string {
  const abs = Math.round(Math.abs(totalMinutes));
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const minutes = abs % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return (totalMinutes < 0 ? "-" : "") + parts.join(" ");
}

const LEG_LABELS: Record<string, string> = {
  support: "Support",
  engineering: "Engineering",
  waiting_customer: "Waiting on customer",
  unknown: "Unknown",
};

export function formatLeg(leg: string): string {
  return LEG_LABELS[leg] ?? leg;
}

const COMMITMENT_KIND_LABELS: Record<string, string> = {
  first_response: "First response",
  resolution: "Resolution",
};

export function formatCommitmentKind(kind: string): string {
  return COMMITMENT_KIND_LABELS[kind] ?? kind;
}
