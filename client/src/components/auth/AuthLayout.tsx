import { LineChart, Bot, FlaskConical, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../../store/languageStore';
import { supportedLanguages, SupportedLanguage } from '../../i18n/config';

/**
 * The logged-out shell: a brand panel that says what LAILA is on one side, and
 * whatever card the caller passes (sign in, and later register / forgot) on the
 * other.
 *
 * The card stays a pure card with no idea this panel exists, so it remains
 * testable on its own — the same split the reference implementations use.
 *
 * The panel is hidden below `lg`. On a phone the form IS the page, and a hero
 * that pushes the password field below the fold is worse than no hero at all.
 */

/**
 * The story on the panel. These are capabilities LAILA actually ships
 * (docs/FEATURES.md, plus the labs and analytics described in CLAUDE.md) — not
 * copy invented for this screen. If a claim stops being true there, it must
 * stop being true here.
 */
const FEATURES = [
  { key: 'analytics', icon: LineChart },
  { key: 'ai', icon: Bot },
  { key: 'labs', icon: FlaskConical },
  { key: 'collab', icon: Users },
] as const;

/**
 * `logo-mark.webp` is the signature wordmark as pure black ink on a transparent
 * background, so one file can be tinted per surface instead of shipping three
 * colourways. `invert(1)` turns that ink white and leaves the alpha channel
 * (which carries all the antialiasing) untouched.
 *
 * The older `logo.webp` is opaque RGB on a white background — usable only on a
 * white card, and a white rectangle anywhere else. Do not use it here.
 */
const InkMark = ({ className, invert }: { className: string; invert?: boolean }) => (
  <img
    src="/icons/logo-mark.webp"
    alt="LAILA"
    className={className}
    style={invert ? { filter: 'invert(1)' } : undefined}
  />
);

export const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  const { t } = useTranslation('auth');
  const { language: currentLanguage, setLanguage } = useLanguageStore();

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-950">
      {/* Brand panel. In Arabic the document direction flips this to the right,
          which is correct — it is the leading edge, not the left edge. */}
      {/* A deep base with bright glows on top, rather than a mid-tone teal
          throughout — a gradient that stays near one lightness reads as washed
          out no matter which teals it runs between. */}
      <aside className="relative hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-between overflow-hidden p-12 bg-gradient-to-br from-primary-800 via-primary-600 to-secondary-500">
        <div
          aria-hidden="true"
          className="absolute -top-40 -start-40 w-[36rem] h-[36rem] rounded-full bg-secondary-300/45 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-48 -end-24 w-[32rem] h-[32rem] rounded-full bg-primary-300/30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 start-1/4 w-[26rem] h-[26rem] rounded-full bg-secondary-200/25 blur-3xl"
        />

        {/* The signature spells "Laila", so it is the wordmark. Setting a typed
            LAILA beside it printed the name twice. Its bounding box is nearly
            square, so it also needs real height to stay legible. */}
        <div className="relative">
          <InkMark className="h-20 w-auto" invert />
        </div>

        <div className="relative max-w-xl">
          {/* Sized for a full sentence, not a three-word slogan: at text-4xl
              this headline runs to five lines and swamps the panel. */}
          <h1 className="mb-5 text-3xl xl:text-4xl font-bold leading-tight text-white">
            {t('hero_headline')}
          </h1>
          <p className="mb-10 text-base leading-relaxed text-white/90">{t('hero_sub')}</p>

          <ul className="space-y-5">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/15">
                  <Icon className="h-[18px] w-[18px] text-secondary-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t(`feature_${key}_title`)}</p>
                  <p className="text-sm leading-snug text-white/80">{t(`feature_${key}_desc`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">{t('brand_baseline')}</p>
      </aside>

      {/* Card column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Language sits above the card, before sign-in, because someone who
            cannot read the form cannot read a control buried inside it. */}
        <div className="flex justify-end p-4">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
            {Object.entries(supportedLanguages).map(([code, { nativeName }]) => {
              const active = currentLanguage === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code as SupportedLanguage)}
                  aria-pressed={active}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-white font-semibold text-primary-600 shadow-sm dark:bg-gray-700 dark:text-primary-300'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {nativeName}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            {/* Compact brand for small screens, where the panel is hidden. */}
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <InkMark className="mb-3 h-20 w-auto dark:invert" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('brand_baseline')}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
