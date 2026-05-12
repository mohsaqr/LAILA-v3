import { useTranslation } from 'react-i18next';

interface WelcomeCardProps {
  name?: string | null;
  message?: string;
  className?: string;
  /** Hero artwork. Defaults to the LAILA word-mark logo. */
  illustration?: string;
}

/**
 * Hero greeting tile for role dashboards. Light cream background with a
 * faint teal-tinted gradient and dotted texture so the black LAILA
 * word-mark logo (PNG with transparent background) reads cleanly. Body
 * copy stays in dark slate for readability.
 */
export const WelcomeCard = ({
  name,
  message,
  className = '',
  illustration = '/welcome-logo.png',
}: WelcomeCardProps) => {
  const { t } = useTranslation(['common']);
  const fullName = name?.trim() ?? '';
  return (
    <div
      className={`relative h-full overflow-hidden rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 ${className}`}
      style={{
        background:
          'linear-gradient(135deg, #fdfdfb 0%, #f0fdfa 55%, #fff7ed 100%)',
      }}
    >
      {/* Subtle dot pattern in slate so the texture stays readable on light bg */}
      <svg
        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id="welcome-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="#94a3b8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#welcome-dots)" />
      </svg>

      {/* Soft accent blobs — brand teal + warm amber, both at low alpha */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle at center, #ccfbf1 0%, transparent 65%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle at center, #fef3c7 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative h-full flex items-center justify-center p-5 sm:p-6 min-h-[220px]">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 max-w-2xl">
          <WelcomeIllustration src={illustration} />
          <div className="flex flex-col text-center sm:text-left">
            <p className="text-sm font-medium tracking-wide mb-1" style={{ color: '#64748b' }}>
              {t('common:welcome_back_short', { defaultValue: 'Welcome back' })}
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold mb-2 break-words"
              style={{ color: '#0f172a' }}
            >
              {fullName || t('common:there', { defaultValue: 'there' })}
            </h2>
            <p
              className="text-sm max-w-md leading-relaxed"
              style={{ color: '#334155' }}
            >
              {message ??
                t('common:lets_start_message', {
                  defaultValue:
                    "Let's check what needs your attention today. Take a look at pending grading and recent student activity.",
                })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hero artwork shipped from `client/public/`. Defaults to the LAILA
 * word-mark logo (black ink on transparent background); the card is
 * intentionally light so it reads without an extra drop-shadow.
 */
const WelcomeIllustration = ({ src }: { src: string }) => (
  <img
    src={src}
    alt=""
    aria-hidden="true"
    className="w-full max-w-[140px] sm:max-w-[155px] lg:max-w-[180px] h-auto select-none pointer-events-none"
    draggable={false}
  />
);
