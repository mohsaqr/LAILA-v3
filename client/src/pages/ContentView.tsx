import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { coursesApi } from '../api/courses';
import { Card, CardBody } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { Breadcrumb } from '../components/common/Breadcrumb';

interface LocationState {
  title?: string;
  content?: string;
  type?: string;
}

export const ContentView = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  // Try to get content from sessionStorage (for new tab opens)
  const [storedContent, setStoredContent] = useState<LocationState | null>(null);

  useEffect(() => {
    if (id) {
      const stored = sessionStorage.getItem(`content-${id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setStoredContent(parsed);
          // Clean up after reading
          sessionStorage.removeItem(`content-${id}`);
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }, [id]);

  // If content was passed via state or sessionStorage, use it directly
  const passedContent = state?.content || storedContent?.content;
  const passedTitle = state?.title || storedContent?.title;
  const passedType = state?.type || storedContent?.type;

  // If type is 'section', we need to fetch the lecture containing that section
  // For now, sections are passed via state for simplicity
  const { data: lecture, isLoading } = useQuery({
    queryKey: ['lecture', id],
    queryFn: () => coursesApi.getLectureById(parseInt(id!)),
    enabled: type === 'lecture' && !passedContent,
  });

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  if (isLoading) {
    return <Loading fullScreen text="Loading content..." />;
  }

  // Determine content source
  let title = passedTitle;
  let content = passedContent;
  let contentType = passedType || type;

  if (type === 'lecture' && lecture && !passedContent) {
    title = lecture.title;
    content = lecture.content || '';
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardBody className="text-center py-8 px-12">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Content Not Found</h2>
            <p className="text-gray-600 mb-4">The requested content could not be found.</p>
            <button onClick={handleBack} className="btn btn-primary">
              Go Back
            </button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Breadcrumb */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <Breadcrumb
            items={[
              { label: 'Courses', href: '/courses' },
              { label: title || 'Content' },
            ]}
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          {title && (
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                {contentType === 'ai-generated' && <Sparkles className="w-5 h-5 text-purple-500" />}
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              </div>
            </div>
          )}
          <CardBody className="py-6">
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
