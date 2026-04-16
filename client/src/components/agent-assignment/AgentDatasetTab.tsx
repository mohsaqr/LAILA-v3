import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Database, Download, Pencil, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { agentAssignmentsApi } from '../../api/agentAssignments';
import { resolveFileUrl } from '../../api/client';
import { Card, CardBody } from '../common/Card';
import { StudentAgentConfig } from '../../types';

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
    <Card>
      <CardBody>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-violet-500" />
          {t('my_datasets')}
        </h3>

        {datasets.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{t('no_datasets')}</p>
          </div>
        ) : (
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
                {ds.userPrompt && (
                  <div className="mt-2 p-2 bg-white border border-gray-200 rounded">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-0.5">
                      {t('generated_from_prompt')}
                    </p>
                    <p className="text-xs text-gray-700 line-clamp-3 whitespace-pre-wrap">
                      {ds.userPrompt}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
