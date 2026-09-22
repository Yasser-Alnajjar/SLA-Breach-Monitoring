import { isValidTimeZone } from "./calendar-validation";

/**
 * Legacy CLDR identifiers that V8/ICU's `Intl.supportedValuesOf("timeZone")`
 * still returns in place of the current IANA name (e.g. Node 22 lists
 * `Asia/Calcutta`, not `Asia/Kolkata`). Both spellings are valid IANA
 * identifiers and `Intl` accepts either, so this is purely about offering the
 * name people search for. Applied only when the runtime accepts the modern
 * name, so an older ICU never gets an identifier it can't resolve.
 */
const MODERN_NAMES: Record<string, string> = {
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Coral_Harbour": "America/Atikokan",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
};

export interface TimeZoneOption {
  /** Canonical IANA identifier — the only thing ever persisted. */
  value: string;
  /** Shown in the input once selected, e.g. "Africa/Cairo (GMT+03:00)". */
  label: string;
  /** Offset in effect at the reference instant, e.g. "GMT+03:00". */
  offset: string;
  offsetMinutes: number;
  /** Localized zone name, e.g. "Eastern European Summer Time" — search/display only. */
  longName: string;
  /** False for a stored value the runtime can't resolve (kept so an edit never silently swaps it). */
  valid: boolean;
}

/**
 * Every IANA time zone the runtime supports, plus `UTC` (which
 * `Intl.supportedValuesOf` omits in V8), with legacy CLDR spellings mapped to
 * their current IANA names. Sorted, deduplicated.
 */
export function supportedTimeZones(): string[] {
  const raw =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const zones = new Set<string>(["UTC"]);
  for (const zone of raw) {
    const modern = MODERN_NAMES[zone];
    zones.add(modern && isValidTimeZone(modern) ? modern : zone);
  }
  return [...zones].sort();
}

function zoneNamePart(
  timeZone: string,
  style: "longOffset" | "long",
  at: Date,
): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: style })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

/** "GMT+05:30" -> 330; "GMT" (zero offset) -> 0. */
function parseOffsetMinutes(offset: string): number {
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

export function timeZoneOption(timeZone: string, at: Date): TimeZoneOption {
  if (!isValidTimeZone(timeZone)) {
    return {
      value: timeZone,
      label: timeZone,
      offset: "",
      offsetMinutes: 0,
      longName: "Not a recognized IANA time zone",
      valid: false,
    };
  }
  // `longOffset` renders a zero offset as bare "GMT"; normalize so every row
  // lines up as GMT±HH:MM.
  const rawOffset = zoneNamePart(timeZone, "longOffset", at);
  const offset = rawOffset === "GMT" ? "GMT+00:00" : rawOffset;
  return {
    value: timeZone,
    label: `${timeZone} (${offset})`,
    offset,
    offsetMinutes: parseOffsetMinutes(offset),
    longName: zoneNamePart(timeZone, "long", at),
    valid: true,
  };
}

/**
 * Options for the timezone picker, ordered by the offset in effect at `at`
 * (then by name), with `UTC` first. `current` is included even when the
 * runtime's list doesn't contain it — an already-stored alias or an
 * unrecognized value stays visible rather than being silently replaced.
 */
export function buildTimeZoneOptions(
  at: Date = new Date(),
  current?: string,
): TimeZoneOption[] {
  const zones = supportedTimeZones();
  if (current && !zones.includes(current)) zones.push(current);

  return zones
    .map((zone) => timeZoneOption(zone, at))
    .sort((a, b) => {
      if (a.value === "UTC") return -1;
      if (b.value === "UTC") return 1;
      return a.offsetMinutes - b.offsetMinutes || a.value.localeCompare(b.value);
    });
}

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[_/]/g, " ");
}

/**
 * Case-insensitive match on the IANA id (underscores/slashes read as spaces,
 * so "new york" finds America/New_York), the localized name ("eastern"), or
 * the offset ("+05:30", "gmt-4").
 */
export function matchesTimeZoneQuery(
  option: TimeZoneOption,
  query: string,
): boolean {
  const q = normalizeForSearch(query.trim());
  if (!q) return true;
  const haystack = normalizeForSearch(
    `${option.value} ${option.longName} ${option.offset} ${option.offset.replace(/:00$/, "").replace(/([+-])0/, "$1")}`,
  );
  return q.split(/\s+/).every((term) => haystack.includes(term));
}
