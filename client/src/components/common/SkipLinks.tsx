export const SkipLinks = () => {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="absolute top-2 left-2 z-[100] px-4 py-2 bg-primary-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#main-navigation"
        className="absolute top-2 left-48 z-[100] px-4 py-2 bg-primary-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        Skip to navigation
      </a>
    </div>
  );
};
