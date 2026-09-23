"use client";

import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  CircleUser,
  Hourglass,
  Inbox,
  Sparkles,
  Timer,
  TriangleAlert,
  Unlink,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { CountdownClock } from "@/components/shared/countdown-clock";
import { DataTableColumnHeader } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatCommitmentKind,
  formatMinutes,
  formatPriorityTier,
} from "@/lib/format";
import type { CaseListRow } from "@/lib/types/cases";
import { cn } from "@/lib/utils";

const MS_ICONS: Record<string, LucideIcon> = {
  sync_alt: ArrowLeftRight,
  inbox: Inbox,
  verified: BadgeCheck,
  pattern: Sparkles,
  warning: TriangleAlert,
  task_alt: CircleCheck,
  timer: Timer,
  hourglass_bottom: Hourglass,
  account_circle: CircleUser,
  person_off: UserX,
};

/** Stitch's Material Symbol names, rendered with lucide (the font isn't loaded). */
function Ms({ name, className }: { name: string; className?: string }) {
  const Icon = MS_ICONS[name] ?? Timer;
  return <Icon aria-hidden className={cn("shrink-0", className)} />;
}

/** Column-header sort trigger inherits the Stitch label-caps typography. */
const HEADER_CLASS =
  "[&_button]:h-auto [&_button]:px-0 [&_button]:text-inherit [&_button]:font-[inherit] [&_button]:text-[length:inherit] [&_button]:tracking-[inherit] [&_button]:uppercase [&_button]:ml-0 [&_button]:whitespace-normal [&_button]:text-left";

const LINKED_SYSTEM_LABEL: Record<string, string> = {
  jira: "ENG",
  linear: "LIN",
  github: "GH",
};

const SEVERITY_TONE: Record<string, string> = {
  P1: "bg-error-container text-error",
  P2: "bg-error-container/80 text-error",
  P3: "bg-surface-container-highest text-on-surface-variant",
  P4: "bg-surface-subtle text-muted-foreground",
};

/** "Priority & Dual-Key" — severity chip over the Zendesk⇄Jira id pairing. */
function PriorityDualKeyCell({ row }: { row: CaseListRow }) {
  const severity = formatPriorityTier(row.priority);
  const link = row.primaryLink;

  return (
    <div className="flex items-center gap-space-xs whitespace-nowrap gap-2">
      {severity && (
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-label-caps text-label-caps font-semibold uppercase tracking-wider",
            SEVERITY_TONE[severity],
          )}
        >
          {severity}
        </span>
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-1 font-mono-metric-md text-mono-metric-md text-on-surface group-hover:text-primary">
          <span>#{row.externalId}</span>
          {link && (
            <>
              <Ms name={"sync_alt"} className="size-[13px] text-tertiary" />
              <span className="font-semibold text-primary">
                {LINKED_SYSTEM_LABEL[link.system] ?? link.system.toUpperCase()}-
                {link.externalId}
              </span>
            </>
          )}
        </div>
        <span className="font-code-audit text-[10px] text-outline">
          {link ? `synced · ${link.statusName ?? "linked"}` : "standalone"}
        </span>
      </div>
    </div>
  );
}

/** "Customer & Subject". */
function CustomerSubjectCell({ row }: { row: CaseListRow }) {
  return (
    <div className="flex max-w-[190px] min-w-0 flex-col">
      <div className="flex items-center gap-space-xs">
        <span className="font-headline-sm text-body-md font-semibold text-on-surface truncate">
          {row.customerName ?? "—"}
        </span>
        {row.tier && (
          <span className="shrink-0 rounded bg-surface-container-lowest px-1 font-code-audit text-[10px] text-primary">
            {row.tier}
          </span>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/cases/${row.caseId}`}
            className="mt-0.5 block min-w-0 truncate text-body-sm font-body-sm text-on-surface-variant hover:text-primary hover:underline"
          >
            {row.subject ?? `#${row.externalId}`}
          </Link>
        </TooltipTrigger>
        <TooltipContent>{row.subject ?? `#${row.externalId}`}</TooltipContent>
      </Tooltip>
      <div className="mt-1 flex items-center gap-2">
        <span className="flex items-center gap-1 font-label-caps text-[10px] text-outline">
          <Ms name={"inbox"} className="size-[11px] text-outline" />
          Zendesk #{row.externalId}
        </span>
      </div>
    </div>
  );
}

/** "Correlation" — link confidence + status caption, when known. */
function CorrelationCell({ row }: { row: CaseListRow }) {
  const link = row.primaryLink;

  if (!link) {
    return (
      <div className="whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5 rounded bg-surface-container-highest px-2 py-0.5 font-label-caps text-label-caps text-outline">
          <Unlink className="size-3" />
          <span>Unlinked</span>
        </div>
        <div className="mt-1 font-code-audit text-[10px] text-outline">
          Support-only
        </div>
      </div>
    );
  }

  const isCertain = link.confidence === "certain";

  return (
    <div>
      <div
        className={cn(
          "inline-flex max-w-[112px] items-center gap-1.5 rounded px-2 py-0.5 font-label-caps text-label-caps",
          isCertain
            ? "bg-tertiary-container/30 text-tertiary-fixed"
            : "bg-secondary-container/30 text-secondary",
        )}
      >
        <Ms name={isCertain ? "verified" : "pattern"} className="size-[13px]" />
        <span className="leading-tight">Linked — {isCertain ? "Certain" : link.confidence}</span>
      </div>
      {link.statusName && (
        <div className="mt-1 font-code-audit text-[10px] text-outline">
          {link.statusName}
        </div>
      )}
    </div>
  );
}

const SETTLED_TONE: Record<string, { text: string; bar: string; badge: string; label: string }> = {
  met: { text: "text-tertiary", bar: "bg-tertiary", badge: "bg-tertiary/20 text-tertiary font-bold", label: "MET" },
  breached: { text: "text-error", bar: "bg-error", badge: "bg-error-container text-error font-bold", label: "BREACHED" },
  at_risk: { text: "text-error", bar: "bg-error", badge: "bg-error-container text-error", label: "AT RISK" },
  on_track: { text: "text-primary", bar: "bg-primary", badge: "bg-primary-container/20 text-primary", label: "ON TRACK" },
  cancelled: { text: "text-outline", bar: "bg-outline", badge: "bg-surface-container-highest text-outline", label: "CANCELLED" },
};

/** Final outcome for a case with no live clock: elapsed vs. target with a progress bar. */
function SettledRunway({
  settled,
}: {
  settled: NonNullable<CaseListRow["settledCommitment"]>;
}) {
  const tone = SETTLED_TONE[settled.status] ?? SETTLED_TONE.on_track!;
  const targetSeconds = settled.targetMinutes * 60;
  const percent = targetSeconds > 0 ? (settled.elapsedSeconds / targetSeconds) * 100 : 0;
  const overBy = settled.elapsedSeconds - targetSeconds;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-code-audit text-code-audit text-on-surface-variant">
          {formatCommitmentKind(settled.kind)} ({formatMinutes(settled.targetMinutes)} Max)
        </span>
        <span className={cn("rounded px-1.5 py-0.5 font-label-caps text-label-caps", tone.badge)}>
          {tone.label}
        </span>
      </div>
      <div className={cn("flex items-center gap-1.5 font-mono-metric-md text-mono-metric-md font-semibold", tone.text)}>
        <Ms name={settled.status === "breached" ? "warning" : "task_alt"} className="size-[14px]" />
        <span>
          {settled.status === "breached" && overBy > 0
            ? `+${formatMinutes(Math.ceil(overBy / 60))} over`
            : `${formatMinutes(Math.max(0, Math.round(settled.elapsedSeconds / 60)))} used`}
        </span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-lowest">
        <div
          className={cn("h-full rounded-full", tone.bar)}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * "SLA Target & Runway" — live for a case with an open commitment,
 * otherwise the persisted worst-of badge.
 */
function SlaTargetRunwayCell({ row }: { row: CaseListRow }) {
  const live = row.liveCommitment;
  const settled = row.settledCommitment;

  if (!live && settled) return <SettledRunway settled={settled} />;

  if (!live) {
    return row.worstCommitmentStatus ? (
      <StatusBadge status={row.worstCommitmentStatus} />
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  const percentExpended =
    live.targetMinutes > 0
      ? Math.min(100, (live.elapsedSeconds / 60 / live.targetMinutes) * 100)
      : 0;

  const statusTone =
    live.status === "breached"
      ? "text-error"
      : live.status === "at_risk"
        ? "text-error"
        : live.status === "on_track"
          ? "text-primary"
          : "text-tertiary";

  const barTone =
    live.status === "breached"
      ? "bg-error"
      : live.status === "at_risk"
        ? "bg-error"
        : live.status === "on_track"
          ? "bg-primary"
          : "bg-tertiary";

  const statusLabel =
    live.status === "breached"
      ? "BREACHED"
      : live.status === "at_risk"
        ? "AT RISK"
        : live.status === "on_track"
          ? "ON TRACK"
          : "MET";

  const badgeTone =
    live.status === "breached"
      ? "bg-error-container text-error font-bold"
      : live.status === "at_risk"
        ? "bg-error-container text-error"
        : live.status === "on_track"
          ? "bg-primary-container/20 text-primary"
          : "bg-tertiary/20 text-tertiary font-bold";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-code-audit text-code-audit text-on-surface-variant">
          {formatCommitmentKind(live.kind)} ({formatMinutes(live.targetMinutes)}{" "}
          Max)
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-label-caps text-label-caps",
            badgeTone,
            live.status === "at_risk" && "animate-pulse",
          )}
        >
          {statusLabel}
        </span>
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 font-mono-metric-md text-mono-metric-md font-semibold",
          statusTone,
        )}
      >
        <Ms name={live.status === "breached"
            ? "warning"
            : live.status === "met"
              ? "task_alt"
              : "timer"} className="size-[14px]" />
        <CountdownClock
          remainingMinutes={live.remainingMinutes}
          className="font-mono"
        />
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-lowest">
        <div
          className={cn("h-full rounded-full", barTone)}
          style={{ width: `${percentExpended}%` }}
        />
      </div>
    </div>
  );
}

/** "Leg Allocation (Supp↔Eng)" — a compact two-segment mini bar. */
function LegAllocationCell({ row }: { row: CaseListRow }) {
  const live = row.liveCommitment;
  const snap = live ?? row.settledCommitment;

  if (!snap) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const total = snap.supportLegMinutes + snap.engineeringLegMinutes;
  const supportShare = total > 0 ? (snap.supportLegMinutes / total) * 100 : 0;
  const engineeringShare =
    total > 0 ? (snap.engineeringLegMinutes / total) * 100 : 0;

  return (
    <div className="flex w-[165px] flex-col gap-1">
      <div className="flex items-center justify-between font-code-audit text-[11px] text-on-surface-variant">
        <span
          className={cn(
            supportShare > engineeringShare && "text-error font-medium",
          )}
        >
          Supp: {formatMinutes(snap.supportLegMinutes)}
        </span>
        <span
          className={cn(
            engineeringShare > supportShare && "text-error font-medium",
          )}
        >
          Eng: {formatMinutes(snap.engineeringLegMinutes)}
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded bg-surface-container-lowest">
        <div
          className={cn(
            "h-full",
            supportShare > engineeringShare ? "bg-error" : "bg-primary/70",
          )}
          style={{ width: `${supportShare}%` }}
          title={`Support leg: ${formatMinutes(snap.supportLegMinutes)}`}
        />
        <div
          className={cn(
            "h-full",
            engineeringShare > supportShare ? "bg-error" : "bg-primary",
          )}
          style={{ width: `${engineeringShare}%` }}
          title={`Engineering leg: ${formatMinutes(snap.engineeringLegMinutes)}`}
        />
      </div>
      <div className="flex items-center gap-1 font-mono-metric-md text-[11px]">
        {!live ? (
          <span className="text-outline">
            Settled · {engineeringShare > supportShare ? "mostly Eng" : "mostly Support"}
          </span>
        ) : live.status === "breached" ? (
          <>
            <Ms name={"hourglass_bottom"} className="size-[13px] text-error" />
            <span className="text-error">Clock Halted / Latent</span>
          </>
        ) : (
          <>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                engineeringShare > supportShare
                  ? "bg-error animate-ping"
                  : "bg-primary animate-pulse",
              )}
            />
            <span
              className={cn(
                engineeringShare > supportShare ? "text-error" : "text-primary",
              )}
            >
              Active in{" "}
              {engineeringShare > supportShare ? "Eng Jira" : "Support Tier"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** "Current State & Assignee". */
function CurrentStateAssigneeCell({ row }: { row: CaseListRow }) {
  const closed = Boolean(row.closedAt);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "rounded bg-surface-container-lowest px-1.5 py-0.5 font-code-audit text-[11px]",
            closed ? "text-outline" : "text-on-surface",
          )}
        >
          ZD: {closed ? "Closed" : "Open"}
        </span>
        {row.primaryLink?.statusName && (
          <span
            className={cn(
              "rounded bg-surface-container-lowest px-1.5 py-0.5 font-code-audit text-[11px]",
              row.primaryLink.statusName.toLowerCase().includes("resolved")
                ? "text-tertiary"
                : "text-primary",
            )}
          >
            ENG: {row.primaryLink.statusName}
          </span>
        )}
      </div>
      <span className="mt-0.5 flex items-center gap-1 text-body-sm text-on-surface-variant">
        <Ms name={row.assigneeName ? "account_circle" : "person_off"} className="size-[14px] text-outline" />
        {row.assigneeName ? (
          <span className="max-w-[110px] truncate">{row.assigneeName}</span>
        ) : (
          <span className="italic text-error">Unassigned</span>
        )}
      </span>
    </div>
  );
}

export const useCaseListColumns = (): ColumnDef<CaseListRow>[] => [
  {
    id: "priorityDualKey",
    minSize: 170,
    maxSize: 200,
    accessorFn: (row) => row.externalId,
    header: ({ column }) => (
      <DataTableColumnHeader className={HEADER_CLASS} column={column} title="Priority & dual-key" />
    ),
    cell: ({ row }) => <PriorityDualKeyCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "customerSubject",
    minSize: 200,
    maxSize: 205,
    accessorFn: (row) => row.customerName ?? row.subject ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader className={HEADER_CLASS} column={column} title="Customer & subject" />
    ),
    cell: ({ row }) => <CustomerSubjectCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "correlation",
    minSize: 120,
    maxSize: 140,
    accessorFn: (row) =>
      row.primaryLink ? row.primaryLink.confidence : "unlinked",
    header: ({ column }) => (
      <DataTableColumnHeader className={HEADER_CLASS} column={column} title="Correlation" />
    ),
    cell: ({ row }) => <CorrelationCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "slaTargetRunway",
    minSize: 190,
    maxSize: 230,
    accessorFn: (row) =>
      row.liveCommitment?.remainingMinutes ?? row.worstCommitmentStatus ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader className={HEADER_CLASS} column={column} title="SLA target & runway" />
    ),
    cell: ({ row }) => <SlaTargetRunwayCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "legAllocation",
    minSize: 180,
    maxSize: 220,
    accessorFn: (row) =>
      row.liveCommitment
        ? row.liveCommitment.engineeringLegMinutes /
          Math.max(
            1,
            row.liveCommitment.supportLegMinutes +
              row.liveCommitment.engineeringLegMinutes,
          )
        : -1,
    header: ({ column }) => (
      <DataTableColumnHeader
        className={HEADER_CLASS}
        column={column}
        title="Leg allocation (supp↔eng)"
      />
    ),
    cell: ({ row }) => <LegAllocationCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "currentStateAssignee",
    minSize: 140,
    maxSize: 170,
    accessorFn: (row) => row.assigneeName ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader className={HEADER_CLASS} column={column} title="Current state & assignee" />
    ),
    cell: ({ row }) => <CurrentStateAssigneeCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "action",
    minSize: 100,
    maxSize: 110,
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 gap-1 rounded bg-surface-container-high px-2.5 py-1.5 font-label-caps text-label-caps text-on-surface transition-all hover:bg-primary hover:text-on-primary"
        >
          <Link href={`/cases/${row.original.caseId}`}>
            <span>View Case</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    ),
    enableSorting: false,
    enableColumnFilter: false,
  },
];
