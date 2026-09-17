"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { caseCommitmentHref } from "@/lib/case-links";
import { formatCommitmentKind, formatLeg, formatMinutes } from "@/lib/format";
import { AtRiskRow } from "@/lib/types/dashboard";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export const useAtRiskColumns = (): ColumnDef<AtRiskRow>[] => [
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => row.original.customerName ?? "—",
  },
  {
    accessorKey: "subject",
    header: "Case",
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
  },
  {
    accessorKey: "externalId",
    header: "Ticket",
    cell: ({ row }) => (
      <Link
        href={row.original.externalId}
        className="text-muted-foreground hover:underline"
      >
        {`#${row.original.externalId}`}
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
