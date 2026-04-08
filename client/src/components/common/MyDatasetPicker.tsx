import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Database, FileSpreadsheet, X, Loader2 } from 'lucide-react';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { resolveFileUrl } from '../../api/client';
import { UserDataset } from '../../types';

interface MyDatasetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (csvText: string, dataset: UserDataset) => void;
}

export const MyDatasetPicker = ({ isOpen, onClose, onSelect }: MyDatasetPickerProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const [loading, setLoading] = useState<number | null>(null);

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['my-all-datasets'],
    queryFn: () => agentAssignmentsApi.getAllMyDatasets(),
    enabled: isOpen,
  });

  const handlePick = async (ds: UserDataset) => {
    setLoading(ds.id);
    try {
      const url = resolveFileUrl(ds.fileUrl);
      const response = await fetch(url);
      const csvText = await response.text();
      onSelect(csvText, ds);
      onClose();
    } catch {
      // silently fail — user can try again
    } finally {
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-violet-500" />
            {t('my_datasets')}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}
          {!isLoading && datasets.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{t('no_datasets')}</p>
            </div>
          )}
          {datasets.map((ds) => (
            <button
              key={ds.id}
              onClick={() => handlePick(ds)}
              disabled={loading !== null}
              className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                {loading === ds.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500 flex-shrink-0" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-violet-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{ds.name}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                {ds.rowCount ? `${ds.rowCount} rows` : ''}{' '}
                {ds.aiModel ? `· ${ds.aiModel}` : ''}{' '}
                · {new Date(ds.createdAt).toLocaleDateString()}
              </p>
              {ds.description && (
                <p className="text-xs text-gray-400 mt-1 ml-6 line-clamp-1">{ds.description}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
