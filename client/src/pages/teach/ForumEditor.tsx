import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { forumsApi } from '../../api/forums';
import { coursesApi } from '../../api/courses';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { Input } from '../../components/common/Input';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { RichTextEditor } from '../../components/forum/RichTextEditor';

const blankForm = () => ({ title: '', content: '', isPublished: true, allowAnonymous: false });

/**
 * Single create + edit page for a discussion/forum (no popups). Mode is
 * driven by the route params:
 *   - edit:   /teach/courses/:id/forums/:forumId/edit
 *   - create: /teach/courses/:id/modules/:moduleId/forums/new
 * Nothing is written to the database until the user clicks Save.
 */
export const ForumEditor = () => {
  const { t } = useTranslation(['teaching', 'common', 'courses']);
  const { id, forumId, moduleId } = useParams<{ id: string; forumId?: string; moduleId?: string }>();
  const courseId = parseInt(id!, 10);
  const fId = forumId ? parseInt(forumId, 10) : null;
  const isNew = fId == null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(blankForm());

  const { data: thread, isLoading } = useQuery({
    queryKey: ['thread', fId],
    queryFn: () => forumsApi.getThread(fId!),
    enabled: !isNew && !!fId,
  });
  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId),
    enabled: !!courseId,
  });

  useEffect(() => {
    if (thread) {
      setForm({
        title: thread.title || '',
        content: thread.content || '',
        isPublished: thread.isPublished ?? true,
        allowAnonymous: (thread as { allowAnonymous?: boolean }).allowAnonymous ?? false,
      });
    }
  }, [thread]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
  };

  const createMutation = useMutation({
    mutationFn: (f: typeof form) => forumsApi.createForum(courseId, { ...f, moduleId: moduleId ? Number(moduleId) : undefined }),
    onSuccess: (created) => {
      refresh();
      toast.success(t('forum_created', { defaultValue: 'Discussion created' }));
      navigate(`/teach/courses/${courseId}/forums/${created.id}/edit`, { replace: true });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? t('common:error')),
  });

  const updateMutation = useMutation({
    mutationFn: (f: typeof form) => forumsApi.updateForum(fId!, f),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread', fId] });
      refresh();
      toast.success(t('common:saved', { defaultValue: 'Saved' }));
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? t('common:error')),
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      toast.error(t('title_required', { defaultValue: 'Title is required' }));
      return;
    }
    (isNew ? createMutation : updateMutation).mutate(form);
  };

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  if (!isNew && isLoading) return <Loading fullScreen text={t('common:loading', { defaultValue: 'Loading…' })} />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: t('courses:courses', { defaultValue: 'Courses' }), href: '/courses' },
            { label: course?.title || t('courses:course', { defaultValue: 'Course' }), href: `/courses/${courseId}` },
            { label: isNew ? t('new_forum', { defaultValue: 'New discussion' }) : t('edit_forum', { defaultValue: 'Edit Discussion' }) },
          ]}
        />
      </div>

      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={form.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              onClick={() => set('isPublished', !form.isPublished)}
            >
              {form.isPublished
                ? t('common:published', { defaultValue: 'Published' })
                : t('common:draft', { defaultValue: 'Draft' })}
            </Button>
            <Button size="sm" icon={<Save className="w-4 h-4" />} onClick={handleSave} loading={createMutation.isPending || updateMutation.isPending}>
              {isNew ? t('common:create', { defaultValue: 'Create' }) : t('common:save', { defaultValue: 'Save' })}
            </Button>
          </div>

          <Input
            label={t('forum_title', { defaultValue: 'Discussion title' })}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('common:description', { defaultValue: 'Description' })}
            </label>
            <RichTextEditor value={form.content} onChange={v => set('content', v)} />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.allowAnonymous}
              onChange={e => set('allowAnonymous', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            {t('allow_anonymous', { defaultValue: 'Allow anonymous posts' })}
          </label>
        </CardBody>
      </Card>
    </div>
  );
};
