import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../utils/auth';

let socket: Socket | null = null;

/**
 * Where the Socket.IO client should dial, given VITE_API_URL.
 *
 * Production builds set `VITE_API_URL=/api` (deploy/deploy.sh), and nginx
 * proxies `/socket.io/` to the server (deploy/nginx/laila.conf) — so the correct
 * production target is *same origin*.
 *
 * Returns `undefined` for same origin, never `''`. socket.io-client only treats
 * null/undefined as "use window.location"; an empty string falls through its
 * relative-path handling to `location.protocol + "//" + ""` — i.e. `"https://"`,
 * a URL with no host. The two are not interchangeable.
 *
 * Exported for tests: this resolution was silently wrong in production for every
 * build that set VITE_API_URL, so it is worth pinning.
 */
export function resolveSocketURL(configured: string | undefined): string | undefined {
  // Unset — local dev with no client/.env pointing anywhere.
  if (!configured) return 'http://localhost:5001';
  // '/api' → '' → same origin. An absolute URL keeps its origin.
  return configured.replace(/\/api\/?$/, '') || undefined;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const serverURL = resolveSocketURL(import.meta.env.VITE_API_URL);

  // The server authenticates the handshake and derives the userId from this
  // token — it is never trusted from a client-supplied id.
  // `serverURL` may be undefined; io()'s uri parameter is optional and that is
  // how same-origin is expressed.
  socket = io(serverURL, {
    auth: { token: getAuthToken() },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
