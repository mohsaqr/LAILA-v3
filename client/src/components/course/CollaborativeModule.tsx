import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, AudioLines, Settings } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { resolveFileUrl } from '../../api/client';

interface TutorInfo {
  id?: number;
  courseTutorId?: number;
  displayName: string;
  avatarUrl: string | null;
}

interface CollaborativeModuleProps {
  courseId: number;
  tutors?: TutorInfo[];
  courseTitle?: string;
  moduleName?: string;
  isInstructor?: boolean;
}

/**
 * Compact "join the AI tutors" card for the course page sidebar.
 * Mirrors the reference design (overlapping circular avatars with
 * a thin ring + tiny audio chip on the trailing avatar, names
 * joined naturally below). Sits on the standard card surface used
 * everywhere else on the dashboard — no deep-blue gradient.
 */
export const CollaborativeModule = ({ courseId, tutors, moduleName, isInstructor }: CollaborativeModuleProps) => {
  const { t } = useTranslation(['courses']);
  const { isDark } = useTheme();

  const colors = {
    cardBg: isDark ? '#1f2937' : '#ffffff',
    cardBorder: isDark ? '#374151' : '#e5e7eb',
    titleColor: isDark ? '#f3f4f6' : '#111827',
    muted: isDark ? '#9ca3af' : '#6b7280',
    ring: isDark ? '#1f2937' : '#ffffff',
  };

  if (!tutors || tutors.length === 0) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <Bot className="w-10 h-10 mx-auto mb-2" style={{ color: colors.muted }} />
        <p className="text-sm" style={{ color: colors.muted }}>
          {t('no_ai_tutors_available')}
        </p>
      </div>
    );
  }

  const displayed = tutors.slice(0, 3);
  const extra = Math.max(0, tutors.length - displayed.length);
  const heading = (moduleName?.trim() || t('collaborative_module')) as string;

  return (
    <div className="space-y-2">
      {isInstructor && (
        <div className="flex items-center justify-end">
          <Link
            to={`/teach/courses/${courseId}/setup?step=tutors`}
            className="text-xs hover:underline flex items-center gap-1"
            style={{ color: '#0d9488' }}
          >
            <Settings className="w-3 h-3" />
            {t('manage_tutors')}
          </Link>
        </div>
      )}

      <Link
        to={`/ai-tutors?courseId=${courseId}`}
        className="block rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md"
        style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}
      >
        <div className="px-5 py-5 flex flex-col items-center">
          {/* Overlapping ringed avatars + green pulse overlapping the
              trailing avatar's bottom-right. */}
          <div className="relative inline-flex items-center">
            {displayed.map((tutor, i) => (
              <div
                key={tutor.courseTutorId || tutor.id || i}
                className="relative w-10 h-10 rounded-full p-0.5"
                style={{
                  marginLeft: i === 0 ? 0 : -10,
                  zIndex: displayed.length - i,
                  backgroundColor: colors.ring,
                }}
                title={tutor.displayName}
              >
                <div
                  className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-white"
                  style={{
                    border: `2px solid ${isDark ? 'rgba(167,139,250,0.30)' : '#e9d5ff'}`,
                    backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  }}
                >
                  {tutor.avatarUrl ? (
                    <img
                      src={resolveFileUrl(tutor.avatarUrl) || tutor.avatarUrl}
                      alt={tutor.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
              </div>
            ))}
            {extra > 0 && (
              <div
                className="relative w-10 h-10 rounded-full p-0.5"
                style={{ marginLeft: -10, zIndex: 0, backgroundColor: colors.ring }}
              >
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-[10px] font-semibold"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                    color: colors.muted,
                    border: `2px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  }}
                >
                  +{extra}
                </div>
              </div>
            )}

            {/* Pulsing audio chip — overlaps the trailing avatar. */}
            <span
              className="absolute inline-flex items-center justify-center w-5 h-5 rounded-full shadow-md"
              style={{
                backgroundColor: '#22c55e',
                right: '-6px',
                bottom: '-2px',
                zIndex: displayed.length + 1,
              }}
            >
              <AudioLines className="w-3 h-3 text-white" strokeWidth={2.5} />
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: '#22c55e', opacity: 0.5 }}
                aria-hidden
              />
            </span>
          </div>

          {/* Module name (instructor-configured, falls back to the
              default "Collaborative Module" copy). */}
          <p
            className="mt-3 text-sm font-semibold text-center"
            style={{ color: colors.titleColor }}
          >
            {heading}
          </p>
        </div>
      </Link>
    </div>
  );
};

export default CollaborativeModule;
