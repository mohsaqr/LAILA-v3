import { QueryClient } from '@tanstack/react-query';

// Shared app-wide QueryClient. Lives outside main.tsx so non-component code
// (the auth store) can reach it: the cache is keyed by query, not by user, so
// every auth transition must wipe it or the next account sees the previous
// account's cached data (conversations, enrollments, ...) served instantly —
// and kept on screen even after the refetch fails with a 403.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
