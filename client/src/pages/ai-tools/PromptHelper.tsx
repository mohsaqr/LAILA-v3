import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wand2, Copy, Check, Sparkles, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { chatApi } from '../../api/chat';
import { Card, CardBody, CardHeader } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TextArea, Select } from '../../components/common/Input';

const PROMPT_TEMPLATES = {
  research: {
    label: 'Research Question',
    template: `You are a research methodology expert. Help me formulate a clear, focused research question about: [TOPIC]

Consider:
- Specificity and scope
- Measurability
- Relevance to the field
- Feasibility`,
  },
  analysis: {
    label: 'Data Analysis',
    template: `You are a data analysis expert. Help me analyze the following data/findings:

[DATA]

Provide:
- Key patterns and trends
- Statistical significance (if applicable)
- Potential interpretations
- Limitations to consider`,
  },
  writing: {
    label: 'Academic Writing',
    template: `You are an academic writing expert. Help me improve the following text for clarity, coherence, and academic tone:

[TEXT]

Focus on:
- Clear argumentation
- Proper academic language
- Logical flow
- Citation suggestions`,
  },
  custom: {
    label: 'Custom Prompt',
    template: '',
  },
};

export const PromptHelper = () => {
  const [promptType, setPromptType] = useState<keyof typeof PROMPT_TEMPLATES>('research');
  const [userInput, setUserInput] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGeneratePrompt = () => {
    if (!userInput.trim()) {
      toast.error('Please enter your topic or content');
      return;
    }

    const template = PROMPT_TEMPLATES[promptType].template;
    let prompt = template;

    if (promptType === 'research') {
      prompt = template.replace('[TOPIC]', userInput);
    } else if (promptType === 'analysis') {
      prompt = template.replace('[DATA]', userInput);
    } else if (promptType === 'writing') {
      prompt = template.replace('[TEXT]', userInput);
    } else {
      prompt = userInput;
    }

    setGeneratedPrompt(prompt);
  };

  const handleRunPrompt = async () => {
    if (!generatedPrompt.trim()) {
      toast.error('Generate a prompt first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await chatApi.sendMessage({
        message: generatedPrompt,
        module: 'prompt-helper',
      });
      setAiResponse(response.reply);
    } catch (error) {
      toast.error('Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link to="/ai-tools">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to AI Tools
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Wand2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prompt Engineering Helper</h1>
          <p className="text-gray-600">Create effective AI prompts using the PCTFT framework</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">1. Define Your Task</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <Select
              label="Prompt Type"
              value={promptType}
              onChange={e => setPromptType(e.target.value as keyof typeof PROMPT_TEMPLATES)}
              options={Object.entries(PROMPT_TEMPLATES).map(([key, val]) => ({
                value: key,
                label: val.label,
              }))}
            />

            <TextArea
              label={promptType === 'custom' ? 'Your Custom Prompt' : 'Your Input'}
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder={
                promptType === 'research'
                  ? 'Enter your research topic...'
                  : promptType === 'analysis'
                  ? 'Paste your data or findings...'
                  : promptType === 'writing'
                  ? 'Paste your text to improve...'
                  : 'Write your custom prompt...'
              }
              rows={5}
            />

            <Button onClick={handleGeneratePrompt} icon={<Sparkles className="w-4 h-4" />}>
              Generate Prompt
            </Button>
          </CardBody>
        </Card>

        {/* Generated Prompt */}
        {generatedPrompt && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">2. Generated Prompt</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(generatedPrompt)}
                icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </CardHeader>
            <CardBody>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                {generatedPrompt}
              </div>
              <div className="mt-4">
                <Button
                  onClick={handleRunPrompt}
                  loading={isLoading}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  Run with AI
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {/* AI Response */}
        {aiResponse && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">3. AI Response</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(aiResponse)}
                icon={<Copy className="w-4 h-4" />}
              >
                Copy
              </Button>
            </CardHeader>
            <CardBody>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap">{aiResponse}</p>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Tips */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">PCTFT Framework Tips</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-semibold text-blue-700">P - Persona</p>
                <p className="text-blue-600">Define who the AI should act as</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="font-semibold text-green-700">C - Context</p>
                <p className="text-green-600">Provide relevant background</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="font-semibold text-purple-700">T - Task</p>
                <p className="text-purple-600">Clearly state what you need</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="font-semibold text-orange-700">F - Format</p>
                <p className="text-orange-600">Specify output structure</p>
              </div>
              <div className="p-3 bg-pink-50 rounded-lg">
                <p className="font-semibold text-pink-700">T - Tone</p>
                <p className="text-pink-600">Set the communication style</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
