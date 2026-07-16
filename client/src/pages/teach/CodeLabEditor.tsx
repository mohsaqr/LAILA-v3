import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Plus, FlaskConical, Beaker, Network, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { codeLabsApi } from '../../api/codeLabs';
import { chatbotsApi } from '../../api/chat';
import { useWebR } from '../../hooks/useWebR';
import { LabNotebook } from '../../components/labs/notebook/LabNotebook';
import { blockToCell, cellPatchToBlock } from '../../components/labs/authoring/cell';
import type { CodeBlock } from '../../types';
import { coursesApi } from '../../api/courses';
import { customLabsApi } from '../../api/customLabs';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Toggle } from '../../components/common/Toggle';
import { Loading } from '../../components/common/Loading';
import { Input, TextArea } from '../../components/common/Input';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { UpdateCodeBlockData } from '../../types';
import activityLogger from '../../services/activityLogger';

export const CodeLabEditor = () => {
  const { t } = useTranslation('teaching');
  const { id, codeLabId, moduleId } = useParams<{ id: string; codeLabId?: string; moduleId?: string }>();
  const courseId = parseInt(id!, 10);
  const isNew = !codeLabId;
  const labId = codeLabId ? parseInt(codeLabId, 10) : NaN;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isPublished: false,
    aiChatbotId: null as number | null,
  });

  // Query for code lab data
  const { data: codeLab, isLoading } = useQuery({
    queryKey: ['codeLab', labId],
    queryFn: () => codeLabsApi.getCodeLabById(labId),
    enabled: !isNew && !!labId,
  });

  // Query for course data (for context)
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  useEffect(() => {
    if (labId && courseId) {
      activityLogger.logCodeLabEditorViewed(labId, undefined, courseId);
    }
  }, [labId, courseId]);

  useEffect(() => {
    if (codeLab) {
      setFormData({
        title: codeLab.title || '',
        description: codeLab.description || '',
        isPublished: codeLab.isPublished || false,
        aiChatbotId: codeLab.aiChatbotId ?? null,
      });
    }
  }, [codeLab]);

  // Mutations
  const updateCodeLabMutation = useMutation({
    mutationFn: (data: typeof formData) => codeLabsApi.updateCodeLab(labId, data),
    onSuccess: () => {
      activityLogger.logCodeLabUpdated(labId, formData.title, courseId);
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success(t('code_lab_saved'));
    },
    onError: () => toast.error(t('failed_to_save_code_lab')),
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, data }: { blockId: number; data: UpdateCodeBlockData }) =>
      codeLabsApi.updateCodeBlock(labId, blockId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      toast.success(t('code_block_saved', { defaultValue: 'Cell saved' }));
    },
    onError: () => toast.error(t('failed_to_update_code_block')),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: number) => codeLabsApi.deleteCodeBlock(labId, blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      toast.success(t('code_block_deleted'));
    },
    onError: () => toast.error(t('failed_to_delete_code_block')),
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: (blockIds: number[]) => codeLabsApi.reorderCodeBlocks(labId, blockIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
    },
    onError: () => toast.error(t('failed_to_reorder_blocks')),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      codeLabsApi.createCodeLab({
        moduleId: Number(moduleId),
        title: formData.title.trim(),
        description: formData.description,
        isPublished: formData.isPublished,
      }),
    onSuccess: (created: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      toast.success(t('code_lab_created', { defaultValue: 'Code lab created' }));
      navigate(`/teach/courses/${courseId}/code-labs/${created.id}`, { replace: true });
    },
    onError: () => toast.error(t('failed_to_save_code_lab')),
  });

  // ─── Create-mode: pick blank / template / interactive lab ────────────────
  const [createTab, setCreateTab] = useState<'create' | 'templates' | 'interactive'>('create');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [selectedInteractive, setSelectedInteractive] = useState<string | null>(null);
  // Assignment mode for a selected lab template — optionally turns the lab
  // into a graded assignment (prompt / points / due date / grace period).
  const [labAssignmentForm, setLabAssignmentForm] = useState({
    enableAssignment: false,
    prompt: '',
    points: 100,
    dueDate: '',
    gracePeriodDeadline: '',
  });
  const setLabAssignment = <K extends keyof typeof labAssignmentForm>(key: K, value: (typeof labAssignmentForm)[K]) =>
    setLabAssignmentForm(prev => ({ ...prev, [key]: value }));

  const { data: availableLabs } = useQuery({
    queryKey: ['availableLabs'],
    queryFn: () => customLabsApi.getLabs(),
    enabled: isNew,
  });

  const backToCourse = () => navigate(`/courses/${courseId}`);

  const assignTemplateMutation = useMutation({
    mutationFn: (labId: number) =>
      customLabsApi.assignToCourse(labId, {
        courseId,
        moduleId: Number(moduleId),
        enableAssignment: labAssignmentForm.enableAssignment,
        prompt: labAssignmentForm.enableAssignment ? labAssignmentForm.prompt : undefined,
        points: labAssignmentForm.enableAssignment ? labAssignmentForm.points : undefined,
        dueDate: labAssignmentForm.enableAssignment && labAssignmentForm.dueDate ? labAssignmentForm.dueDate + ':00.000Z' : undefined,
        gracePeriodDeadline: labAssignmentForm.enableAssignment && labAssignmentForm.gracePeriodDeadline ? labAssignmentForm.gracePeriodDeadline + ':00.000Z' : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      toast.success(t('lab_template_added', { defaultValue: 'Lab template added' }));
      backToCourse();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? t('failed_to_add_lab_template', { defaultValue: 'Failed to add lab template' })),
  });

  const addInteractiveMutation = useMutation({
    mutationFn: (key: string) => {
      const mod = course?.modules?.find(m => m.id === Number(moduleId));
      const existing = (mod as { interactiveLabs?: string } | undefined)?.interactiveLabs
        ? (mod as { interactiveLabs?: string }).interactiveLabs!.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const next = Array.from(new Set([...existing, key])).join(',');
      return coursesApi.updateModule(Number(moduleId), { interactiveLabs: next } as never);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      toast.success(t('lab_template_added', { defaultValue: 'Lab added' }));
      backToCourse();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? t('common:error', { defaultValue: 'Something went wrong' })),
  });

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error(t('title_required'));
      return;
    }
    updateCodeLabMutation.mutate(formData);
  };

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdateBlock = useCallback(
    (blockId: number, data: UpdateCodeBlockData) => {
      updateBlockMutation.mutate({ blockId, data });
    },
    [updateBlockMutation]
  );

  const webR = useWebR();

  const { data: chatbots = [] } = useQuery({
    queryKey: ['chatbots'],
    queryFn: () => chatbotsApi.getChatbots(),
  });

  const addBlockMutation = useMutation({
    mutationFn: ({ position, cellType }: { position: number; cellType: 'code' | 'markdown' }) =>
      codeLabsApi.createCodeBlock(labId, {
        title: cellType === 'markdown' ? 'Text' : 'New Code Block',
        instructions: cellType === 'markdown' ? 'Write your content here…' : undefined,
        position,
        cellType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      toast.success(t('code_block_created', { defaultValue: 'Cell added' }));
    },
    onError: () => toast.error(t('failed_to_create_code_block')),
  });

  const duplicateBlockMutation = useMutation({
    mutationFn: (block: CodeBlock) => {
      const sortedIds = [...(codeLab?.blocks ?? [])]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(b => b.id);
      return codeLabsApi.createCodeBlock(labId, {
        title: `${block.title} (copy)`,
        instructions: block.instructions ?? '',
        starterCode: block.starterCode ?? '',
        locked: block.locked ?? false,
        cellType: block.cellType ?? 'code',
        position: sortedIds.indexOf(block.id) + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      toast.success(t('code_block_duplicated', { defaultValue: 'Cell duplicated' }));
    },
    onError: () => toast.error(t('failed_to_create_code_block')),
  });

  const togglePublish = (newPublished: boolean) => {
    setFormData(prev => ({ ...prev, isPublished: newPublished }));
    updateCodeLabMutation.mutate({ ...formData, isPublished: newPublished });
  };

  if (isNew) {
    const tabs: { key: typeof createTab; label: string; icon: typeof FlaskConical }[] = [
      { key: 'create', label: t('create_new', { defaultValue: 'Create New' }), icon: FlaskConical },
      { key: 'templates', label: t('from_templates', { defaultValue: 'From Templates' }), icon: Beaker },
      { key: 'interactive', label: t('interactive_labs', { defaultValue: 'Interactive Labs' }), icon: Network },
    ];
    const interactiveLabs = [
      { key: 'tna', label: t('interactive_lab_tna', { defaultValue: 'TNA' }), description: t('interactive_lab_tna_desc', { defaultValue: 'Transition Network Analysis — analyze learning sequences and behaviour patterns' }) },
      { key: 'sna', label: t('interactive_lab_sna', { defaultValue: 'SNA' }), description: t('interactive_lab_sna_desc', { defaultValue: 'Social Network Analysis — explore connections and influence within a group' }) },
    ];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: t('navigation:courses', { defaultValue: 'Courses' }), href: '/courses' },
              { label: course?.title || t('course'), href: `/courses/${courseId}` },
              { label: t('new_code_lab', { defaultValue: 'New code lab' }) },
            ]}
          />
        </div>
        <Card>
          {/* Tab row */}
          <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 px-2">
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = createTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCreateTab(key)}
                  className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    active
                      ? 'border-teal-500 text-teal-600 dark:text-teal-300'
                      : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {key === 'templates' && availableLabs && availableLabs.length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{availableLabs.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          <CardBody className="space-y-4">
            {createTab === 'create' && (
              <>
                <Input
                  label={t('code_lab_title')}
                  value={formData.title}
                  onChange={e => handleChange('title', e.target.value)}
                  placeholder={t('code_lab_title_placeholder')}
                  required
                />
                <TextArea
                  label={t('common:description', { defaultValue: 'Description' })}
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                />
                <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Toggle
                    checked={formData.isPublished}
                    onChange={v => handleChange('isPublished', v)}
                    onLabel={t('common:published', { defaultValue: 'Published' })}
                    offLabel={t('common:draft', { defaultValue: 'Draft' })}
                  />
                  <Button
                    icon={<Save className="w-4 h-4" />}
                    loading={createMutation.isPending}
                    onClick={() => {
                      if (!formData.title.trim()) { toast.error(t('title_required')); return; }
                      createMutation.mutate();
                    }}
                  >
                    {t('create', { defaultValue: 'Create' })}
                  </Button>
                </div>
              </>
            )}

            {createTab === 'templates' && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('select_lab_template_description', { defaultValue: 'Select a lab template to add to this module. Students will be able to access the lab and its code templates.' })}
                </p>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {(availableLabs ?? []).map(lab => {
                    const isSelected = selectedTemplate === lab.id;
                    const count = (lab as { _count?: { templates?: number } })._count?.templates ?? lab.templates?.length ?? 0;
                    return (
                      <div
                        key={lab.id}
                        onClick={() => setSelectedTemplate(isSelected ? null : lab.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Beaker className={`w-4 h-4 ${isSelected ? 'text-teal-500' : 'text-gray-400'}`} />
                              <span className="font-medium text-gray-900 dark:text-white">{lab.name}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{lab.labType}</span>
                            </div>
                            {lab.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">{lab.description}</p>}
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-6">{t('n_templates', { count, defaultValue: '{{count}} templates' })}</div>
                          </div>
                          {isSelected && <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>}
                        </div>
                      </div>
                    );
                  })}
                  {(availableLabs ?? []).length === 0 && (
                    <p className="text-sm text-gray-400 py-6 text-center">{t('no_lab_templates', { defaultValue: 'No lab templates available.' })}</p>
                  )}
                </div>

                {/* Assignment mode — shown after a template is selected. Optionally
                    turns the lab into a graded assignment for students. */}
                {selectedTemplate && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <Toggle
                      checked={labAssignmentForm.enableAssignment}
                      onChange={v => setLabAssignment('enableAssignment', v)}
                      label={t('enable_assignment_mode', { defaultValue: 'Enable assignment mode' })}
                    />
                    {labAssignmentForm.enableAssignment && (
                      <div className="space-y-3">
                        <TextArea
                          label={t('lab_instructions', { defaultValue: 'Instructions for students' })}
                          value={labAssignmentForm.prompt}
                          onChange={e => setLabAssignment('prompt', e.target.value)}
                          rows={5}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Input
                            type="number"
                            label={t('points', { defaultValue: 'Points' })}
                            value={String(labAssignmentForm.points)}
                            onChange={e => setLabAssignment('points', Number(e.target.value))}
                            min={0}
                          />
                          <Input
                            type="datetime-local"
                            label={t('due_date', { defaultValue: 'Due date' })}
                            value={labAssignmentForm.dueDate}
                            onChange={e => setLabAssignment('dueDate', e.target.value)}
                          />
                          <Input
                            type="datetime-local"
                            label={t('grace_period_deadline', { defaultValue: 'Grace period deadline' })}
                            value={labAssignmentForm.gracePeriodDeadline}
                            onChange={e => setLabAssignment('gracePeriodDeadline', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    disabled={!selectedTemplate}
                    loading={assignTemplateMutation.isPending}
                    onClick={() => selectedTemplate && assignTemplateMutation.mutate(selectedTemplate)}
                  >
                    {t('add_to_module', { defaultValue: 'Add to module' })}
                  </Button>
                </div>
              </>
            )}

            {createTab === 'interactive' && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('select_lab_template_description', { defaultValue: 'Add an interactive analysis lab to this module.' })}
                </p>
                <div className="space-y-2">
                  {interactiveLabs.map(lab => {
                    const isSelected = selectedInteractive === lab.key;
                    return (
                      <div
                        key={lab.key}
                        onClick={() => setSelectedInteractive(isSelected ? null : lab.key)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Network className={`w-4 h-4 ${isSelected ? 'text-teal-500' : 'text-violet-500'}`} />
                              <span className="font-medium text-gray-900 dark:text-white">{lab.label}</span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">{lab.description}</p>
                          </div>
                          {isSelected && <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    disabled={!selectedInteractive}
                    loading={addInteractiveMutation.isPending}
                    onClick={() => selectedInteractive && addInteractiveMutation.mutate(selectedInteractive)}
                  >
                    {t('add_to_module', { defaultValue: 'Add to module' })}
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <Loading fullScreen text={t('loading_code_lab')} />;
  }

  if (!codeLab) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{t('code_lab_not_found')}</h1>
        <Button onClick={() => navigate(`/teach/courses/${courseId}/curriculum`)}>
          {t('back_to_curriculum')}
        </Button>
      </div>
    );
  }

  const blocks = codeLab.blocks
    ? [...codeLab.blocks].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  const breadcrumbItems = buildTeachingBreadcrumb(id, course?.title || t('course'), t('code_lab'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb homeHref="/" items={breadcrumbItems} />
      </div>

      <div className="space-y-6">
          {/* Code Lab Title */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-emerald-600" />
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{t('edit_code_lab')}</h1>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label={t('code_lab_title')}
                value={formData.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder={t('code_lab_title_placeholder')}
                required
              />
              <TextArea
                label={t('common:description')}
                value={formData.description}
                onChange={e => handleChange('description', e.target.value)}
                placeholder={t('code_lab_description_placeholder')}
                rows={3}
              />
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">
                  {t('ai_assistant', { defaultValue: 'AI Assistant' })}
                </label>
                <select
                  value={formData.aiChatbotId ?? ''}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      aiChatbotId: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">
                    {t('ai_assistant_default', { defaultValue: 'Default tutor (generic)' })}
                  </option>
                  {chatbots
                    .filter((cb: { isActive: boolean }) => cb.isActive)
                    .map((cb: { id: number; displayName: string }) => (
                      <option key={cb.id} value={cb.id}>
                        {cb.displayName}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {t('ai_assistant_hint', {
                    defaultValue: 'Students get an "Ask AI" helper in this lab, driven by the chosen agent.',
                  })}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <Toggle
                  checked={formData.isPublished}
                  onChange={togglePublish}
                  onLabel={t('common:published', { defaultValue: 'Published' })}
                  offLabel={t('common:draft', { defaultValue: 'Draft' })}
                />
                <Button
                  onClick={handleSave}
                  loading={updateCodeLabMutation.isPending}
                  icon={<Save className="w-4 h-4" />}
                >
                  {t('save')}
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Code Blocks — the unified lab notebook */}
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{t('code_blocks')}</h2>
                <p className="text-sm text-gray-500">
                  {t('code_blocks_description')}
                </p>
              </div>
            </CardHeader>
            <CardBody>
              <LabNotebook
                cells={blocks.map(blockToCell)}
                language="r"
                canEdit
                runtime={{
                  isReady: webR.isReady,
                  isExecuting: webR.isExecuting,
                  executeCode: webR.executeCode,
                }}
                onSaveCell={(cellId, patch) => handleUpdateBlock(cellId, cellPatchToBlock(patch))}
                onAddCell={(position, cellType) => addBlockMutation.mutate({ position, cellType })}
                isMutating={
                  addBlockMutation.isPending ||
                  duplicateBlockMutation.isPending ||
                  deleteBlockMutation.isPending ||
                  reorderBlocksMutation.isPending
                }
                onDuplicateCell={cell => {
                  const block = blocks.find(b => b.id === cell.id);
                  if (block) duplicateBlockMutation.mutate(block);
                }}
                onDeleteCell={cell => deleteBlockMutation.mutate(cell.id)}
                onReorder={ids => reorderBlocksMutation.mutate(ids)}
              />
            </CardBody>
          </Card>
      </div>

    </div>
  );
};
