import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  FileQuestion,
  Filter as FilterIcon,
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
    }
  | {
      /** Native date picker (calendar). Predicate receives `YYYY-MM-DD`. */
      kind: 'date';
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
  /** Optional secondary CTA rendered to the left of `createCta`.
   *  Useful for "Generate with AI" + "Create" side-by-side. */
  secondaryCta?: { label: string; onClick: () => void; icon?: React.ReactNode };
  /** Top-right secondary "Export" button. The consumer is responsible for
   *  fetching the data and triggering the download (e.g. JSON / CSV). */
  exportAction?: { onClick: () => void | Promise<void>; label?: string };
  /** Top-left global search input. */
  globalSearch?: {
    placeholder: string;
    predicate: (row: T, q: string) => boolean;
  };
  pageSize?: number;
  isLoading?: boolean;
  /** When true (and not loading), render a distinct error state with an
   *  optional Retry instead of the table — so a FAILED fetch is never shown as
   *  an empty "No results" list (which reads as "the data is gone"). */
  error?: boolean;
  /** Retry handler surfaced alongside the error state. */
  onRetry?: () => void;
  empty?: React.ReactNode;
  /** Trailing cell. Typical: Edit / Publish / Delete buttons. */
  rowActions?: (row: T) => React.ReactNode;
  /** Optional row click handler — when set the row gets a pointer cursor. */
  onRowClick?: (row: T) => void;
  /**
   * Opt into backend-driven pagination/sort/filter/search. When provided,
   * the table renders `rows` verbatim (the caller fetches one page at a time),
   * reports state changes via the callbacks, and uses `totalRows` for the
   * footer/page math instead of `rows.length`. Omit it to keep the default
   * client-side behaviour used by every other list. `filters`/`onFiltersChange`
   * keys are column `id`s; `search`/`sort` carry the raw query the caller maps
   * to its API params.
   */
  serverMode?: {
    page: number;
    totalRows: number;
    onPageChange: (page: number) => void;
    sort: { column: string | null; dir: SortDir };
    onSortChange: (column: string | null, dir: SortDir) => void;
    filters: Record<string, string>;
    onFiltersChange: (filters: Record<string, string>) => void;
    onSearchChange: (query: string) => void;
  };
  /**
   * Opt into row multi-selection. The CALLER owns the selected-key set (so it
   * can act on the selection); the table renders a leading checkbox column plus
   * a bulk bar above the table whenever ≥1 row is selected. `isSelectable`
   * greys out rows that can't be acted on (e.g. yourself). Omit to keep every
   * other list unchanged.
   */
  selection?: {
    selectedKeys: Set<string | number>;
    onToggleRow: (key: string | number, row: T) => void;
    /** Toggle every selectable row in the current filtered set. */
    onToggleAll: (keys: (string | number)[], selectAll: boolean) => void;
    isSelectable?: (row: T) => boolean;
    /** Rendered above the table when ≥1 row is selected. */
    renderBulkBar?: (selectedCount: number, clear: () => void) => React.ReactNode;
    /** Clears the caller's selection (bulk bar ✕ and post-action reset). */
    onClear?: () => void;
  };
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
  secondaryCta,
  exportAction,
  globalSearch,
  pageSize = 20,
  isLoading,
  error,
  onRetry,
  empty,
  rowActions,
  onRowClick,
  serverMode,
  selection,
}: DataTableProps<T>) {
  const { t } = useTranslation(['common']);
  const { isDark } = useTheme();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [internalFilters, setInternalFilters] = useState<Record<string, string>>({});
  const [internalSortColumn, setInternalSortColumn] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<SortDir>(null);
  const [internalPage, setInternalPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  // Effective state — read from the caller in server mode, from local state
  // otherwise. Mutations route to the matching sink so the rest of the
  // component is agnostic to which mode is active.
  const page = serverMode ? serverMode.page : internalPage;
  const setPage = (next: number | ((p: number) => number)) => {
    const value = typeof next === 'function' ? next(page) : next;
    if (serverMode) serverMode.onPageChange(value);
    else setInternalPage(value);
  };

  const columnFilters = serverMode ? serverMode.filters : internalFilters;
  const setColumnFilters = (
    next: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => {
    const value = typeof next === 'function' ? next(columnFilters) : next;
    if (serverMode) serverMode.onFiltersChange(value);
    else setInternalFilters(value);
  };

  const sortColumn = serverMode ? serverMode.sort.column : internalSortColumn;
  const sortDir = serverMode ? serverMode.sort.dir : internalSortDir;
  const setSort = (column: string | null, dir: SortDir) => {
    if (serverMode) serverMode.onSortChange(column, dir);
    else {
      setInternalSortColumn(column);
      setInternalSortDir(dir);
    }
  };

  // Debounce global search. In server mode the caller owns the query and is
  // responsible for resetting the page; client mode resets here.
  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (serverMode) serverMode.onSearchChange(trimmed);
      else {
        setSearch(trimmed);
        setInternalPage(1);
      }
    }, 300);
    return () => clearTimeout(id);
    // serverMode callbacks are read via closure at flush time; re-running on
    // identity changes would restart the debounce on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const filteredRows = useMemo(() => {
    if (serverMode) return rows;
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
  }, [rows, search, columnFilters, columns, globalSearch, serverMode]);

  const sortedRows = useMemo(() => {
    if (serverMode) return rows;
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
  }, [filteredRows, sortColumn, sortDir, columns, rows, serverMode]);

  const total = serverMode ? serverMode.totalRows : sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Clamp current page when row count shrinks below it (e.g. after delete
  // or filter). Has to live in an effect so it survives React's batching.
  // In server mode the caller owns page validity.
  useEffect(() => {
    if (!serverMode && page > totalPages) setInternalPage(totalPages);
  }, [page, totalPages, serverMode]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  // Server mode hands us exactly one page of rows; client mode slices locally.
  const pageRows = serverMode ? rows : sortedRows.slice(rangeStart - 1, rangeEnd);
  const pageNumbers = getPageNumbers(page, totalPages);

  const headerColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const subtleBorderColor = isDark ? '#1f2937' : '#f3f4f6';
  const filterableColumns = columns.filter(c => c.filter);
  const anyFiltersActive = Object.values(columnFilters).some(Boolean);

  // Selection: header checkbox operates over every selectable row in the
  // current filtered set (not just the visible page), so "select all" grabs
  // the whole result the caller can act on.
  const selectableScope = useMemo(() => {
    if (!selection) return [] as T[];
    const scope = serverMode ? rows : sortedRows;
    return selection.isSelectable ? scope.filter(selection.isSelectable) : scope;
  }, [selection, serverMode, rows, sortedRows]);
  const selectedCount = selection ? selection.selectedKeys.size : 0;
  const allSelected =
    !!selection && selectableScope.length > 0 &&
    selectableScope.every(r => selection.selectedKeys.has(rowKey(r)));
  const someSelected =
    !!selection && selectableScope.some(r => selection.selectedKeys.has(rowKey(r)));

  // Prune any selected key that's been filtered/searched out of the current
  // set, so a bulk action can never touch rows the user can no longer see.
  // Skipped in server mode, where `rows` is only the current page and the
  // caller owns cross-page selection semantics.
  useEffect(() => {
    if (!selection || serverMode) return;
    const visible = new Set(selectableScope.map(rowKey));
    const stale = [...selection.selectedKeys].filter(k => !visible.has(k));
    if (stale.length > 0) selection.onToggleAll(stale, false);
    // selectableScope recomputes on any rows/filter/search change; the
    // stale-guard makes this a no-op once nothing filtered-out remains.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableScope]);

  const toggleSort = (colId: string) => {
    if (sortColumn !== colId) {
      setSort(colId, 'asc');
      return;
    }
    if (sortDir === 'asc') {
      setSort(colId, 'desc');
      return;
    }
    if (sortDir === 'desc') {
      setSort(null, null);
    }
  };

  return (
    <Card>
      <CardBody>
        {/* Toolbar: global search (left) + Filter / Create CTA (right). */}
        {(globalSearch || createCta || secondaryCta || exportAction || filterableColumns.length > 0) && (
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
            <div className="flex items-center gap-2">
              {filterableColumns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterOpen(o => !o)}
                  aria-expanded={filterOpen}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FilterIcon className="w-3.5 h-3.5" />
                  {t('common:filter', { defaultValue: 'Filter' })}
                  {anyFiltersActive && (
                    <span
                      className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: '#088F8F' }}
                    />
                  )}
                </button>
              )}
              {exportAction && (
                <button
                  type="button"
                  onClick={() => void exportAction.onClick()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {exportAction.label ?? t('common:export', { defaultValue: 'Export' })}
                </button>
              )}
              {secondaryCta && (
                <Button
                  onClick={secondaryCta.onClick}
                  size="sm"
                  variant="secondary"
                  icon={secondaryCta.icon}
                >
                  {secondaryCta.label}
                </Button>
              )}
              {createCta && (
                <Button
                  onClick={createCta.onClick}
                  size="sm"
                  icon={createCta.icon ?? <Plus className="w-4 h-4" />}
                >
                  {createCta.label}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Inline filter card. Stacks the configured column filters
            between the toolbar and the table — toggled by the Filter
            button above. Same surface (white / dark gray) as the host
            card so it reads as one continuous block. */}
        {filterOpen && filterableColumns.length > 0 && (
          <div
            className="mb-4 rounded-xl border p-3 sm:p-4 bg-white dark:bg-gray-800"
            style={{ borderColor }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-sm font-semibold"
                style={{ color: isDark ? '#f3f4f6' : '#111827' }}
              >
                {t('common:filter', { defaultValue: 'Filter' })}
              </span>
              <div className="flex items-center gap-3">
                {anyFiltersActive && (
                  <button
                    type="button"
                    onClick={() => setColumnFilters({})}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t('common:clear_all', { defaultValue: 'Clear all' })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  aria-label={t('common:close', { defaultValue: 'Close' })}
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filterableColumns.map(col => {
                const value = columnFilters[col.id] ?? '';
                const setValue = (v: string) =>
                  setColumnFilters(prev => {
                    const next = { ...prev };
                    if (v) next[col.id] = v;
                    else delete next[col.id];
                    return next;
                  });
                if (col.filter!.kind === 'text' || col.filter!.kind === 'date') {
                  const isDate = col.filter!.kind === 'date';
                  return (
                    <div key={col.id}>
                      <label
                        className="block text-sm font-medium mb-1.5"
                        style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                      >
                        {col.header}
                      </label>
                      <input
                        type={isDate ? 'date' : 'text'}
                        value={value}
                        onChange={e => {
                          setValue(e.target.value);
                          setPage(1);
                        }}
                        placeholder={
                          isDate ? undefined : (col.filter as { placeholder?: string }).placeholder ?? col.header
                        }
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
                  <div key={col.id}>
                    <label
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: isDark ? '#cbd5e1' : '#374151' }}
                    >
                      {col.header}
                    </label>
                    <SearchableSelect
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
            </div>
          </div>
        )}

        {/* Bulk-action bar — shown while any row is selected. */}
        {selection && selectedCount > 0 && selection.renderBulkBar && (
          <div className="mb-3">
            {selection.renderBulkBar(selectedCount, () => selection.onClear?.())}
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
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title={t('common:load_error_title', { defaultValue: "Couldn't load data" })}
            description={t('common:load_error_desc', {
              defaultValue: 'Something went wrong while loading. Please try again.',
            })}
            action={
              onRetry
                ? { label: t('common:retry', { defaultValue: 'Retry' }), onClick: onRetry }
                : undefined
            }
          />
        ) : total === 0 ? (
          empty ?? (
            <EmptyState
              icon={FileQuestion}
              title={t('common:no_results', { defaultValue: 'No results' })}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr
                  className="border-b text-left text-xs font-semibold"
                  style={{ borderColor, color: headerColor }}
                >
                  {selection && (
                    <th className="py-2 px-3" style={{ width: '2.5rem' }}>
                      <input
                        type="checkbox"
                        aria-label={t('common:select_all', { defaultValue: 'Select all' })}
                        ref={el => {
                          if (el) el.indeterminate = !allSelected && someSelected;
                        }}
                        checked={allSelected}
                        onChange={() =>
                          selection.onToggleAll(selectableScope.map(rowKey), !allSelected)
                        }
                        className="accent-primary-600 cursor-pointer"
                      />
                    </th>
                  )}
                  {columns.map(col => (
                    <HeaderCell
                      key={col.id}
                      col={col}
                      sortDir={sortColumn === col.id ? sortDir : null}
                      onToggleSort={() => toggleSort(col.id)}
                    />
                  ))}
                  {rowActions && (
                    <th
                      className="py-2 px-2 text-right"
                      style={{ width: '3rem' }}
                    >
                      <span className="sr-only">
                        {t('common:actions', { defaultValue: 'Actions' })}
                      </span>
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
                    {selection && (
                      <td
                        className="py-3 px-3"
                        style={{ width: '2.5rem' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={t('common:select_row', { defaultValue: 'Select row' })}
                          checked={selection.selectedKeys.has(rowKey(row))}
                          disabled={selection.isSelectable ? !selection.isSelectable(row) : false}
                          onChange={() => selection.onToggleRow(rowKey(row), row)}
                          className="accent-primary-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                    )}
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
                        className="py-3 px-2 text-right"
                        style={{ width: '3rem' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
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
          className="inline-flex items-center gap-1 text-xs font-semibold hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
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
