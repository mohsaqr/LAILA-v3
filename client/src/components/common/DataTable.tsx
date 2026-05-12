import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  FileQuestion,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Card, CardBody } from './Card';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { SearchableSelect } from './SearchableSelect';
import { useTheme } from '../../hooks/useTheme';
import { getPageNumbers } from '../../utils/pagination';

export type SortDir = 'asc' | 'desc' | null;

export type ColumnFilter<T> =
  | {
      kind: 'text';
      placeholder?: string;
      predicate: (row: T, q: string) => boolean;
    }
  | {
      kind: 'select';
      options: { value: string; label: string }[];
      predicate: (row: T, v: string) => boolean;
    };

export interface ColumnDef<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Enables sort when provided. Stable string/number key for the row. */
  sortAccessor?: (row: T) => string | number | null | undefined;
  /** Adds a filter affordance to the header cell. */
  filter?: ColumnFilter<T>;
  align?: 'left' | 'right' | 'center';
  /** Hides the column on viewports < `sm`. */
  hideOnMobile?: boolean;
  /** Optional fixed width (any valid CSS value). */
  width?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string | number;
  /** Top-right primary CTA. */
  createCta?: { label: string; onClick: () => void; icon?: React.ReactNode };
  /** Top-left global search input. */
  globalSearch?: {
    placeholder: string;
    predicate: (row: T, q: string) => boolean;
  };
  pageSize?: number;
  isLoading?: boolean;
  empty?: React.ReactNode;
  /** Trailing cell. Typical: Edit / Publish / Delete buttons. */
  rowActions?: (row: T) => React.ReactNode;
  /** Optional row click handler — when set the row gets a pointer cursor. */
  onRowClick?: (row: T) => void;
}

/**
 * Generic instructor/admin list table. Client-side sort, per-column
 * filters, debounced global search, paginated footer with ellipses, and
 * a row-actions cell. Visual style matches CourseStudents.tsx so all
 * instructor lists share one look.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  createCta,
  globalSearch,
  pageSize = 20,
  isLoading,
  empty,
  rowActions,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useTranslation(['common']);
  const { isDark } = useTheme();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);

  // Debounce global search.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (globalSearch && search) {
      result = result.filter(r => globalSearch.predicate(r, search));
    }
    for (const col of columns) {
      const f = columnFilters[col.id];
      if (!f || !col.filter) continue;
      result = result.filter(r => col.filter!.predicate(r, f));
    }
    return result;
  }, [rows, search, columnFilters, columns, globalSearch]);

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDir) return filteredRows;
    const col = columns.find(c => c.id === sortColumn);
    if (!col?.sortAccessor) return filteredRows;
    const next = [...filteredRows];
    next.sort((a, b) => {
      const av = col.sortAccessor!(a);
      const bv = col.sortAccessor!(b);
      // Nulls sort to the bottom regardless of direction.
      const aNull = av == null || av === '';
      const bNull = bv == null || bv === '';
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return next;
  }, [filteredRows, sortColumn, sortDir, columns]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Clamp current page when row count shrinks below it (e.g. after delete
  // or filter). Has to live in an effect so it survives React's batching.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  const pageRows = sortedRows.slice(rangeStart - 1, rangeEnd);
  const pageNumbers = getPageNumbers(page, totalPages);

  const headerColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const subtleBorderColor = isDark ? '#1f2937' : '#f3f4f6';
  const filterableColumns = columns.filter(c => c.filter);
  const anyFiltersActive = Object.values(columnFilters).some(Boolean);

  const toggleSort = (colId: string) => {
    if (sortColumn !== colId) {
      setSortColumn(colId);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    if (sortDir === 'desc') {
      setSortColumn(null);
      setSortDir(null);
    }
  };

  return (
    <Card>
      <CardBody>
        {/* Toolbar: global search (left) + create CTA (right). */}
        {(globalSearch || createCta) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            {globalSearch ? (
              <div className="relative flex-1 max-w-sm">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: headerColor }}
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={globalSearch.placeholder}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                />
              </div>
            ) : (
              <div />
            )}
            {createCta && (
              <Button
                onClick={createCta.onClick}
                icon={createCta.icon ?? <Plus className="w-4 h-4" />}
              >
                {createCta.label}
              </Button>
            )}
          </div>
        )}

        {/* Column filter toolbar: one control per filterable column,
            wrapping freely. Active filter values are kept in sync with
            the same internal state used by the predicate pipeline. */}
        {filterableColumns.length > 0 && (
          <div
            className="flex flex-wrap items-end gap-3 mb-4 pb-3 border-b"
            style={{ borderColor: subtleBorderColor }}
          >
            {filterableColumns.map(col => {
              const value = columnFilters[col.id] ?? '';
              const setValue = (v: string) =>
                setColumnFilters(prev => {
                  const next = { ...prev };
                  if (v) next[col.id] = v;
                  else delete next[col.id];
                  return next;
                });
              if (col.filter!.kind === 'text') {
                return (
                  <div key={col.id} className="min-w-[10rem]">
                    <label
                      className="block text-[11px] font-medium uppercase tracking-wider mb-1"
                      style={{ color: headerColor }}
                    >
                      {col.header}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={e => {
                        setValue(e.target.value);
                        setPage(1);
                      }}
                      placeholder={col.filter!.placeholder ?? col.header}
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                    />
                  </div>
                );
              }
              const selectFilter = col.filter!;
              const options = [
                { value: '', label: t('common:all', { defaultValue: 'All' }) },
                ...selectFilter.options,
              ];
              return (
                <div key={col.id} className="min-w-[8rem]">
                  <SearchableSelect
                    label={col.header}
                    value={value}
                    onChange={v => {
                      setValue(v);
                      setPage(1);
                    }}
                    options={options}
                  />
                </div>
              );
            })}
            {anyFiltersActive && (
              <button
                type="button"
                onClick={() => setColumnFilters({})}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
                {t('common:clear_all', { defaultValue: 'Clear all' })}
              </button>
            )}
          </div>
        )}

        {/* Table or empty state */}
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-10 rounded animate-pulse"
                style={{ backgroundColor: subtleBorderColor }}
              />
            ))}
          </div>
        ) : total === 0 ? (
          empty ?? (
            <EmptyState
              icon={FileQuestion}
              title={t('common:no_results', { defaultValue: 'No results' })}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr
                  className="border-b text-left text-xs uppercase tracking-wider"
                  style={{ borderColor, color: headerColor }}
                >
                  {columns.map(col => (
                    <HeaderCell
                      key={col.id}
                      col={col}
                      sortDir={sortColumn === col.id ? sortDir : null}
                      onToggleSort={() => toggleSort(col.id)}
                    />
                  ))}
                  {rowActions && (
                    <th className="py-2 px-3 font-medium text-right">
                      {t('common:actions', { defaultValue: 'Actions' })}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`border-b border-gray-100 dark:border-gray-800 ${
                      onRowClick
                        ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {columns.map(col => (
                      <td
                        key={col.id}
                        className={`py-3 px-3 ${
                          col.hideOnMobile ? 'hidden sm:table-cell' : ''
                        } ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : ''
                        }`}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                    {rowActions && (
                      <td
                        className="py-3 px-3 text-right"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {rowActions(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {total > pageSize && (
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t"
            style={{ borderColor }}
          >
            <p className="text-xs" style={{ color: headerColor }}>
              {t('common:showing_range', {
                defaultValue: 'Showing {{from}}–{{to}} of {{total}}',
                from: rangeStart,
                to: rangeEnd,
                total,
              })}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('common:previous', { defaultValue: 'Previous' })}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNumbers.map((p, idx) =>
                p === 'dots' ? (
                  <span
                    key={`dots-${idx}`}
                    className="px-2 text-xs text-gray-400 dark:text-gray-500 select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === page ? 'page' : undefined}
                    className={`min-w-[2rem] px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      p === page
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                aria-label={t('common:next', { defaultValue: 'Next' })}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface HeaderCellProps<T> {
  col: ColumnDef<T>;
  sortDir: SortDir;
  onToggleSort: () => void;
}

function HeaderCell<T>({ col, sortDir, onToggleSort }: HeaderCellProps<T>) {
  const sortable = !!col.sortAccessor;
  return (
    <th
      className={`py-2 px-3 font-medium ${col.hideOnMobile ? 'hidden sm:table-cell' : ''} ${
        col.align === 'right'
          ? 'text-right'
          : col.align === 'center'
          ? 'text-center'
          : ''
      }`}
      style={{ width: col.width }}
      aria-sort={
        sortDir === 'asc'
          ? 'ascending'
          : sortDir === 'desc'
          ? 'descending'
          : 'none'
      }
    >
      {sortable ? (
        <button
          type="button"
          onClick={onToggleSort}
          className="inline-flex items-center gap-1 uppercase tracking-wider text-xs font-medium hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <span>{col.header}</span>
          {sortDir === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : sortDir === 'desc' ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronsUpDown className="w-3 h-3 opacity-40" />
          )}
        </button>
      ) : (
        <span>{col.header}</span>
      )}
    </th>
  );
}
