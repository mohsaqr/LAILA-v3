import { useState, useEffect } from 'react';
import { Award } from 'lucide-react';
import { Input, TextArea } from '../../common/Input';
import { Button } from '../../common/Button';
import { Card, CardBody, CardHeader } from '../../common/Card';

interface GradeAgentFormProps {
  studentName: string;
  maxPoints: number;
  currentGrade?: number | null;
  currentFeedback?: string | null;
  onGrade: (grade: number, feedback: string) => void;
  isGrading: boolean;
}

export const GradeAgentForm = ({
  studentName,
  maxPoints,
  currentGrade,
  currentFeedback,
  onGrade,
  isGrading,
}: GradeAgentFormProps) => {
  const [grade, setGrade] = useState<number>(currentGrade || 0);
  const [feedback, setFeedback] = useState(currentFeedback || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentGrade !== undefined && currentGrade !== null) {
      setGrade(currentGrade);
    }
    if (currentFeedback) {
      setFeedback(currentFeedback);
    }
  }, [currentGrade, currentFeedback]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (grade < 0 || grade > maxPoints) {
      setError(`Grade must be between 0 and ${maxPoints}`);
      return;
    }

    setError(null);
    onGrade(grade, feedback);
  };

  const isUpdate = currentGrade !== undefined && currentGrade !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-gray-900">
            {isUpdate ? 'Update Grade' : 'Grade Submission'}
          </h3>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Student: <span className="font-medium text-gray-900">{studentName}</span>
          </p>

          <Input
            label={`Grade (out of ${maxPoints})`}
            type="number"
            value={grade}
            onChange={(e) => {
              setGrade(parseInt(e.target.value) || 0);
              setError(null);
            }}
            min={0}
            max={maxPoints}
            error={error || undefined}
            required
          />

          <TextArea
            label="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Provide constructive feedback about the student's agent..."
            rows={4}
          />

          {isUpdate && currentGrade !== null && (
            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              <p>
                Current grade: <span className="font-medium">{currentGrade}/{maxPoints}</span>
              </p>
              {currentFeedback && (
                <p className="mt-1">
                  Previous feedback: <span className="italic">"{currentFeedback}"</span>
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isGrading}>
              {isUpdate ? 'Update Grade' : 'Submit Grade'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};
