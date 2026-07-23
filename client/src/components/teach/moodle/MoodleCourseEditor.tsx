import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown, ChevronRight, ArrowUp, ArrowDown, GripVertical, Pencil, SquarePen, Copy, Trash2, Eye, EyeOff, Plus,
  Check, X, FileText, FlaskConical, ClipboardList, MessageSquare, FileQuestion, ClipboardCheck,
  Beaker, Network, Bot, Search, Video, FileUp, Loader2, Link2, UploadCloud,
  Link as LinkIcon, FileType2, MonitorPlay, BarChart3, Image as ImageIcon, Folder,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../../hooks/useTheme';
import { coursesApi } from '../../../api/courses';
import apiClient from '../../../api/client';
import { toEmbedUrl } from '../../../utils/embed';
import { safeEmbedSrc } from '../lesson-editor/EmbedNodeView';
import { uploadWithProgress } from '../../../utils/upload';
import { previewKind } from '../../../utils/filePreview';
import { getCourseTutors } from '../../../api/courseTutor';
import { assignmentsApi } from '../../../api/assignments';
import { quizzesApi } from '../../../api/quizzes';
import { forumsApi } from '../../../api/forums';
import { codeLabsApi } from '../../../api/codeLabs';
import { customLabsApi } from '../../../api/customLabs';
import { surveysApi } from '../../../api/surveys';
import { Loading } from '../../common/Loading';
import { ConfirmDialog } from '../../common/ConfirmDialog';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { SearchableSelect } from '../../common/SearchableSelect';
import { AddResourceModal } from './AddResourceModal';
import { PickerModal } from './PickerModal';
import { emptyResourceMeta, resourceMetaToPayload, availabilityIsValid, type ResourceMeta } from './ResourceMetaFields';

/** Escape a string for safe interpolation into an HTML double-quoted attribute. */
const escapeAttr = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type ItemType = 'lecture' | 'codelab' | 'assignment' | 'quiz' | 'forum' | 'survey' | 'lab' | 'interactive';

/** Every tile the add palette can offer. */
type PaletteKind =
  | 'lecture' | 'page' | 'file' | 'folder' | 'video' | 'url' | 'image' | 'embed'
  | 'assignment' | 'quiz' | 'forum' | 'survey' | 'poll' | 'codelab'
  | 'agent';

/** Item types that participate in the unified cross-type reorder (everything
 *  except the pinned reference items: assigned labs / interactive labs). */
type ReorderableType = 'lecture' | 'codelab' | 'assignment' | 'quiz' | 'forum' | 'survey';

interface EditorItem {
  type: ItemType;
  /** Primary id (moduleSurvey id for surveys; lab-assignment id for labs;
   *  synthetic index for interactive labs). */
  id: number;
  /** Underlying survey id (surveys only). */
  surveyId?: number;
  /** Underlying custom-lab template id (assigned labs only). */
  labId?: number;
  /** Interactive lab key, e.g. 'tna' / 'sna' (interactive labs only). */
  interactiveKey?: string;
  /** For lecture-backed resources (folder/url/embed/video/file/image) — the
   *  refined kind, detected from the lecture's section markers, so the row
   *  shows a distinct icon instead of the generic lesson one. */
  subKind?: LectureSubKind;
  title: string;
  isPublished: boolean;
  orderIndex: number;
  /** View link for the title. */
  viewHref: string;
  /** Reference items (assigned lab / interactive lab) can't be renamed/edited
   *  inline — only removed from the module. */
  reference?: boolean;
}

const ITEM_META: Record<ItemType, { Icon: typeof FileText; color: string; colorDark: string }> = {
  lecture: { Icon: FileText, color: '#475569', colorDark: '#94a3b8' },
  codelab: { Icon: FlaskConical, color: '#059669', colorDark: '#34d399' },
  assignment: { Icon: ClipboardList, color: '#d97706', colorDark: '#fbbf24' },
  forum: { Icon: MessageSquare, color: '#0d9488', colorDark: '#2dd4bf' },
  quiz: { Icon: FileQuestion, color: '#0891b2', colorDark: '#22d3ee' },
  survey: { Icon: ClipboardCheck, color: '#4f46e5', colorDark: '#a5b4fc' },
  lab: { Icon: Beaker, color: '#0d9488', colorDark: '#2dd4bf' },
  interactive: { Icon: Network, color: '#7c3aed', colorDark: '#a78bfa' },
};

/** Refined kinds for lecture-backed resources, so a Folder/URL/Embed/Video/
 *  File/Image item gets its own icon instead of the generic lesson icon.
 *  Colors mirror the matching Add-Resource palette tiles. */
type LectureSubKind = 'folder' | 'url' | 'embed' | 'video' | 'file' | 'image';

const SUBTYPE_META: Record<LectureSubKind, { Icon: typeof FileText; color: string; colorDark: string }> = {
  folder: { Icon: Folder, color: '#d97706', colorDark: '#fbbf24' },
  url: { Icon: LinkIcon, color: '#0284c7', colorDark: '#38bdf8' },
  embed: { Icon: MonitorPlay, color: '#7c3aed', colorDark: '#a78bfa' },
  video: { Icon: Video, color: '#0284c7', colorDark: '#38bdf8' },
  file: { Icon: FileUp, color: '#0d9488', colorDark: '#2dd4bf' },
  image: { Icon: ImageIcon, color: '#0891b2', colorDark: '#22d3ee' },
};

/** Detect a lecture's refined sub-kind from its sections. A standalone resource
 *  is exactly ONE section: a `file` section (→ image when the type is an image,
 *  else file), or a text section holding a single marker node
 *  (`<lecture-folder/url/embed/video>`). Multi-section lectures are genuine
 *  lessons, and a single plain-text section is a page — both keep the generic
 *  lesson icon (returns undefined). */
const detectLectureSubKind = (lecture: { sections?: { type?: string; content?: string | null; fileType?: string | null }[] }): LectureSubKind | undefined => {
  const sections = lecture.sections ?? [];
  if (sections.length !== 1) return undefined;
  const section = sections[0];
  if (section.type === 'file') {
    return previewKind(undefined, section.fileType) === 'image' ? 'image' : 'file';
  }
  // Anchor to the leading node: every genuine resource marker is generated as
  // the first node of the section content. A plain Page whose prose merely
  // mentions the literal text "<lecture-url" elsewhere must not be mislabeled.
  const content = (section.content ?? '').trimStart();
  if (content.startsWith('<lecture-folder')) return 'folder';
  if (content.startsWith('<lecture-url')) return 'url';
  if (content.startsWith('<lecture-embed')) return 'embed';
  if (content.startsWith('<lecture-video')) return 'video';
  return undefined;
};

interface MoodleCourseEditorProps {
  courseId: number;
}

export const MoodleCourseEditor = ({ courseId }: MoodleCourseEditorProps) => {
  const { t } = useTranslation(['teaching', 'common', 'courses']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: details, isLoading } = useQuery({
    queryKey: ['courseDetails', courseId],
    queryFn: () => coursesApi.getCourseDetails(courseId),
    enabled: !!courseId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['courseDetails', courseId] });
  const refresh = () => {
    invalidate();
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
  };

  // ─── Mutations (rename / delete / toggle publish per type) ───────────────
  const mut = {
    moduleUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => coursesApi.updateModule(id, data), onSuccess: refresh }),
    moduleDelete: useMutation({ mutationFn: (id: number) => coursesApi.deleteModule(id), onSuccess: refresh }),
    moduleCreate: useMutation({ mutationFn: (data: Record<string, unknown>) => coursesApi.createModule(courseId, data), onSuccess: refresh }),
    modulesReorder: useMutation({ mutationFn: (moduleIds: number[]) => coursesApi.reorderModules(courseId, moduleIds), onSuccess: refresh }),
    itemsReorder: useMutation({ mutationFn: ({ moduleId, items }: { moduleId: number; items: { type: ReorderableType; id: number }[] }) => coursesApi.reorderModuleItems(moduleId, items), onSuccess: refresh }),

    lectureUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => coursesApi.updateLecture(id, data), onSuccess: refresh }),
    lectureDelete: useMutation({ mutationFn: (id: number) => coursesApi.deleteLecture(id), onSuccess: refresh }),
    lectureDuplicate: useMutation({ mutationFn: (id: number) => coursesApi.duplicateLecture(id), onSuccess: refresh }),

    codelabUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => codeLabsApi.updateCodeLab(id, data), onSuccess: refresh }),
    codelabDelete: useMutation({ mutationFn: (id: number) => codeLabsApi.deleteCodeLab(id), onSuccess: refresh }),

    assignmentUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => assignmentsApi.updateAssignment(id, data), onSuccess: refresh }),
    assignmentDelete: useMutation({ mutationFn: (id: number) => assignmentsApi.deleteAssignment(id), onSuccess: refresh }),

    quizUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => quizzesApi.updateQuiz(id, data), onSuccess: refresh }),
    quizDelete: useMutation({ mutationFn: (id: number) => quizzesApi.deleteQuiz(id), onSuccess: refresh }),

    forumUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => forumsApi.updateForum(id, data), onSuccess: refresh }),
    forumDelete: useMutation({ mutationFn: (id: number) => forumsApi.deleteForum(id), onSuccess: refresh }),

    surveyUpdate: useMutation({ mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => surveysApi.updateSurvey(id, data), onSuccess: refresh }),
    surveyRemove: useMutation({ mutationFn: ({ moduleId, surveyId }: { moduleId: number; surveyId: number }) => surveysApi.removeSurveyFromModule(moduleId, surveyId), onSuccess: refresh }),

    labUnassign: useMutation({ mutationFn: (labId: number) => customLabsApi.unassignFromCourse(labId, courseId), onSuccess: refresh }),
    interactiveRemove: useMutation({
      mutationFn: ({ moduleId, key }: { moduleId: number; key: string }) => {
        const mod = details?.course?.modules?.find((m: { id: number }) => m.id === moduleId) as { interactiveLabs?: string } | undefined;
        const remaining = (mod?.interactiveLabs ? mod.interactiveLabs.split(',').map(s => s.trim()).filter(Boolean) : [])
          .filter(k => k !== key);
        return coursesApi.updateModule(moduleId, { interactiveLabs: remaining.length ? remaining.join(',') : null } as never);
      },
      onSuccess: refresh,
    }),
  };

  const onError = () => toast.error(t('common:error', { defaultValue: 'Something went wrong' }));

  // ─── Survey picker popup — attach one of the instructor's own surveys ─────
  const [surveyPickerModule, setSurveyPickerModule] = useState<number | null>(null);
  const [pickedSurveyId, setPickedSurveyId] = useState('');
  const closeSurveyPicker = () => { setSurveyPickerModule(null); setPickedSurveyId(''); };

  const { data: mySurveys } = useQuery({
    queryKey: ['surveys', 'mine'],
    queryFn: () => surveysApi.getSurveys(),
    enabled: surveyPickerModule != null,
  });

  const surveyAdd = useMutation({
    mutationFn: ({ moduleId, surveyId }: { moduleId: number; surveyId: number }) =>
      surveysApi.addSurveyToModule(courseId, moduleId, surveyId),
    onSuccess: () => {
      refresh();
      toast.success(t('survey_added', { defaultValue: 'Survey added' }));
      closeSurveyPicker();
    },
    onError,
  });

  // ─── AI agent picker — add a tutor/chatbot as its own item in a topic ─────
  // Implemented as a lecture whose single section is a functional chatbot
  // (type='chatbot'), so students can actually chat with it.
  const [agentPickerModule, setAgentPickerModule] = useState<number | null>(null);
  const [agentSearch, setAgentSearch] = useState('');
  const closeAgentPicker = () => { setAgentPickerModule(null); setAgentSearch(''); };

  const { data: agentTutors = [] } = useQuery({
    queryKey: ['course-tutors', courseId],
    queryFn: () => getCourseTutors(courseId),
    enabled: agentPickerModule != null,
  });
  const { data: agentChatbots = [] } = useQuery({
    queryKey: ['ai-components-library'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { id: number; displayName: string; description: string | null; systemPrompt: string; welcomeMessage?: string | null; avatarUrl?: string | null; isActive: boolean }[] }>('/chatbots');
      return res.data.data.filter(c => c.isActive);
    },
    enabled: agentPickerModule != null,
  });

  const addAgentMutation = useMutation({
    mutationFn: async ({ moduleId, agent }: { moduleId: number; agent: { displayName: string; description: string; systemPrompt: string; welcome: string; imageUrl?: string | null } }) => {
      const lecture = await coursesApi.createLecture(moduleId, { title: agent.displayName, contentType: 'text', isPublished: true } as never);
      try {
        await coursesApi.createSection(lecture.id, {
          type: 'chatbot',
          chatbotTitle: agent.displayName,
          chatbotIntro: agent.description,
          chatbotSystemPrompt: agent.systemPrompt,
          chatbotWelcome: agent.welcome,
          ...(agent.imageUrl ? { chatbotImageUrl: agent.imageUrl } : {}),
        });
      } catch (err) {
        // Roll back the just-created lecture so a failed section doesn't leave
        // an empty stray lecture (which students would open to a blank page).
        await coursesApi.deleteLecture(lecture.id).catch(() => {});
        throw err;
      }
    },
    onSuccess: () => { refresh(); toast.success(t('agent_added', { defaultValue: 'AI agent added' })); closeAgentPicker(); },
    onError,
  });

  // ─── Unified "Add resource" modal ───────────────────────────────────────────
  // Every create type (lesson/code lab/assignment/quiz/forum/video/file) opens
  // the same modal shell with the shared meta fields + a type-specific body.
  type AddType = 'lecture' | 'codelab' | 'assignment' | 'quiz' | 'forum' | 'video' | 'file'
    | 'folder' | 'url' | 'page' | 'embed' | 'poll';
  // `editing` set → the modal updates an existing lecture in place (URL/embed
  // resources) instead of creating a new one.
  const [addModal, setAddModal] = useState<{ moduleId: number; type: AddType; editing?: { lectureId: number; sectionId: number } } | null>(null);
  const [meta, setMeta] = useState<ResourceMeta>(emptyResourceMeta());
  const [busy, setBusy] = useState(false);          // create/upload in flight
  const [progress, setProgress] = useState<number | null>(null);
  // Multi-file batch: each entry is one File item to create (file add type).
  const [fileBatch, setFileBatch] = useState<{ name: string; status: 'uploading' | 'done' | 'error'; fileUrl?: string; fileType?: string; fileSize?: number }[]>([]);
  // Folder batch: the files staged for a single grouped Folder item.
  const [folderBatch, setFolderBatch] = useState<{ name: string; status: 'uploading' | 'done' | 'error'; fileUrl?: string; fileType?: string; fileSize?: number }[]>([]);
  const [videoExtra, setVideoExtra] = useState<{ src: string; mode: 'file' | 'embed' } | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  // URL / Page / Embed / Poll bodies.
  const [urlValue, setUrlValue] = useState('');
  const [urlNewTab, setUrlNewTab] = useState(true);
  const [pageBody, setPageBody] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedHeight, setEmbedHeight] = useState(480);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [imageOnly, setImageOnly] = useState(false);  // file modal restricted to images

  const openAdd = (moduleId: number, type: AddType, asImage = false) => {
    setMeta(emptyResourceMeta());
    setFileBatch([]); setFolderBatch([]); setVideoExtra(null); setVideoUrl(''); setBusy(false); setProgress(null);
    setUrlValue(''); setUrlNewTab(true); setPageBody(''); setEmbedUrl(''); setEmbedHeight(480);
    setPollQuestion(''); setPollOptions(['', '']); setImageOnly(asImage);
    setAddModal({ moduleId, type });
  };
  const closeAdd = () => { if (!busy) setAddModal(null); };

  // Read the data-* attributes off a lecture-resource marker node.
  const parseMarker = (content: string, tag: string): Record<string, string> => {
    const el = new DOMParser().parseFromString(content ?? '', 'text/html').querySelector(tag);
    const attrs: Record<string, string> = {};
    if (el) for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
    return attrs;
  };
  // ISO timestamp → a `datetime-local`-friendly string in local time.
  const isoToLocalInput = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Re-open the add modal pre-filled to EDIT an existing URL/embed resource
  // (the same fields as when adding, but saving updates in place).
  const openEdit = async (item: EditorItem) => {
    const kind = item.subKind;
    if (kind !== 'url' && kind !== 'embed') return;
    try {
      const lec = await coursesApi.getLectureById(item.id) as any;
      const section = (lec.sections ?? [])[0];
      if (!section) { onError(); return; }
      setFileBatch([]); setFolderBatch([]); setVideoExtra(null); setVideoUrl(''); setBusy(false); setProgress(null);
      setPageBody(''); setPollQuestion(''); setPollOptions(['', '']); setImageOnly(false);
      setMeta({
        title: lec.title ?? '',
        description: lec.description ?? '',
        isPublished: !!lec.isPublished,
        scheduleAvailability: !!(lec.availableFrom || lec.availableUntil),
        availableFrom: lec.availableFrom ? isoToLocalInput(lec.availableFrom) : '',
        availableUntil: lec.availableUntil ? isoToLocalInput(lec.availableUntil) : '',
      });
      if (kind === 'url') {
        const a = parseMarker(section.content ?? '', 'lecture-url');
        setUrlValue(a['data-url'] ?? '');
        setUrlNewTab((a['data-newtab'] ?? 'true') !== 'false');
        setEmbedUrl(''); setEmbedHeight(480);
      } else {
        const a = parseMarker(section.content ?? '', 'lecture-embed');
        setEmbedUrl(a['data-src'] ?? '');
        setEmbedHeight(Math.max(160, Math.min(1200, parseInt(a['data-height'] ?? '', 10) || 480)));
        setUrlValue(''); setUrlNewTab(true);
      }
      setAddModal({ moduleId: lec.moduleId, type: kind, editing: { lectureId: item.id, sectionId: section.id } });
    } catch { onError(); }
  };

  // Create a lecture whose single section is the given media, carrying the
  // shared meta (description / visibility / availability) on the lecture.
  const createMediaLecture = async (
    moduleId: number,
    title: string,
    section: Parameters<typeof coursesApi.createSection>[1],
    lectureMeta: Record<string, unknown>,
  ) => {
    const lecture = await coursesApi.createLecture(moduleId, { title, contentType: 'text', ...lectureMeta } as never);
    await coursesApi.createSection(lecture.id, section);
  };

  const upload = (endpoint: string, file: File) => uploadWithProgress(endpoint, file, setProgress);

  // Multi-file: upload several files at once, tracking per-file state. Each
  // successful upload becomes its own File item on Create.
  const onPickFilesForModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = '';
    if (files.length === 0) return;
    const startIndex = fileBatch.length;
    setFileBatch(b => [...b, ...files.map(f => ({ name: f.name, status: 'uploading' as const }))]);
    setMeta(m => (m.title ? m : { ...m, title: files.length === 1 ? files[0].name : t('files_n', { defaultValue: '{{count}} files', count: files.length }) }));
    await Promise.all(files.map(async (file, i) => {
      const idx = startIndex + i;
      try {
        const url = await uploadWithProgress('/api/uploads/file', file);
        setFileBatch(b => b.map((it, j) => j === idx ? { ...it, status: 'done', fileUrl: url, fileType: file.type || file.name.split('.').pop() || '', fileSize: file.size } : it));
      } catch {
        setFileBatch(b => b.map((it, j) => j === idx ? { ...it, status: 'error' } : it));
      }
    }));
  };

  // Folder: stage several files under ONE grouped item. Same per-file upload
  // tracking as the multi-file picker, but the files don't seed the title
  // (the folder carries its own name) and all stay in one folder on Create.
  const onPickFilesForFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = '';
    if (files.length === 0) return;
    const startIndex = folderBatch.length;
    setFolderBatch(b => [...b, ...files.map(f => ({ name: f.name, status: 'uploading' as const }))]);
    await Promise.all(files.map(async (file, i) => {
      const idx = startIndex + i;
      try {
        const url = await uploadWithProgress('/api/uploads/file', file);
        setFolderBatch(b => b.map((it, j) => j === idx ? { ...it, status: 'done', fileUrl: url, fileType: file.type || file.name.split('.').pop() || '', fileSize: file.size } : it));
      } catch {
        setFolderBatch(b => b.map((it, j) => j === idx ? { ...it, status: 'error' } : it));
      }
    }));
  };

  const onPickVideoForModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true); setProgress(0);
    try {
      const url = await upload('/api/uploads/video', file);
      setVideoExtra({ src: url, mode: 'file' });
      setMeta(m => (m.title ? m : { ...m, title: file.name }));
    } catch { onError(); }
    finally { setBusy(false); setProgress(null); }
  };
  const setVideoEmbed = () => {
    const raw = videoUrl.trim();
    if (!raw) return;
    // Only accept http(s) embeds (safeEmbedSrc rejects javascript:/data: and
    // other schemes), so a pasted non-http URL can't reach a student's iframe.
    const safe = safeEmbedSrc(toEmbedUrl(raw));
    if (safe) setVideoExtra({ src: safe, mode: 'embed' });
  };

  // Finalize: create the chosen resource type with the captured meta + media.
  const submitAdd = async () => {
    if (!addModal) return;
    const { moduleId, type } = addModal;
    const p = resourceMetaToPayload(meta);
    if (!p.title) return;
    if (!availabilityIsValid(meta)) return;
    const dates = { availableFrom: p.availableFrom, availableUntil: p.availableUntil };
    const lectureMeta = { description: p.description, isPublished: p.isPublished, ...dates };
    setBusy(true);
    try {
      switch (type) {
        case 'lecture': {
          const c = await coursesApi.createLecture(moduleId, { title: p.title, contentType: 'text', ...lectureMeta } as never) as { id: number };
          refresh(); setAddModal(null); navigate(`/teach/courses/${courseId}/lectures/${c.id}`); return;
        }
        case 'codelab': {
          const c = await codeLabsApi.createCodeLab({ moduleId, title: p.title, description: p.description, isPublished: p.isPublished, ...dates } as never) as { id: number };
          refresh(); setAddModal(null); navigate(`/teach/courses/${courseId}/code-labs/${c.id}`); return;
        }
        case 'quiz': {
          const c = await quizzesApi.createQuiz(courseId, { moduleId, title: p.title, description: p.description, isPublished: p.isPublished, ...dates } as never) as { id: number };
          refresh(); setAddModal(null); navigate(`/teach/courses/${courseId}/quizzes/${c.id}`); return;
        }
        case 'assignment': {
          const c = await assignmentsApi.createAssignment(courseId, { moduleId, title: p.title, description: p.description, isPublished: p.isPublished, submissionType: 'text', points: 100, ...dates } as never) as { id: number };
          refresh(); setAddModal(null); navigate(`/teach/courses/${courseId}/assignments/${c.id}/edit`); return;
        }
        case 'forum': {
          const c = await forumsApi.createForum(courseId, { moduleId, title: p.title, content: p.description || p.title, description: p.description, isPublished: p.isPublished, ...dates } as never) as { id: number };
          refresh(); setAddModal(null); navigate(`/teach/courses/${courseId}/forums/${c.id}/edit`); return;
        }
        case 'video': {
          if (!videoExtra) { setBusy(false); return; }
          await createMediaLecture(moduleId, p.title, { type: 'text', content: `<lecture-video data-src="${videoExtra.src}" data-mode="${videoExtra.mode}"></lecture-video>` }, lectureMeta);
          refresh(); toast.success(t('video_added', { defaultValue: 'Video added' })); setBusy(false); setAddModal(null); return;
        }
        case 'file': {
          const ready = fileBatch.filter(f => f.status === 'done' && f.fileUrl);
          if (ready.length === 0) { setBusy(false); return; }
          // One File item per uploaded file. With a single file we honor the
          // typed title; with several we use each file's own name.
          let created = 0;
          for (let i = 0; i < ready.length; i++) {
            const f = ready[i];
            const title = ready.length === 1 ? p.title : f.name;
            await createMediaLecture(moduleId, title, { type: 'file', fileName: f.name, fileUrl: f.fileUrl!, fileType: f.fileType ?? '', fileSize: f.fileSize ?? 0, content: ready.length === 1 ? p.description : undefined }, lectureMeta);
            created++;
            // Drop the just-created file from the batch so that if a later file
            // in this loop throws, re-clicking Create only retries the ones
            // that never got created (no duplicate lectures). Match by object
            // identity, not fileUrl — two staged entries can share a fileUrl.
            setFileBatch(b => b.filter(it => it !== f));
          }
          refresh(); toast.success(t('files_added', { defaultValue: '{{count}} file(s) added', count: created })); setBusy(false); setAddModal(null); return;
        }
        case 'folder': {
          // ONE grouped item: all staged files become a single <lecture-folder>
          // node, distinct from the multi-file upload (which makes N items).
          const ready = folderBatch.filter(f => f.status === 'done' && f.fileUrl);
          if (ready.length === 0) { setBusy(false); return; }
          const folderFiles = ready.map(f => ({ fileName: f.name, fileUrl: f.fileUrl!, fileType: f.fileType ?? '', fileSize: f.fileSize ?? 0 }));
          const content = `<lecture-folder data-label="${escapeAttr(p.title)}" data-files="${escapeAttr(JSON.stringify(folderFiles))}"></lecture-folder>`;
          await createMediaLecture(moduleId, p.title, { type: 'text', content }, lectureMeta);
          refresh(); toast.success(t('folder_added', { defaultValue: 'Folder added' })); setBusy(false); setAddModal(null); return;
        }
        case 'url': {
          const raw = urlValue.trim();
          if (!raw) { setBusy(false); return; }
          const content = `<lecture-url data-url="${escapeAttr(raw)}" data-title="${escapeAttr(p.title)}" data-newtab="${urlNewTab ? 'true' : 'false'}"></lecture-url>`;
          if (addModal.editing) {
            await coursesApi.updateLecture(addModal.editing.lectureId, { title: p.title, ...lectureMeta } as never);
            await coursesApi.updateSection(addModal.editing.sectionId, { content });
            refresh(); toast.success(t('common:saved', { defaultValue: 'Saved' })); setBusy(false); setAddModal(null); return;
          }
          await createMediaLecture(moduleId, p.title, { type: 'text', content }, lectureMeta);
          refresh(); toast.success(t('url_added', { defaultValue: 'Link added' })); setBusy(false); setAddModal(null); return;
        }
        case 'page': {
          // Lightweight standalone prose page — store the body as a text section.
          await createMediaLecture(moduleId, p.title, { type: 'text', content: pageBody.trim() || p.description }, lectureMeta);
          refresh(); toast.success(t('page_added', { defaultValue: 'Page added' })); setBusy(false); setAddModal(null); return;
        }
        case 'embed': {
          const raw = embedUrl.trim();
          if (!raw) { setBusy(false); return; }
          const content = `<lecture-embed data-src="${escapeAttr(raw)}" data-height="${embedHeight}"></lecture-embed>`;
          if (addModal.editing) {
            await coursesApi.updateLecture(addModal.editing.lectureId, { title: p.title, ...lectureMeta } as never);
            await coursesApi.updateSection(addModal.editing.sectionId, { content });
            refresh(); toast.success(t('common:saved', { defaultValue: 'Saved' })); setBusy(false); setAddModal(null); return;
          }
          await createMediaLecture(moduleId, p.title, { type: 'text', content }, lectureMeta);
          refresh(); toast.success(t('embed_added', { defaultValue: 'Embed added' })); setBusy(false); setAddModal(null); return;
        }
        case 'poll': {
          const opts = pollOptions.map(o => o.trim()).filter(Boolean);
          if (!pollQuestion.trim() || opts.length < 2) { setBusy(false); return; }
          await surveysApi.createPoll({
            courseId, moduleId, title: p.title, description: p.description,
            question: pollQuestion.trim(), options: opts, isPublished: p.isPublished,
          });
          refresh(); toast.success(t('poll_added', { defaultValue: 'Poll added' })); setBusy(false); setAddModal(null); return;
        }
      }
    } catch { onError(); setBusy(false); }
  };

  // Rename an item's title.
  const renameItem = (item: EditorItem, title: string) => {
    const data = { title };
    const opts = { onSuccess: refresh, onError };
    switch (item.type) {
      case 'lecture': mut.lectureUpdate.mutate({ id: item.id, data }, opts); break;
      case 'codelab': mut.codelabUpdate.mutate({ id: item.id, data }, opts); break;
      case 'assignment': mut.assignmentUpdate.mutate({ id: item.id, data }, opts); break;
      case 'quiz': mut.quizUpdate.mutate({ id: item.id, data }, opts); break;
      case 'forum': mut.forumUpdate.mutate({ id: item.id, data }, opts); break;
      case 'survey': if (item.surveyId) mut.surveyUpdate.mutate({ id: item.surveyId, data }, opts); break;
    }
  };

  const toggleItem = (item: EditorItem) => {
    const data = { isPublished: !item.isPublished };
    const opts = { onError };
    switch (item.type) {
      case 'lecture': mut.lectureUpdate.mutate({ id: item.id, data }, opts); break;
      case 'codelab': mut.codelabUpdate.mutate({ id: item.id, data }, opts); break;
      case 'assignment': mut.assignmentUpdate.mutate({ id: item.id, data }, opts); break;
      case 'quiz': mut.quizUpdate.mutate({ id: item.id, data }, opts); break;
      case 'forum': mut.forumUpdate.mutate({ id: item.id, data }, opts); break;
      case 'survey': if (item.surveyId) mut.surveyUpdate.mutate({ id: item.surveyId, data }, opts); break;
    }
  };

  const deleteItem = (item: EditorItem, moduleId: number) => {
    const opts = { onError };
    switch (item.type) {
      case 'lecture': mut.lectureDelete.mutate(item.id, opts); break;
      case 'codelab': mut.codelabDelete.mutate(item.id, opts); break;
      case 'assignment': mut.assignmentDelete.mutate(item.id, opts); break;
      case 'quiz': mut.quizDelete.mutate(item.id, opts); break;
      case 'forum': mut.forumDelete.mutate(item.id, opts); break;
      case 'survey': if (item.surveyId) mut.surveyRemove.mutate({ moduleId, surveyId: item.surveyId }, opts); break;
      case 'lab': if (item.labId) mut.labUnassign.mutate(item.labId, opts); break;
      case 'interactive': if (item.interactiveKey) mut.interactiveRemove.mutate({ moduleId, key: item.interactiveKey }, opts); break;
    }
  };

  // Duplicate an item. Only lessons (lectures) support a deep copy today;
  // the copy lands unpublished at the end of its module with a "(copy)" title.
  const duplicateItem = (item: EditorItem) => {
    if (item.type !== 'lecture') return;
    mut.lectureDuplicate.mutate(item.id, {
      onError,
      onSuccess: () => { refresh(); toast.success(t('lesson_duplicated', { defaultValue: 'Lesson duplicated' })); },
    });
  };

  // Persist a new item order within a module (unified cross-type reorder).
  const reorderItems = (moduleId: number, items: { type: ReorderableType; id: number }[]) =>
    mut.itemsReorder.mutate({ moduleId, items }, { onError });

  // Open the dedicated editor page for an item.
  const editItem = (item: EditorItem) => {
    switch (item.type) {
      case 'lecture':
        // URL / embed resources edit in place via the same modal used to add
        // them (they carry no editable prose, so the section page would be a
        // dead end). Every other lecture opens the full section editor.
        if (item.subKind === 'url' || item.subKind === 'embed') { void openEdit(item); break; }
        navigate(`/teach/courses/${courseId}/lectures/${item.id}`); break;
      case 'codelab': navigate(`/teach/courses/${courseId}/code-labs/${item.id}`); break;
      case 'quiz': navigate(`/teach/courses/${courseId}/quizzes/${item.id}`); break;
      case 'assignment': navigate(`/teach/courses/${courseId}/assignments/${item.id}/edit`); break;
      case 'forum': navigate(`/teach/courses/${courseId}/forums/${item.id}/edit`); break;
      case 'survey': navigate(`/teach/surveys?courseId=${courseId}`); break;
    }
  };

  // Navigate to a dedicated "new" page per type — nothing is written to the
  // database until the user fills the form and clicks Save/Create there.
  const addItem = (moduleId: number, type: ItemType) => {
    switch (type) {
      case 'lecture':
      case 'codelab':
      case 'quiz':
      case 'assignment':
      case 'forum':
        openAdd(moduleId, type); break;
      // Surveys can't be created blank here — pick one the instructor already
      // made and attach it to the module via a popup.
      case 'survey': setSurveyPickerModule(moduleId); break;
    }
  };

  // Route a palette tile click to the right flow: the unified add modal,
  // a "new editor page" type, or a "pick existing" popup.
  const addResource = (moduleId: number, kind: PaletteKind) => {
    switch (kind) {
      case 'lecture':
      case 'codelab':
      case 'assignment':
      case 'quiz':
      case 'forum':
        addItem(moduleId, kind); break;
      case 'survey': setSurveyPickerModule(moduleId); break;
      case 'agent': setAgentPickerModule(moduleId); break;
      // Image is a file restricted to image types (it previews inline).
      case 'image': openAdd(moduleId, 'file', true); break;
      // Everything else opens the unified add-resource modal.
      case 'video':
      case 'file':
      case 'folder':
      case 'url':
      case 'page':
      case 'embed':
      case 'poll':
        openAdd(moduleId, kind); break;
    }
  };

  // ─── Build modules with their (sorted) items ─────────────────────────────
  const modules = useMemo(() => {
    const course = details?.course;
    if (!course?.modules) return [];
    const assignments = details?.assignments ?? [];
    const forums = details?.forums ?? [];
    const labs = (details as { labs?: any[] } | undefined)?.labs ?? [];
    // Pin assigned labs + interactive labs to the end, mirroring the student
    // view's ordering.
    const LAB_ORDER = Number.MAX_SAFE_INTEGER - 2;
    const INTERACTIVE_ORDER = Number.MAX_SAFE_INTEGER - 1;
    const interactiveLabel = (key: string) =>
      key === 'tna' ? t('interactive_lab_tna', { defaultValue: 'Interactive TNA Exercise' })
      : key === 'sna' ? t('interactive_lab_sna', { defaultValue: 'Interactive SNA Exercise' })
      : key;
    return [...course.modules]
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map(m => {
        const interactiveKeys = (m as { interactiveLabs?: string }).interactiveLabs
          ? (m as { interactiveLabs?: string }).interactiveLabs!.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        const items: EditorItem[] = [
          ...(m.lectures ?? []).map((l: any) => ({ type: 'lecture' as const, id: l.id, subKind: detectLectureSubKind(l), title: l.title, isPublished: !!l.isPublished, orderIndex: l.orderIndex ?? 0, viewHref: `/courses/${courseId}/lectures/${l.id}` })),
          ...((m as any).codeLabs ?? []).map((c: any) => ({ type: 'codelab' as const, id: c.id, title: c.title, isPublished: !!c.isPublished, orderIndex: c.orderIndex ?? 0, viewHref: `/teach/courses/${courseId}/code-labs/${c.id}` })),
          ...((m as any).quizzes ?? []).map((q: any) => ({ type: 'quiz' as const, id: q.id, title: q.title, isPublished: !!q.isPublished, orderIndex: q.orderIndex ?? 0, viewHref: `/teach/courses/${courseId}/quizzes/${q.id}` })),
          ...assignments.filter((a: any) => a.moduleId === m.id).map((a: any) => ({ type: 'assignment' as const, id: a.id, title: a.title, isPublished: !!a.isPublished, orderIndex: a.orderIndex ?? 0, viewHref: `/teach/courses/${courseId}/assignments/${a.id}/edit` })),
          ...forums.filter((f: any) => f.moduleId === m.id).map((f: any) => ({ type: 'forum' as const, id: f.id, title: f.title, isPublished: !!f.isPublished, orderIndex: f.orderIndex ?? 0, viewHref: `/courses/${courseId}/forums/${f.id}` })),
          ...((m as any).moduleSurveys ?? []).map((ms: any) => ({ type: 'survey' as const, id: ms.id, surveyId: ms.survey?.id, title: ms.survey?.title ?? 'Survey', isPublished: !!ms.survey?.isPublished, orderIndex: ms.orderIndex ?? 0, viewHref: `/teach/surveys?courseId=${courseId}` })),
          // Assigned lab templates (Python SNA Lab, etc.) — reference items.
          ...labs.filter((la: any) => la.moduleId === m.id).map((la: any) => ({ type: 'lab' as const, id: la.id, labId: la.labId ?? la.lab?.id, title: la.lab?.name ?? la.title ?? 'Lab', isPublished: true, orderIndex: LAB_ORDER, viewHref: `/courses/${courseId}`, reference: true })),
          // Interactive labs (TNA / SNA) stored on the module — reference items.
          ...interactiveKeys.map((key, idx) => ({ type: 'interactive' as const, id: idx, interactiveKey: key, title: interactiveLabel(key), isPublished: true, orderIndex: INTERACTIVE_ORDER + idx, viewHref: `/courses/${courseId}`, reference: true })),
        ].sort((a, b) => (a.orderIndex - b.orderIndex) || (a.id - b.id));
        return { id: m.id, title: m.title, description: (m as { description?: string }).description ?? '', isPublished: (m as any).isPublished ?? true, items };
      });
  }, [details, courseId, t]);

  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'module'; id: number; title: string }
    | { kind: 'item'; item: EditorItem; moduleId: number; title: string }
    | null
  >(null);

  // Move a whole topic (module) up/down by swapping with its neighbour and
  // persisting the new module order.
  const moveModule = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= modules.length) return;
    const ids = modules.map(m => m.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    mut.modulesReorder.mutate(ids, { onError });
  };

  // Create a new topic. When `afterIndex` is given, the new topic is moved to
  // sit right after that one; otherwise it's appended at the end.
  const addSection = async (afterIndex?: number) => {
    try {
      const created = await coursesApi.createModule(courseId, { title: t('new_section', { defaultValue: 'New section' }) } as never);
      if (afterIndex != null && afterIndex < modules.length - 1) {
        const ids = modules.map(m => m.id);
        ids.splice(afterIndex + 1, 0, created.id);
        await coursesApi.reorderModules(courseId, ids);
      }
      refresh();
    } catch { onError(); }
  };

  if (isLoading) return <Loading text={t('common:loading', { defaultValue: 'Loading…' })} />;

  return (
    <div className="space-y-4">
      {modules.map((m, idx) => (
        <div key={m.id} className="space-y-4">
          <ModuleCard
            module={m}
            isFirst={idx === 0}
            isLast={idx === modules.length - 1}
            onMoveUp={() => moveModule(idx, -1)}
            onMoveDown={() => moveModule(idx, 1)}
            onReorderItems={(items) => reorderItems(m.id, items)}
            onRenameModule={(title) => mut.moduleUpdate.mutate({ id: m.id, data: { title } }, { onError })}
            onDescribeModule={(description) => mut.moduleUpdate.mutate({ id: m.id, data: { description } }, { onError })}
            onToggleModule={() => mut.moduleUpdate.mutate({ id: m.id, data: { isPublished: !m.isPublished } }, { onError })}
            onDeleteModule={() => setDeleteTarget({ kind: 'module', id: m.id, title: m.title })}
            onRenameItem={renameItem}
            onToggleItem={toggleItem}
            onEditItem={editItem}
            onDuplicateItem={duplicateItem}
            onDeleteItem={(item) => setDeleteTarget({ kind: 'item', item, moduleId: m.id, title: item.title })}
            onAdd={(kind) => addResource(m.id, kind)}
          />
          {/* "Add section" after EACH topic — inserts a new topic right here. */}
          <AddSectionRow label={t('add_section', { defaultValue: 'Add section' })} onClick={() => addSection(idx)} />
        </div>
      ))}

      {modules.length === 0 && (
        <AddSectionRow label={t('add_section', { defaultValue: 'Add section' })} onClick={() => addSection()} />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'module') mut.moduleDelete.mutate(deleteTarget.id, { onError });
          else deleteItem(deleteTarget.item, deleteTarget.moduleId);
          setDeleteTarget(null);
        }}
        title={t('common:delete', { defaultValue: 'Delete' })}
        message={t('delete_confirm_named', { defaultValue: 'Delete "{{title}}"? This cannot be undone.', title: deleteTarget?.title ?? '' })}
        confirmText={t('common:delete', { defaultValue: 'Delete' })}
        requireSecondConfirm
      />

      {surveyPickerModule != null && (() => {
        const attachedIds = new Set<number>(
          ((details?.course?.modules?.find((m: { id: number }) => m.id === surveyPickerModule) as { moduleSurveys?: { survey?: { id?: number } }[] } | undefined)?.moduleSurveys ?? [])
            .map(ms => ms.survey?.id)
            .filter((x): x is number => typeof x === 'number'),
        );
        const options = (mySurveys ?? [])
          .filter(s => !attachedIds.has(s.id))
          .map(s => ({ value: String(s.id), label: s.title }));
        const empty = options.length === 0;
        return (
          <PickerModal
            isOpen
            onClose={closeSurveyPicker}
            title={t('add_survey_title', { defaultValue: 'Add a survey' })}
            subtitle={t('pick_existing_survey', { defaultValue: 'Pick one of your existing surveys to attach to this section.' })}
            footer={!empty && (
              <Button
                disabled={!pickedSurveyId}
                loading={surveyAdd.isPending}
                onClick={() => surveyPickerModule != null && pickedSurveyId &&
                  surveyAdd.mutate({ moduleId: surveyPickerModule, surveyId: Number(pickedSurveyId) })}
              >
                {t('common:add', { defaultValue: 'Add' })}
              </Button>
            )}
          >
            {empty ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('no_surveys_create', { defaultValue: 'You have no surveys to add. Create one first.' })}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => { closeSurveyPicker(); navigate(`/teach/surveys?courseId=${courseId}`); }}
                >
                  {t('create_survey_link', { defaultValue: 'Go to surveys' })}
                </Button>
              </div>
            ) : (
              <SearchableSelect
                label={t('select_survey', { defaultValue: 'Select a survey' })}
                value={pickedSurveyId}
                onChange={setPickedSurveyId}
                options={options}
              />
            )}
          </PickerModal>
        );
      })()}

      {/* AI agent picker — attach a course tutor or global chatbot to a topic */}
      <PickerModal
        isOpen={agentPickerModule != null}
        onClose={closeAgentPicker}
        title={t('add_ai_agent_title', { defaultValue: 'Add an AI agent' })}
        subtitle={t('pick_existing_agent', { defaultValue: 'Pick a tutor or chatbot to add to this section as a chat.' })}
      >
        {(() => {
          const courseOpts = agentTutors
            .filter(ct => ct.isActive)
            .map(ct => {
              const displayName = ct.customName || ct.chatbot?.displayName || 'Tutor';
              return {
                key: `course-${ct.id}`,
                displayName,
                description: ct.customDescription || ct.chatbot?.description || '',
                systemPrompt: ct.customSystemPrompt || ct.chatbot?.systemPrompt || '',
                welcome: ct.customWelcomeMessage || ct.chatbot?.welcomeMessage || `Hi! I'm ${displayName}. How can I help you today?`,
                imageUrl: ct.chatbot?.avatarUrl ?? null,
              };
            });
          const globalOpts = agentChatbots.map(c => ({
            key: `global-${c.id}`,
            displayName: c.displayName,
            description: c.description ?? '',
            systemPrompt: c.systemPrompt,
            welcome: c.welcomeMessage || `Hi! I'm ${c.displayName}. How can I help you today?`,
            imageUrl: c.avatarUrl ?? null,
          }));
          const q = agentSearch.toLowerCase();
          const matchOpt = (o: { displayName: string; description: string }) =>
            o.displayName.toLowerCase().includes(q) || o.description.toLowerCase().includes(q);
          const course = courseOpts.filter(matchOpt);
          const global = globalOpts.filter(matchOpt);
          const pick = (o: { displayName: string; description: string; systemPrompt: string; welcome: string; imageUrl?: string | null }) =>
            agentPickerModule != null && addAgentMutation.mutate({ moduleId: agentPickerModule, agent: o });

          const OptBtn = ({ o }: { o: typeof course[number] }) => (
            <button
              type="button"
              disabled={addAgentMutation.isPending}
              onClick={() => pick(o)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b last:border-b-0 border-gray-100 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-700/50 transition-colors"
            >
              <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{o.displayName}</div>
              {o.description && <div className="text-xs mt-0.5 line-clamp-2 text-gray-500 dark:text-gray-400">{o.description}</div>}
            </button>
          );

          return (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  value={agentSearch}
                  onChange={e => setAgentSearch(e.target.value)}
                  placeholder={t('search', { defaultValue: 'Search…' })}
                  aria-label={t('search', { defaultValue: 'Search…' })}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500"
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {course.length === 0 && global.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('no_agents_available', { defaultValue: 'No AI agents available. Add tutors to this course first.' })}
                  </div>
                ) : (
                  <>
                    {course.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 dark:bg-gray-800 sticky top-0">
                          {t('agents_from_this_course', { defaultValue: 'From this course' })}
                        </div>
                        {course.map(o => <OptBtn key={o.key} o={o} />)}
                      </>
                    )}
                    {global.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 dark:bg-gray-800 sticky top-0">
                          {t('agents_all_chatbots', { defaultValue: 'All chatbots' })}
                        </div>
                        {global.map(o => <OptBtn key={o.key} o={o} />)}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </PickerModal>

      {/* Unified add-resource modal — one design, per-type body. */}
      {addModal && (() => {
        const titles: Record<AddType, string> = {
          lecture: t('add_lesson', { defaultValue: 'Add Lesson' }),
          codelab: t('add_code_lab', { defaultValue: 'Add Code Lab' }),
          assignment: t('add_assignment', { defaultValue: 'Add Assignment' }),
          quiz: t('add_quiz', { defaultValue: 'Add Quiz' }),
          forum: t('add_forum', { defaultValue: 'Add Forum' }),
          video: t('add_video_title', { defaultValue: 'Add a video' }),
          file: imageOnly ? t('add_image_title', { defaultValue: 'Add an image' }) : t('add_file_title', { defaultValue: 'Add a file' }),
          folder: t('add_folder_title', { defaultValue: 'Add a folder' }),
          url: t('add_url_title', { defaultValue: 'Add a link' }),
          page: t('add_page_title', { defaultValue: 'Add a page' }),
          embed: t('add_embed_title', { defaultValue: 'Add an embed' }),
          poll: t('add_poll_title', { defaultValue: 'Add a poll' }),
        };
        const titleLabels: Partial<Record<AddType, string>> = {
          lecture: t('lesson_title', { defaultValue: 'Lesson title' }),
          folder: t('folder_title_label', { defaultValue: 'Folder name' }),
          forum: t('forum_title', { defaultValue: 'Discussion title' }),
          url: t('url_title', { defaultValue: 'Link title' }),
          page: t('page_title_label', { defaultValue: 'Page title' }),
          poll: t('poll_title_label', { defaultValue: 'Poll title' }),
        };
        const { type, editing } = addModal;
        const modalTitle = editing
          ? (type === 'url'
              ? t('edit_url_title', { defaultValue: 'Edit link' })
              : t('edit_embed_title', { defaultValue: 'Edit embed' }))
          : titles[type];
        // Match the server's per-type minimum title length so we never fire a
        // request that 400s: assignment min 3, lecture-backed types min 2.
        const lectureBacked = type === 'lecture' || type === 'video' || type === 'file' || type === 'folder' || type === 'url' || type === 'page' || type === 'embed';
        const minTitle = type === 'assignment' ? 3 : lectureBacked ? 2 : 1;
        // A batch is "ready" only when at least one file uploaded AND none are
        // still uploading — otherwise Create would fire mid-upload and silently
        // drop the files that haven't finished (submitAdd keeps only `done`).
        const fileUploading = fileBatch.some(f => f.status === 'uploading');
        const folderUploading = folderBatch.some(f => f.status === 'uploading');
        // A failed upload must block Create too — otherwise it is silently
        // dropped (submitAdd only keeps 'done' files) under a success toast.
        // The user can remove the failed row to proceed.
        const fileError = fileBatch.some(f => f.status === 'error');
        const folderError = folderBatch.some(f => f.status === 'error');
        const fileReadyCount = fileBatch.filter(f => f.status === 'done').length;
        const folderReadyCount = folderBatch.filter(f => f.status === 'done').length;
        const pollOptsValid = pollOptions.map(o => o.trim()).filter(Boolean).length >= 2;
        const bodyValid =
          type === 'video' ? !!videoExtra
          : type === 'file' ? (fileReadyCount > 0 && !fileUploading && !fileError)
          : type === 'folder' ? (folderReadyCount > 0 && !folderUploading && !folderError)
          : type === 'url' ? !!urlValue.trim()
          : type === 'embed' ? !!embedUrl.trim()
          : type === 'poll' ? (!!pollQuestion.trim() && pollOptsValid)
          : true;  // page needs only a title
        const canCreate = meta.title.trim().length >= minTitle && bodyValid && availabilityIsValid(meta);
        const dropzone = 'flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 dark:hover:border-teal-500 text-gray-500 dark:text-gray-400 transition-colors focus-within:ring-2 focus-within:ring-teal-400 focus-within:border-teal-400';
        const uploading = (
          <div className="py-4 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-teal-500" /><p className="text-xs mt-1 text-gray-500 dark:text-gray-400">{progress != null ? `${progress}%` : t('uploading', { defaultValue: 'Uploading…' })}</p></div>
        );
        return (
          <AddResourceModal
            isOpen
            onClose={closeAdd}
            title={modalTitle}
            meta={meta}
            onMetaChange={setMeta}
            onCreate={submitAdd}
            canCreate={canCreate}
            busy={busy}
            createLabel={editing ? t('common:save', { defaultValue: 'Save' }) : undefined}
            titleLabel={titleLabels[type]}
          >
            {type === 'file' && (
              <div className="space-y-2">
                {fileBatch.length > 0 && (
                  <ul className="space-y-1.5">
                    {fileBatch.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                        {f.status === 'uploading' ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-teal-500" />
                          : f.status === 'error' ? <X className="w-4 h-4 shrink-0 text-red-500" />
                          : <Check className="w-4 h-4 shrink-0 text-emerald-500" />}
                        <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200" title={f.name}>{f.name}</span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {f.status === 'uploading' ? t('uploading', { defaultValue: 'Uploading…' })
                            : f.status === 'error' ? t('upload_failed', { defaultValue: 'Failed' })
                            : t('ready', { defaultValue: 'Ready' })}
                        </span>
                        <button type="button" onClick={() => setFileBatch(b => b.filter((_, j) => j !== i))} className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label={t('common:remove', { defaultValue: 'Remove' })}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className={dropzone}>
                  <UploadCloud className="w-7 h-7" />
                  <span className="text-sm font-medium">
                    {imageOnly
                      ? t('choose_images', { defaultValue: 'Click to choose image(s)' })
                      : t('choose_files', { defaultValue: 'Click to choose file(s)' })}
                  </span>
                  <input type="file" multiple accept={imageOnly ? 'image/*' : undefined} className="hidden" onChange={onPickFilesForModal} />
                </label>
                {fileReadyCount > 1 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('files_each_own_item', { defaultValue: 'Each file becomes its own item.' })}
                  </p>
                )}
              </div>
            )}
            {type === 'folder' && (
              <div className="space-y-2">
                {folderBatch.length > 0 && (
                  <ul className="space-y-1.5">
                    {folderBatch.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                        {f.status === 'uploading' ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-teal-500" />
                          : f.status === 'error' ? <X className="w-4 h-4 shrink-0 text-red-500" />
                          : <Check className="w-4 h-4 shrink-0 text-emerald-500" />}
                        <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200" title={f.name}>{f.name}</span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {f.status === 'uploading' ? t('uploading', { defaultValue: 'Uploading…' })
                            : f.status === 'error' ? t('upload_failed', { defaultValue: 'Failed' })
                            : t('ready', { defaultValue: 'Ready' })}
                        </span>
                        <button type="button" onClick={() => setFolderBatch(b => b.filter((_, j) => j !== i))} className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label={t('common:remove', { defaultValue: 'Remove' })}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className={dropzone}>
                  <UploadCloud className="w-7 h-7" />
                  <span className="text-sm font-medium">{t('add_files_to_folder', { defaultValue: 'Click to add file(s) to this folder' })}</span>
                  <input type="file" multiple className="hidden" onChange={onPickFilesForFolder} />
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('folder_groups_files_hint', { defaultValue: 'All files are grouped into one collapsible folder item.' })}
                </p>
              </div>
            )}
            {type === 'url' && (
              <div className="space-y-3">
                <Input
                  type="url"
                  label={t('url_field', { defaultValue: 'Link URL' })}
                  value={urlValue}
                  onChange={e => setUrlValue(e.target.value)}
                  placeholder="https://example.com"
                  required
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 select-none cursor-pointer">
                  <input type="checkbox" checked={urlNewTab} onChange={e => setUrlNewTab(e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-400" />
                  {t('url_new_tab', { defaultValue: 'Open in a new tab' })}
                </label>
              </div>
            )}
            {type === 'page' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{t('page_body', { defaultValue: 'Page content' })}</label>
                <textarea
                  value={pageBody}
                  onChange={e => setPageBody(e.target.value)}
                  rows={6}
                  placeholder={t('page_body_placeholder', { defaultValue: 'Write the page content here…' })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y"
                />
              </div>
            )}
            {type === 'embed' && (
              <div className="space-y-3">
                <Input
                  type="url"
                  label={t('embed_field', { defaultValue: 'Embed URL (H5P, Padlet, Genially, Google Slides…)' })}
                  value={embedUrl}
                  onChange={e => setEmbedUrl(e.target.value)}
                  placeholder="https://…"
                  required
                />
                <Input
                  type="number"
                  label={t('embed_height', { defaultValue: 'Height (px)' })}
                  value={String(embedHeight)}
                  onChange={e => setEmbedHeight(Math.max(160, Math.min(1200, parseInt(e.target.value, 10) || 480)))}
                  min={160}
                  max={1200}
                />
              </div>
            )}
            {type === 'poll' && (
              <div className="space-y-3">
                <Input
                  label={t('poll_question', { defaultValue: 'Question' })}
                  value={pollQuestion}
                  onChange={e => setPollQuestion(e.target.value)}
                  placeholder={t('poll_question_placeholder', { defaultValue: 'What would you like to ask?' })}
                  required
                />
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">{t('poll_options', { defaultValue: 'Options' })}</span>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={e => setPollOptions(o => o.map((v, j) => j === i ? e.target.value : v))}
                        placeholder={t('poll_option_n', { defaultValue: 'Option {{n}}', n: i + 1 })}
                      />
                      {pollOptions.length > 2 && (
                        <button type="button" onClick={() => setPollOptions(o => o.filter((_, j) => j !== i))} className="shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label={t('common:remove', { defaultValue: 'Remove' })}>
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setPollOptions(o => [...o, ''])} className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 dark:text-teal-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded">
                    <Plus className="w-4 h-4" />{t('poll_add_option', { defaultValue: 'Add option' })}
                  </button>
                </div>
              </div>
            )}
            {type === 'video' && (
              <div className="space-y-3">
                {videoExtra ? (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 truncate"><Check className="w-4 h-4" />{videoExtra.mode === 'embed' ? t('embed_video_link', { defaultValue: 'Embed link' }) : t('upload_a_video', { defaultValue: 'Video file' })}</span>
                    <button type="button" onClick={() => setVideoExtra(null)} className="text-xs underline shrink-0">{t('common:change', { defaultValue: 'Change' })}</button>
                  </div>
                ) : busy ? uploading : (
                  <>
                    <label className={dropzone}>
                      <UploadCloud className="w-7 h-7" />
                      <span className="text-sm font-medium">{t('upload_a_video', { defaultValue: 'Upload a video file' })}</span>
                      <input type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" className="hidden" onChange={onPickVideoForModal} />
                    </label>
                    <div className="text-center text-xs font-medium text-gray-400">{t('or', { defaultValue: 'or' })}</div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input type="url" label={t('embed_video_link', { defaultValue: 'Paste a YouTube / Vimeo link' })} value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setVideoEmbed(); } }} />
                      </div>
                      <Button onClick={setVideoEmbed} disabled={!videoUrl.trim()} icon={<Link2 className="w-4 h-4" />}>{t('embed', { defaultValue: 'Embed' })}</Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </AddResourceModal>
        );
      })()}
    </div>
  );
};

// ─── "Add section" (add a topic) dashed button ──────────────────────────────

const AddSectionRow = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900"
  >
    <Plus className="w-4 h-4 shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);

// ─── Module card ────────────────────────────────────────────────────────────

interface ModuleCardProps {
  module: { id: number; title: string; description?: string; isPublished: boolean; items: EditorItem[] };
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReorderItems: (items: { type: ReorderableType; id: number }[]) => void;
  onRenameModule: (title: string) => void;
  onDescribeModule: (description: string) => void;
  onToggleModule: () => void;
  onDeleteModule: () => void;
  onRenameItem: (item: EditorItem, title: string) => void;
  onToggleItem: (item: EditorItem) => void;
  onEditItem: (item: EditorItem) => void;
  onDuplicateItem: (item: EditorItem) => void;
  onDeleteItem: (item: EditorItem) => void;
  onAdd: (kind: PaletteKind) => void;
}

/** A palette tile: icon, label, one-line description, and accent colors. */
interface PaletteTile {
  kind: PaletteKind;
  Icon: typeof FileText;
  color: string;
  colorDark: string;
  labelKey: string;
  labelFallback: string;
  descKey: string;
  descFallback: string;
}

/** The add palette, grouped into Content / Activities / AI & Labs. */
const PALETTE_GROUPS: { headingKey: string; headingFallback: string; tiles: PaletteTile[] }[] = [
  {
    headingKey: 'group_content', headingFallback: 'Content',
    tiles: [
      { kind: 'lecture', Icon: FileText, color: '#475569', colorDark: '#94a3b8', labelKey: 'add_lesson', labelFallback: 'Lesson', descKey: 'desc_lesson', descFallback: 'A full multi-section lesson' },
      { kind: 'page', Icon: FileType2, color: '#475569', colorDark: '#94a3b8', labelKey: 'add_page', labelFallback: 'Page', descKey: 'desc_page', descFallback: 'A simple text page' },
      { kind: 'file', Icon: FileUp, color: '#0d9488', colorDark: '#2dd4bf', labelKey: 'add_file', labelFallback: 'File', descKey: 'desc_file', descFallback: 'A downloadable file' },
      { kind: 'folder', Icon: Folder, color: '#d97706', colorDark: '#fbbf24', labelKey: 'add_folder', labelFallback: 'Folder', descKey: 'desc_folder', descFallback: 'Group several files in one item' },
      { kind: 'video', Icon: Video, color: '#0284c7', colorDark: '#38bdf8', labelKey: 'add_video', labelFallback: 'Video', descKey: 'desc_video', descFallback: 'Upload or embed a video' },
      { kind: 'url', Icon: LinkIcon, color: '#0284c7', colorDark: '#38bdf8', labelKey: 'add_url', labelFallback: 'URL', descKey: 'desc_url', descFallback: 'A link to an external site' },
      { kind: 'image', Icon: ImageIcon, color: '#0891b2', colorDark: '#22d3ee', labelKey: 'add_image', labelFallback: 'Image', descKey: 'desc_image', descFallback: 'An image shown inline' },
      { kind: 'embed', Icon: MonitorPlay, color: '#7c3aed', colorDark: '#a78bfa', labelKey: 'add_embed', labelFallback: 'Embed', descKey: 'desc_embed', descFallback: 'Interactive iframe (H5P, Padlet…)' },
    ],
  },
  {
    headingKey: 'group_activities', headingFallback: 'Activities',
    tiles: [
      { kind: 'assignment', Icon: ClipboardList, color: '#d97706', colorDark: '#fbbf24', labelKey: 'add_assignment', labelFallback: 'Assignment', descKey: 'desc_assignment', descFallback: 'A graded submission' },
      { kind: 'quiz', Icon: FileQuestion, color: '#0891b2', colorDark: '#22d3ee', labelKey: 'add_quiz', labelFallback: 'Quiz', descKey: 'desc_quiz', descFallback: 'An auto-graded quiz' },
      { kind: 'forum', Icon: MessageSquare, color: '#0d9488', colorDark: '#2dd4bf', labelKey: 'add_forum', labelFallback: 'Forum', descKey: 'desc_forum', descFallback: 'A discussion board' },
      { kind: 'survey', Icon: ClipboardCheck, color: '#4f46e5', colorDark: '#a5b4fc', labelKey: 'add_survey', labelFallback: 'Survey', descKey: 'desc_survey', descFallback: 'Attach one of your surveys' },
      { kind: 'poll', Icon: BarChart3, color: '#4f46e5', colorDark: '#a5b4fc', labelKey: 'add_poll', labelFallback: 'Poll', descKey: 'desc_poll', descFallback: 'A quick one-question vote' },
      { kind: 'codelab', Icon: FlaskConical, color: '#059669', colorDark: '#34d399', labelKey: 'add_code_lab', labelFallback: 'Code Lab', descKey: 'desc_code_lab', descFallback: 'An interactive coding lab' },
    ],
  },
  {
    headingKey: 'group_ai_labs', headingFallback: 'AI & Labs',
    tiles: [
      { kind: 'agent', Icon: Bot, color: '#7c3aed', colorDark: '#a78bfa', labelKey: 'add_ai_agent', labelFallback: 'AI Agent', descKey: 'desc_ai_agent', descFallback: 'Attach a tutor / chatbot' },
    ],
  },
];

/** Total tile count — used to decide whether to show the palette search box. */
const PALETTE_TILE_COUNT = PALETTE_GROUPS.reduce((n, g) => n + g.tiles.length, 0);

const ModuleCard = ({
  module, isFirst, isLast, onMoveUp, onMoveDown, onReorderItems,
  onRenameModule, onDescribeModule, onToggleModule, onDeleteModule,
  onRenameItem, onToggleItem, onEditItem, onDuplicateItem, onDeleteItem, onAdd,
}: ModuleCardProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { isDark } = useTheme();
  const [open, setOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [moduleDesc, setModuleDesc] = useState(module.description ?? '');
  useEffect(() => { setModuleDesc(module.description ?? ''); }, [module.description]);
  // Index (within `reorderable`) of the row currently being dragged.
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // The reorderable subset (everything except pinned reference items), in
  // display order. Moving an item swaps it with its neighbour here and sends
  // the full new order to the server.
  const reorderable = module.items.filter(i => !i.reference) as (EditorItem & { type: ReorderableType })[];
  const commitOrder = (next: typeof reorderable) =>
    onReorderItems(next.map(r => ({ type: r.type, id: r.id })));
  const moveItem = (item: EditorItem, dir: -1 | 1) => {
    const i = reorderable.findIndex(r => r.type === item.type && r.id === item.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= reorderable.length) return;
    const next = [...reorderable];
    [next[i], next[j]] = [next[j], next[i]];
    commitOrder(next);
  };
  // Drag row at `from` to position `to` (both indices within `reorderable`).
  const dropItem = (to: number) => {
    if (dragIndex == null || dragIndex === to) { setDragIndex(null); return; }
    const next = [...reorderable];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(to, 0, moved);
    setDragIndex(null);
    commitOrder(next);
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen(o => !o)} className="shrink-0 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label={open ? t('collapse', { defaultValue: 'Collapse' }) : t('expand', { defaultValue: 'Expand' })}>
          {open ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
        </button>
        <InlineTitle
          title={module.title}
          onSave={onRenameModule}
          className="text-base font-bold text-gray-900 dark:text-white"
        />
        {!module.isPublished && <HiddenBadge />}
        <div className="ml-auto shrink-0 flex items-center gap-0.5">
          <ReorderArrows isFirst={isFirst} isLast={isLast} onUp={onMoveUp} onDown={onMoveDown} />
          <ItemActions
            isPublished={module.isPublished}
            onToggle={onToggleModule}
            onDelete={onDeleteModule}
          />
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          {/* Topic description — shown on the course front page under the title. */}
          <textarea
            value={moduleDesc}
            onChange={e => setModuleDesc(e.target.value)}
            onBlur={() => onDescribeModule(moduleDesc.trim())}
            rows={2}
            placeholder={t('section_description_placeholder', { defaultValue: 'Add a description for this section (optional)…' })}
            className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          />
          <div className="border-t border-dashed border-gray-200 dark:border-gray-700 pt-2 space-y-1">
            {module.items.map(item => {
              const ri = item.reference ? -1 : reorderable.findIndex(r => r.type === item.type && r.id === item.id);
              return (
                <ItemRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  canReorder={!item.reference}
                  isFirst={ri === 0}
                  isLast={ri === reorderable.length - 1}
                  onMoveUp={() => moveItem(item, -1)}
                  onMoveDown={() => moveItem(item, 1)}
                  isDragging={dragIndex === ri}
                  onDragStart={() => setDragIndex(ri)}
                  onDragOverRow={(e) => { if (!item.reference) e.preventDefault(); }}
                  onDropRow={() => dropItem(ri)}
                  onDragEnd={() => setDragIndex(null)}
                  onRename={(title) => onRenameItem(item, title)}
                  onToggle={() => onToggleItem(item)}
                  onEdit={() => onEditItem(item)}
                  onDuplicate={() => onDuplicateItem(item)}
                  onDelete={() => onDeleteItem(item)}
                />
              );
            })}
          </div>

          {/* Bottom + add bar */}
          <div className="relative mt-3 flex items-center">
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
            <button
              type="button"
              onClick={() => setAddOpen(o => !o)}
              aria-expanded={addOpen}
              className="mx-2 shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium whitespace-nowrap bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              aria-label={t('add_resource', { defaultValue: 'Add resource' })}
            >
              <Plus className="w-4 h-4 shrink-0" />
              {t('add_resource', { defaultValue: 'Add resource' })}
            </button>
            <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
          </div>

          {addOpen && (() => {
            const q = paletteSearch.trim().toLowerCase();
            const groups = PALETTE_GROUPS
              .map(g => ({
                ...g,
                tiles: q ? g.tiles.filter(tile => t(tile.labelKey, { defaultValue: tile.labelFallback }).toLowerCase().includes(q)) : g.tiles,
              }))
              .filter(g => g.tiles.length > 0);
            return (
              <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 space-y-3">
                {/* Palette search — only when there are many tiles. */}
                {PALETTE_TILE_COUNT > 8 && (
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      value={paletteSearch}
                      onChange={e => setPaletteSearch(e.target.value)}
                      placeholder={t('search_resources', { defaultValue: 'Search resources…' })}
                      aria-label={t('search_resources', { defaultValue: 'Search resources…' })}
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500"
                    />
                  </div>
                )}
                {groups.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('no_results', { defaultValue: 'No matches' })}</p>
                ) : groups.map(group => (
                  <div key={group.headingKey} className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {t(group.headingKey, { defaultValue: group.headingFallback })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.tiles.map(tile => (
                        <button
                          key={tile.kind}
                          type="button"
                          onClick={() => { setAddOpen(false); setPaletteSearch(''); onAdd(tile.kind); }}
                          title={t(tile.descKey, { defaultValue: tile.descFallback })}
                          className="inline-flex flex-col items-start gap-1 px-3 py-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-white dark:hover:bg-gray-800 dark:hover:border-gray-700 transition-colors w-[148px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <tile.Icon className="w-4 h-4 shrink-0" style={{ color: isDark ? tile.colorDark : tile.color }} />
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{t(tile.labelKey, { defaultValue: tile.labelFallback })}</span>
                          </span>
                          <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400 line-clamp-2">{t(tile.descKey, { defaultValue: tile.descFallback })}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

// ─── Item row ─────────────────────────────────────────────────────────────

const ItemRow = ({
  item, canReorder, isFirst, isLast, onMoveUp, onMoveDown,
  isDragging, onDragStart, onDragOverRow, onDropRow, onDragEnd,
  onRename, onToggle, onEdit, onDuplicate, onDelete,
}: {
  item: EditorItem;
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOverRow: (e: React.DragEvent) => void;
  onDropRow: () => void;
  onDragEnd: () => void;
  onRename: (title: string) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) => {
  const { Icon, color, colorDark } = (item.subKind && SUBTYPE_META[item.subKind]) || ITEM_META[item.type];
  // Only the grip handle arms dragging — so clicking the title/inputs/buttons
  // never starts a drag. Native HTML5 DnD; reorder persists on drop.
  const [armed, setArmed] = useState(false);
  const { t } = useTranslation(['teaching', 'common']);
  const { isDark } = useTheme();
  return (
    <div
      draggable={canReorder && armed}
      onDragStart={onDragStart}
      onDragOver={onDragOverRow}
      onDrop={() => { onDropRow(); setArmed(false); }}
      onDragEnd={() => { onDragEnd(); setArmed(false); }}
      className={`group/item flex items-center gap-1.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 ${isDragging ? 'opacity-50 ring-2 ring-teal-300' : ''}`}
    >
      {canReorder ? (
        <button
          type="button"
          aria-label={t('drag_to_reorder', { defaultValue: 'Drag to reorder' })}
          title={t('drag_to_reorder', { defaultValue: 'Drag to reorder' })}
          onMouseDown={() => setArmed(true)}
          onMouseUp={() => setArmed(false)}
          className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <Icon className="w-4 h-4 shrink-0" style={{ color: isDark ? colorDark : color }} />
      {item.reference ? (
        // Assigned lab / interactive lab — reference to a shared resource, so
        // the title isn't renamed inline and there's no edit/hide, only remove.
        <Link to={item.viewHref} className="flex-1 min-w-0 text-sm font-medium text-teal-700 dark:text-teal-300 truncate hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded" title={item.title}>
          {item.title}
        </Link>
      ) : (
        <InlineTitle
          title={item.title}
          onSave={onRename}
          href={item.viewHref}
          className="text-sm font-medium text-teal-700 dark:text-teal-300"
        />
      )}
      {!item.isPublished && <HiddenBadge />}
      <div className="ml-auto shrink-0 flex items-center gap-0.5">
        {canReorder && <ReorderArrows isFirst={isFirst} isLast={isLast} onUp={onMoveUp} onDown={onMoveDown} />}
        <ItemActions
          isPublished={item.isPublished}
          onEdit={item.reference ? undefined : onEdit}
          // Duplicate is lessons-only for now.
          onDuplicate={item.type === 'lecture' ? onDuplicate : undefined}
          onToggle={item.reference ? undefined : onToggle}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
};

// ─── Up / down reorder arrows ───────────────────────────────────────────────

const ReorderArrows = ({
  isFirst, isLast, onUp, onDown,
}: {
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
}) => {
  const { t } = useTranslation(['teaching', 'common']);
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onUp}
        disabled={isFirst}
        aria-label={t('move_up', { defaultValue: 'Move up' })}
        title={t('move_up', { defaultValue: 'Move up' })}
        className="p-1.5 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <ArrowUp className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={isLast}
        aria-label={t('move_down', { defaultValue: 'Move down' })}
        title={t('move_down', { defaultValue: 'Move down' })}
        className="p-1.5 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <ArrowDown className="w-4 h-4" />
      </button>
    </div>
  );
};

/** Small opaque "Hidden" pill — keeps the row visually identical to visible
 *  items (no translucency) while still flagging hidden-from-students status. */
const HiddenBadge = () => {
  const { t } = useTranslation(['teaching']);
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
      <EyeOff className="w-3 h-3" />
      {t('hidden', { defaultValue: 'Hidden' })}
    </span>
  );
};

// ─── Inline editable title (pencil → input) ─────────────────────────────────

const InlineTitle = ({
  title, onSave, href, className = '', dimmed = false,
}: {
  title: string;
  onSave: (title: string) => void;
  href?: string;
  className?: string;
  dimmed?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { setDraft(title); setTimeout(() => inputRef.current?.select(), 0); } }, [editing, title]);

  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== title) onSave(v);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 flex-1 min-w-0">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          aria-label="Title"
          className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
        <button type="button" onClick={commit} className="shrink-0 p-1 rounded text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label="Save"><Check className="w-4 h-4" /></button>
        <button type="button" onClick={() => setEditing(false)} className="shrink-0 p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label="Cancel"><X className="w-4 h-4" /></button>
      </span>
    );
  }

  return (
    <span className={`group/title inline-flex items-center gap-1.5 min-w-0 flex-1 ${dimmed ? 'opacity-60' : ''}`}>
      {href ? (
        <Link to={href} className={`truncate hover:underline ${className}`} title={title}>{title}</Link>
      ) : (
        <span className={`truncate ${className}`} title={title}>{title}</span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        aria-label="Edit title"
        title="Edit title"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </span>
  );
};

// ─── Inline action icons (edit / duplicate / hide / delete) ─────────────────

/** A small inline action icon with an immediate hover tooltip rendered below
 *  it (so it isn't clipped by the row). `hover` sets the per-action hover
 *  tint so each reads at a glance. */
const ActionBtn = ({
  onClick, title, hover, children,
}: {
  onClick: () => void;
  title: string;
  hover: string;
  children: React.ReactNode;
}) => (
  <span className="relative group/act">
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className={`p-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${hover}`}
    >
      {children}
    </button>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/act:opacity-100 dark:bg-gray-700"
    >
      {title}
    </span>
  </span>
);

/** Always-visible inline row of small action icons. Each action only renders
 *  when its handler is supplied (e.g. modules have no edit/duplicate). */
const ItemActions = ({
  isPublished, onEdit, onDuplicate, onToggle, onDelete,
}: {
  isPublished: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onToggle?: () => void;
  onDelete: () => void;
}) => {
  const { t } = useTranslation(['common', 'teaching']);
  return (
    <div className="flex items-center gap-0.5">
      {onEdit && (
        <ActionBtn
          onClick={onEdit}
          title={t('common:edit', { defaultValue: 'Edit' })}
          hover="hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <SquarePen className="w-4 h-4 text-gray-500" />
        </ActionBtn>
      )}
      {onDuplicate && (
        <ActionBtn
          onClick={onDuplicate}
          title={t('teaching:duplicate_lesson', { defaultValue: 'Duplicate' })}
          hover="hover:bg-blue-100 dark:hover:bg-blue-900/30"
        >
          <Copy className="w-4 h-4 text-blue-500" />
        </ActionBtn>
      )}
      {onToggle && (
        <ActionBtn
          onClick={onToggle}
          title={isPublished ? t('teaching:hide', { defaultValue: 'Hide' }) : t('teaching:show', { defaultValue: 'Show' })}
          hover={isPublished ? 'hover:bg-green-100 dark:hover:bg-green-900/30' : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'}
        >
          {isPublished ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-amber-500" />}
        </ActionBtn>
      )}
      <ActionBtn
        onClick={onDelete}
        title={t('common:delete', { defaultValue: 'Delete' })}
        hover="hover:bg-red-100 dark:hover:bg-red-900/30"
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </ActionBtn>
    </div>
  );
};
