import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Database, Download, FileSpreadsheet, Loader2, Send, Pencil, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { resolveFileUrl } from '../../api/client';
import { Card, CardBody } from '../common/Card';
import { Button } from '../common/Button';
import { StudentAgentConfig, GenerateDatasetResponse } from '../../types';

interface AgentDatasetTabProps {
  assignmentId: number;
  config: StudentAgentConfig | null;
}

const EditableName = ({
  datasetId,
  name,
  assignmentId,
}: {
  datasetId: number;
  name: string;
  assignmentId: number;
}) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);

  const renameMutation = useMutation({
    mutationFn: (newName: string) =>
      agentAssignmentsApi.renameDataset(assignmentId, datasetId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-datasets', assignmentId] });
      setEditing(false);
    },
  });

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      renameMutation.mutate(trimmed);
    } else {
      setEditing(false);
      setEditValue(name);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setEditing(false); setEditValue(name); }
          }}
          autoFocus
          className="text-sm font-medium border border-gray-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 min-w-0 flex-1"
        />
        <button onClick={handleSave} className="p-0.5 text-green-600 hover:text-green-800">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { setEditing(false); setEditValue(name); }} className="p-0.5 text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <p className="text-sm font-medium truncate">{name}</p>
      <button
        onClick={() => setEditing(true)}
        className="p-0.5 text-gray-400 hover:text-violet-600 flex-shrink-0"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
};

export const AgentDatasetTab = ({ assignmentId, config }: AgentDatasetTabProps) => {
  const { t } = useTranslation(['teaching', 'common']);
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [lastResult, setLastResult] = useState<GenerateDatasetResponse | null>(null);

  const { data: datasets = [] } = useQuery({
    queryKey: ['agent-datasets', assignmentId],
    queryFn: () => agentAssignmentsApi.getMyDatasets(assignmentId),
    enabled: !!config,
  });

  const deleteMutation = useMutation({
    mutationFn: (datasetId: number) => agentAssignmentsApi.deleteDataset(assignmentId, datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-datasets', assignmentId] });
      toast.success(t('common:deleted'));
    },
  });

  const generateMutation = useMutation({
    mutationFn: (desc: string) => agentAssignmentsApi.generateDataset(assignmentId, desc),
    onSuccess: (result) => {
      setLastResult(result);
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['agent-datasets', assignmentId] });
      toast.success(t('dataset_generated'));
    },
    onError: (error: any) => {
      const serverMessage = error?.response?.data?.error;
      toast.error(serverMessage || t('dataset_generation_failed'), { duration: 5000 });
    },
  });

  const handleGenerate = () => {
    if (!description.trim() || description.trim().length < 10) return;
    generateMutation.mutate(description.trim());
  };

  if (!config) {
    return (
      <Card>
        <CardBody>
          <div className="text-center py-12 text-gray-500">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('create_agent_first')}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate Section */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-500" />
            {t('generate_dataset')}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {t('generate_dataset_description')}
          </p>
          <div className="flex gap-3">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dataset_prompt_placeholder')}
              rows={3}
              maxLength={500}
              disabled={generateMutation.isPending}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none disabled:opacity-50"
            />
            <Button
              onClick={handleGenerate}
              disabled={!description.trim() || description.trim().length < 10 || generateMutation.isPending}
              className="self-end"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {generateMutation.isPending ? t('common:generating') : t('common:generate')}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Last Generated Result */}
      {lastResult && (
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-green-500 flex-shrink-0" />
              <EditableName
                datasetId={lastResult.dataset.id}
                name={lastResult.dataset.name}
                assignmentId={assignmentId}
              />
            </div>
            <p className="text-sm text-gray-600 mb-2">{lastResult.explanation}</p>
            {lastResult.dataset.description && (
              <p className="text-xs text-gray-400 mb-4 italic">{lastResult.dataset.description}</p>
            )}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre">{lastResult.csvPreview}</pre>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={resolveFileUrl(lastResult.dataset.fileUrl)}
                download={lastResult.dataset.fileName}
                className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-medium"
              >
                <Download className="w-4 h-4" />
                {t('download_csv')}
              </a>
              {lastResult.dataset.rowCount && (
                <span className="text-xs text-gray-500">
                  {lastResult.dataset.rowCount} {t('common:rows')}
                </span>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Previous Datasets */}
      {datasets.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold mb-4">{t('my_datasets')}</h3>
            <div className="space-y-3">
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  className="p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <EditableName
                        datasetId={ds.id}
                        name={ds.name}
                        assignmentId={assignmentId}
                      />
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ds.rowCount ? `${ds.rowCount} rows` : ''}{' '}
                        {ds.aiModel ? `· ${ds.aiModel}` : ''}{' '}
                        · {new Date(ds.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-1 flex-shrink-0">
                      <a
                        href={resolveFileUrl(ds.fileUrl)}
                        download={ds.name}
                        className="p-2 text-gray-500 hover:text-violet-600 rounded-lg hover:bg-violet-50"
                        title={t('download_csv')}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => deleteMutation.mutate(ds.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title={t('common:delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {ds.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                      {ds.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
