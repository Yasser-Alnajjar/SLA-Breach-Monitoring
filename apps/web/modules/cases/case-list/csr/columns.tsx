"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { CaseListRow } from "@/lib/types/cases";
import type { ColumnDef } from "@tanstack/react-table";

export const useCaseListColumns = (): ColumnDef<CaseListRow>[] => [
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
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.priority ?? "—"}</span>
    ),
  },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.tier ?? "—"}</span>
    ),
  },
  {
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.channel ?? "—"}</span>
    ),
  },
  {
    accessorKey: "worstCommitmentStatus",
    header: "SLA status",
    cell: ({ row }) =>
      row.original.worstCommitmentStatus ? (
        <StatusBadge status={row.original.worstCommitmentStatus} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "openClosed",
    accessorFn: (row) => (row.closedAt ? "closed" : "open"),
    header: "Case status",
    cell: ({ row }) => (
      <Badge variant={row.original.closedAt ? "outline" : "default"}>
        {row.original.closedAt ? "Closed" : "Open"}
      </Badge>
    ),
  },
  {
    accessorKey: "openedAt",
    header: "Opened",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDateTime(row.original.openedAt)}</span>
    ),
    sortingFn: "datetime",
  },
  {
    accessorKey: "closedAt",
    header: "Closed",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.closedAt ? formatDateTime(row.original.closedAt) : "—"}
      </span>
    ),
    sortingFn: "datetime",
  },
];
