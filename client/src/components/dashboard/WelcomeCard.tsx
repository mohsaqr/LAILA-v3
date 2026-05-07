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
 * Inline SVG illustration — friendly stylized character resting on a
 * calendar. Pure SVG so it inherits the surrounding card's gradient
 * background without any external asset.
 */
const WelcomeIllustration = () => (
  <svg
    viewBox="0 0 240 200"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full max-w-[200px] sm:max-w-[180px] h-auto drop-shadow-lg"
    aria-hidden="true"
  >
    {/* Background clouds */}
    <ellipse cx="195" cy="40" rx="32" ry="11" fill="rgba(255,255,255,0.3)" />
    <ellipse cx="40" cy="55" rx="24" ry="9" fill="rgba(255,255,255,0.22)" />
    <ellipse cx="215" cy="155" rx="22" ry="8" fill="rgba(255,255,255,0.18)" />

    {/* Calendar — left of character */}
    <g transform="translate(8, 70)">
      {/* shadow */}
      <rect x="3" y="6" width="92" height="108" rx="11" fill="rgba(0,0,0,0.18)" />
      {/* body */}
      <rect width="92" height="108" rx="11" fill="#ffffff" />
      {/* header band */}
      <rect width="92" height="26" rx="11" fill="#f97316" />
      <rect y="16" width="92" height="10" fill="#f97316" />
      {/* tabs */}
      <rect x="22" y="-6" width="5" height="14" rx="1.5" fill="#fdba74" />
      <rect x="65" y="-6" width="5" height="14" rx="1.5" fill="#fdba74" />
      {/* dates */}
      {([0, 1, 2, 3, 4] as const).flatMap(c =>
        ([0, 1, 2, 3] as const).map(r => {
          const x = 14 + c * 16;
          const y = 42 + r * 14;
          const highlight = c === 2 && r === 1;
          return (
            <circle
              key={`d-${c}-${r}`}
              cx={x}
              cy={y}
              r={highlight ? 5 : 2.6}
              fill={highlight ? '#f97316' : '#cbd5e1'}
            />
          );
        })
      )}
    </g>

    {/* Character */}
    <g transform="translate(112, 28)">
      {/* desk shadow */}
      <ellipse cx="58" cy="160" rx="58" ry="10" fill="rgba(0,0,0,0.18)" />

      {/* shirt body */}
      <path d="M28 100 Q58 90 88 100 L92 150 Q58 158 24 150 Z" fill="#fef3c7" />

      {/* sleeves */}
      <path d="M22 100 Q14 110 22 130 Q34 124 38 110 Z" fill="#1e3a8a" />
      <path d="M94 100 Q102 110 94 130 Q82 124 78 110 Z" fill="#1e3a8a" />

      {/* arms folded */}
      <ellipse cx="40" cy="120" rx="14" ry="10" fill="#fde68a" transform="rotate(15 40 120)" />
      <ellipse cx="76" cy="120" rx="14" ry="10" fill="#fde68a" transform="rotate(-15 76 120)" />

      {/* neck */}
      <rect x="52" y="78" width="14" height="14" fill="#fde68a" />

      {/* head */}
      <circle cx="59" cy="62" r="24" fill="#fde68a" />

      {/* hair top */}
      <path
        d="M34 62 Q33 32 59 28 Q85 32 84 62 Q84 48 76 45 Q68 43 59 43 Q50 43 42 45 Q34 48 34 62 Z"
        fill="#7c2d12"
      />
      {/* hair sides */}
      <path d="M34 62 Q30 75 34 84 Q40 80 40 68 Z" fill="#7c2d12" />
      <path d="M84 62 Q88 75 84 84 Q78 80 78 68 Z" fill="#7c2d12" />
      {/* hair tuft */}
      <ellipse cx="59" cy="32" rx="14" ry="6" fill="#5b1a08" />

      {/* eyes */}
      <ellipse cx="50" cy="64" rx="2" ry="2.4" fill="#1f2937" />
      <ellipse cx="68" cy="64" rx="2" ry="2.4" fill="#1f2937" />

      {/* eyebrows */}
      <path d="M46 58 Q50 56 54 58" stroke="#5b1a08" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M64 58 Q68 56 72 58" stroke="#5b1a08" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* mouth */}
      <path
        d="M53 75 Q59 79 65 75"
        stroke="#1f2937"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />

      {/* cheeks */}
      <circle cx="44" cy="71" r="3" fill="#fb7185" opacity="0.45" />
      <circle cx="74" cy="71" r="3" fill="#fb7185" opacity="0.45" />
    </g>
  </svg>
);
