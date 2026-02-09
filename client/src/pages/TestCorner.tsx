import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Server,
  Zap,
  Users,
  Radio,
  Sparkles,
  ArrowRight,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { tutorsApi } from '../api/tutors';
import { apiClient } from '../api/client';
import { Button } from '../components/common/Button';
import { Card, CardBody, CardHeader } from '../components/common/Card';
import type { TutorMode, TutorAgent, TutorMessageResponse } from '../types/tutor';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

export const TestCorner = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [quickTestAgent, setQuickTestAgent] = useState<TutorAgent | null>(null);
  const [quickTestMessage, setQuickTestMessage] = useState('');
  const [quickTestMode, setQuickTestMode] = useState<TutorMode>('manual');
  const [quickTestResponse, setQuickTestResponse] = useState<TutorMessageResponse | null>(null);
  const [isQuickTesting, setIsQuickTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Fetch session data
  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ['tutorSession'],
    queryFn: tutorsApi.getSession,
  });

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ['tutorAgents'],
    queryFn: tutorsApi.getAgents,
  });

  // Health check
  const healthCheck = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await apiClient.get('/health');
      return response.data;
    },
    refetchInterval: 10000,
  });

  // Update test result helper
  const updateTestResult = (name: string, update: Partial<TestResult>) => {
    setTestResults((prev) =>
      prev.map((r) => (r.name === name ? { ...r, ...update } : r))
    );
  };

  // Add test result helper
  const addTestResult = (result: TestResult) => {
    setTestResults((prev) => [...prev, result]);
  };

  // Run all tests
  const runAllTests = async () => {
    setTestResults([]);

    const tests = [
      { name: 'API Health Check', fn: testHealthCheck },
      { name: 'Get Session', fn: testGetSession },
      { name: 'Get Agents', fn: testGetAgents },
      { name: 'Get Conversations', fn: testGetConversations },
      { name: 'Mode Change (Manual)', fn: () => testModeChange('manual') },
      { name: 'Mode Change (Router)', fn: () => testModeChange('router') },
      { name: 'Mode Change (Collaborative)', fn: () => testModeChange('collaborative') },
    ];

    for (const test of tests) {
      addTestResult({ name: test.name, status: 'running' });
      const startTime = Date.now();

      try {
        await test.fn();
        updateTestResult(test.name, {
          status: 'success',
          message: 'Passed',
          duration: Date.now() - startTime,
        });
      } catch (error: any) {
        updateTestResult(test.name, {
          status: 'error',
          message: error.message || 'Failed',
          duration: Date.now() - startTime,
        });
      }

      // Small delay between tests
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  // Individual test functions
  const testHealthCheck = async () => {
    const response = await apiClient.get('/health');
    if (response.data.status !== 'ok') {
      throw new Error('Health check failed');
    }
  };

  const testGetSession = async () => {
    const data = await tutorsApi.getSession();
    if (!data.session || !data.agents) {
      throw new Error('Invalid session response');
    }
  };

  const testGetAgents = async () => {
    const agents = await tutorsApi.getAgents();
    if (!Array.isArray(agents) || agents.length === 0) {
      throw new Error('No agents returned');
    }
  };

  const testGetConversations = async () => {
    const conversations = await tutorsApi.getConversations();
    if (!Array.isArray(conversations)) {
      throw new Error('Invalid conversations response');
    }
  };

  const testModeChange = async (mode: TutorMode) => {
    const session = await tutorsApi.setMode(mode);
    if (session.mode !== mode) {
      throw new Error(`Mode not changed to ${mode}`);
    }
  };

  // Quick test send message
  const handleQuickTest = async () => {
    if (!quickTestAgent || !quickTestMessage.trim()) return;

    setIsQuickTesting(true);
    setQuickTestResponse(null);
    setTestError(null);

    try {
      // Set mode first
      await tutorsApi.setMode(quickTestMode);

      // Send message
      const response = await tutorsApi.sendMessage(
        quickTestAgent.id,
        quickTestMessage.trim()
      );

      setQuickTestResponse(response);
    } catch (error: any) {
      setTestError(error.message || 'Failed to send message');
    } finally {
      setIsQuickTesting(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getModeIcon = (mode: TutorMode) => {
    switch (mode) {
      case 'manual':
        return <Radio className="w-4 h-4" />;
      case 'router':
        return <Sparkles className="w-4 h-4" />;
      case 'collaborative':
        return <Users className="w-4 h-4" />;
    }
  };

  const getModeColor = (mode: TutorMode, isSelected: boolean) => {
    if (!isSelected) return 'bg-gray-50 hover:bg-gray-100';
    switch (mode) {
      case 'manual':
        return 'bg-green-50 border border-green-200 text-green-700';
      case 'router':
        return 'bg-purple-50 border border-purple-200 text-purple-700';
      case 'collaborative':
        return 'bg-blue-50 border border-blue-200 text-blue-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Corner</h1>
          <p className="text-gray-600">Test all AI Tutor modes and features</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">System Status</h2>
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">API Health</span>
              <div className="flex items-center gap-2">
                {healthCheck.isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                ) : healthCheck.data?.status === 'ok' ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Healthy
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 text-sm">
                    <XCircle className="w-4 h-4" />
                    Error
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Session ID</span>
              <span className="text-sm font-mono text-gray-900">
                {sessionData?.session.id || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Current Mode</span>
              <span className="text-sm font-medium text-primary-600 flex items-center gap-1">
                {sessionData?.session.mode && getModeIcon(sessionData.session.mode)}
                {sessionData?.session.mode || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Available Agents</span>
              <span className="text-sm font-medium text-gray-900">
                {agents?.length || 0}
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => refetchSession()}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh Status
            </Button>
          </CardBody>
        </Card>

        {/* Automated Tests */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Automated Tests</h2>
              </div>
              <Button size="sm" onClick={runAllTests} icon={<Zap className="w-4 h-4" />}>
                Run All
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            {testResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Click "Run All" to start tests</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {testResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.status === 'success'
                        ? 'bg-green-50'
                        : result.status === 'error'
                        ? 'bg-red-50'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="text-sm font-medium text-gray-900">
                        {result.name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {result.duration && <span>{result.duration}ms</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Quick Message Test */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Interactive Mode Test</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. Select Agent
                </label>
                <div className="space-y-2">
                  {agents?.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => setQuickTestAgent(agent)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                        quickTestAgent?.id === agent.id
                          ? 'bg-primary-50 border border-primary-200'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <Bot className="w-4 h-4" />
                      <span className="truncate">{agent.displayName}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2. Select Mode
                </label>
                <div className="space-y-2">
                  {(['manual', 'router', 'collaborative'] as TutorMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setQuickTestMode(mode)}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${getModeColor(
                        mode,
                        quickTestMode === mode
                      )}`}
                    >
                      {getModeIcon(mode)}
                      <div>
                        <span className="font-medium capitalize">{mode}</span>
                        <p className="text-xs text-gray-500">
                          {mode === 'manual' && 'Direct to selected agent'}
                          {mode === 'router' && 'AI picks best agent'}
                          {mode === 'collaborative' && 'All agents respond'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  3. Enter Test Message
                </label>
                <textarea
                  value={quickTestMessage}
                  onChange={(e) => setQuickTestMessage(e.target.value)}
                  placeholder="Try different messages to test routing:
• 'Why does this happen?' → Socratic
• 'How do I do this?' → Helper
• 'Hey, I'm stuck' → Peer
• 'Help me build this' → Project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  rows={5}
                />
                <Button
                  className="w-full mt-2"
                  onClick={handleQuickTest}
                  disabled={!quickTestAgent || !quickTestMessage.trim() || isQuickTesting}
                  icon={
                    isQuickTesting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )
                  }
                >
                  {isQuickTesting ? 'Processing...' : 'Send Test Message'}
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {testError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mt-1 text-sm text-red-600">{testError}</p>
              </div>
            )}

            {/* Response Display */}
            {quickTestResponse && (
              <div className="mt-4 space-y-4">
                {/* Mode-specific info */}
                {quickTestResponse.routingInfo && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-700 mb-2">
                      <Sparkles className="w-5 h-5" />
                      <span className="font-medium">Auto-Route Decision</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Selected Agent</p>
                        <p className="font-medium text-gray-900">
                          {quickTestResponse.routingInfo.selectedAgent.displayName}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Confidence</p>
                        <p className="font-medium text-gray-900">
                          {Math.round(quickTestResponse.routingInfo.confidence * 100)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Reason</p>
                        <p className="font-medium text-gray-900">
                          {quickTestResponse.routingInfo.reason}
                        </p>
                      </div>
                    </div>
                    {quickTestResponse.routingInfo.alternatives && (
                      <div className="mt-3">
                        <p className="text-gray-500 text-sm">Alternatives considered:</p>
                        <div className="flex gap-2 mt-1">
                          {quickTestResponse.routingInfo.alternatives.map((alt, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                            >
                              {alt.agentName} ({Math.round(alt.score * 100)}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {quickTestResponse.collaborativeInfo && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 mb-2">
                      <Users className="w-5 h-5" />
                      <span className="font-medium">Team Collaboration</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Synthesized from {quickTestResponse.collaborativeInfo.agentContributions.length} agents
                    </p>
                    <div className="space-y-3">
                      {quickTestResponse.collaborativeInfo.agentContributions.map((contrib, idx) => (
                        <div key={idx} className="p-3 bg-white rounded border border-blue-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {contrib.agentDisplayName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {contrib.responseTimeMs}ms
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{contrib.contribution}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Response */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Final Response</span>
                    {quickTestResponse.assistantMessage.responseTimeMs && (
                      <span className="text-xs text-gray-500">
                        ({quickTestResponse.assistantMessage.responseTimeMs}ms)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {quickTestResponse.assistantMessage.content}
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Agent Details */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Agent Details</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {agents?.map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {agent.displayName}
                      </p>
                      <p className="text-xs text-gray-500">{agent.name}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">{agent.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                      {agent.personality}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                      temp: {agent.temperature}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
