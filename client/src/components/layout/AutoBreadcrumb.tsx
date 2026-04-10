import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  /^\/teach\/courses\/\d+\/surveys/,
  /^\/teach\/courses\/\d+\/certificates/,
  /^\/teach\/courses\/\d+\/chatbot-logs/,
  /^\/teach\/courses\/\d+\/tutors/,
  /^\/teach\/courses\/\d+\/edit/,
  /^\/teach\/courses\/\d+\/lectures/,
  /^\/teach\/courses\/\d+\/code-labs/,
  /^\/teach\/courses\/\d+\/logs/,
  /^\/teach\/courses\/\d+\/analytics/,
  /^\/courses\/\d+$/,
  /^\/courses\/\d+\/lectures\//,
  /^\/courses\/\d+\/assignments$/,
  /^\/courses\/\d+\/assignments\/\d+$/,
  /^\/courses\/\d+\/agent-assignments\/\d+$/,
  /^\/courses\/\d+\/agent-assignments\/\d+\/use$/,
  /^\/teach\/courses\/\d+\/assignments$/,
  /^\/courses\/\d+\/analytics$/,
  /^\/courses\/\d+\/tna-exercise/,
  /^\/courses\/\d+\/sna-exercise/,
  /^\/labs\/tna-exercise/,
  /^\/labs\/sna-exercise/,
  /^\/admin\/users/,
  /^\/admin\/enrollments/,
  /^\/courses$/,
  /^\/labs\//,
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
      const prevSeg = i > 0 ? segments[i - 1] : '';
      const isLast = i === segments.length - 1;

      if (prevSeg === 'courses') {
        // Course ID → course title
        items.push({
          label: course?.title || `Course ${seg}`,
          href: isLast ? undefined : currentPath,
        });
      } else if (prevSeg === 'lectures' && course?.modules) {
        // Module ID after /lectures/ → module title
        const mod = course.modules.find((m: any) => m.id === parseInt(seg));
        if (mod) {
          items.push({
            label: mod.title,
            href: isLast ? undefined : currentPath,
          });
        }
      } else if (i > 1 && segments[i - 2] === 'lectures' && course?.modules) {
        // Lecture ID (third segment after /lectures/moduleId/lectureId) → lecture title
        const modId = parseInt(segments[i - 1]);
        const mod = course.modules.find((m: any) => m.id === modId);
        const lec = mod?.lectures?.find((l: any) => l.id === parseInt(seg));
        if (lec) {
          items.push({
            label: lec.title,
            href: isLast ? undefined : undefined,
          });
        }
      }
      continue;
    }

    // Skip 'lectures' segment — module/lecture titles are shown instead
    if (seg === 'lectures' && i + 1 < segments.length && /^\d+$/.test(segments[i + 1])) {
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
