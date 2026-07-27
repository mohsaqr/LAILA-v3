import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

/**
 * OIDC authorization endpoint — the one user-facing step of LAILA-as-identity-provider.
 *
 * WHY THIS IS A PAGE AND NOT AN API ROUTE. A relying party sends the browser
 * here with a top-level redirect, and LAILA's session token lives in
 * localStorage rather than a cookie — a redirect cannot carry an Authorization
 * header. So the SPA has to read the token itself and call the API. The server
 * returns the redirect target as JSON instead of a 302 so that nothing follows
 * a redirect the page has not validated.
 *
 * There is no consent screen: the relying party is a first-party application
 * registered by an administrator, not a third-party app asking for access to
 * someone's account. The interstitial exists to explain the hop, not to gate it.
 */
export function OidcAuthorize() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // React 18 StrictMode double-invokes effects in development, and each call
  // mints a fresh authorization code. Harmless (they expire unused) but noisy.
  const submitted = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || submitted.current) return;
    submitted.current = true;

    const payload = {
      client_id: params.get('client_id'),
      redirect_uri: params.get('redirect_uri'),
      state: params.get('state'),
      nonce: params.get('nonce'),
      scope: params.get('scope'),
      code_challenge: params.get('code_challenge'),
      code_challenge_method: params.get('code_challenge_method'),
    };

    apiClient
      .post('/oidc/authorize', payload)
      .then((res) => {
        const redirectTo = res.data?.data?.redirectTo;
        if (!redirectTo) {
          setError('The sign-in service returned an unexpected response.');
          return;
        }
        // replace() so the back button does not re-run a spent authorization.
        window.location.replace(redirectTo);
      })
      .catch((err) => {
        // A 4xx here means the request itself was rejected (unknown client or
        // unregistered redirect_uri). Those must NOT be redirected anywhere —
        // bouncing to an unverified redirect_uri is the open-redirect hole.
        setError(err?.response?.data?.error || 'Could not complete the sign-in request.');
        submitted.current = false;
      });
  }, [isAuthenticated, isLoading, params]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Send them to sign in, then back here with the OIDC parameters intact.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-red-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Sign-in request refused
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Return to the application you came from and try again. If this keeps happening, the
            application may not be registered with LAILA.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-500" />
        <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Signing you in&hellip;
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          LAILA is confirming your identity with the application you are opening.
        </p>
      </div>
    </div>
  );
}
