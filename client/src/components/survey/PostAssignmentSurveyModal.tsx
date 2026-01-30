import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Survey } from '../../types';
import { surveysApi } from '../../api/surveys';
import { SurveyRenderer } from './SurveyRenderer';
import { SurveyCompletedCard } from './SurveyCompletedCard';
import { Loading } from '../common/Loading';
import { Button } from '../common/Button';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';

interface PostAssignmentSurveyModalProps {
  surveyId: number;
  assignmentId: number;
  isRequired: boolean;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const PostAssignmentSurveyModal = ({
  surveyId,
  assignmentId,
  isRequired,
  isOpen,
  onClose,
  onComplete,
}: PostAssignmentSurveyModalProps) => {
  const { isDark } = useTheme();
  const { user } = useAuthStore();
  const focusTrapRef = useFocusTrap(isOpen);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const fetchSurvey = async () => {
      if (!isOpen) return;

      try {
        setLoading(true);
        setError(null);

        const surveyData = await surveysApi.getSurveyById(surveyId);
        setSurvey(surveyData);

        // Check if already completed
        if (user && !surveyData.isAnonymous) {
          try {
            const { completed: isCompleted } = await surveysApi.checkIfCompleted(surveyId);
            if (isCompleted) {
              setAlreadyCompleted(true);
            }
          } catch {
            // Ignore errors in completion check
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load survey');
      } finally {
        setLoading(false);
      }
    };

    fetchSurvey();
  }, [surveyId, isOpen, user]);

  const handleComplete = () => {
    setCompleted(true);
    onComplete?.();
    // Auto-close after showing success message
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleSkip = () => {
    if (!isRequired) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={!isRequired ? onClose : undefined}
          aria-hidden="true"
        />
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="survey-modal-title"
          className="relative w-full max-w-2xl rounded-xl shadow-xl transform transition-all"
          style={{
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 border-b"
            style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
          >
            <div>
              <h3
                id="survey-modal-title"
                className="text-lg font-semibold"
                style={{ color: isDark ? '#f3f4f6' : '#111827' }}
              >
                {survey?.title || 'Feedback Survey'}
              </h3>
              {isRequired && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  This survey is required to complete your submission
                </p>
              )}
            </div>
            {!isRequired && !completed && !alreadyCompleted && (
              <button
                onClick={handleSkip}
                aria-label="Close"
                className="p-1 rounded-lg transition-colors"
                style={{
                  color: isDark ? '#9ca3af' : '#6b7280',
                }}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loading />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            ) : alreadyCompleted || completed ? (
              <SurveyCompletedCard
                title="Survey Completed"
                message="Thank you for your feedback!"
              />
            ) : survey ? (
              <SurveyRenderer
                survey={survey}
                context="post_assignment"
                contextId={assignmentId}
                onComplete={handleComplete}
              />
            ) : null}
          </div>

          {/* Footer for non-required surveys */}
          {!isRequired && !loading && !error && !completed && !alreadyCompleted && (
            <div
              className="flex justify-end gap-3 p-4 border-t"
              style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
            >
              <Button variant="ghost" onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
