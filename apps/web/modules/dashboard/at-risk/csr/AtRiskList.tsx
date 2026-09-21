"use client";

import React from "react";

import { Download, ListChecks, RefreshCcw, Search } from "lucide-react";

import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Utils } from "@/lib/utils";
import type { AtRiskRow } from "@/lib/types/dashboard";

import { useAtRiskColumns } from "./columns";

interface AtRiskListProps {
  data: AtRiskRow[];
}

export function AtRiskList({ data }: AtRiskListProps) {
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = React.useState("");

  const columns = useAtRiskColumns();

  return (
    <DataTable
      title={"At risk now"}
      columns={columns}
      data={data}
      setGlobalFilter={setGlobalFilter}
      globalFilter={globalFilter}
      prefix={"atRisk"}
      empty={
        <EmptyState
          icon={ListChecks}
          title="No open commitments"
          description="Everything currently tracked is closed."
        />
      }
      header={({ table }) => (
        <>
          <h3 className="text-sm font-semibold">At risk now</h3>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                placeholder={"Search..."}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-8 w-64 pe-10"
              />

              <Search
                size={14}
                className="absolute inset-e-3 top-1/2 -translate-y-1/2 text-foreground"
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={"ghost"}
                    disabled={table.getFilteredRowModel().rows.length === 0}
                    onClick={() => {
                      const exportRows = table
                        .getFilteredRowModel()
                        .rows.map((row) => row.original);

                      Utils.exportToCsv("at-risk.csv", exportRows);
                    }}
                  >
                    <Download size={14} />
                  </Button>
                </TooltipTrigger>

                <TooltipContent>Export Csv</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={"ghost"}
                    onClick={() => {
                      router.refresh();
                    }}
                  >
                    <RefreshCcw size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </>
      )}
    />
  );
}
