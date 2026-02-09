import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Plus, Edit, Trash2, Users, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Loading } from '../../components/common/Loading';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { buildTeachingBreadcrumb } from '../../utils/breadcrumbs';
import apiClient from '../../api/client';
import { forumsApi, CreateForumInput, Forum } from '../../api/forums';

interface CourseInfo {
  id: number;
  title: string;
}

export const CourseForumManager = () => {
  const { t } = useTranslation(['teaching', 'common']);
  const { id: courseId } = useParams<{ id: string }>();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingForum, setEditingForum] = useState<Forum | null>(null);
  const [formData, setFormData] = useState<CreateForumInput>({
    title: '',
    description: '',
    isPublished: true,
    allowAnonymous: false,
  });

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#088F8F',
  };

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: CourseInfo }>(`/courses/${courseId}`);
      return response.data.data;
    },
  });

  const { data: forums, isLoading } = useQuery({
    queryKey: ['forums', 'course', courseId],
    queryFn: () => forumsApi.getForums(parseInt(courseId!)),
    enabled: !!courseId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForumInput) => forumsApi.createForum(parseInt(courseId!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'course', courseId] });
      setShowCreateModal(false);
      resetForm();
      toast.success(t('forum_created_success'));
    },
    onError: () => toast.error(t('failed_create_forum')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateForumInput> }) =>
      forumsApi.updateForum(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'course', courseId] });
      setEditingForum(null);
      resetForm();
      toast.success(t('forum_updated_success'));
    },
    onError: () => toast.error(t('failed_update_forum')),
  });

  const deleteMutation = useMutation({
    mutationFn: forumsApi.deleteForum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'course', courseId] });
      toast.success(t('forum_deleted_success'));
    },
    onError: () => toast.error(t('failed_delete_forum')),
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      isPublished: true,
      allowAnonymous: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingForum) {
      updateMutation.mutate({ id: editingForum.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditModal = (forum: Forum) => {
    setEditingForum(forum);
    setFormData({
      title: forum.title,
      description: forum.description || '',
      isPublished: forum.isPublished,
      allowAnonymous: forum.allowAnonymous,
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingForum(null);
    resetForm();
  };

  if (isLoading) {
    return <Loading text={t('loading_forums')} />;
  }

  const breadcrumbItems = buildTeachingBreadcrumb(courseId, course?.title || 'Course', 'Forums');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb navigation */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
            {t('forum_manager')}
          </h1>
          {course && (
            <p className="mt-2" style={{ color: colors.textSecondary }}>
              {t('manage_forums_for', { course: course.title })}
            </p>
          )}
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('new_forum')}
        </Button>
      </div>

      {!forums || forums.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('no_forums_created')}
            </h3>
            <p style={{ color: colors.textSecondary }}>
              {t('create_forums_desc')}
            </p>
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('create_forum_btn')}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {forums.map((forum) => (
            <Card key={forum.id}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5" style={{ color: colors.accent }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                        {forum.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          forum.isPublished
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}
                      >
                        {forum.isPublished ? t('published') : t('draft')}
                      </span>
                    </div>
                    {forum.description && (
                      <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                        {forum.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/courses/${courseId}/forums/${forum.id}`}>
                    <Button variant="ghost" size="sm" title={t('view_forum')}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(forum)}
                    title={t('edit')}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(t('delete_forum_threads_warning'))) {
                        deleteMutation.mutate(forum.id);
                      }
                    }}
                    title={t('common:delete')}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </CardHeader>
              <CardBody>
                <div className="flex items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{forum._count?.threads || 0} threads</span>
                  </div>
                  {forum.allowAnonymous && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                      {t('anonymous_allowed')}
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || !!editingForum}
        onClose={closeModal}
        title={editingForum ? t('edit_forum') : t('create_forum_title')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('forum_title_label')}
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
              placeholder={t('forum_title_placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textPrimary }}>
              {t('description_label')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border"
              style={{
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                color: colors.textPrimary,
              }}
              rows={3}
              placeholder={t('forum_description_placeholder')}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm" style={{ color: colors.textPrimary }}>
                {t('published')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowAnonymous}
                onChange={(e) => setFormData({ ...formData, allowAnonymous: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm" style={{ color: colors.textPrimary }}>
                {t('allow_anonymous_posts')}
              </span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingForum ? t('update_forum') : t('create_forum_btn')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
