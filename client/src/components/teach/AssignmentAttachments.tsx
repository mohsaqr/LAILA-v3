import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AssignmentAttachment } from '../../types';
import { assignmentsApi } from '../../api/assignments';
import { uploadsApi } from '../../api/uploads';
import { resolveFileUrl } from '../../api/client';
import {
  ASSIGNMENT_FILE_MAX_BYTES,
  ASSIGNMENT_FILE_MAX_LABEL,
  fileExtension,
  formatFileSize,
} from '../../constants/assignmentFiles';

/**
 * Attachment handling for the assignment editors, in two halves: this hook owns
 * the files, `<AssignmentAttachmentList>` below draws them.
 *
 * The awkward part it exists to hide is that a brand-new assignment has no id,
 * and `POST /assignments/:id/attachments` needs one. Rather than create the
 * assignment early (which would leave a half-filled row behind if the user
 * walked away), files picked before the first save are STAGED in memory and
 * uploaded by `flushStaged()` once the create call returns an id. Nothing
 * reaches the server until the user saves — the same contract the surrounding
 * forms already have.
 */
export const useAssignmentAttachments = (assignmentId: number | null) => {
  const { t } = useTranslation(['teaching']);
  const queryClient = useQueryClient();
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ['assignmentAttachments', assignmentId],
    queryFn: () => assignmentsApi.getAttachments(assignmentId!),
    enabled: !!assignmentId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => assignmentsApi.deleteAttachment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignmentAttachments', assignmentId] }),
    onError: () => toast.error(t('file_delete_failed')),
  });

  /**
   * Upload one file and register it against `targetId`. Extracted because both
   * the live path and the staged flush need exactly this, and a divergence
   * between them would mean files that upload but are never recorded.
   */
  const uploadOne = async (file: File, targetId: number) => {
    const result = await uploadsApi.uploadAssignmentFile(file);
    await assignmentsApi.addAttachment(targetId, {
      fileName: file.name,
      fileUrl: result.url,
      fileType: fileExtension(file.name),
      fileSize: file.size,
    });
  };

  /** Client-side size gate. The server enforces the same limit; this only saves the round trip. */
  const withinSizeLimit = (files: File[]) =>
    files.filter(file => {
      if (file.size > ASSIGNMENT_FILE_MAX_BYTES) {
        toast.error(t('file_too_large', { name: file.name, limit: ASSIGNMENT_FILE_MAX_LABEL }));
        return false;
      }
      return true;
    });

  const attach = useCallback(async (files: File[]) => {
    const accepted = withinSizeLimit(files);
    if (!accepted.length) return;

    if (!assignmentId) {
      setStagedFiles(prev => [...prev, ...accepted]);
      return;
    }

    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of accepted) {
        await uploadOne(file, assignmentId);
        uploaded += 1;
      }
      toast.success(t('files_uploaded'));
    } catch (e: any) {
      // Files before the failure are already saved, so refresh regardless —
      // reporting a blanket failure while the list fills in would be worse.
      toast.error(e?.response?.data?.error ?? t('file_upload_failed'));
    } finally {
      setUploading(false);
      if (uploaded > 0) {
        queryClient.invalidateQueries({ queryKey: ['assignmentAttachments', assignmentId] });
      }
    }
  }, [assignmentId, queryClient, t]);

  /**
   * Upload everything staged against a freshly created assignment. Called from
   * the create mutation's onSuccess; a failure here is reported but must not
   * fail the create, which already succeeded. Files stay staged on failure so
   * the next save retries them.
   */
  const flushStaged = useCallback(async (newAssignmentId: number) => {
    if (!stagedFiles.length) return;
    setUploading(true);
    try {
      for (const file of stagedFiles) {
        await uploadOne(file, newAssignmentId);
      }
      setStagedFiles([]);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? t('file_upload_failed'));
    } finally {
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ['assignmentAttachments', newAssignmentId] });
    }
  }, [stagedFiles, queryClient, t]);

  const removeStaged = useCallback((index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  /** Drop staged files without uploading — for a cancelled create. */
  const clearStaged = useCallback(() => setStagedFiles([]), []);

  return {
    attachments,
    stagedFiles,
    uploading,
    attach,
    flushStaged,
    removeStaged,
    clearStaged,
    remove: deleteMutation.mutate,
    removingId: deleteMutation.isPending ? deleteMutation.variables : null,
  };
};

interface AssignmentAttachmentListProps {
  attachments: AssignmentAttachment[];
  stagedFiles: File[];
  onRemove: (id: number) => void;
  onRemoveStaged: (index: number) => void;
  removingId?: number | null;
}

const rowClass =
  'flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60';

/**
 * Saved attachments (downloadable) followed by staged ones (not yet uploaded).
 * Both are listed so the user sees one set of files regardless of whether the
 * assignment has been saved; only the saved ones can be downloaded, because
 * only they have a URL.
 */
export const AssignmentAttachmentList = ({
  attachments,
  stagedFiles,
  onRemove,
  onRemoveStaged,
  removingId,
}: AssignmentAttachmentListProps) => {
  const { t } = useTranslation(['teaching', 'common']);

  if (!attachments.length && !stagedFiles.length) return null;

  return (
    <ul className="mt-2 space-y-2">
      {attachments.map(att => (
        <li key={att.id} className={rowClass}>
          <FileText className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-100">{att.fileName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {att.fileType.toUpperCase()}
              {att.fileSize ? ` · ${formatFileSize(att.fileSize)}` : ''}
            </p>
          </div>
          <a
            href={resolveFileUrl(att.fileUrl)}
            download={att.fileName}
            target="_blank"
            rel="noopener noreferrer"
            title={t('download')}
            aria-label={t('download')}
            className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={() => onRemove(att.id)}
            disabled={removingId === att.id}
            title={t('common:delete')}
            aria-label={t('common:delete')}
            className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            {removingId === att.id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
          </button>
        </li>
      ))}

      {stagedFiles.map((file, i) => (
        <li key={`staged-${i}-${file.name}`} className={`${rowClass} border-dashed`}>
          <FileText className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-100">{file.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('attachment_pending_save')}
              {file.size ? ` · ${formatFileSize(file.size)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemoveStaged(i)}
            title={t('common:remove')}
            aria-label={t('common:remove')}
            className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
};
