"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { formatCommitmentKind, formatLeg, formatMinutes } from "@/lib/format";
import { AtRiskRow } from "@/lib/types/dashboard";
import type { ColumnDef } from "@tanstack/react-table";

export const useAtRiskColumns = (): ColumnDef<AtRiskRow>[] => [
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.customerName ?? "—"}</span>
    ),
  },
  {
    accessorKey: "externalId",
    header: "Ticket",
    cell: ({ row }) => (
      <a
        href={`/cases/${row.original.caseId}`}
        className="text-primary hover:underline"
      >
        #{row.original.externalId}
      </a>
    ),
  },
  {
    accessorKey: "kind",
    header: "Commitment",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatCommitmentKind(row.original.kind)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "remainingMinutes",
    header: "Remaining",
    cell: ({ row }) => {
      const minutes = row.original.remainingMinutes;
      const overdue = minutes < 0;

      return (
        <span className={overdue ? "font-medium text-destructive" : undefined}>
          {overdue
            ? `${formatMinutes(-minutes)} overdue`
            : formatMinutes(minutes)}
        </span>
      );
    },
    sortingFn: "basic",
  },
  {
    accessorKey: "currentLeg",
    header: "Leg",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatLeg(row.original.currentLeg)}
      </span>
    ),
  },
  {
    accessorKey: "minutesInCurrentLeg",
    header: "Time in leg",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatMinutes(row.original.minutesInCurrentLeg)}
      </span>
    ),
  },
];

export const useOtherCasesColumns = (): ColumnDef<AtRiskRow>[] => [
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.customerName ?? "—"}</span>
    ),
  },
  {
    accessorKey: "externalId",
    header: "Ticket",
    cell: ({ row }) => (
      <a
        href={`/cases/${row.original.caseId}`}
        className="text-primary hover:underline"
      >
        #{row.original.externalId}
      </a>
    ),
  },
  {
    accessorKey: "kind",
    header: "Commitment",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatCommitmentKind(row.original.kind)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "currentLeg",
    header: "Leg",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatLeg(row.original.currentLeg)}
      </span>
    ),
  },
  {
    accessorKey: "minutesInCurrentLeg",
    header: "Time in leg",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatMinutes(row.original.minutesInCurrentLeg)}
      </span>
    ),
  },
];
