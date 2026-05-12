import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronRight, Compass, Trophy } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { activityLogger } from '../../services/activityLogger';
import { Card, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { EmptyDashboard, Skeleton, StatTile } from '../../components/dashboard';
import { WelcomeCard } from '../../components/dashboard/WelcomeCard';
import { MiniCalendar } from '../../components/dashboard/MiniCalendar';
import { ContinueLearningRail } from '../../components/courses/ContinueLearningRail';
import { meApi } from '../../api/me';
import { assignmentsApi } from '../../api/assignments';

type Tone = 'green' | 'blue' | 'yellow';

interface UpcomingItem {
  assignmentId: number;
  title: string;
  courseId: number;
  courseTitle: string;
  dueDate: string;
  gracePeriodDeadline?: string | null;
  tone: Tone;
  /** Effective deadline for the displayed date string — grace
      deadline if we're past due-date but still in grace, else
      due-date. */
  effectiveDate: string;
}

const TONE_LIGHT: Record<Tone, { bg: string; border: string; text: string; sub: string; chev: string }> = {
  green: { bg: '#dcfce7', border: '#bbf7d0', text: '#14532d', sub: '#15803d', chev: '#16a34a' },
  blue:  { bg: '#dbeafe', border: '#bfdbfe', text: '#1e3a8a', sub: '#1d4ed8', chev: '#2563eb' },
  yellow:{ bg: '#fef3c7', border: '#fde68a', text: '#78350f', sub: '#a16207', chev: '#d97706' },
};
const TONE_DARK: Record<Tone, { bg: string; border: string; text: string; sub: string; chev: string }> = {
  green: { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)',  text: '#bbf7d0', sub: '#86efac', chev: '#86efac' },
  blue:  { bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.30)', text: '#bfdbfe', sub: '#93c5fd', chev: '#93c5fd' },
  yellow:{ bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.30)', text: '#fde68a', sub: '#fcd34d', chev: '#fcd34d' },
};

const ONE_DAY = 86_400_000;
const ONE_WEEK = 7 * ONE_DAY;
const ONE_MONTH = 30 * ONE_DAY;

/**
 * Student dashboard. Two parallel columns that don't influence each
 * other's vertical flow:
 *   - Left (3 cols):  WelcomeCard, then the courses-in-progress rail.
 *   - Right (2 cols): MiniCalendar, then a compact Upcoming list.
 * `items-start` on the grid keeps each column content-sized so a tall
 * Upcoming list never pushes the rail down on the left.
 */
export const StudentDashboard = () => {
  const { t } = useTranslation(['courses', 'common', 'navigation']);
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    activityLogger.logDashboardViewed();
  }, []);

  const { data: continueLearning, isLoading: clLoading } = useQuery({
    queryKey: ['me', 'continue-learning'],
    queryFn: () => meApi.getContinueLearning(),
    enabled: !!user,
  });

  const { data: gradebook } = useQuery({
    queryKey: ['myGradebook'],
    queryFn: assignmentsApi.getMyGradebook,
    enabled: !!user,
  });

  // Flatten gradebook into a raw list of due-dated assignments. The
  // calendar uses every item; the upcoming list filters further.
  const allAssignments = useMemo(() => {
    return (gradebook ?? []).flatMap((c: any) =>
      (c.assignments ?? [])
        .filter((a: any) => !!a.dueDate)
        .map((a: any) => ({
          assignmentId: a.id as number,
          title: a.title as string,
          courseId: (a.courseId ?? c.courseId) as number,
          courseTitle: c.courseTitle as string,
          dueDate: a.dueDate as string,
          gracePeriodDeadline: (a.gracePeriodDeadline ?? null) as string | null,
        })),
    );
  }, [gradebook]);

  const itemsByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allAssignments) {
      const iso = a.dueDate.slice(0, 10);
      m.set(iso, (m.get(iso) ?? 0) + 1);
    }
    return m;
  }, [allAssignments]);

  // Upcoming = items the student should pay attention to right now.
  // Tone is driven by the time-to-deadline (or grace state):
  //   - yellow → past due but still inside the grace period
  //   - blue   → 0 to ≤ 1 week to due-date
  //   - green  → > 1 week and ≤ ~1 month to due-date
  // Anything further out (or beyond grace) is hidden so the list
  // stays compact and actionable.
  const upcoming = useMemo<UpcomingItem[]>(() => {
    const now = Date.now();
    const out: UpcomingItem[] = [];
    for (const a of allAssignments) {
      const due = new Date(a.dueDate).getTime();
      const grace = a.gracePeriodDeadline ? new Date(a.gracePeriodDeadline).getTime() : null;

      let tone: Tone | null = null;
      let effectiveDate = a.dueDate;
      if (due >= now) {
        const delta = due - now;
        if (delta <= ONE_WEEK) tone = 'blue';
        else if (delta <= ONE_MONTH) tone = 'green';
      } else if (grace != null && grace >= now) {
        // Past due but still within the instructor-configured grace
        // window — surface as yellow with the grace deadline as the
        // displayed date so the student knows their actual cutoff.
        tone = 'yellow';
        effectiveDate = a.gracePeriodDeadline as string;
      }

      if (!tone) continue;
      out.push({ ...a, tone, effectiveDate });
    }
    out.sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
    return out.slice(0, 6);
  }, [allAssignments]);

  const railItems = useMemo(
    () => (continueLearning ?? []).filter(c => c.progress < 100),
    [continueLearning],
  );

  // KPI counts. `continueLearning` returns every active+completed
  // enrollment, so its length is the enrolled total and the slice
  // with progress ≥ 100 is the completed total.
  const enrolledCount = continueLearning?.length ?? 0;
  const completedCount = useMemo(
    () => (continueLearning ?? []).filter(c => c.progress >= 100).length,
    [continueLearning],
  );

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    cardBg: isDark ? '#1f2937' : '#ffffff',
    cardBorder: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
    subtle: isDark ? '#6b7280' : '#9ca3af',
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-4">
          <Breadcrumb items={[{ label: t('common:dashboard', { defaultValue: 'Dashboard' }) }]} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5 items-start">
          {/* Left column: welcome + KPI tiles + courses-in-progress rail */}
          <div className="lg:col-span-3 space-y-6">
            <WelcomeCard
              name={user?.fullname}
              message={t('common:welcome_message_student', {
                defaultValue:
                  "Pick up where you left off and stay on top of what's due this week.",
              })}
            />

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <StatTile
                icon={BookOpen}
                label={t('common:enrolled_courses', { defaultValue: 'Enrolled Courses' })}
                value={enrolledCount}
                color="violet"
                href="/courses"
              />
              <StatTile
                icon={Trophy}
                label={t('common:completed', { defaultValue: 'Completed' })}
                value={completedCount}
                color="emerald"
                href="/courses"
              />
            </div>

            <section>
              <h2 className="text-base font-semibold mb-3" style={{ color: colors.text }}>
                {t('common:courses_in_progress', { defaultValue: 'Courses in progress' })}
              </h2>
              {clLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[0, 1].map(i => (
                    <Skeleton key={i} className="h-44" rounded="lg" />
                  ))}
                </div>
              ) : railItems.length === 0 ? (
                <Card>
                  <CardBody>
                    <EmptyDashboard
                      icon={Compass}
                      title={t('common:nothing_in_progress', { defaultValue: 'Nothing in progress yet' })}
                      description={t('common:browse_to_get_started', { defaultValue: 'Browse the catalog to start learning.' })}
                      action={
                        <Link to="/courses">
                          <Button size="sm">{t('explore_courses')}</Button>
                        </Link>
                      }
                    />
                  </CardBody>
                </Card>
              ) : (
                <ContinueLearningRail
                  items={railItems}
                  bleed={false}
                  percentLabel={pct =>
                    t('courses:percent_complete', {
                      defaultValue: '{{percent}}% Complete',
                      percent: pct,
                    })
                  }
                />
              )}
            </section>
          </div>

          {/* Right column: calendar + upcoming */}
          <div className="lg:col-span-2 space-y-4">
            <MiniCalendar
              itemsByDate={itemsByDate}
              onDateClick={() => navigate('/dashboard/calendar')}
            />

            {upcoming.length > 0 && (
              <div
                className="rounded-2xl border"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
              >
                <div className="px-4 pt-4 pb-2">
                  <h3 className="text-sm font-semibold" style={{ color: colors.text }}>
                    {t('common:upcoming_assignments', { defaultValue: 'Upcoming assignments' })}
                  </h3>
                </div>

                <ul className="px-3 pb-3 space-y-2">
                  {upcoming.map(item => (
                    <UpcomingRow
                      key={item.assignmentId}
                      item={item}
                      isDark={isDark}
                      duePrefix={t('common:due_on', { defaultValue: 'Due' })}
                      gracePrefix={t('common:grace_until', { defaultValue: 'Grace until' })}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Inline upcoming list ---------- */

interface UpcomingRowProps {
  item: UpcomingItem;
  isDark: boolean;
  duePrefix: string;
  gracePrefix: string;
}

const formatDeadline = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

const UpcomingRow = ({ item, isDark, duePrefix, gracePrefix }: UpcomingRowProps) => {
  const tone = (isDark ? TONE_DARK : TONE_LIGHT)[item.tone];
  const prefix = item.tone === 'yellow' ? gracePrefix : duePrefix;
  return (
    <li>
      <Link
        to={`/courses/${item.courseId}/assignments/${item.assignmentId}`}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors hover:brightness-95 dark:hover:brightness-110"
        style={{ backgroundColor: tone.bg, borderColor: tone.border }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: tone.text }}>
            {item.title}
          </p>
          <p className="text-xs truncate" style={{ color: tone.sub }}>
            {item.courseTitle}
          </p>
          <p className="mt-0.5 text-[11px] font-medium" style={{ color: tone.sub }}>
            {prefix} {formatDeadline(item.effectiveDate)}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: tone.chev }} />
      </Link>
    </li>
  );
};
