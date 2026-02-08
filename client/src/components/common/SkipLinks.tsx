import { useTranslation } from 'react-i18next';

export const SkipLinks = () => {
  const { t } = useTranslation(['common']);

  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-2 left-2 z-[100] px-4 py-2 bg-primary-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        {t('skip_to_main_content')}
      </a>
      <a
        href="#main-navigation"
        className="absolute top-2 left-48 z-[100] px-4 py-2 bg-primary-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        {t('skip_to_navigation')}
      </a>
    </div>
  );
};
