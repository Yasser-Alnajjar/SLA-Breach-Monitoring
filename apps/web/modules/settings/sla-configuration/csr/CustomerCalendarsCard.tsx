"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BusinessCalendarOption, CustomerCalendarSummary } from "@/lib/types/sla-configuration";

const DEFAULT_VALUE = "__default__";

function calendarLabel(calendar: BusinessCalendarOption): string {
  return calendar.alwaysOpen ? `${calendar.name} (24/7)` : `${calendar.name} — ${calendar.timezone}`;
}

function CustomerRow({ customer, calendars }: { customer: CustomerCalendarSummary; calendars: BusinessCalendarOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(customer.calendarId ?? DEFAULT_VALUE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = selected !== (customer.calendarId ?? DEFAULT_VALUE);

  async function handleSave() {
    setSaving(true);
    setError(null);

    const { ok, body } = await Actions.SlaConfiguration.setCustomerCalendar(
      customer.id,
      selected === DEFAULT_VALUE ? null : selected,
    );
    setSaving(false);

    if (!ok) {
      setError(body.error ?? "Failed to save calendar");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-2 border-b border-outline-variant/30 pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{customer.name}</p>
        {customer.tier && <Badge variant="outline">{customer.tier}</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_VALUE}>Default (from matched policy)</SelectItem>
            {calendars.map((calendar) => (
              <SelectItem key={calendar.id} value={calendar.id}>
                {calendarLabel(calendar)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dirty && (
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** Per-customer calendar override picker (roadmap step 24): assigns one of the org's existing `BusinessCalendar`s (an imported schedule, or the always-open default) to a customer, overriding whatever their matched SLA policy would otherwise resolve to. */
export function CustomerCalendarsCard({
  customers,
  calendars,
}: {
  customers: CustomerCalendarSummary[];
  calendars: BusinessCalendarOption[];
}) {
  if (customers.length === 0) {
    return <p className="text-sm text-on-surface-variant">No customers yet.</p>;
  }
  if (calendars.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        No business calendars available yet — import Zendesk business hours or SLA policies first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {customers.map((customer) => (
        <CustomerRow key={customer.id} customer={customer} calendars={calendars} />
      ))}
    </div>
  );
}
