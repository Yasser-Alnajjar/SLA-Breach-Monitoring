"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Actions } from "@/actions/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessCalendarOption } from "@/lib/types/sla-configuration";
import { CalendarEditorDialog } from "./CalendarEditorDialog";

function CalendarRow({
  calendar,
  isDefault,
  onSaved,
}: {
  calendar: BusinessCalendarOption;
  isDefault: boolean;
  onSaved: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  async function handleSetDefault() {
    setSettingDefault(true);
    const { ok } = await Actions.SlaConfiguration.setDefaultCalendar(isDefault ? null : calendar.id);
    setSettingDefault(false);
    if (ok) onSaved();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 pb-3 last:border-0 last:pb-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{calendar.name}</p>
            <Badge variant={calendar.source === "imported" ? "outline" : "secondary"}>
              {calendar.source === "imported" ? "Imported" : "Native"}
            </Badge>
            {isDefault && <Badge variant="success">Org default</Badge>}
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">
            {calendar.alwaysOpen ? "24/7" : `${calendar.timezone} · ${calendar.holidays.length} holiday(s)`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" variant="surface" onClick={handleSetDefault} disabled={settingDefault}>
            {settingDefault && <Loader2 className="animate-spin" />}
            {isDefault ? "Unset default" : "Set as default"}
          </Button>
          <Button type="button" size="sm" variant="surface" onClick={() => setDialogOpen(true)}>
            Edit
          </Button>
        </div>
      </div>

      <CalendarEditorDialog
        mode="edit"
        calendar={calendar}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          setDialogOpen(false);
          onSaved();
        }}
      />
    </>
  );
}

export function BusinessCalendarsCard({
  calendars,
  defaultCalendarId,
}: {
  calendars: BusinessCalendarOption[];
  defaultCalendarId: string | null;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant">
          Editing an imported calendar&apos;s hours locally is never overwritten by the next Zendesk sync.
        </p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          Create calendar
        </Button>
      </div>

      {calendars.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No business calendars yet.</p>
      ) : (
        <div className="space-y-3">
          {calendars.map((calendar) => (
            <CalendarRow
              key={calendar.id}
              calendar={calendar}
              isDefault={calendar.id === defaultCalendarId}
              onSaved={() => router.refresh()}
            />
          ))}
        </div>
      )}

      <CalendarEditorDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => {
          setCreateOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
