"use client";

import * as React from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  buildTimeZoneOptions,
  matchesTimeZoneQuery,
  type TimeZoneOption,
} from "@/lib/timezones";
import { cn } from "@/lib/utils";

interface TimezoneComboboxProps {
  id?: string;
  /** Canonical IANA identifier, e.g. "Africa/Cairo". */
  value: string;
  onChange: (timeZone: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable single-select over every IANA time zone the runtime supports.
 * Displays the zone's current offset and localized name, but only ever emits
 * the canonical identifier — the same string the calendar API validates and
 * `packages/core`'s calendar engine hands to `Intl`.
 */
export function TimezoneCombobox({
  id,
  value,
  onChange,
  disabled = false,
  className,
}: TimezoneComboboxProps) {
  // Offsets are computed once per mount; the picker is short-lived (it
  // lives in a dialog), so a DST change mid-session is not worth tracking.
  // `value` is a dependency only so a stored value outside the runtime's list
  // is still offered as an option.
  const options = React.useMemo(() => buildTimeZoneOptions(new Date(), value), [value]);
  const selected = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <Combobox<TimeZoneOption>
      items={options}
      value={selected}
      onValueChange={(option) => {
        // Clearing isn't meaningful — a calendar always has a timezone.
        if (option) onChange(option.value);
      }}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(option, query) =>
        // With a selection, base-ui's input holds that option's label; treat
        // it as "no query" so reopening lists every zone, not just one.
        query === selected?.label || matchesTimeZoneQuery(option, query)
      }
      disabled={disabled}
      autoHighlight
    >
      <ComboboxInput
        id={id}
        className={cn("w-full", className)}
        placeholder="Search timezones…"
        disabled={disabled}
        aria-invalid={selected?.valid === false || undefined}
      />
      {/* Wider than the input: zone ids and localized names are long. */}
      <ComboboxContent className="w-80" align="end">
        <ComboboxEmpty>No matching timezone.</ComboboxEmpty>
        <ComboboxList>
          {(option: TimeZoneOption) => (
            <ComboboxItem key={option.value} value={option} className="pe-7">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{option.value}</span>
                <span className="truncate text-muted-foreground">
                  {option.longName}
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {option.offset}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
