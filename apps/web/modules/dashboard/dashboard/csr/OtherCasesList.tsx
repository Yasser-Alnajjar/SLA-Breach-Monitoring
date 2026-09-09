"use client";

import React from "react";

import { Download, RefreshCcw, Search } from "lucide-react";

import { DataTable } from "@/components/shared/data-table";
import { AtRiskRow } from "@/lib/types/dashboard";
import { Input } from "@/components/ui/input";
import { useOtherCasesColumns } from "./columns";
import { Utils } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export const OtherCasesList = ({ data }: { data: AtRiskRow[] }) => {
  const [globalFilter, setGlobalFilter] = React.useState("");

  const columns = useOtherCasesColumns();
  const router = useRouter();
  return (
    <DataTable
      title={"All other cases"}
      columns={columns}
      data={data}
      setGlobalFilter={setGlobalFilter}
      globalFilter={globalFilter}
      header={({ table }) => (
        <>
          <h3 className="text-sm font-semibold">All other cases</h3>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                placeholder={"Search..."}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-6 w-64 pe-10"
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
                    onClick={() => {
                      const exportRows = table
                        .getFilteredRowModel()
                        .rows.map((row) => row.original);

                      Utils.exportToCsv("other-cases.csv", exportRows);
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
};
