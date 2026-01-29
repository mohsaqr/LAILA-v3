import { Bot, ThumbsUp, ThumbsDown, MessageSquare, Image } from 'lucide-react';
import { StudentAgentConfig } from '../../../types';
import { Card, CardBody, CardHeader } from '../../common/Card';

interface AgentConfigViewerProps {
  config: StudentAgentConfig;
}

export const AgentConfigViewer = ({ config }: AgentConfigViewerProps) => {
  const dosRules = config.dosRules || [];
  const dontsRules = config.dontsRules || [];

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-600" />
            <h3 className="font-semibold text-gray-900">Agent Identity</h3>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-start gap-4">
            {config.avatarImageUrl ? (
              <img
                src={config.avatarImageUrl}
                alt={config.agentName}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                <Image className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <h4 className="text-lg font-semibold text-gray-900">{config.agentName}</h4>
                {config.agentTitle && (
                  <span className="text-sm text-violet-600 font-medium">{config.agentTitle}</span>
                )}
              </div>
              {config.personaDescription && (
                <p className="text-gray-600 mt-1">{config.personaDescription}</p>
              )}
              <div className="mt-2 text-sm text-gray-500">
                Version {config.version} • Last updated{' '}
                {new Date(config.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-violet-600" />
            <h3 className="font-semibold text-gray-900">System Prompt</h3>
          </div>
        </CardHeader>
        <CardBody>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg font-mono">
            {config.systemPrompt}
          </pre>
        </CardBody>
      </Card>

      {/* Behavioral Rules */}
      {(dosRules.length > 0 || dontsRules.length > 0) && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Behavioral Rules</h3>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Do's */}
              {dosRules.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">Should Do</span>
                  </div>
                  <ul className="space-y-2">
                    {dosRules.map((rule, index) => (
                      <li
                        key={index}
                        className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                      >
                        <span className="text-green-600 font-bold mr-2">+</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Don'ts */}
              {dontsRules.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsDown className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-gray-700">Should Not Do</span>
                  </div>
                  <ul className="space-y-2">
                    {dontsRules.map((rule, index) => (
                      <li
                        key={index}
                        className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                      >
                        <span className="text-red-600 font-bold mr-2">-</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Welcome Message */}
      {config.welcomeMessage && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Welcome Message</h3>
          </CardHeader>
          <CardBody>
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
              <p className="text-gray-700">{config.welcomeMessage}</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
