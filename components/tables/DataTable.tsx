"use client";
import { useState, useCallback, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  total: number;
  page: number;
  lastPage: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSearch?: (q: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  enableSelection?: boolean;
  onBulkDelete?: (selectedIds: string[]) => Promise<void>;
  getRowId?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  lastPage,
  loading,
  onPageChange,
  onSearch,
  searchPlaceholder = "Search...",
  actions,
  enableSelection,
  onBulkDelete,
  getRowId,
}: DataTableProps<T>) {
  const [searchVal, setSearchVal] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const isSelectionActive = enableSelection ?? Boolean(onBulkDelete);

  const tableColumns = useMemo(() => {
    if (!isSelectionActive) return columns;

    const selectCol: ColumnDef<T> = {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer align-middle"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) {
              el.indeterminate = table.getIsSomePageRowsSelected();
            }
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer align-middle"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          aria-label="Select row"
        />
      ),
      size: 40,
    };

    return [selectCol, ...columns];
  }, [columns, isSelectionActive]);

  const defaultGetRowId = useCallback((row: any) => {
    return String(row._id ?? row.id ?? JSON.stringify(row));
  }, []);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: lastPage,
    enableRowSelection: isSelectionActive,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getRowId: getRowId ?? defaultGetRowId,
  });

  const selectedCount = Object.keys(rowSelection).filter(
    (id) => rowSelection[id]
  ).length;

  const handleSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSearch?.(searchVal);
    },
    [searchVal, onSearch]
  );

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedCount === 0) return;
    const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    if (
      !confirm(
        `Are you sure you want to delete ${selectedCount} selected record${
          selectedCount > 1 ? "s" : ""
        }? This action will reverse any associated inventory stock.`
      )
    ) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      await onBulkDelete(selectedIds);
      setRowSelection({});
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="data-table-shell">
      {/* Toolbar */}
      {(onSearch || actions) && (
        <div className="flex flex-col items-start gap-3 border-b p-4 sm:flex-row sm:items-center">
          {onSearch && (
            <form
              onSubmit={handleSearch}
              className="flex gap-2 flex-1 min-w-0 max-w-sm"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="form-input w-full pl-9"
                />
              </div>
              <button type="submit" className="button-outline">
                Search
              </button>
            </form>
          )}
          <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between border-b bg-primary/10 px-4 py-2.5 text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">{selectedCount}</span>
            <span className="text-foreground">
              {selectedCount === 1 ? "record" : "records"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRowSelection({})}
              className="button-outline h-8 px-3 text-xs"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Deselect All
            </button>
            {onBulkDelete && (
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
                className="flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete Selected
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "h-10 border-b bg-muted/30 px-4 text-left text-xs font-medium text-foreground whitespace-nowrap",
                      header.id === "select" && "w-10 px-3 text-center"
                    )}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={tableColumns.length} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="py-16 text-center text-muted-foreground text-sm"
                >
                  No records found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/40 transition-colors",
                    row.getIsSelected() && "bg-primary/5"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-4 py-3 text-foreground whitespace-nowrap",
                        cell.column.id === "select" && "w-10 px-3 text-center"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          Showing {total ? Math.min((page - 1) * 15 + 1, total) : 0}–
          {Math.min(page * 15, total)} of {total} records
        </p>
        <div className="flex items-center gap-1">
          <PaginationButton
            onClick={() => onPageChange(1)}
            disabled={page === 1}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </PaginationButton>
          <PaginationButton
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </PaginationButton>
          <span className="px-3 py-1 text-xs font-medium text-foreground">
            Page {page} of {lastPage || 1}
          </span>
          <PaginationButton
            onClick={() => onPageChange(page + 1)}
            disabled={page >= lastPage}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </PaginationButton>
          <PaginationButton
            onClick={() => onPageChange(lastPage)}
            disabled={page >= lastPage}
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </PaginationButton>
        </div>
      </div>
    </div>
  );
}

function PaginationButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
