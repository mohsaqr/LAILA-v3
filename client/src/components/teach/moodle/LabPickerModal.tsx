import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, FlaskConical, User, Layers, BookOpen, Lock, Globe, Check } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import type { CustomLab } from '../../../types';

/** Who a lab belongs to, from the viewer's perspective. */
export type LabOrigin = 'mine' | 'shared' | 'template' | 'builtin';

/**
 * The built-in JS exercises (TNA / SNA) are not rows in custom_labs — a module
 * just records their key. They are offered here anyway, because "add a lab to
 * this course" is one intention and splitting it across separate palette tiles
 * is how they became impossible to find. They are marked by a negative id,
 * which no autoincrement row can collide with.
 */
export const isBuiltinLab = (lab: Pick<CustomLab, 'id'>): boolean => lab.id < 0;

export const labOrigin = (lab: CustomLab, currentUserId: number | undefined, adminIds: Set<number>): LabOrigin => {
  if (isBuiltinLab(lab)) return 'builtin';
  if (currentUserId != null && lab.createdBy === currentUserId) return 'mine';
  if (adminIds.has(lab.createdBy)) return 'template';
  return 'shared';
};

interface LabPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The whole library the viewer may attach from, not just their own labs. */
  labs: CustomLab[];
  /** Labs already attached to this course; shown as unavailable, never offered. */
  assignedLabIds: Set<number>;
  currentUserId?: number;
  /** Creators known to be admins — their labs read as shared templates. */
  adminCreatorIds?: Set<number>;
  selectedLabId: string;
  onSelect: (labId: string) => void;
  /** Grading and scheduling fields, rendered under the preview. */
  children?: React.ReactNode;
  onConfirm: () => void;
  isConfirming?: boolean;
  onBrowseAll: () => void;
}

const ORIGIN_STYLE: Record<LabOrigin, string> = {
  mine: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  template: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  shared: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  builtin: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
};

/**
 * Library browser for attaching a lab to a course section.
 *
 * A lab is a reusable unit — LabAssignment is a join table, so one lab serves
 * many courses — and the server lets an instructor attach any public or
 * admin-authored lab, not only their own. This surface exists so that library
 * is actually visible: an instructor picks by what a lab *contains*, not by
 * remembering which of their own they built.
 */
export const LabPickerModal = ({
  isOpen,
  onClose,
  labs,
  assignedLabIds,
  currentUserId,
  adminCreatorIds = new Set(),
  selectedLabId,
  onSelect,
  children,
  onConfirm,
  isConfirming = false,
  onBrowseAll,
}: LabPickerModalProps) => {
  const { t } = useTranslation(['teaching', 'courses', 'common']);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState<'all' | LabOrigin>('all');

  const decorated = useMemo(
    () =>
      labs.map(lab => ({
        lab,
        origin: labOrigin(lab, currentUserId, adminCreatorIds),
        attached: assignedLabIds.has(lab.id),
      })),
    [labs, currentUserId, adminCreatorIds, assignedLabIds]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return decorated.filter(({ lab, origin: o }) => {
      if (origin !== 'all' && o !== origin) return false;
      if (!q) return true;
      return (
        lab.name.toLowerCase().includes(q) ||
        (lab.description ?? '').toLowerCase().includes(q) ||
        (lab.creator?.fullname ?? '').toLowerCase().includes(q)
      );
    });
  }, [decorated, search, origin]);

  const selected = decorated.find(d => String(d.lab.id) === selectedLabId);
  const cells = selected?.lab.templates ?? [];

  const originLabel = (o: LabOrigin) =>
    o === 'mine'
      ? t('teaching:lab_origin_mine', { defaultValue: 'Yours' })
      : o === 'template'
        ? t('teaching:lab_origin_template', { defaultValue: 'Template' })
        : o === 'builtin'
          ? t('teaching:lab_origin_builtin', { defaultValue: 'Built-in' })
          : t('teaching:lab_origin_shared', { defaultValue: 'Shared' });

  const filters: ('all' | LabOrigin)[] = ['all', 'mine', 'shared', 'template', 'builtin'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('teaching:add_lab_title', { defaultValue: 'Add a lab' })}
      size="5xl"
    >
      <div className="flex flex-col" style={{ maxHeight: '78vh' }}>
        {/* Search + origin filters */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('teaching:lab_library_subtitle', {
              defaultValue:
                'Attach any lab from the library. It stays reusable — adding it here does not copy it or take it away from other courses.',
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[16rem]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                placeholder={t('teaching:lab_search_ph', {
                  defaultValue: 'Search by name, description or author…',
                })}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 p-0.5">
              {filters.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOrigin(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    origin === f
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {f === 'all' ? t('common:all', { defaultValue: 'All' }) : originLabel(f)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Library on the left, preview on the right */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-5">
          <div className="md:col-span-2 overflow-y-auto border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 max-h-[42vh] md:max-h-none">
            {visible.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('teaching:no_labs_match', { defaultValue: 'No labs match your search.' })}
              </div>
            ) : (
              <ul data-testid="lab-list" className="divide-y divide-gray-100 dark:divide-gray-700">
                {visible.map(({ lab, origin: o, attached }) => {
                  const isSelected = String(lab.id) === selectedLabId;
                  return (
                    <li key={lab.id}>
                      <button
                        type="button"
                        disabled={attached}
                        onClick={() => onSelect(String(lab.id))}
                        aria-current={isSelected}
                        className={`w-full text-left px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <FlaskConical className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {lab.name}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className={`px-1.5 py-0.5 rounded ${ORIGIN_STYLE[o]}`}>{originLabel(o)}</span>
                              <span className="flex items-center gap-1 truncate">
                                <User className="w-3 h-3" />
                                {lab.creator?.fullname ??
                                  t('teaching:unknown_author', { defaultValue: 'Unknown' })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                {t('teaching:n_cells', {
                                  count: lab._count?.templates ?? lab.templates?.length ?? 0,
                                  defaultValue: '{{count}} cells',
                                })}
                              </span>
                              {attached && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  {t('teaching:already_in_course', { defaultValue: 'Already in this course' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Preview */}
          <div data-testid="lab-preview" className="md:col-span-3 overflow-y-auto p-5 max-h-[42vh] md:max-h-none">
            {!selected ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-gray-400">
                <BookOpen className="w-8 h-8 mb-2" />
                <p className="text-sm">
                  {t('teaching:select_lab_to_preview', {
                    defaultValue: 'Select a lab to see what it contains.',
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {selected.lab.name}
                  </h3>
                  {selected.lab.description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {selected.lab.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      {selected.lab.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {selected.lab.isPublic
                        ? t('teaching:lab_public', { defaultValue: 'Public' })
                        : t('teaching:lab_private', { defaultValue: 'Private' })}
                    </span>
                    <span>{selected.lab.labType}</span>
                    <span>
                      {t('teaching:used_in_n_courses', {
                        count: selected.lab._count?.assignments ?? 0,
                        defaultValue: 'Used in {{count}} courses',
                      })}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    {t('teaching:lab_contents', { defaultValue: 'Contents' })}
                  </p>
                  {cells.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      {t('teaching:lab_empty', { defaultValue: 'This lab has no cells yet.' })}
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {cells.map((cell, i) => (
                        <li
                          key={cell.id}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900/40">
                            <span className="font-mono text-xs text-gray-400">{i + 1}</span>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                              {cell.title}
                            </span>
                            <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">
                              {cell.cellType === 'markdown'
                                ? t('teaching:text_cell_badge', { defaultValue: 'Text' })
                                : 'R'}
                            </span>
                          </div>
                          {cell.cellType !== 'markdown' && cell.code?.trim() && (
                            <pre className="px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 overflow-x-auto whitespace-pre">
                              {cell.code.split('\n').slice(0, 4).join('\n')}
                              {cell.code.split('\n').length > 4 ? '\n…' : ''}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {children && (
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">{children}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-700">
          <Button variant="ghost" onClick={onBrowseAll}>
            {t('teaching:go_to_labs', { defaultValue: 'Manage labs' })}
          </Button>
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button disabled={!selectedLabId} loading={isConfirming} onClick={onConfirm}>
            {t('teaching:add_lab', { defaultValue: 'Add lab' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
