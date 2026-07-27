import { Navigate } from 'react-router-dom';

/**
 * Deprecated (2026-07-16). Lab administration was consolidated: the catalog
 * (/labs) lists and creates labs; each lab page owns its settings, course
 * assignment, duplication, and deletion. This stub only preserves old links.
 */
export const LabManager = () => <Navigate to="/labs" replace />;
