import { BreadcrumbItem } from '../components/common/Breadcrumb';

/**
 * Build breadcrumb for course context
 */
export const buildCourseBreadcrumb = (
  courseId: number | string,
  courseTitle: string
): BreadcrumbItem[] => [
  { label: 'Courses', href: '/courses' },
  { label: courseTitle, href: `/courses/${courseId}` },
];

/**
 * Build breadcrumb for forum pages
 */
export const buildForumBreadcrumb = (
  courseId: number | string,
  courseTitle: string,
  forumTitle?: string,
  forumId?: number | string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    ...buildCourseBreadcrumb(courseId, courseTitle),
    { label: 'Forums', href: `/courses/${courseId}/forums` },
  ];
  if (forumTitle && forumId) {
    items.push({ label: forumTitle, href: `/courses/${courseId}/forums/${forumId}` });
  } else if (forumTitle) {
    items.push({ label: forumTitle });
  }
  return items;
};

/**
 * Build breadcrumb for thread pages
 */
export const buildThreadBreadcrumb = (
  courseId: number | string,
  courseTitle: string,
  forumId: number | string,
  forumTitle: string,
  threadTitle?: string
): BreadcrumbItem[] => {
  const items = buildForumBreadcrumb(courseId, courseTitle, forumTitle, forumId);
  if (threadTitle) {
    items.push({ label: threadTitle });
  }
  return items;
};

/**
 * Build breadcrumb for quiz pages
 */
export const buildQuizBreadcrumb = (
  courseId: number | string,
  courseTitle: string,
  quizTitle?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    ...buildCourseBreadcrumb(courseId, courseTitle),
    { label: 'Quizzes', href: `/courses/${courseId}/quizzes` },
  ];
  if (quizTitle) {
    items.push({ label: quizTitle });
  }
  return items;
};

/**
 * Build breadcrumb for certificate pages
 */
export const buildCertificateBreadcrumb = (
  courseId?: number | string,
  courseTitle?: string,
  certificateName?: string
): BreadcrumbItem[] => {
  if (courseId && courseTitle) {
    const items: BreadcrumbItem[] = [
      ...buildCourseBreadcrumb(courseId, courseTitle),
      { label: 'Certificates', href: `/courses/${courseId}/certificates` },
    ];
    if (certificateName) {
      items.push({ label: certificateName });
    }
    return items;
  }
  // Dashboard context
  const items: BreadcrumbItem[] = [
    { label: 'My Certificates', href: '/certificates' },
  ];
  if (certificateName) {
    items.push({ label: certificateName });
  }
  return items;
};

/**
 * Build breadcrumb for teaching pages
 */
export const buildTeachingBreadcrumb = (
  courseId?: number | string,
  courseTitle?: string,
  section?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    { label: 'Teaching', href: '/courses' },
  ];
  if (courseId && courseTitle) {
    items.push({ label: courseTitle, href: `/courses/${courseId}` });
  }
  if (section) {
    items.push({ label: section });
  }
  return items;
};

/**
 * Build breadcrumb for admin pages
 */
export const buildAdminBreadcrumb = (
  section?: string,
  subSection?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    { label: 'Admin', href: '/admin' },
  ];
  if (section) {
    items.push({ label: section });
  }
  if (subSection) {
    items.push({ label: subSection });
  }
  return items;
};

/**
 * Build breadcrumb for content view with full hierarchy
 */
export const buildContentBreadcrumb = (
  courseId?: number | string,
  courseTitle?: string,
  moduleName?: string,
  lectureName?: string,
  contentTitle?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [
    { label: 'Courses', href: '/courses' },
  ];
  if (courseId && courseTitle) {
    items.push({ label: courseTitle, href: `/courses/${courseId}` });
  }
  if (moduleName) {
    items.push({ label: moduleName });
  }
  if (lectureName) {
    items.push({ label: lectureName });
  }
  if (contentTitle) {
    items.push({ label: contentTitle });
  }
  return items;
};

/**
 * Build breadcrumb for dashboard pages
 */
export const buildDashboardBreadcrumb = (
  section?: string,
  subSection?: string
): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [];
  if (section) {
    items.push({ label: section, href: section === 'My Quizzes' ? '/quizzes' : undefined });
  }
  if (subSection) {
    items.push({ label: subSection });
  }
  return items;
};
