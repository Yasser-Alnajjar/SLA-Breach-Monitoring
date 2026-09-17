"use client";

import { DataTableColumnHeader } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { CaseListRow } from "@/lib/types/cases";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export const useCaseListColumns = (): ColumnDef<CaseListRow>[] => [
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Customer" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.original.customerName ?? "—"}</span>
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
        href={`/cases/${row.original.caseId}`}
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
    accessorKey: "priority",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Priority" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.priority ?? "—"}
      </span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "tier",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tier" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.tier ?? "—"}</span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "channel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Channel" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.channel ?? "—"}
      </span>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "worstCommitmentStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="SLA status" />
    ),
    cell: ({ row }) =>
      row.original.worstCommitmentStatus ? (
        <StatusBadge status={row.original.worstCommitmentStatus} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    id: "openClosed",
    accessorFn: (row) => (row.closedAt ? "closed" : "open"),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Case status" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.closedAt ? "outline" : "default"}>
        {row.original.closedAt ? "Closed" : "Open"}
      </Badge>
    ),
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "openedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Opened" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateTime(row.original.openedAt)}
      </span>
    ),
    sortingFn: "datetime",
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "closedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Closed" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.closedAt ? formatDateTime(row.original.closedAt) : "—"}
      </span>
    ),
    sortingFn: "datetime",
    enableSorting: true,
    enableColumnFilter: true,
  },
];
