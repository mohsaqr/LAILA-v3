import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Code,
  Eye,
  FlaskConical,
  Globe,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { customLabsApi } from '../../api/customLabs';
import { coursesApi } from '../../api/courses';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import {
  DataTable,
  type ColumnDef,
} from '../../components/common/DataTable';
import { RowMenu } from '../../components/common/RowMenu';
import { CustomLab, LabTemplate, LabType, Course, UpdateCustomLabData } from '../../types';
import activityLogger from '../../services/activityLogger';

export const LabManager = () => {
  const { t } = useTranslation(['teaching', 'common', 'navigation']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    activityLogger.logLabManagerViewed();
  }, []);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [selectedLab, setSelectedLab] = useState<CustomLab | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<LabTemplate | null>(null);

  const [labForm, setLabForm] = useState({
    name: '',
    description: '',
    labType: 'tna',
    isPublic: false,
    addDefaultTemplates: true,
  });
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    code: '',
  });
  const [assignCourseId, setAssignCourseId] = useState<number | null>(null);

  const { data: labs = [], isLoading: labsLoading } = useQuery({
    queryKey: ['myLabs'],
    queryFn: customLabsApi.getMyLabs,
  });

  const { data: labTypes } = useQuery({
    queryKey: ['labTypes'],
    queryFn: customLabsApi.getLabTypes,
  });

  const { data: myCourses } = useQuery({
    queryKey: ['myCourses'],
    queryFn: coursesApi.getMyCourses,
  });

  const inputCls =
    'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const labelCls = 'block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100';

  const createLabMutation = useMutation({
    mutationFn: customLabsApi.createLab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowCreateModal(false);
      resetLabForm();
      toast.success(t('lab_created'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_create_lab')),
  });

  const updateLabMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCustomLabData }) =>
      customLabsApi.updateLab(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowEditModal(false);
      setSelectedLab(null);
      toast.success(t('lab_updated'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_update_lab')),
  });

  const deleteLabMutation = useMutation({
    mutationFn: customLabsApi.deleteLab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowDeleteModal(false);
      setSelectedLab(null);
      toast.success(t('lab_deleted'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_delete_lab')),
  });

  const addTemplateMutation = useMutation({
    mutationFn: ({ labId, data }: { labId: number; data: typeof templateForm }) =>
      customLabsApi.addTemplate(labId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowTemplateModal(false);
      resetTemplateForm();
      toast.success(t('template_added'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_add_template')),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({
      labId,
      templateId,
      data,
    }: {
      labId: number;
      templateId: number;
      data: typeof templateForm;
    }) => customLabsApi.updateTemplate(labId, templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      toast.success(t('template_updated'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_update_template')),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: ({ labId, templateId }: { labId: number; templateId: number }) =>
      customLabsApi.deleteTemplate(labId, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      toast.success(t('template_deleted'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_delete_template')),
  });

  const assignLabMutation = useMutation({
    mutationFn: ({ labId, courseId }: { labId: number; courseId: number }) =>
      customLabsApi.assignToCourse(labId, { courseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      setShowAssignModal(false);
      setAssignCourseId(null);
      toast.success(t('lab_assigned'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_assign_lab')),
  });

  const unassignLabMutation = useMutation({
    mutationFn: ({ labId, courseId }: { labId: number; courseId: number }) =>
      customLabsApi.unassignFromCourse(labId, courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
      toast.success(t('lab_unassigned'));
    },
    onError: (error: Error) =>
      toast.error(error.message || t('failed_to_unassign_lab')),
  });

  const reorderTemplatesMutation = useMutation({
    mutationFn: ({ labId, templateIds }: { labId: number; templateIds: number[] }) =>
      customLabsApi.reorderTemplates(labId, templateIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLabs'] });
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Failed to reorder templates'),
  });

  const resetLabForm = () =>
    setLabForm({
      name: '',
      description: '',
      labType: 'tna',
      isPublic: false,
      addDefaultTemplates: true,
    });

  const resetTemplateForm = () =>
    setTemplateForm({ title: '', description: '', code: '' });

  const openEditModal = (lab: CustomLab) => {
    setSelectedLab(lab);
    setLabForm({
      name: lab.name,
      description: lab.description || '',
      labType: lab.labType,
      isPublic: lab.isPublic,
      addDefaultTemplates: false,
    });
    setShowEditModal(true);
  };

  const openTemplatesPanel = (lab: CustomLab) => {
    setSelectedLab(lab);
    setShowTemplatesPanel(true);
  };

  // Keep selectedLab in sync with the cached query so the templates
  // panel re-renders when templates are added / edited / reordered.
  const liveSelectedLab =
    showTemplatesPanel && selectedLab
      ? labs.find((l: CustomLab) => l.id === selectedLab.id) || selectedLab
      : selectedLab;

  const openTemplateModal = (lab: CustomLab, template?: LabTemplate) => {
    setSelectedLab(lab);
    setSelectedTemplate(template || null);
    setTemplateForm({
      title: template?.title || '',
      description: template?.description || '',
      code: template?.code || '',
    });
    setShowTemplateModal(true);
  };

  const openAssignModal = (lab: CustomLab) => {
    setSelectedLab(lab);
    setAssignCourseId(null);
    setShowAssignModal(true);
  };

  const openDeleteModal = (lab: CustomLab) => {
    setSelectedLab(lab);
    setShowDeleteModal(true);
  };

  const handleSaveTemplate = () => {
    if (!selectedLab) return;
    if (selectedTemplate) {
      updateTemplateMutation.mutate({
        labId: selectedLab.id,
        templateId: selectedTemplate.id,
        data: templateForm,
      });
    } else {
      addTemplateMutation.mutate({ labId: selectedLab.id, data: templateForm });
    }
  };

  const moveTemplate = (
    lab: CustomLab,
    templateId: number,
    direction: 'up' | 'down',
  ) => {
    if (!lab.templates) return;
    const sorted = [...lab.templates].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = sorted.findIndex(tpl => tpl.id === templateId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
    reorderTemplatesMutation.mutate({
      labId: lab.id,
      templateIds: sorted.map(tpl => tpl.id),
    });
  };

  const columns: ColumnDef<CustomLab>[] = [
    {
      id: 'name',
      header: t('common:name', { defaultValue: 'Name' }),
      sortAccessor: l => l.name.toLowerCase(),
      width: '32%',
      cell: l => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p
              className="text-sm truncate text-gray-700 dark:text-gray-200"
              title={l.name}
            >
              {l.name}
            </p>
            {l.description && (
              <p
                className="text-xs truncate text-gray-500 dark:text-gray-400"
                title={l.description}
              >
                {l.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'type',
      header: t('lab_type', { defaultValue: 'Type' }),
      sortAccessor: l => l.labType,
      width: '8rem',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options:
          labTypes?.map((tp: LabType) => ({ value: tp.id, label: tp.name })) ??
          [],
        predicate: (l, v) => l.labType === v,
      },
      cell: l => (
        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
          {l.labType}
        </span>
      ),
    },
    {
      id: 'templates',
      header: t('templates'),
      sortAccessor: l => l._count?.templates ?? 0,
      align: 'right',
      width: '5.5rem',
      cell: l => (
        <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 tabular-nums">
          <Code className="w-3.5 h-3.5" />
          {l._count?.templates ?? 0}
        </span>
      ),
    },
    {
      id: 'courses',
      header: t('courses_count'),
      sortAccessor: l => l._count?.assignments ?? 0,
      align: 'right',
      width: '5.5rem',
      hideOnMobile: true,
      cell: l => (
        <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
          {l._count?.assignments ?? 0}
        </span>
      ),
    },
    {
      id: 'visibility',
      header: t('visibility', { defaultValue: 'Visibility' }),
      sortAccessor: l => (l.isPublic ? 'public' : 'private'),
      width: '7rem',
      hideOnMobile: true,
      filter: {
        kind: 'select',
        options: [
          { value: 'public', label: t('public') },
          { value: 'private', label: t('private') },
        ],
        predicate: (l, v) => (l.isPublic ? 'public' : 'private') === v,
      },
      cell: l =>
        l.isPublic ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <Globe className="w-3.5 h-3.5" />
            {t('public')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            {t('private')}
          </span>
        ),
    },
    {
      id: 'created',
      header: t('created', { defaultValue: 'Created' }),
      sortAccessor: l => new Date(l.createdAt).getTime(),
      align: 'right',
      width: '7rem',
      hideOnMobile: true,
      cell: l => (
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
          {new Date(l.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb homeHref="/" items={[{ label: t('navigation:labs') }]} />
      </div>

      <DataTable<CustomLab>
        rows={labs}
        columns={columns}
        rowKey={l => l.id}
        isLoading={labsLoading}
        pageSize={20}
        globalSearch={{
          placeholder: t('search_labs', {
            defaultValue: 'Search labs by name or description…',
          }),
          predicate: (l, q) => {
            const x = q.toLowerCase();
            return (
              l.name.toLowerCase().includes(x) ||
              (l.description || '').toLowerCase().includes(x)
            );
          },
        }}
        createCta={{
          label: t('create_lab'),
          icon: <Plus className="w-4 h-4" />,
          onClick: () => setShowCreateModal(true),
        }}
        rowActions={l => (
          <RowMenu
            items={[
              {
                key: 'preview',
                label: t('preview'),
                icon: <Eye className="w-3.5 h-3.5" />,
                onClick: () => navigate(`/labs/${l.id}`),
              },
              {
                key: 'templates',
                label: t('templates_title'),
                icon: <Layers className="w-3.5 h-3.5" />,
                onClick: () => openTemplatesPanel(l),
              },
              {
                key: 'assign',
                label: t('assign'),
                icon: <BookOpen className="w-3.5 h-3.5" />,
                onClick: () => openAssignModal(l),
              },
              {
                key: 'edit',
                label: t('common:edit', { defaultValue: 'Edit' }),
                icon: <Pencil className="w-3.5 h-3.5" />,
                onClick: () => openEditModal(l),
              },
              {
                key: 'delete',
                label: t('common:delete', { defaultValue: 'Delete' }),
                icon: <Trash2 className="w-3.5 h-3.5" />,
                onClick: () => openDeleteModal(l),
                destructive: true,
              },
            ]}
          />
        )}
      />

      {/* Create Lab */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('create_new_lab')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls}>{t('lab_name')} *</label>
            <input
              type="text"
              value={labForm.name}
              onChange={e => setLabForm({ ...labForm, name: e.target.value })}
              className={inputCls}
              placeholder="e.g., TNA Lab — Network Analysis"
            />
          </div>
          <div>
            <label className={labelCls}>{t('common:description')}</label>
            <textarea
              value={labForm.description}
              onChange={e =>
                setLabForm({ ...labForm, description: e.target.value })
              }
              className={inputCls}
              rows={3}
            />
          </div>
          <div>
            <label className={labelCls}>{t('lab_type')} *</label>
            <select
              value={labForm.labType}
              onChange={e => setLabForm({ ...labForm, labType: e.target.value })}
              className={inputCls}
            >
              {labTypes?.map((tp: LabType) => (
                <option key={tp.id} value={tp.id} disabled={tp.disabled}>
                  {tp.name} {tp.disabled ? `(${t('coming_soon')})` : ''}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-100">
            <input
              type="checkbox"
              checked={labForm.addDefaultTemplates}
              onChange={e =>
                setLabForm({ ...labForm, addDefaultTemplates: e.target.checked })
              }
              className="w-4 h-4 rounded text-emerald-500"
            />
            {t('add_default_templates')}
          </label>
          <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-100">
            <input
              type="checkbox"
              checked={labForm.isPublic}
              onChange={e =>
                setLabForm({ ...labForm, isPublic: e.target.checked })
              }
              className="w-4 h-4 rounded text-emerald-500"
            />
            {t('make_lab_public')}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('common:cancel')}
            </Button>
            <Button
              onClick={() => createLabMutation.mutate(labForm)}
              disabled={!labForm.name || createLabMutation.isPending}
              icon={
                createLabMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )
              }
            >
              {createLabMutation.isPending ? t('creating') : t('create_lab')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Lab */}
      <Modal
        isOpen={showEditModal && !!selectedLab}
        onClose={() => setShowEditModal(false)}
        title={t('edit_lab')}
        size="lg"
      >
        {selectedLab && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('lab_name')} *</label>
              <input
                type="text"
                value={labForm.name}
                onChange={e => setLabForm({ ...labForm, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('common:description')}</label>
              <textarea
                value={labForm.description}
                onChange={e =>
                  setLabForm({ ...labForm, description: e.target.value })
                }
                className={inputCls}
                rows={3}
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                checked={labForm.isPublic}
                onChange={e =>
                  setLabForm({ ...labForm, isPublic: e.target.checked })
                }
                className="w-4 h-4 rounded text-emerald-500"
              />
              {t('make_lab_public')}
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                {t('common:cancel')}
              </Button>
              <Button
                onClick={() =>
                  updateLabMutation.mutate({
                    id: selectedLab.id,
                    data: {
                      name: labForm.name,
                      description: labForm.description,
                      isPublic: labForm.isPublic,
                    },
                  })
                }
                disabled={!labForm.name || updateLabMutation.isPending}
                icon={<Save className="w-4 h-4" />}
              >
                {updateLabMutation.isPending ? t('saving') : t('save_changes')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Lab */}
      <Modal
        isOpen={showDeleteModal && !!selectedLab}
        onClose={() => setShowDeleteModal(false)}
        title={t('delete_lab')}
      >
        {selectedLab && (
          <>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              {t('delete_lab_confirm', { name: selectedLab.name })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                {t('common:cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteLabMutation.mutate(selectedLab.id)}
                disabled={deleteLabMutation.isPending}
                icon={<Trash2 className="w-4 h-4" />}
              >
                {deleteLabMutation.isPending ? t('deleting') : t('delete_lab')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Manage Templates panel */}
      <Modal
        isOpen={showTemplatesPanel && !!liveSelectedLab}
        onClose={() => setShowTemplatesPanel(false)}
        title={liveSelectedLab ? `${liveSelectedLab.name} — ${t('templates_title')}` : t('templates_title')}
        size="3xl"
      >
        {liveSelectedLab && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => openTemplateModal(liveSelectedLab)}
                icon={<Plus className="w-4 h-4" />}
              >
                {t('add_template')}
              </Button>
            </div>

            {liveSelectedLab.templates && liveSelectedLab.templates.length > 0 ? (
              <div className="space-y-2">
                {[...liveSelectedLab.templates]
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((tpl, idx, arr) => (
                    <div
                      key={tpl.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    >
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveTemplate(liveSelectedLab, tpl.id, 'up')}
                          disabled={idx === 0 || reorderTemplatesMutation.isPending}
                          className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => moveTemplate(liveSelectedLab, tpl.id, 'down')}
                          disabled={
                            idx === arr.length - 1 ||
                            reorderTemplatesMutation.isPending
                          }
                          className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                          {tpl.title}
                        </p>
                        {tpl.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {tpl.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openTemplateModal(liveSelectedLab, tpl)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                          title={t('common:edit')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            deleteTemplateMutation.mutate({
                              labId: liveSelectedLab.id,
                              templateId: tpl.id,
                            })
                          }
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 hover:text-red-600"
                          title={t('common:delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                {t('no_templates_description')}
              </p>
            )}

            {liveSelectedLab.assignments && liveSelectedLab.assignments.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-medium mb-2 text-gray-800 dark:text-gray-100 text-sm">
                  {t('assigned_courses')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {liveSelectedLab.assignments.map(a => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      {a.course?.title}
                      <button
                        onClick={() =>
                          unassignLabMutation.mutate({
                            labId: liveSelectedLab.id,
                            courseId: a.courseId,
                          })
                        }
                        className="hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add / Edit Template */}
      <Modal
        isOpen={showTemplateModal && !!selectedLab}
        onClose={() => setShowTemplateModal(false)}
        title={selectedTemplate ? t('edit_template') : t('add_template')}
        size="2xl"
      >
        {selectedLab && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('common:title')} *</label>
              <input
                type="text"
                value={templateForm.title}
                onChange={e =>
                  setTemplateForm({ ...templateForm, title: e.target.value })
                }
                className={inputCls}
                placeholder="e.g., Load Data"
              />
            </div>
            <div>
              <label className={labelCls}>{t('common:description')}</label>
              <input
                type="text"
                value={templateForm.description}
                onChange={e =>
                  setTemplateForm({
                    ...templateForm,
                    description: e.target.value,
                  })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t('r_code')} *</label>
              <textarea
                value={templateForm.code}
                onChange={e =>
                  setTemplateForm({ ...templateForm, code: e.target.value })
                }
                className={`${inputCls} font-mono text-sm`}
                rows={10}
                placeholder="# Enter R code here..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowTemplateModal(false)}
              >
                {t('common:cancel')}
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={
                  !templateForm.title ||
                  !templateForm.code ||
                  addTemplateMutation.isPending ||
                  updateTemplateMutation.isPending
                }
                icon={<Save className="w-4 h-4" />}
              >
                {addTemplateMutation.isPending ||
                updateTemplateMutation.isPending
                  ? t('saving')
                  : t('save_template')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign to Course */}
      <Modal
        isOpen={showAssignModal && !!selectedLab}
        onClose={() => setShowAssignModal(false)}
        title={t('assign_lab_to_course')}
      >
        {selectedLab && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('select_course_to_assign', { name: selectedLab.name })}
            </p>
            <div>
              <label className={labelCls}>{t('course')}</label>
              <select
                value={assignCourseId || ''}
                onChange={e =>
                  setAssignCourseId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className={inputCls}
              >
                <option value="">{t('select_course_placeholder')}</option>
                {myCourses?.map((course: Course) => {
                  const isAlreadyAssigned = selectedLab.assignments?.some(
                    a => a.courseId === course.id,
                  );
                  return (
                    <option
                      key={course.id}
                      value={course.id}
                      disabled={isAlreadyAssigned}
                    >
                      {course.title}{' '}
                      {isAlreadyAssigned ? `(${t('already_assigned')})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAssignModal(false)}
              >
                {t('common:cancel')}
              </Button>
              <Button
                onClick={() =>
                  selectedLab &&
                  assignCourseId &&
                  assignLabMutation.mutate({
                    labId: selectedLab.id,
                    courseId: assignCourseId,
                  })
                }
                disabled={!assignCourseId || assignLabMutation.isPending}
                icon={<BookOpen className="w-4 h-4" />}
              >
                {assignLabMutation.isPending
                  ? t('assigning')
                  : t('assign_to_course')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
