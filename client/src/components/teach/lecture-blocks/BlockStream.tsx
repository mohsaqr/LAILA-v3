import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { coursesApi } from '../../../api/courses';
import type {
  LectureSection,
  CreateSectionData,
  UpdateSectionData,
} from '../../../types';
type PendingUpdate = UpdateSectionData;
import { TextBlock } from './TextBlock';
import { FileBlock } from './FileBlock';
import { ChatbotBlock } from './ChatbotBlock';
import { LegacyBlock } from './LegacyBlock';
import { BlockShell } from './BlockShell';
import { InlineInserter } from './InlineInserter';

type InsertableType = 'text' | 'file' | 'chatbot';

interface BlockStreamProps {
  lectureId: number;
  initialSections: LectureSection[];
}

const sortByOrder = (a: LectureSection, b: LectureSection) =>
  (a.order ?? 0) - (b.order ?? 0);

/**
 * Block-based lecture editor. Owns the section list, all CRUD
 * mutations, and native HTML5 drag-and-drop reordering. Auto-creates
 * one empty text block when the lecture has no sections so the
 * canvas is never blank.
 */
export const BlockStream = ({ lectureId, initialSections }: BlockStreamProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const queryClient = useQueryClient();

  const [sections, setSections] = useState<LectureSection[]>(
    () => [...initialSections].sort(sortByOrder),
  );
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | 'top' | null>(null);
  const autoCreateRef = useRef(false);
  // Keep ids of sections the user just deleted so the courseDetails refetch
  // (which is stale for a moment after deleteMutation) doesn't resurrect them.
  const deletedIdsRef = useRef<Set<number>>(new Set());
  // Updates / deletes that arrived while a create mutation was still in
  // flight. Keyed by tempId; flushed in createMutation.onSuccess.
  const pendingUpdatesRef = useRef<Map<number, PendingUpdate>>(new Map());
  const pendingDeletesRef = useRef<Set<number>>(new Set());

  // Sync external server-side updates back into local state.
  useEffect(() => {
    setSections(prev => {
      const fresh = [...initialSections]
        .filter(s => !deletedIdsRef.current.has(s.id))
        .sort(sortByOrder);
      // Preserve any pending optimistic stub (negative id) AND keep local
      // content for any section already known so the user's in-flight edits
      // aren't clobbered by a stale refetch.
      const localById = new Map(prev.map(s => [s.id, s]));
      const merged = fresh.map(f => {
        const local = localById.get(f.id);
        if (!local) return f;
        return { ...f, ...local, content: local.content };
      });
      // Append local-only stubs (still being created) at their tail position.
      const stubs = prev.filter(p => p.id < 0);
      return [...merged, ...stubs].sort(sortByOrder);
    });
  }, [initialSections]);

  const createMutation = useMutation({
    mutationFn: ({ data }: { data: CreateSectionData; tempId: number }) =>
      coursesApi.createSection(lectureId, data),
    onSuccess: (created, vars) => {
      // If the user deleted the still-being-created section, delete it now.
      if (pendingDeletesRef.current.has(vars.tempId)) {
        pendingDeletesRef.current.delete(vars.tempId);
        deletedIdsRef.current.add(created.id);
        deleteMutation.mutate(created.id);
        setSections(prev => prev.filter(s => s.id !== vars.tempId));
        return;
      }
      // Otherwise replace the temp id with the real one — but preserve any
      // local content the user typed while the create was in flight.
      setSections(prev => prev.map(s => {
        if (s.id !== vars.tempId) return s;
        return { ...created, content: s.content ?? created.content };
      }));
      // Flush any pending updates queued while the create was in flight.
      const pending = pendingUpdatesRef.current.get(vars.tempId);
      if (pending) {
        pendingUpdatesRef.current.delete(vars.tempId);
        updateMutation.mutate({ id: created.id, data: pending });
      }
      queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
    },
    onError: () => {
      toast.error(t('teaching:failed_to_save_lesson', { defaultValue: 'Failed to save section.' }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSectionData }) =>
      coursesApi.updateSection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
    },
    onError: () => {
      toast.error(t('teaching:failed_to_save_lesson', { defaultValue: 'Failed to save section.' }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => coursesApi.deleteSection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
    },
    onError: () => {
      toast.error(t('teaching:failed_to_save_lesson', { defaultValue: 'Failed to delete section.' }));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => coursesApi.reorderSections(lectureId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courseDetails'] });
    },
    onError: () => {
      toast.error(t('teaching:failed_to_save_lesson', { defaultValue: 'Failed to reorder.' }));
    },
  });

  // Auto-create one empty text block on first mount if the lecture is empty.
  useEffect(() => {
    if (autoCreateRef.current) return;
    if (sections.length > 0) return;
    autoCreateRef.current = true;
    insertAt(0, 'text');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertAt = (index: number, type: InsertableType) => {
    const tempId = -Date.now();
    const stub: LectureSection = {
      id: tempId,
      lectureId,
      title: null,
      type,
      content: type === 'text' ? '' : null,
      fileName: null,
      fileUrl: null,
      fileType: null,
      fileSize: null,
      order: index,
    };
    setSections(prev => {
      const next = [...prev];
      next.splice(index, 0, stub);
      return next;
    });
    createMutation.mutate({ tempId, data: { type, content: stub.content ?? undefined } });
  };

  const handleUpdate = (id: number, patch: UpdateSectionData) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    if (id < 0) {
      // Queue the update so it fires once the create resolves.
      const merged = { ...(pendingUpdatesRef.current.get(id) ?? {}), ...patch };
      pendingUpdatesRef.current.set(id, merged);
      return;
    }
    updateMutation.mutate({ id, data: patch });
  };

  const handleDelete = (id: number) => {
    setSections(prev => prev.filter(s => s.id !== id));
    if (id < 0) {
      // Defer the delete until the create returns the real id.
      pendingDeletesRef.current.add(id);
      pendingUpdatesRef.current.delete(id);
      return;
    }
    deletedIdsRef.current.add(id);
    deleteMutation.mutate(id);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    reorderMutation.mutate(next.map(s => s.id).filter(id => id > 0));
  };

  // ─── Native HTML5 drag-and-drop ───────────────────────────────────────────

  const onDragStart = (id: number) => (e: React.DragEvent<HTMLElement>) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const onDragEnd = () => {
    setDraggedId(null);
    setDropTargetId(null);
  };

  const onDragOverGap = (targetId: number | 'top') => (e: React.DragEvent<HTMLElement>) => {
    if (draggedId == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetId);
  };

  const onDropGap = (targetId: number | 'top') => (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (draggedId == null) return;
    setDropTargetId(null);
    if (draggedId === targetId) return;
    setSections(prev => {
      const fromIdx = prev.findIndex(s => s.id === draggedId);
      if (fromIdx === -1) return prev;
      const without = prev.filter(s => s.id !== draggedId);
      const targetIdx = targetId === 'top'
        ? 0
        : without.findIndex(s => s.id === targetId);
      if (targetIdx === -1) return prev;
      const next = [...without];
      next.splice(targetIdx, 0, prev[fromIdx]);
      reorderMutation.mutate(next.map(s => s.id).filter(id => id > 0));
      return next;
    });
    setDraggedId(null);
  };

  const renderBlock = (section: LectureSection) => {
    switch (section.type) {
      case 'text':
        return (
          <TextBlock
            section={section}
            onChange={patch => handleUpdate(section.id, patch)}
            autoFocus={!section.content}
          />
        );
      case 'file':
        return (
          <FileBlock
            section={section}
            onChange={patch => handleUpdate(section.id, patch)}
          />
        );
      case 'chatbot':
        return (
          <ChatbotBlock
            section={section}
            onChange={patch => handleUpdate(section.id, patch)}
          />
        );
      default:
        return <LegacyBlock section={section} />;
    }
  };

  const blocks = useMemo(() => sections, [sections]);

  return (
    <div>
      {/* Top inserter (so you can prepend before the first block) */}
      <div
        onDragOver={onDragOverGap('top')}
        onDrop={onDropGap('top')}
        className="relative"
      >
        <div
          aria-hidden="true"
          className="h-0.5 rounded-full transition-opacity"
          style={{
            backgroundColor: '#0d9488',
            opacity: dropTargetId === 'top' ? 1 : 0,
          }}
        />
      </div>

      {blocks.map((section, i) => (
        <div key={section.id} className="mb-3 last:mb-0">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 pt-2 pb-3 shadow-sm">
            <BlockShell
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
              isDragging={draggedId === section.id}
              isDropTarget={dropTargetId === section.id}
              onDragStart={onDragStart(section.id)}
              onDragEnd={onDragEnd}
              onDragOverGap={onDragOverGap(section.id)}
              onDropGap={onDropGap(section.id)}
              onMoveUp={() => move(i, -1)}
              onMoveDown={() => move(i, 1)}
              onDelete={() => handleDelete(section.id)}
            >
              {renderBlock(section)}
            </BlockShell>
          </div>
          <InlineInserter
            onInsert={(type) => insertAt(i + 1, type)}
            omitText={section.type === 'text'}
          />
        </div>
      ))}
    </div>
  );
};
