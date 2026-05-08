import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  ExternalLink,
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

const formatSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * File block — minimal card showing filename + size + Replace + Open.
 * Empty state is a tight drop zone (no big "File section" header).
 * Reuses the existing POST /api/uploads/file endpoint.
 */
export const FileBlock = ({ section, onChange }: FileBlockProps) => {
  const { t } = useTranslation('teaching');
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const hasFile = !!(section.fileUrl && section.fileName);
  const Icon = iconFor(section.fileType);
  const url = section.fileUrl ? resolveFileUrl(section.fileUrl) : null;

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

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const cardBorder = isDark ? '#374151' : '#e5e7eb';
  const subtle = isDark ? '#cbd5e1' : '#374151';
  const muted = isDark ? '#9ca3af' : '#6b7280';

  if (hasFile) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}
        >
          <Icon className="w-5 h-5" style={{ color: muted }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" style={{ color: subtle }}>{section.fileName}</p>
          <p className="text-xs" style={{ color: muted }}>
            {section.fileType?.toUpperCase()}{section.fileSize ? ` · ${formatSize(section.fileSize)}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: subtle, backgroundColor: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {uploading
            ? <Loader2 className="w-4 h-4 animate-spin inline" />
            : t('replace_file', { defaultValue: 'Replace' })}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg"
            style={{ color: '#0d9488' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('open_file', { defaultValue: 'Open' })}
          </a>
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
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className="rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors cursor-pointer"
      style={{
        borderColor: dragOver ? '#14b8a6' : (isDark ? '#374151' : '#d1d5db'),
        backgroundColor: dragOver ? (isDark ? 'rgba(20,184,166,0.08)' : '#f0fdfa') : 'transparent',
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      {uploading ? (
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: muted }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('uploading_file', { defaultValue: 'Uploading…' })}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: muted }}>
          <Upload className="w-4 h-4" />
          {t('drag_drop_file', { defaultValue: 'Drag & drop or click to upload' })}
        </div>
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
