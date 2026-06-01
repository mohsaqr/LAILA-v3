import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Pencil,
  Check,
  X,
  Download,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import { resolveFileUrl } from '../../../api/client';

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText, doc: FileText, docx: FileText, txt: FileText,
  jpg: ImageIcon, jpeg: ImageIcon, png: ImageIcon, gif: ImageIcon, webp: ImageIcon, svg: ImageIcon,
  mp4: Film, mov: Film, avi: Film, webm: Film,
  mp3: Music, wav: Music, ogg: Music,
  zip: Archive, rar: Archive, '7z': Archive,
};

const iconFor = (fileType: string | null) => {
  if (!fileType) return FileIcon;
  return FILE_ICONS[fileType.toLowerCase().replace(/^\./, '')] || FileIcon;
};

/**
 * Inline File node — thin row with icon + filename (rename) +
 * download + delete. Sits inside the Tiptap editor flow.
 */
export const FileNodeView = ({ node, updateAttributes, deleteNode, editor }: NodeViewProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const editable = editor?.isEditable ?? true;
  const fileUrl = node.attrs.fileUrl as string;
  const fileName = node.attrs.fileName as string;
  const fileType = node.attrs.fileType as string;
  const Icon = iconFor(fileType);
  const url = fileUrl ? resolveFileUrl(fileUrl) : null;

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const startRename = () => {
    setDraft(fileName);
    setRenaming(true);
  };

  const commitRename = () => {
    const trimmed = draft.trim();
    setRenaming(false);
    if (trimmed && trimmed !== fileName) updateAttributes({ fileName: trimmed });
  };

  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const accent = isDark ? '#5eead4' : '#0d9488';

  return (
    <NodeViewWrapper
      as="div"
      className="my-2"
      data-drag-handle
    >
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
        style={{
          backgroundColor: isDark ? 'rgba(20,184,166,0.10)' : '#f0fdfa',
          border: `1px solid ${isDark ? 'rgba(20,184,166,0.25)' : '#a7f3d0'}`,
        }}
        contentEditable={false}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
        {renaming ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="flex-1 min-w-0 bg-transparent outline-none"
              style={{ color: subtle }}
            />
            <button
              type="button"
              onClick={commitRename}
              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: accent }}
              aria-label={t('common:save', { defaultValue: 'Save' })}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: muted }}
              aria-label={t('common:cancel', { defaultValue: 'Cancel' })}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 min-w-0 truncate" style={{ color: subtle }}>
              {fileName || t('block_file', { defaultValue: 'File' })}
            </span>
            {editable && (
              <button
                type="button"
                onClick={startRename}
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: muted }}
                aria-label={t('edit_file_name', { defaultValue: 'Rename' })}
                title={t('edit_file_name', { defaultValue: 'Rename' })}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {url && (
              <a
                href={url}
                download={fileName || undefined}
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: muted }}
                aria-label={t('download', { defaultValue: 'Download' })}
                title={t('download', { defaultValue: 'Download' })}
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => deleteNode()}
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                style={{ color: '#ef4444' }}
                aria-label={t('common:delete', { defaultValue: 'Delete' })}
                title={t('common:delete', { defaultValue: 'Delete' })}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};
