import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createLogger } from './logger.js';

const logger = createLogger('socket');
let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer, corsOrigin: string | boolean | string[]) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (userId) {
      socket.join(`user:${userId}`);
      logger.debug({ userId }, 'Socket connected');
    }
    socket.on('disconnect', () => {
      logger.debug({ userId }, 'Socket disconnected');
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: number, event: string, data: unknown) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}
