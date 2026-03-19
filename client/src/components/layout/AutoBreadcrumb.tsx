import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, BreadcrumbItem } from '../common/Breadcrumb';
import { coursesApi } from '../../api/courses';

/** Route segment → human-readable label mapping */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  courses: 'Courses',
  teach: 'Teaching',
  admin: 'Admin',
  labs: 'Labs',
  forums: 'Forums',
  quizzes: 'Quizzes',
  certificates: 'Certificates',
  profile: 'Profile',
  settings: 'Settings',
  reports: 'Reports',
  surveys: 'Surveys',
  curriculum: 'Curriculum',
  assignments: 'Assignments',
  gradebook: 'Gradebook',
  submissions: 'Submissions',
  edit: 'Settings',
  create: 'Create',
  'ai-tools': 'AI Tools',
  'ai-tutors': 'AI Tutors',
  'tna-exercise': 'TNA Exercise',
  'sna-exercise': 'SNA Exercise',
  grades: 'Grades',
  'chatbot-logs': 'Chatbot Logs',
  tutors: 'Tutors',
  logs: 'Logs',
  analytics: 'Analytics',
  'agent-assignments': 'Agent Assignments',
  'code-labs': 'Code Labs',
  'my-learning': 'My Learning',
  'batch-enrollment': 'Batch Enrollment',
};

/** Pages that render their own breadcrumbs — skip auto-breadcrumb */
const PAGES_WITH_OWN_BREADCRUMBS = [
  /^\/teach\/courses\/\d+\/curriculum/,
  /^\/teach\/courses\/\d+\/assignments\/\d+\/submissions\/\d+/,
  /^\/teach\/courses\/\d+\/assignments\/\d+\/submissions$/,
  /^\/teach\/courses\/\d+\/gradebook/,
  /^\/teach\/courses\/\d+\/quizzes/,
  /^\/teach\/courses\/\d+\/forums/,
  /^\/teach\/courses\/\d+\/certificates/,
  /^\/teach\/courses\/\d+\/chatbot-logs/,
  /^\/teach\/courses\/\d+\/tutors/,
  /^\/teach\/courses\/\d+\/edit/,
  /^\/teach\/courses\/\d+\/lectures/,
  /^\/teach\/courses\/\d+\/code-labs/,
  /^\/courses\/\d+\/assignments\/\d+$/,
  /^\/admin\/users/,
  /^\/admin\/enrollments/,
];

/** Pages where breadcrumb is not useful (root-level dashboards) */
const SKIP_PAGES = [
  /^\/dashboard$/,
  /^\/$/,
  /^\/auth\//,
  /^\/login/,
  /^\/register/,
];

export const AutoBreadcrumb = () => {
  const { t } = useTranslation(['navigation', 'common']);
  const location = useLocation();
  const path = location.pathname;

  // Skip for pages that have their own breadcrumbs or don't need them
  if (SKIP_PAGES.some(re => re.test(path))) return null;
  if (PAGES_WITH_OWN_BREADCRUMBS.some(re => re.test(path))) return null;

  // Extract course ID if present for fetching course title
  const courseMatch = path.match(/\/(?:teach\/)?courses\/(\d+)/);
  const courseId = courseMatch ? parseInt(courseMatch[1]) : null;

  return <AutoBreadcrumbInner path={path} courseId={courseId} />;
};

/** Inner component that can use hooks conditionally based on courseId */
const AutoBreadcrumbInner = ({ path, courseId }: { path: string; courseId: number | null }) => {
  const { t } = useTranslation(['navigation', 'common']);

  const { data: course } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourseById(courseId!),
    enabled: courseId != null,
    staleTime: 5 * 60 * 1000,
  });

  const segments = path.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += '/' + seg;

    // Skip numeric IDs — they'll be resolved to names
    if (/^\d+$/.test(seg)) {
      // If this is a course ID, insert the course title
      if (i > 0 && (segments[i - 1] === 'courses')) {
        const label = course?.title || `Course ${seg}`;
        const isLast = i === segments.length - 1;
        items.push({
          label,
          href: isLast ? undefined : currentPath,
        });
      }
      continue;
    }

    // Get label from mapping or capitalize
    const label = SEGMENT_LABELS[seg] || seg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const isLast = i === segments.length - 1;
    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4">
      <Breadcrumb items={items} />
    </div>
  );
};
