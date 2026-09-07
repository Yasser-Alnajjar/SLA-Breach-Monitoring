"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DataTableViewOptions } from "./data-table-view-options";

import { useQueryParams } from "@hooks";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@radix-ui/react-select";
import { dir } from "console";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  className?: string;
}

export function DataTablePagination<TData>({
  table,
  className,
}: DataTablePaginationProps<TData>) {
  const { createQueryFromObject, getQueryObject } = useQueryParams();
  const [goToPage, setGoToPage] = useState<number | undefined>(undefined);
  const page = Number(getQueryObject().page || 1);
  const pageSize = Number(getQueryObject().pageSize || 10);

  return (
    <div
      className={cn(
        "flex w-full flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="flex justify-center sm:justify-start items-center gap-2 flex-wrap">
        <DataTableViewOptions table={table} />
        <div className="flex items-center gap-2 order-2 md:order-1">
          Show
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => {
              createQueryFromObject({ pageSize: Number(value) });
            }}
          >
            <SelectTrigger className="h-8 w-17.5">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50, 75, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          Per Page
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap lg:gap-4 order-1 md:order-2">
        <div className="flex max-w-40 text-nowrap items-center justify-center text-sm font-medium">
          Total: {table.getPrePaginationRowModel().rows.length} | Page{" "}
          {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          {" | "}
          {table.getState().pagination.pageSize} per page
        </div>
        <div className="flex items-center justify-center text-sm gap-2">
          <Input
            type="number"
            min={1}
            max={table.getPageCount()}
            value={
              goToPage !== undefined
                ? Math.min(goToPage, table.getPageCount())
                : ""
            }
            placeholder="Go to page"
            className="min-w-30"
            onChange={(e) => {
              const value = e.target.value;

              if (value === "") {
                setGoToPage(undefined);
                return;
              }

              const num = Number(value);

              if (!Number.isNaN(num) && num >= 1) {
                setGoToPage(Math.min(num, table.getPageCount()));
              }
            }}
            onKeyDown={(e) => {
              e.key === "Enter" && createQueryFromObject({ page: goToPage });
            }}
          />
          <Button
            variant="outline"
            onClick={() => createQueryFromObject({ page: goToPage })}
          >
            Go
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              createQueryFromObject({
                page: page - 1,
              });
            }}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              createQueryFromObject({
                page: page + 1,
              });
            }}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
