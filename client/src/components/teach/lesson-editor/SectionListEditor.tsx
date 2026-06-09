import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Type, ImagePlus, Video, FileUp, Bot, ListChecks, Loader2, Search, Link2, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { marked } from 'marked';
import { coursesApi } from '../../../api/courses';
import apiClient from '../../../api/client';
import { toEmbedUrl } from '../../../utils/embed';
import { safeEmbedSrc } from './EmbedNodeView';
import { uploadWithProgress } from '../../../utils/upload';
import { getCourseTutors } from '../../../api/courseTutor';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { isHtmlContent } from '../../../utils/sanitize';
import type { LectureSection, CreateSectionData } from '../../../types';
import { SectionCard } from './SectionCard';

interface SectionListEditorProps {
  lectureId: number;
  initialSections: LectureSection[];
  courseId?: number;
  legacyContent?: string;
}

/** Legacy content may be HTML or markdown; normalize to HTML for the editor. */
const legacyToHtml = (c: string): string => (isHtmlContent(c) ? c : (marked.parse(c, { async: false }) as string));

export interface SectionListEditorHandle {
  flush: () => Promise<void>;
}

const byOrder = (a: LectureSection, b: LectureSection) => (a.order ?? 0) - (b.order ?? 0);


/**
 * Stacked, multi-section lesson builder. Each section is its own typed card
 * (text / image / video / file / AI agent / MCQ). Sections are added via the
 * icon row at the bottom — every icon creates a NEW section of that type
 * (nothing is inserted inline). Reorder via drag + arrows.
 */
export const SectionListEditor = forwardRef<SectionListEditorHandle, SectionListEditorProps>((
  { lectureId, initialSections, courseId, legacyContent },
  ref,
) => {
  const { t } = useTranslation(['teaching', 'common']);
  const queryClient = useQueryClient();

  const [sections, setSections] = useState<LectureSection[]>(() => [...initialSections].sort(byOrder));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LectureSection | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flushRegistry = useRef(new Map<number, () => Promise<void>>());
  const makeRegister = (id: number) => (fn: (() => Promise<void>) | null) => {
    if (fn) flushRegistry.current.set(id, fn);
    else flushRegistry.current.delete(id);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lecture', lectureId] });
    queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
  };

  const idsSig = [...initialSections].map(s => s.id).sort((a, b) => a - b).join(',');
  useEffect(() => {
    setSections(prev => {
      const byId = new Map(initialSections.map(s => [s.id, s] as const));
      const kept = prev.filter(s => byId.has(s.id)).map(s => byId.get(s.id)!);
      const fresh = initialSections.filter(s => !prev.some(p => p.id === s.id)).sort(byOrder);
      return [...kept, ...fresh];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSig]);

  // One-time lazy migration of the legacy `lecture.content` field into a section.
  const importedRef = useRef(false);
  useEffect(() => {
    if (importedRef.current) return;
    const legacy = (legacyContent ?? '').trim();
    if (!legacy) return;
    importedRef.current = true;
    const existingIds = sections.map(s => s.id);
    (async () => {
      // Once the section exists, NEVER re-run the import — re-running would
      // duplicate the legacy content. Only a failure of createSection itself
      // (no section made) is safe to retry.
      let sectionCreated = false;
      try {
        const created = await coursesApi.createSection(lectureId, { type: 'text', title: '', content: legacyToHtml(legacy) });
        sectionCreated = true;
        setSections(prev => [created, ...prev.filter(s => s.id !== created.id)]);
        if (existingIds.length > 0) await coursesApi.reorderSections(lectureId, [created.id, ...existingIds]);
        await coursesApi.updateLecture(lectureId, { content: '' });
        invalidate();
      } catch {
        if (!sectionCreated) importedRef.current = false; // safe to retry only if nothing was created
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyContent, lectureId]);

  // ─── Section ops (create / delete / reorder / title) ──────────────────────
  const createAndAppend = async (data: CreateSectionData) => {
    const created = await coursesApi.createSection(lectureId, data);
    setSections(prev => [...prev, created]);
    invalidate();
    return created;
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteSection(id),
    onSuccess: (_d, id) => {
      flushRegistry.current.delete(id);
      setSections(prev => prev.filter(s => s.id !== id));
      invalidate();
    },
    onError: () => toast.error(t('common:error', { defaultValue: 'Something went wrong' })),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => coursesApi.reorderSections(lectureId, orderedIds),
    onSuccess: invalidate,
    onError: () => { toast.error(t('common:error', { defaultValue: 'Something went wrong' })); invalidate(); },
  });

  const titleMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => coursesApi.updateSection(id, { title }),
    onError: () => toast.error(t('common:error', { defaultValue: 'Something went wrong' })),
  });

  // Persist a file section's description (stored in the section `content` field).
  const fileDescMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) => coursesApi.updateSection(id, { content }),
    onError: () => toast.error(t('common:error', { defaultValue: 'Something went wrong' })),
  });

  const commitOrder = (next: LectureSection[]) => { setSections(next); reorderMutation.mutate(next.map(s => s.id)); };
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[index], next[j]] = [next[j], next[index]];
    commitOrder(next);
  };
  const dropItem = (to: number) => {
    if (dragIndex === null || dragIndex === to) { setDragIndex(null); return; }
    const next = [...sections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(to, 0, moved);
    setDragIndex(null);
    commitOrder(next);
  };
  const commitTitle = (id: number, title: string) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, title } : s)));
    titleMutation.mutate({ id, title });
  };
  const commitFileDesc = (id: number, content: string) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, content } : s)));
    fileDescMutation.mutate({ id, content });
  };

  useImperativeHandle(ref, () => ({
    flush: async () => {
      await Promise.all([...flushRegistry.current.values()].map(fn => fn().catch(() => null)));
      invalidate();
    },
  }));

  const upload = (endpoint: string, file: File) => uploadWithProgress(endpoint, file, setProgress);

  // ─── Add-section handlers (each creates a NEW section) ─────────────────────
  const addText = () => { createAndAppend({ type: 'text', title: '', content: '' }).catch(() => toast.error(t('common:error', { defaultValue: 'Something went wrong' }))); };
  const addMcq = () => { createAndAppend({ type: 'text', title: '', content: '<lecture-mcq></lecture-mcq>' }).catch(() => toast.error(t('common:error', { defaultValue: 'Something went wrong' }))); };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true); setProgress(0);
    try {
      const url = await upload('/api/uploads/image', file);
      await createAndAppend({ type: 'text', title: '', content: `<img src="${url}" alt="${file.name}">` });
    } catch { toast.error(t('common:error', { defaultValue: 'Something went wrong' })); }
    finally { setBusy(false); setProgress(null); }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — must match the server multer limit
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('file_too_large', { name: file.name, limit: '50 MB' }));
      return;
    }
    setBusy(true); setProgress(0);
    try {
      const url = await upload('/api/uploads/file', file);
      await createAndAppend({ type: 'file', title: '', content: '', fileName: file.name, fileUrl: url, fileType: file.type || file.name.split('.').pop() || '', fileSize: file.size });
    } catch { toast.error(t('common:error', { defaultValue: 'Something went wrong' })); }
    finally { setBusy(false); setProgress(null); }
  };

  // Video modal (upload or embed link)
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);
  const onPickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true); setProgress(0);
    try {
      const url = await upload('/api/uploads/video', file);
      await createAndAppend({ type: 'text', title: '', content: `<lecture-video data-src="${url}" data-mode="file"></lecture-video>` });
      setVideoOpen(false);
    } catch { toast.error(t('common:error', { defaultValue: 'Something went wrong' })); }
    finally { setBusy(false); setProgress(null); }
  };
  const submitVideoEmbed = async () => {
    const raw = videoUrl.trim();
    if (!raw) return;
    // Only persist http(s) embeds (safeEmbedSrc rejects javascript:/data:),
    // matching MoodleCourseEditor's authoring guard.
    const safe = safeEmbedSrc(toEmbedUrl(raw));
    if (!safe) { toast.error(t('common:error', { defaultValue: 'Something went wrong' })); return; }
    setBusy(true);
    try {
      await createAndAppend({ type: 'text', title: '', content: `<lecture-video data-src="${safe}" data-mode="embed"></lecture-video>` });
      setVideoOpen(false); setVideoUrl('');
    } catch { toast.error(t('common:error', { defaultValue: 'Something went wrong' })); }
    finally { setBusy(false); }
  };

  // Agent picker modal (course tutors + global chatbots)
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const { data: agentTutors = [] } = useQuery({
    queryKey: ['course-tutors', courseId],
    queryFn: () => getCourseTutors(courseId as number),
    enabled: agentOpen && courseId != null,
  });
  const { data: agentChatbots = [] } = useQuery({
    queryKey: ['ai-components-library'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { id: number; displayName: string; description: string | null; systemPrompt: string; welcomeMessage?: string | null; avatarUrl?: string | null; isActive: boolean }[] }>('/chatbots');
      return res.data.data.filter(c => c.isActive);
    },
    enabled: agentOpen,
  });
  const pickAgent = async (a: { displayName: string; description: string; systemPrompt: string; welcome: string; imageUrl?: string | null }) => {
    setBusy(true);
    try {
      await createAndAppend({ type: 'chatbot', chatbotTitle: a.displayName, chatbotIntro: a.description, chatbotSystemPrompt: a.systemPrompt, chatbotWelcome: a.welcome, ...(a.imageUrl ? { chatbotImageUrl: a.imageUrl } : {}) });
      setAgentOpen(false); setAgentSearch('');
    } catch { toast.error(t('common:error', { defaultValue: 'Something went wrong' })); }
    finally { setBusy(false); }
  };

  const courseOpts = agentTutors.filter(ct => ct.isActive).map(ct => {
    const displayName = ct.customName || ct.chatbot?.displayName || 'Tutor';
    return { key: `c-${ct.id}`, displayName, description: ct.customDescription || ct.chatbot?.description || '', systemPrompt: ct.customSystemPrompt || ct.chatbot?.systemPrompt || '', welcome: ct.customWelcomeMessage || ct.chatbot?.welcomeMessage || `Hi! I'm ${displayName}.`, imageUrl: ct.chatbot?.avatarUrl ?? null };
  });
  const globalOpts = agentChatbots.map(c => ({ key: `g-${c.id}`, displayName: c.displayName, description: c.description ?? '', systemPrompt: c.systemPrompt, welcome: c.welcomeMessage || `Hi! I'm ${c.displayName}.`, imageUrl: c.avatarUrl ?? null }));
  const q = agentSearch.toLowerCase();
  const agentMatches = [...courseOpts, ...globalOpts].filter(o => o.displayName.toLowerCase().includes(q) || o.description.toLowerCase().includes(q));

  // ─── UI ────────────────────────────────────────────────────────────────────
  const ADD_BUTTONS = [
    { key: 'text', icon: <Type size={16} />, label: t('section_text', { defaultValue: 'Text' }), onClick: addText },
    { key: 'image', icon: <ImagePlus size={16} />, label: t('section_image', { defaultValue: 'Image' }), onClick: () => imageInputRef.current?.click() },
    { key: 'video', icon: <Video size={16} />, label: t('section_video', { defaultValue: 'Video' }), onClick: () => { setVideoUrl(''); setVideoOpen(true); } },
    { key: 'file', icon: <FileUp size={16} />, label: t('section_file', { defaultValue: 'File' }), onClick: () => fileInputRef.current?.click() },
    { key: 'agent', icon: <Bot size={16} />, label: t('section_agent', { defaultValue: 'AI Agent' }), onClick: () => { setAgentSearch(''); setAgentOpen(true); } },
    { key: 'mcq', icon: <ListChecks size={16} />, label: t('section_mcq', { defaultValue: 'MCQ' }), onClick: addMcq },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          index={index}
          courseId={courseId}
          isFirst={index === 0}
          isLast={index === sections.length - 1}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          isDragging={dragIndex === index}
          onDragStart={() => setDragIndex(index)}
          onDragOverRow={(e) => e.preventDefault()}
          onDropRow={() => dropItem(index)}
          onDragEnd={() => setDragIndex(null)}
          onTitleCommit={(title) => commitTitle(section.id, title)}
          onFileDescCommit={(desc) => commitFileDesc(section.id, desc)}
          onRequestDelete={() => setDeleteTarget(section)}
          registerFlush={makeRegister(section.id)}
        />
      ))}

      {/* Single "add a section" bar — each button creates a new section. */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium mr-1 text-gray-500 dark:text-gray-400">
            {busy ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{progress != null ? `${progress}%` : t('common:loading', { defaultValue: 'Working…' })}</span>
            ) : t('add_a_section', { defaultValue: 'Add a section:' })}
          </span>
          {ADD_BUTTONS.map(b => (
            <button
              key={b.key}
              type="button"
              disabled={busy}
              onClick={b.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <span className="shrink-0">{b.icon}</span>{b.label}
            </button>
          ))}
        </div>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
      <input ref={fileInputRef} type="file" onChange={onPickFile} className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif,.zip" />
      <input ref={videoInputRef} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" onChange={onPickVideo} className="hidden" />

      {/* Video: upload or embed link */}
      <Modal isOpen={videoOpen} onClose={() => { if (!busy) { setVideoOpen(false); setVideoUrl(''); } }} title={t('add_video_title', { defaultValue: 'Add a video' })}>
        <div className="p-5 space-y-4">
          {busy ? (
            <div className="py-6 text-center"><Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-teal-500" /><p className="text-sm text-gray-500 dark:text-gray-400">{progress != null ? `${t('uploading', { defaultValue: 'Uploading…' })} ${progress}%` : t('common:loading', { defaultValue: 'Loading…' })}</p></div>
          ) : (
            <>
              <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 dark:hover:border-teal-500 text-gray-500 dark:text-gray-400 transition-colors">
                <UploadCloud className="w-7 h-7" />
                <span className="text-sm font-medium">{t('upload_a_video', { defaultValue: 'Upload a video file' })}</span>
                <button type="button" onClick={() => videoInputRef.current?.click()} className="hidden" />
                <span onClick={() => videoInputRef.current?.click()} className="text-xs underline">{t('choose_file', { defaultValue: 'Choose file' })}</span>
              </label>
              <div className="text-center text-xs font-medium text-gray-400">{t('or', { defaultValue: 'or' })}</div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input type="url" label={t('embed_video_link', { defaultValue: 'Paste a YouTube / Vimeo link' })} value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitVideoEmbed(); } }} />
                </div>
                <Button onClick={submitVideoEmbed} disabled={!videoUrl.trim()} icon={<Link2 className="w-4 h-4" />}>{t('embed', { defaultValue: 'Embed' })}</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* AI Agent picker */}
      <Modal isOpen={agentOpen} onClose={() => { if (!busy) { setAgentOpen(false); setAgentSearch(''); } }} title={t('add_ai_agent_title', { defaultValue: 'Add an AI agent' })}>
        <div className="p-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input autoFocus value={agentSearch} onChange={e => setAgentSearch(e.target.value)} placeholder={t('search', { defaultValue: 'Search…' })} aria-label={t('search', { defaultValue: 'Search…' })} className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500" />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            {agentMatches.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('no_agents_available', { defaultValue: 'No AI agents available.' })}</div>
            ) : agentMatches.map(o => (
              <button key={o.key} type="button" disabled={busy} onClick={() => pickAgent(o)} className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b last:border-b-0 border-gray-100 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-700/50 transition-colors">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{o.displayName}</div>
                {o.description && <div className="text-xs mt-0.5 line-clamp-2 text-gray-500 dark:text-gray-400">{o.description}</div>}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
        title={t('delete_section', { defaultValue: 'Delete section' })}
        message={t('delete_section_confirm', { defaultValue: 'Delete this section and its content? This cannot be undone.' })}
        confirmText={t('common:delete', { defaultValue: 'Delete' })}
      />
    </div>
  );
});

SectionListEditor.displayName = 'SectionListEditor';
