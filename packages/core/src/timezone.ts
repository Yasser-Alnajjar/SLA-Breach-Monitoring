/** Whether `Intl` recognizes `timeZone` as a valid IANA time zone identifier (or legacy alias it still resolves). Shared by every layer that accepts a timezone string — the calendar API, the timezone picker, and the Zendesk business-hours importer's normalizer. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
