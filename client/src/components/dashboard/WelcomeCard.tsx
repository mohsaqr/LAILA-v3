import { useTranslation } from 'react-i18next';

interface WelcomeCardProps {
  name?: string | null;
  message?: string;
  className?: string;
}

/**
 * Hero greeting tile for role dashboards. Pairs an inline SVG
 * character + calendar with the user's full name and a friendly
 * one-liner. Designed to sit alongside a 2×2 stat-tile grid.
 */
export const WelcomeCard = ({ name, message, className = '' }: WelcomeCardProps) => {
  const { t } = useTranslation(['common']);
  const fullName = name?.trim() ?? '';
  return (
    <div
      className={`relative h-full overflow-hidden rounded-2xl text-white shadow-md ${className}`}
      style={{
        background:
          'linear-gradient(135deg, #0e7490 0%, #0d9488 35%, #6366f1 100%)',
      }}
    >
      {/* Subtle dot pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="welcome-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#welcome-dots)" />
      </svg>

      {/* Soft background blobs */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle at center, #ffffff 0%, transparent 65%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle at center, #fde68a 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-2 p-5 sm:p-7 items-center">
        <div className="sm:col-span-2 flex justify-center sm:justify-start">
          <WelcomeIllustration />
        </div>
        <div className="sm:col-span-3 sm:pl-2 text-center sm:text-left">
          <p className="text-white/80 text-sm font-medium tracking-wide mb-1">
            {t('common:welcome_back_short', { defaultValue: 'Welcome back' })}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 break-words">
            {fullName || t('common:there', { defaultValue: 'there' })}
          </h2>
          <p className="text-white/85 text-sm max-w-md leading-relaxed mx-auto sm:mx-0">
            {message ??
              t('common:lets_start_message', {
                defaultValue:
                  "Let's check what needs your attention today. Take a look at pending grading and recent student activity.",
              })}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * 3D illustration shipped from `client/public/illustrations/`. PNG with
 * transparent background so it sits cleanly on the card's gradient.
 */
const WelcomeIllustration = () => (
  <img
    src="/illustrations/welcome-instructor.png"
    alt=""
    aria-hidden="true"
    className="w-full max-w-[220px] sm:max-w-[200px] h-auto select-none pointer-events-none drop-shadow-xl"
    draggable={false}
  />
);
