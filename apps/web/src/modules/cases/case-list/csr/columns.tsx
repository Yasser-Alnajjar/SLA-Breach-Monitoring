import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";

import type { CaseListRow } from "@/lib/types/cases";

import {
  CorrelationCell,
  CurrentStateAssigneeCell,
  CustomerSubjectCell,
  LegAllocationCell,
  PriorityDualKeyCell,
  SlaTargetRunwayCell,
} from "./cells";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

const HEADER_CLASS =
  "[&_button]:h-auto [&_button]:text-inherit [&_button]:font-[inherit]";

export const useCaseListColumns = (): ColumnDef<CaseListRow>[] => [
  {
    id: "priorityDualKey",
    minSize: 170,
    accessorFn: (row) => row.externalId,
    header: ({ column }) => (
      <DataTableColumnHeader
        className={HEADER_CLASS}
        column={column}
        title="Priority & dual-key"
      />
    ),
    cell: ({ row }) => <PriorityDualKeyCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "subject",
    minSize: 200,
    maxSize: 205,
    accessorFn: (row) => row.subject ?? row.customerName ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader
        className={HEADER_CLASS}
        column={column}
        title="Customer & subject"
      />
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
      <DataTableColumnHeader
        className={HEADER_CLASS}
        column={column}
        title="Correlation"
      />
    ),
    cell: ({ row }) => <CorrelationCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },
  {
    id: "slaTargetRunway",
    minSize: 190,
    accessorFn: (row) =>
      row.liveCommitment?.remainingMinutes ?? row.worstCommitmentStatus ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader
        className={HEADER_CLASS}
        column={column}
        title="SLA target & runway"
      />
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
    accessorFn: (row) => row.assigneeName ?? "",
    header: ({ column }) => (
      <DataTableColumnHeader
        className={HEADER_CLASS}
        column={column}
        title="Current state & assignee"
      />
    ),
    cell: ({ row }) => <CurrentStateAssigneeCell row={row.original} />,
    enableSorting: true,
    enableColumnFilter: false,
  },

  {
    id: "action",
    minSize: 100,
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <Button variant="subtle" size="sm" asChild>
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
