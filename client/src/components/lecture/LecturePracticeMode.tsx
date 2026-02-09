import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quizzesApi, GeneratedMCQ } from '../../api/quizzes';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../common/Button';

interface LecturePracticeModeProps {
  lectureId: number;
  lectureTitle: string;
  onBack: () => void;
}

type PracticeState = 'setup' | 'quiz' | 'results';

interface AnswerState {
  selectedAnswer: string | null;
  isChecked: boolean;
  isCorrect: boolean | null;
}

export const LecturePracticeMode = ({ lectureId, lectureTitle, onBack }: LecturePracticeModeProps) => {
  const { t } = useTranslation(['courses', 'common']);
  const { isDark } = useTheme();

  // State
  const [state, setState] = useState<PracticeState>('setup');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questions, setQuestions] = useState<GeneratedMCQ[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});

  const colors = {
    bg: isDark ? '#1f2937' : '#ffffff',
    bgSecondary: isDark ? '#374151' : '#f9fafb',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    accent: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
  };

  // Generate questions mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      quizzesApi.generatePracticeQuiz({
        lectureId,
        questionCount,
        difficulty,
      }),
    onSuccess: (data) => {
      if (data.questions.length === 0) {
        toast.error(t('no_questions_generated'));
        return;
      }
      setQuestions(data.questions);
      setCurrentIndex(0);
      setAnswers({});
      setState('quiz');
      toast.success(t('practice_quiz_ready'));
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || t('failed_generate_practice'));
    },
  });

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex] || { selectedAnswer: null, isChecked: false, isCorrect: null };

  const handleSelectAnswer = useCallback((answer: string) => {
    if (currentAnswer.isChecked) return; // Can't change after checking
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: { ...prev[currentIndex], selectedAnswer: answer, isChecked: false, isCorrect: null },
    }));
  }, [currentIndex, currentAnswer.isChecked]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentAnswer.selectedAnswer || !currentQuestion) return;
    const isCorrect = currentAnswer.selectedAnswer === currentQuestion.correctAnswer;
    setAnswers((prev) => ({
      ...prev,
      [currentIndex]: { ...prev[currentIndex], isChecked: true, isCorrect },
    }));
  }, [currentIndex, currentAnswer.selectedAnswer, currentQuestion]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setState('results');
    }
  }, [currentIndex, questions.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleTryAgain = useCallback(() => {
    setAnswers({});
    setCurrentIndex(0);
    setState('quiz');
  }, []);

  const handleNewQuestions = useCallback(() => {
    setState('setup');
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
  }, []);

  // Calculate score
  const calculateScore = () => {
    let correct = 0;
    let total = questions.length;
    Object.values(answers).forEach((a) => {
      if (a.isCorrect) correct++;
    });
    return { correct, total, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 };
  };

  // Setup View
  if (state === 'setup') {
    return (
      <div className="p-4 space-y-6">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm"
          style={{ color: colors.textSecondary }}
        >
          <ChevronLeft size={16} />
          {t('back_to_menu')}
        </button>

        {/* Header */}
        <div className="text-center">
          <div
            className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <Target className="w-6 h-6" style={{ color: colors.accent }} />
          </div>
          <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            {t('practice_mode')}
          </h3>
          <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            {t('practice_description')}
          </p>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          {/* Question Count */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('number_of_questions')}
            </label>
            <div className="flex gap-2">
              {[3, 5, 10].map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    questionCount === count ? 'ring-2 ring-blue-500' : ''
                  }`}
                  style={{
                    backgroundColor: questionCount === count ? colors.accent : colors.bgSecondary,
                    color: questionCount === count ? '#ffffff' : colors.textPrimary,
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
              {t('difficulty')}
            </label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    difficulty === diff ? 'ring-2 ring-blue-500' : ''
                  }`}
                  style={{
                    backgroundColor: difficulty === diff ? colors.accent : colors.bgSecondary,
                    color: difficulty === diff ? '#ffffff' : colors.textPrimary,
                  }}
                >
                  {t(`difficulty_${diff}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('generating_questions')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t('generate_practice_quiz')}
            </>
          )}
        </Button>
      </div>
    );
  }

  // Quiz View
  if (state === 'quiz' && currentQuestion) {
    return (
      <div className="p-4 space-y-4">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm"
            style={{ color: colors.textSecondary }}
          >
            <ChevronLeft size={16} />
            {t('exit')}
          </button>
          <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
            {t('question_of', { current: currentIndex + 1, total: questions.length })}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 rounded-full" style={{ backgroundColor: colors.bgSecondary }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              backgroundColor: colors.accent,
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>

        {/* Question */}
        <div className="py-4">
          <p className="text-base font-medium" style={{ color: colors.textPrimary }}>
            {currentQuestion.questionText}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = currentAnswer.selectedAnswer === option;
            const isCorrectAnswer = option === currentQuestion.correctAnswer;
            const showResult = currentAnswer.isChecked;

            let bgColor = colors.bgSecondary;
            let borderColor = colors.border;
            let textColor = colors.textPrimary;

            if (showResult) {
              if (isCorrectAnswer) {
                bgColor = isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5';
                borderColor = colors.success;
              } else if (isSelected && !isCorrectAnswer) {
                bgColor = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2';
                borderColor = colors.error;
              }
            } else if (isSelected) {
              borderColor = colors.accent;
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(option)}
                disabled={currentAnswer.isChecked}
                className="w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left"
                style={{
                  backgroundColor: bgColor,
                  borderColor,
                  color: textColor,
                  opacity: currentAnswer.isChecked && !isSelected && !isCorrectAnswer ? 0.6 : 1,
                }}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium ${
                    isSelected && !showResult ? 'bg-blue-500 text-white' : ''
                  }`}
                  style={
                    !isSelected || showResult
                      ? {
                          backgroundColor: showResult && isCorrectAnswer ? colors.success : colors.border,
                          color: showResult && isCorrectAnswer ? '#ffffff' : colors.textSecondary,
                        }
                      : {}
                  }
                >
                  {showResult && isCorrectAnswer ? (
                    <CheckCircle size={14} />
                  ) : showResult && isSelected && !isCorrectAnswer ? (
                    <XCircle size={14} />
                  ) : (
                    String.fromCharCode(65 + idx)
                  )}
                </div>
                <span className="text-sm">{option}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation (shown after checking) */}
        {currentAnswer.isChecked && currentQuestion.explanation && (
          <div
            className="p-3 rounded-lg text-sm"
            style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}
          >
            <span className="font-medium">{t('explanation')}:</span> {currentQuestion.explanation}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {currentIndex > 0 && (
            <Button variant="secondary" onClick={handlePrevious}>
              <ChevronLeft size={16} />
              {t('previous')}
            </Button>
          )}
          <div className="flex-1" />
          {!currentAnswer.isChecked ? (
            <Button onClick={handleCheckAnswer} disabled={!currentAnswer.selectedAnswer}>
              {t('check_answer')}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {currentIndex < questions.length - 1 ? (
                <>
                  {t('next_question')}
                  <ChevronRight size={16} />
                </>
              ) : (
                <>
                  {t('see_results')}
                  <Trophy size={16} />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Results View
  if (state === 'results') {
    const score = calculateScore();

    return (
      <div className="p-4 space-y-6">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm"
          style={{ color: colors.textSecondary }}
        >
          <ChevronLeft size={16} />
          {t('back_to_menu')}
        </button>

        {/* Score Card */}
        <div className="text-center py-6">
          <div
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
            style={{
              backgroundColor: score.percentage >= 70 ? colors.success : colors.error,
            }}
          >
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
            {score.percentage}%
          </h3>
          <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            {t('score_summary', { correct: score.correct, total: score.total })}
          </p>
          {score.percentage >= 70 ? (
            <p className="text-sm mt-2 font-medium" style={{ color: colors.success }}>
              {t('great_job')}
            </p>
          ) : (
            <p className="text-sm mt-2" style={{ color: colors.textSecondary }}>
              {t('keep_practicing')}
            </p>
          )}
        </div>

        {/* Question Review Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium" style={{ color: colors.textPrimary }}>
            {t('question_review')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {questions.map((_, idx) => {
              const answer = answers[idx];
              const isCorrect = answer?.isCorrect;
              return (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: isCorrect ? colors.success : colors.error,
                    color: '#ffffff',
                  }}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleTryAgain} className="flex-1">
            <RotateCcw size={16} />
            {t('try_again')}
          </Button>
          <Button onClick={handleNewQuestions} className="flex-1">
            <Sparkles size={16} />
            {t('new_questions')}
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
