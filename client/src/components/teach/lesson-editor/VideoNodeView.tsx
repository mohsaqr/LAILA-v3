import { useContext, useEffect, useRef } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { resolveFileUrl } from '../../../api/client';
import {
  trackUploadedVideo,
  trackYouTubeEmbed,
  isYouTubeEmbed,
  withJsApi,
  type VideoXapiContext,
} from '../../../services/videoXapi';
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
 * When viewed (not editable), watch activity is captured via the xAPI Video
 * Profile (`services/videoXapi.ts`, built on the `xapi-youtube` package):
 * initialized / played / paused / seeked / playback-rate-changed / completed
 * / abandoned / terminated, plus a coarse `progressed` heartbeat every 30s.
 * Uploaded videos use native media events; embedded YouTube videos are driven
 * by the package's engine over the YouTube IFrame API. Non-YouTube embeds
 * (e.g. Vimeo) stay plain iframes — the IFrame API can't reach them.
 */
export const VideoNodeView = ({ node, deleteNode, editor }: NodeViewProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const { courseId, lectureId, sectionId } = useContext(LessonMediaContext);
  const editable = editor?.isEditable ?? true;
  const mode = (node.attrs.mode as string) || 'file';
  const src = node.attrs.src as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isYouTube = mode === 'embed' && isYouTubeEmbed(src);
  // YouTube embeds need `enablejsapi=1` so the IFrame API can attach.
  const iframeSrc = isYouTube ? withJsApi(src) : src;

  // Watch tracking — only when read-only (a student watching, not an
  // instructor editing) and only when we know which lecture this is (so
  // instructor previews without context don't generate logs).
  useEffect(() => {
    if (editable || lectureId == null) return;

    const ctx: VideoXapiContext = {
      courseId,
      lectureId,
      sectionId,
      title: titleFromSrc(src),
      src,
      mode: mode === 'embed' ? 'embed' : 'file',
    };

    if (mode === 'embed') {
      if (!isYouTube || !iframeRef.current) return;
      return trackYouTubeEmbed(iframeRef.current, ctx);
    }
    if (!videoRef.current) return;
    return trackUploadedVideo(videoRef.current, ctx);
  }, [editable, mode, src, courseId, lectureId, sectionId, isYouTube]);

  return (
    <NodeViewWrapper as="div" className="my-3 relative group/video max-w-xl mx-auto" data-drag-handle>
      <div contentEditable={false}>
        {/* Both uploaded videos and embeds use one full-width 16:9 frame so
            they take the whole content width at a consistent, reasonable size. */}
        <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ paddingBottom: '56.25%' }}>
          {mode === 'embed' ? (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
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
