"use client";

import React from "react";

import { Download, ListChecks, RefreshCcw, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Utils } from "@/lib/utils";
import type { CaseListData } from "@/lib/types/cases";
import { useCaseListColumns } from "./columns";
import { Card } from "@/components/ui/card";

interface CaseListViewProps {
  data: CaseListData;
}

export const CaseListView = ({ data }: CaseListViewProps) => {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const columns = useCaseListColumns();
  const router = useRouter();

  if (data.cases.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No cases yet"
        description="Cases will show up here once they start syncing in."
      />
    );
  }

  return (
    <Card>
      <DataTable
        title="All cases"
        columns={columns}
        data={data.cases}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        header={({ table }) => (
          <>
            <h3 className="text-sm font-semibold">
              All cases ({data.cases.length})
            </h3>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  placeholder="Search..."
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
                      variant="ghost"
                      disabled={table.getFilteredRowModel().rows.length === 0}
                      onClick={() => {
                        const exportRows = table
                          .getFilteredRowModel()
                          .rows.map((row) => row.original);

                        Utils.exportToCsv("all-cases.csv", exportRows);
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
                      variant="ghost"
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
    </Card>
  );
};
