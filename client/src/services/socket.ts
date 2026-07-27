import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../utils/auth';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  // Strip /api suffix if present to get the server origin
  const serverURL = baseURL.replace(/\/api\/?$/, '') || 'http://localhost:5001';

  // The server authenticates the handshake and derives the userId from this
  // token — it is never trusted from a client-supplied id.
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
