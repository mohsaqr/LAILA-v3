import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
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
  Loader2,
} from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';
import { getAuthToken } from '../../../utils/auth';
import { resolveFileUrl } from '../../../api/client';
import type { LectureSection, UpdateSectionData } from '../../../types';

interface FileBlockProps {
  section: LectureSection;
  onChange: (data: UpdateSectionData) => void;
}

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
 * File block — minimal thin row. When a file is attached: icon +
 * filename (click pencil to rename, Enter saves) + download. No
 * Replace, no Open. When empty: a single click target that opens the
 * file picker (also accepts drag-and-drop).
 */
export const FileBlock = ({ section, onChange }: FileBlockProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const hasFile = !!(section.fileUrl && section.fileName);
  const Icon = iconFor(section.fileType);
  const url = section.fileUrl ? resolveFileUrl(section.fileUrl) : null;

  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = getAuthToken();
      const response = await fetch('/api/uploads/file', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      const fileData = data.data || data;
      onChange({
        fileName: file.name,
        fileUrl: fileData.url || fileData.path,
        fileType: file.name.split('.').pop() || '',
        fileSize: file.size,
      });
    } catch (e) {
      console.error('File upload error:', e);
    } finally {
      setUploading(false);
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  const startRename = () => {
    setRenameDraft(section.fileName ?? '');
    setRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameDraft.trim();
    setRenaming(false);
    if (trimmed && trimmed !== section.fileName) {
      onChange({ fileName: trimmed });
    }
  };

  const cancelRename = () => {
    setRenaming(false);
    setRenameDraft('');
  };

  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const accent = isDark ? '#5eead4' : '#0d9488';

  if (hasFile) {
    return (
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
        style={{
          backgroundColor: isDark ? 'rgba(20,184,166,0.10)' : '#f0fdfa',
          border: `1px solid ${isDark ? 'rgba(20,184,166,0.25)' : '#a7f3d0'}`,
        }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
        {renaming ? (
          <>
            <input
              ref={renameInputRef}
              type="text"
              value={renameDraft}
              onChange={e => setRenameDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') cancelRename();
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
              onClick={cancelRename}
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
              {section.fileName}
            </span>
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
            {url && (
              <a
                href={url}
                download={section.fileName ?? undefined}
                className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: muted }}
                aria-label={t('download', { defaultValue: 'Download' })}
                title={t('download', { defaultValue: 'Download' })}
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className="flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm cursor-pointer transition-colors"
      style={{
        border: `1px dashed ${dragOver ? '#14b8a6' : (isDark ? '#374151' : '#d1d5db')}`,
        backgroundColor: dragOver
          ? (isDark ? 'rgba(20,184,166,0.08)' : '#f0fdfa')
          : 'transparent',
        color: muted,
      }}
    >
      {uploading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('uploading_file', { defaultValue: 'Uploading…' })}
        </>
      ) : (
        <>
          <Upload className="w-4 h-4" />
          {t('drag_drop_file', { defaultValue: 'Drag & drop or click to upload' })}
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        onChange={onSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mov,.mp3,.wav,.zip"
      />
    </div>
  );
};
