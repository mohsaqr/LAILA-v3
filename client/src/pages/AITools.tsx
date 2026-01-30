import { Link } from 'react-router-dom';
import {
  Scale,
  Sparkles,
  BarChart3,
  Bot,
  BrainCircuit,
  ArrowRight,
  Lightbulb,
  Shield,
  History,
  Settings,
  Wrench,
} from 'lucide-react';
import { Card, CardBody } from '../components/common/Card';
import { useTheme } from '../hooks/useTheme';

const tools = [
  {
    id: 'builder',
    name: 'AI Builder',
    description: 'Create and manage reusable AI components. Build chatbots, tutors, and assistants that can be used across all courses.',
    icon: Wrench,
    gradient: 'from-violet-500 to-purple-600',
    features: ['Component Library', 'Custom Chatbots', 'Reusable Templates', 'Course Integration'],
    path: '/ai-tools/builder',
    featured: true,
  },
  {
    id: 'chatbots',
    name: 'AI Assistants',
    description: 'Interact with specialized AI assistants designed for different research and academic tasks.',
    icon: Bot,
    gradient: 'from-blue-500 to-cyan-500',
    features: ['Research Methods Helper', 'Academic Writing Tutor', 'Platform Guide', 'Specialized AI Support'],
    path: '/ai-tools/chatbots',
  },
  {
    id: 'bias-research',
    name: 'Bias Research Platform',
    description: 'Comprehensive toolkit for creating and analyzing academic vignettes with AI-powered bias detection.',
    icon: Scale,
    gradient: 'from-purple-500 to-indigo-500',
    features: ['Interactive Story Builder', 'Quick Story Generator', 'Comparison Analysis', 'AI Bias Detection'],
    path: '/ai-tools/bias-research',
  },
  {
    id: 'prompt-helper',
    name: 'Prompt Engineering',
    description: 'Expert-guided prompt creation using the PCTFT framework for optimal AI interactions.',
    icon: Sparkles,
    gradient: 'from-green-500 to-emerald-500',
    features: ['Guided Prompt Creation', 'PCTFT Framework', 'Schema Suggestions', 'Interactive Refinement'],
    path: '/ai-tools/prompt-helper',
  },
  {
    id: 'data-analyzer',
    name: 'Data Interpreter',
    description: 'AI-powered statistical analysis and interpretation for educational research data.',
    icon: BarChart3,
    gradient: 'from-orange-500 to-red-500',
    features: ['Statistical Analysis', 'Educational Focus', 'Interactive Discussion', 'Multiple Data Formats'],
    path: '/ai-tools/data-analyzer',
  },
];

const infoCards = [
  {
    icon: BrainCircuit,
    title: 'Powered by AI',
    description: 'Advanced AI models provide intelligent analysis, suggestions, and assistance across all tools.',
  },
  {
    icon: Shield,
    title: 'Research-Focused',
    description: 'Tools are specifically designed for academic research with educational methodology in mind.',
  },
  {
    icon: History,
    title: 'Session Tracking',
    description: 'Your interactions are logged for research purposes and to improve your experience.',
  },
  {
    icon: Settings,
    title: 'Customizable',
    description: 'Configure AI settings, choose models, and personalize tools to match your preferences.',
  },
];

export const AITools = () => {
  const { isDark } = useTheme();

  // Theme colors
  const colors = {
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#4b5563',
    checkBg: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
    checkIcon: isDark ? '#4ade80' : '#16a34a',
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center text-white mb-12">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BrainCircuit className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4">AI Research Tools</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Powerful AI-powered tools for academic research, learning, and content creation
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {tools.map(tool => {
            const Icon = tool.icon;
            return (
              <Link key={tool.id} to={tool.path}>
                <Card hover className="h-full relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tool.gradient}`} />
                  <CardBody className="p-8">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${tool.gradient} flex items-center justify-center mb-6`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>

                    <h2 className="text-xl font-bold mb-3" style={{ color: colors.textPrimary }}>{tool.name}</h2>
                    <p className="mb-6" style={{ color: colors.textSecondary }}>{tool.description}</p>

                    <ul className="space-y-2 mb-6">
                      {tool.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: colors.textSecondary }}>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.checkBg }}>
                            <svg className="w-3 h-3" style={{ color: colors.checkIcon }} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${tool.gradient} text-white font-medium`}>
                      Launch Tool
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* How It Works Section */}
        <div className="text-center text-white mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lightbulb className="w-6 h-6" />
            <h2 className="text-2xl font-bold">How It Works</h2>
          </div>
          <p className="text-white/80">Our AI tools are designed to enhance your research and learning experience</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {infoCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white text-center">
                <Icon className="w-10 h-10 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{card.title}</h3>
                <p className="text-sm text-white/80">{card.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
