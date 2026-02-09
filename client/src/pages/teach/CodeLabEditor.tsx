import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Plus, FlaskConical, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { codeLabsApi } from '../../api/codeLabs';
import { coursesApi } from '../../api/courses';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Input, TextArea } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CodeBlockEditor } from '../../components/teach/CodeBlockEditor';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import { UpdateCodeBlockData } from '../../types';

export const CodeLabEditor = () => {
  const { t } = useTranslation('teaching');
  const { id, codeLabId } = useParams<{ id: string; codeLabId: string }>();
  const courseId = parseInt(id!, 10);
  const labId = parseInt(codeLabId!, 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isPublished: false,
  });
  const [deleteBlockConfirm, setDeleteBlockConfirm] = useState<number | null>(null);

  // Query for code lab data
  const { data: codeLab, isLoading } = useQuery({
    queryKey: ['codeLab', labId],
    queryFn: () => codeLabsApi.getCodeLabById(labId),
    enabled: !!labId,
  });

  // Query for course data (for context)
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  useEffect(() => {
    if (codeLab) {
      setFormData({
        title: codeLab.title || '',
        description: codeLab.description || '',
        isPublished: codeLab.isPublished || false,
      });
    }
  }, [codeLab]);

  // Mutations
  const updateCodeLabMutation = useMutation({
    mutationFn: (data: typeof formData) => codeLabsApi.updateCodeLab(labId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      queryClient.invalidateQueries({ queryKey: ['courseModules', courseId] });
      toast.success(t('code_lab_saved'));
    },
    onError: () => toast.error(t('failed_to_save_code_lab')),
  });

  const createBlockMutation = useMutation({
    mutationFn: () => codeLabsApi.createCodeBlock(labId, { title: 'New Code Block' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      toast.success(t('code_block_added'));
    },
    onError: () => toast.error(t('failed_to_add_code_block')),
  });

  const updateBlockMutation = useMutation({
    mutationFn: ({ blockId, data }: { blockId: number; data: UpdateCodeBlockData }) =>
      codeLabsApi.updateCodeBlock(labId, blockId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
    },
    onError: () => toast.error(t('failed_to_update_code_block')),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: number) => codeLabsApi.deleteCodeBlock(labId, blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codeLab', labId] });
      toast.success(t('code_block_deleted'));
      setDeleteBlockConfirm(null);
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

  const handleUpdateBlock = (blockId: number, data: UpdateCodeBlockData) => {
    updateBlockMutation.mutate({ blockId, data });
  };

  const handleDeleteBlock = (blockId: number) => {
    setDeleteBlockConfirm(blockId);
  };

  const handleMoveBlock = (blockId: number, direction: 'up' | 'down') => {
    if (!codeLab?.blocks) return;

    const blocks = [...codeLab.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
    const currentIndex = blocks.findIndex(b => b.id === blockId);

    if (direction === 'up' && currentIndex > 0) {
      const newOrder = [...blocks];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
        newOrder[currentIndex],
        newOrder[currentIndex - 1],
      ];
      reorderBlocksMutation.mutate(newOrder.map(b => b.id));
    } else if (direction === 'down' && currentIndex < blocks.length - 1) {
      const newOrder = [...blocks];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
        newOrder[currentIndex + 1],
        newOrder[currentIndex],
      ];
      reorderBlocksMutation.mutate(newOrder.map(b => b.id));
    }
  };

  const togglePublish = () => {
    const newPublished = !formData.isPublished;
    setFormData(prev => ({ ...prev, isPublished: newPublished }));
    updateCodeLabMutation.mutate({ ...formData, isPublished: newPublished });
  };

  if (isLoading) {
    return <Loading fullScreen text={t('loading_code_lab')} />;
  }

  if (!codeLab) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('code_lab_not_found')}</h1>
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={togglePublish}
            icon={formData.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          >
            {formData.isPublished ? t('unpublish') : t('publish')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            loading={updateCodeLabMutation.isPending}
            icon={<Save className="w-4 h-4" />}
          >
            {t('save')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Code Lab Title */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-emerald-600" />
                <h1 className="text-xl font-semibold text-gray-900">{t('edit_code_lab')}</h1>
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
            </CardBody>
          </Card>

          {/* Code Blocks */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('code_blocks')}</h2>
                <p className="text-sm text-gray-500">
                  {t('code_blocks_description')}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => createBlockMutation.mutate()}
                loading={createBlockMutation.isPending}
                icon={<Plus className="w-4 h-4" />}
              >
                {t('add_block')}
              </Button>
            </CardHeader>
            <CardBody>
              {blocks.length > 0 ? (
                <div className="space-y-4">
                  {blocks.map((block, index) => (
                    <CodeBlockEditor
                      key={block.id}
                      block={block}
                      index={index}
                      totalBlocks={blocks.length}
                      onUpdate={handleUpdateBlock}
                      onDelete={handleDeleteBlock}
                      onMoveUp={(id) => handleMoveBlock(id, 'up')}
                      onMoveDown={(id) => handleMoveBlock(id, 'down')}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FlaskConical}
                  title={t('no_code_blocks_yet')}
                  description={t('no_code_blocks_description')}
                  action={{
                    label: t('add_code_block'),
                    onClick: () => createBlockMutation.mutate(),
                  }}
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">{t('code_lab_info')}</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('course')}</span>
                <span className="font-medium text-gray-900">{course?.title || t('loading')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('blocks_count')}</span>
                <span className="font-medium text-gray-900">{blocks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('status')}</span>
                <span className={`font-medium ${formData.isPublished ? 'text-green-600' : 'text-amber-600'}`}>
                  {formData.isPublished ? t('published') : t('draft')}
                </span>
              </div>
            </CardBody>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">{t('tips')}</h2>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{t('tip_focus_concept')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{t('tip_clear_instructions')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{t('tip_starter_code')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{t('tip_blocks_order')}</span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Block Confirmation */}
      <ConfirmDialog
        isOpen={deleteBlockConfirm !== null}
        onClose={() => setDeleteBlockConfirm(null)}
        onConfirm={() => deleteBlockConfirm && deleteBlockMutation.mutate(deleteBlockConfirm)}
        title={t('delete_code_block')}
        message={t('delete_code_block_confirm')}
        confirmText={t('common:delete')}
        loading={deleteBlockMutation.isPending}
      />
    </div>
  );
};
