import { useSearchParams } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  Bot,
  Settings,
} from 'lucide-react';

// Import setting panels
import { UsersPanel } from './settings/UsersPanel';
import { EnrollmentsPanel } from './settings/EnrollmentsPanel';
import { LLMPanel } from './settings/LLMPanel';
import { SystemPanel } from './settings/SystemPanel';

type SettingsTab = 'users' | 'enrollments' | 'llm' | 'system';

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'users', label: 'Users', icon: <Users className="w-5 h-5" />, description: 'Manage users and permissions' },
  { id: 'enrollments', label: 'Enrollments', icon: <GraduationCap className="w-5 h-5" />, description: 'Course enrollments and batch import' },
  { id: 'llm', label: 'LLM Providers', icon: <Bot className="w-5 h-5" />, description: 'AI provider configuration' },
  { id: 'system', label: 'System', icon: <Settings className="w-5 h-5" />, description: 'General system settings' },
];

export const AdminSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as SettingsTab) || 'users';

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'users':
        return <UsersPanel />;
      case 'enrollments':
        return <EnrollmentsPanel />;
      case 'llm':
        return <LLMPanel />;
      case 'system':
        return <SystemPanel />;
      default:
        return <UsersPanel />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your system configuration</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-64 flex-shrink-0">
            <ul className="space-y-1">
              {TABS.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className={activeTab === tab.id ? 'text-white' : 'text-gray-400'}>
                      {tab.icon}
                    </span>
                    <span className="font-medium">{tab.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {renderPanel()}
          </main>
        </div>
      </div>
    </div>
  );
};
