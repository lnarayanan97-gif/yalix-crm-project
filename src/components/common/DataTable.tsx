import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from 'lucide-react';
import { generateCsvString, downloadCsvFile, ExportColumnDef } from '../../utils/csvExport';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  searchFields?: (keyof T)[];
  searchPlaceholder?: string;
  onSelect?: (selected: T[]) => void;
  bulkActions?: (selected: T[], clearSelection: () => void) => React.ReactNode;
  exportFilename?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  initialPageSize?: number;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  searchFields = [],
  searchPlaceholder = 'Search records...',
  onSelect,
  bulkActions,
  exportFilename = 'yalix_export',
  isLoading = false,
  emptyMessage = 'No records found',
  initialPageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedKeys, setSelectedKeys] = useState<Set<any>>(new Set());

  // Search filtering
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const lower = search.toLowerCase().trim();
    return data.filter((item) => {
      if (searchFields.length > 0) {
        return searchFields.some((field) => {
          const val = item[field];
          return val != null && String(val).toLowerCase().includes(lower);
        });
      }
      return Object.values(item).some(
        (val) => val != null && String(val).toLowerCase().includes(lower)
      );
    });
  }, [data, search, searchFields]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA == null && valB == null) return 0;
      if (valA == null) return sortDirection === 'asc' ? 1 : -1;
      if (valB == null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Selection
  const toggleSelectAll = () => {
    if (selectedKeys.size === paginatedData.length && paginatedData.length > 0) {
      setSelectedKeys(new Set());
      onSelect?.([]);
    } else {
      const newSet = new Set(paginatedData.map((d) => d[keyField]));
      setSelectedKeys(newSet);
      onSelect?.(paginatedData);
    }
  };

  const toggleSelectOne = (key: any, item: T) => {
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedKeys(newSet);
    const selectedItems = data.filter((d) => newSet.has(d[keyField]));
    onSelect?.(selectedItems);
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
    onSelect?.([]);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Export to Excel / CSV (Exporting all filtered matching records across all pages)
  const handleExport = async (format: 'xlsx' | 'csv') => {
    // If user has actively selected specific rows with checkboxes, export only those selected rows;
    // otherwise, export ALL records matching the current filter/search across all pages (not just the current page).
    const exportItems = selectedKeys.size > 0
      ? data.filter((d) => selectedKeys.has(d[keyField]))
      : sortedData;

    const exportCols: ExportColumnDef<T>[] = columns
      .filter((c) => c.key !== 'actions')
      .map((c) => ({
        key: c.key,
        label: c.label,
        getter: (item: T) => item[c.key],
      }));

    const timestamp = Date.now();
    const baseFilename = `${exportFilename}_${timestamp}`;

    if (format === 'csv') {
      // RFC 4180 Unicode CSV with Byte Order Mark (BOM) & commas/quotes escaping
      const csvString = generateCsvString(exportItems, exportCols);
      downloadCsvFile(csvString, `${baseFilename}.csv`);
    } else {
      // Dynamically load XLSX on demand via SheetJS
      const XLSX = await import('xlsx');
      const cleanRows = exportItems.map((item) => {
        const row: Record<string, any> = {};
        exportCols.forEach((c) => {
          row[c.label] = item[c.key] ?? '';
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(cleanRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      XLSX.writeFile(workbook, `${baseFilename}.xlsx`, { bookType: 'xlsx' });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/50">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedKeys.size > 0 && bulkActions && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                {selectedKeys.size} selected
              </span>
              {bulkActions(
                data.filter((d) => selectedKeys.has(d[keyField])),
                clearSelection
              )}
            </div>
          )}

          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-white text-xs text-slate-600">
            <button
              onClick={() => handleExport('xlsx')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium"
              title="Export as Excel XLSX"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>XLSX</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors font-medium"
              title="Export as CSV"
            >
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto min-h-[300px] relative">
        {isLoading ? (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl shadow-md border border-slate-100 text-slate-600 text-sm">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Loading records...</span>
            </div>
          </div>
        ) : null}

        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 tracking-wider">
              {onSelect && (
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      paginatedData.length > 0 && selectedKeys.size === paginatedData.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    className={`py-3 px-4 ${
                      col.sortable !== false ? 'cursor-pointer select-none hover:bg-slate-100/80' : ''
                    } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.label}</span>
                      {col.sortable !== false && (
                        <span className="text-slate-400">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelect ? 1 : 0)}
                  className="py-12 text-center text-slate-400"
                >
                  <p className="text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => {
                const key = item[keyField];
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={String(key)}
                    className={`transition-colors hover:bg-slate-50/80 ${
                      isSelected ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    {onSelect && (
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(key, item)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-3 px-4 text-slate-700 ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {col.render ? col.render(item) : item[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>
            Showing{' '}
            <strong className="text-slate-700">
              {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-700">
              {Math.min(currentPage * pageSize, filteredData.length)}
            </strong>{' '}
            of <strong className="text-slate-700">{filteredData.length}</strong> records
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-600"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
