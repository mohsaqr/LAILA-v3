import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, MessageSquare, ArrowRight } from 'lucide-react';
import { courseTutorApi, MergedTutorConfig } from '../../api/courseTutor';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardBody } from '../common/Card';
import { Button } from '../common/Button';
import { Loading } from '../common/Loading';
import { CourseTutorChat } from './CourseTutorChat';

interface CollaborativeModuleProps {
  courseId: number;
  courseTitle: string;
}

export const CollaborativeModule = ({ courseId, courseTitle }: CollaborativeModuleProps) => {
  const { isDark } = useTheme();
  const [selectedTutor, setSelectedTutor] = useState<MergedTutorConfig | null>(null);

  // Theme colors
  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    bgCard: isDark ? '#1f2937' : '#ffffff',
    bgHover: isDark ? '#374151' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb',
    bgPrimary: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff',
    textPrimary600: isDark ? '#a5b4fc' : '#4f46e5',
    bgTeal: isDark ? 'rgba(8, 143, 143, 0.2)' : '#f0fdfd',
    textTeal: isDark ? '#5eecec' : '#088F8F',
  };

  // Fetch tutors for this course
  const { data: tutors, isLoading } = useQuery({
    queryKey: ['studentCourseTutors', courseId],
    queryFn: () => courseTutorApi.getStudentTutors(courseId),
  });

  // Fetch conversations for selected tutor
  const { data: conversations } = useQuery({
    queryKey: ['tutorConversations', courseId, selectedTutor?.courseTutorId],
    queryFn: () =>
      selectedTutor
        ? courseTutorApi.getConversations(courseId, selectedTutor.courseTutorId)
        : Promise.resolve([]),
    enabled: !!selectedTutor,
  });

  const getPersonalityColor = (personality: string | null) => {
    switch (personality) {
      case 'socratic':
        return 'from-purple-500 to-indigo-500';
      case 'friendly':
        return 'from-green-500 to-emerald-500';
      case 'casual':
        return 'from-orange-500 to-amber-500';
      case 'professional':
        return 'from-blue-500 to-cyan-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  if (isLoading) {
    return <Loading text="Loading tutors..." />;
  }

  // If a tutor is selected, show the chat interface
  if (selectedTutor) {
    return (
      <CourseTutorChat
        courseId={courseId}
        courseTitle={courseTitle}
        tutor={selectedTutor}
        onBack={() => setSelectedTutor(null)}
        existingConversations={conversations || []}
      />
    );
  }

  // Show tutor grid
  if (!tutors || tutors.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <Bot className="w-12 h-12 mx-auto mb-3" style={{ color: colors.textMuted }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
            No Tutors Available
          </h3>
          <p style={{ color: colors.textSecondary }}>
            Your instructor hasn't added any AI tutors to this course yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2" style={{ color: colors.textPrimary }}>
          Collaborative Module
        </h2>
        <p style={{ color: colors.textSecondary }}>
          Chat with AI tutors to get help with course material
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tutors.map((tutor) => (
          <TutorCard
            key={tutor.courseTutorId}
            tutor={tutor}
            onSelect={() => setSelectedTutor(tutor)}
            hasConversations={false} // Will be updated when we fetch
            colors={colors}
            getPersonalityColor={getPersonalityColor}
          />
        ))}
      </div>
    </div>
  );
};

interface TutorCardProps {
  tutor: MergedTutorConfig;
  onSelect: () => void;
  hasConversations: boolean;
  colors: Record<string, string>;
  getPersonalityColor: (personality: string | null) => string;
}

const TutorCard = ({
  tutor,
  onSelect,
  hasConversations,
  colors,
  getPersonalityColor,
}: TutorCardProps) => {
  return (
    <Card hover className="cursor-pointer transition-all" onClick={onSelect}>
      <CardBody className="flex flex-col items-center text-center p-6">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br ${getPersonalityColor(
            tutor.personality
          )} text-white mb-4`}
        >
          {tutor.avatarUrl ? (
            <img
              src={tutor.avatarUrl}
              alt={tutor.displayName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <Bot className="w-8 h-8" />
          )}
        </div>

        <h3 className="font-semibold mb-1" style={{ color: colors.textPrimary }}>
          {tutor.displayName}
        </h3>

        <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.textSecondary }}>
          {tutor.description || 'AI Tutor for this course'}
        </p>

        {tutor.isCustomized && (
          <span
            className="text-xs px-2 py-0.5 rounded mb-3"
            style={{ backgroundColor: colors.bgTeal, color: colors.textTeal }}
          >
            Course-specific
          </span>
        )}

        <Button
          size="sm"
          icon={hasConversations ? <MessageSquare className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          className="w-full"
        >
          {hasConversations ? 'Continue Chat' : 'Start Chat'}
        </Button>
      </CardBody>
    </Card>
  );
};

export default CollaborativeModule;
