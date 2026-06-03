import { useContext, useEffect, useRef } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveFileUrl } from '../../../api/client';
import { activityLogger } from '../../../services/activityLogger';
import { LessonMediaContext } from './LessonMediaContext';

/** Filename (without uuid noise) for a friendlier log title. */
const titleFromSrc = (src: string) => {
  try {
    return decodeURIComponent(src.split('/').pop() || 'video');
  } catch {
    return 'video';
  }
};

/**
 * Inline video node. Renders either an uploaded HTML5 `<video>` (mode
 * 'file') or an embedded `<iframe>` for an external provider such as
 * YouTube/Vimeo (mode 'embed'). Used by both the editor and the
 * read-only LessonViewer.
 *
 * When viewed (not editable), an uploaded video logs a `progressed`
 * activity every 30 seconds it is actually playing, plus a `completed`
 * event when it ends, so watch time lands in the activity logs.
 */
export const VideoNodeView = ({ node, deleteNode, editor }: NodeViewProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { courseId, lectureId } = useContext(LessonMediaContext);
  const editable = editor?.isEditable ?? true;
  const mode = (node.attrs.mode as string) || 'file';
  const src = node.attrs.src as string;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Watch tracking — uploaded videos only, and only when read-only (a
  // student watching, not an instructor editing). Cross-origin embeds
  // (YouTube/Vimeo) can't be tracked from a plain iframe.
  useEffect(() => {
    if (editable || mode === 'embed') return;
    const el = videoRef.current;
    if (!el) return;

    const baseLog = (verb: 'progressed' | 'completed', subtype: string) =>
      activityLogger.log({
        verb,
        objectType: 'video',
        objectTitle: titleFromSrc(src),
        courseId,
        lectureId,
        duration: Number.isFinite(el.duration) ? Math.round(el.duration) : undefined,
        progress: el.duration ? Math.round((el.currentTime / el.duration) * 100) : undefined,
        actionSubtype: subtype,
        extensions: { position: Math.round(el.currentTime), src },
      });

    // Fire every 30s, but only count time while the video is actually playing.
    const interval = setInterval(() => {
      if (!el.paused && !el.ended) baseLog('progressed', 'video.watch_tick');
    }, 30000);

    const onEnded = () => baseLog('completed', 'video.completed');
    el.addEventListener('ended', onEnded);

    return () => {
      clearInterval(interval);
      el.removeEventListener('ended', onEnded);
    };
  }, [editable, mode, src, courseId, lectureId]);

  return (
    <NodeViewWrapper as="div" className="my-3 relative group/video max-w-xl mx-auto" data-drag-handle>
      <div contentEditable={false}>
        {/* Both uploaded videos and embeds use one full-width 16:9 frame so
            they take the whole content width at a consistent, reasonable size. */}
        <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ paddingBottom: '56.25%' }}>
          {mode === 'embed' ? (
            <iframe
              src={src}
              title={t('block_video', { defaultValue: 'Video' })}
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              controls
              preload="metadata"
              // The `#t=0.1` media fragment makes the browser seek to and
              // paint the first frame as a poster thumbnail before playback.
              src={src ? `${resolveFileUrl(src)}#t=0.1` : undefined}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain' }}
            />
          )}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => deleteNode()}
            className="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-md bg-black/50 text-white opacity-0 group-hover/video:opacity-100 transition-opacity hover:bg-red-500"
            aria-label={t('common:delete', { defaultValue: 'Delete' })}
            title={t('common:delete', { defaultValue: 'Delete' })}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
};
