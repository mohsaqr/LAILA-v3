import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(userId: number): Socket {
  if (socket?.connected) return socket;

  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  // Strip /api suffix if present to get the server origin
  const serverURL = baseURL.replace(/\/api\/?$/, '') || 'http://localhost:5001';

  socket = io(serverURL, {
    auth: { userId },
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
