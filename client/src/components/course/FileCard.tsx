import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  FileSpreadsheet,
  Presentation,
  Download,
  Eye,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { previewKind } from '../../utils/filePreview';

type IconC = ComponentType<{ className?: string }>;

const TYPE_META: Record<string, { Icon: IconC; light: string; dark: string }> = {
  pdf: { Icon: FileText, light: '#dc2626', dark: '#f87171' },
  doc: { Icon: FileText, light: '#2563eb', dark: '#60a5fa' },
  docx: { Icon: FileText, light: '#2563eb', dark: '#60a5fa' },
  txt: { Icon: FileText, light: '#475569', dark: '#94a3b8' },
  jpg: { Icon: ImageIcon, light: '#0891b2', dark: '#22d3ee' },
  jpeg: { Icon: ImageIcon, light: '#0891b2', dark: '#22d3ee' },
  png: { Icon: ImageIcon, light: '#0891b2', dark: '#22d3ee' },
  gif: { Icon: ImageIcon, light: '#0891b2', dark: '#22d3ee' },
  webp: { Icon: ImageIcon, light: '#0891b2', dark: '#22d3ee' },
  svg: { Icon: ImageIcon, light: '#0891b2', dark: '#22d3ee' },
  mp4: { Icon: Film, light: '#7c3aed', dark: '#a78bfa' },
  mov: { Icon: Film, light: '#7c3aed', dark: '#a78bfa' },
  webm: { Icon: Film, light: '#7c3aed', dark: '#a78bfa' },
  mp3: { Icon: Music, light: '#db2777', dark: '#f472b6' },
  wav: { Icon: Music, light: '#db2777', dark: '#f472b6' },
  ogg: { Icon: Music, light: '#db2777', dark: '#f472b6' },
  zip: { Icon: Archive, light: '#d97706', dark: '#fbbf24' },
  rar: { Icon: Archive, light: '#d97706', dark: '#fbbf24' },
  '7z': { Icon: Archive, light: '#d97706', dark: '#fbbf24' },
  xls: { Icon: FileSpreadsheet, light: '#059669', dark: '#34d399' },
  xlsx: { Icon: FileSpreadsheet, light: '#059669', dark: '#34d399' },
  csv: { Icon: FileSpreadsheet, light: '#059669', dark: '#34d399' },
  ppt: { Icon: Presentation, light: '#ea580c', dark: '#fb923c' },
  pptx: { Icon: Presentation, light: '#ea580c', dark: '#fb923c' },
};

/** Extension from a filename or a mime/type string. */
const extOf = (fileName: string, fileType?: string | null): string => {
  const fromName = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  if (fromName) return fromName.toLowerCase();
  const ft = (fileType ?? '').toLowerCase();
  if (ft.includes('/')) return ft.split('/').pop() ?? '';
  return ft.replace(/^\./, '');
};

const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
};

interface FileCardProps {
  fileName: string;
  fileType?: string | null;
  /** Already-resolved, downloadable URL. */
  url: string;
  fileSize?: number | null;
  description?: string | null;
  /** Optional click handler (e.g. activity logging); falls back to the link. */
  onDownload?: (e: React.MouseEvent) => void;
  /** Optional click handler for the inline "View" action (opens in a new tab). */
  onView?: (e: React.MouseEvent) => void;
}

/**
 * Professional, reusable student-facing file card: type-colored icon tile,
 * filename title, "TYPE · size" meta, optional description, and a Download
 * button. Shared by the in-lesson file node and standalone file sections so
 * every file looks the same.
 */
export const FileCard = ({ fileName, fileType, url, fileSize, description, onDownload, onView }: FileCardProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();
  const ext = extOf(fileName, fileType);
  const { Icon, light, dark } = TYPE_META[ext] ?? { Icon: FileIcon, light: '#475569', dark: '#94a3b8' };
  const accent = isDark ? dark : light;
  const size = formatBytes(fileSize);
  const meta = [ext.toUpperCase(), size].filter(Boolean).join('  ·  ');
  const canView = previewKind(fileName, fileType) !== null;

  return (
    <div
      className="flex items-center gap-3.5 rounded-xl border p-3.5 transition-shadow hover:shadow-sm"
      style={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb' }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl"
        style={{ backgroundColor: `${accent}1f`, color: accent }}
      >
        <Icon className="w-6 h-6" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: isDark ? '#f3f4f6' : '#111827' }} title={fileName}>
          {fileName}
        </div>
        <div className="mt-0.5 text-xs font-medium tracking-wide" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
          {meta || t('common:file', { defaultValue: 'File' })}
        </div>
        {description && (
          <p className="mt-1 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{description}</p>
        )}
      </div>
      {canView ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onView}
          aria-label={`${t('common:view', { defaultValue: 'View' })}${fileName ? ` ${fileName}` : ''}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition-colors"
        >
          <Eye className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('common:view', { defaultValue: 'View' })}</span>
        </a>
      ) : (
        <a
          href={url}
          download={fileName || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDownload}
          aria-label={`${t('common:download', { defaultValue: 'Download' })}${fileName ? ` ${fileName}` : ''}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition-colors"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('common:download', { defaultValue: 'Download' })}</span>
        </a>
      )}
    </div>
  );
};
