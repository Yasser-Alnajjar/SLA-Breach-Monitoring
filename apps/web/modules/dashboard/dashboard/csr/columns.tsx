"use client";

import { DataTableColumnHeader } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { caseCommitmentHref } from "@/lib/case-links";
import { formatCommitmentKind, formatLeg, formatMinutes } from "@/lib/format";
import { AtRiskRow } from "@/lib/types/dashboard";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export const useAtRiskColumns = (): ColumnDef<AtRiskRow>[] => [
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => row.original.customerName ?? "—",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "requesterName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Requester" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.requesterName ?? "—"}
      </span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "subject",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Case" />
    ),
    cell: ({ row }) => (
      <Link
        href={caseCommitmentHref(
          row.original.caseId,
          row.original.commitmentId,
        )}
        className="text-primary hover:underline text-nowrap truncate min-w-0 max-w-75 block"
        title={row.original.subject ?? `#${row.original.externalId}`}
      >
        {row.original.subject ?? `#${row.original.externalId}`}
      </Link>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "externalId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ticket" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">#{row.original.externalId}</span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "kind",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Commitment" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatCommitmentKind(row.original.kind)}
      </span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "remainingMinutes",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Remaining" />
    ),
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
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "currentLeg",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Leg" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatLeg(row.original.currentLeg)}
      </span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "minutesInCurrentLeg",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Time in leg" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatMinutes(row.original.minutesInCurrentLeg)}
      </span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
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
      <Link
        href={caseCommitmentHref(
          row.original.caseId,
          row.original.commitmentId,
        )}
        className="text-primary hover:underline"
      >
        #{row.original.externalId}
      </Link>
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
