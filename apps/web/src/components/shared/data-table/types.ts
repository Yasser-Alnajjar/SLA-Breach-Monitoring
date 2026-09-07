import { ColumnDef } from "@tanstack/react-table";

export type DataTableColumns<TData> = ColumnDef<TData> & {
  sticky?: boolean;
  draggable?: boolean;
  sortable?: boolean;
  resizable?: boolean;
};
