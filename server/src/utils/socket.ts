import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { createLogger } from './logger.js';
import { UserPayload } from '../types/index.js';

const logger = createLogger('socket');
let io: SocketIOServer | null = null;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export function initSocket(httpServer: HttpServer, corsOrigin: string | boolean | string[]) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    path: '/socket.io',
  });

  // Authenticate the handshake: the userId a socket joins MUST come from a
  // verified JWT, never from a client-supplied field. Otherwise anyone could
  // subscribe to another user's notification room by guessing their id.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET as string) as unknown as UserPayload;
      (socket.data as { userId?: number }).userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket.data as { userId?: number }).userId;
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
