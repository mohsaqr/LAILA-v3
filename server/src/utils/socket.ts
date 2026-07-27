import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { createLogger } from './logger.js';
import { UserPayload } from '../types/index.js';

const logger = createLogger('socket');
let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer, corsOrigin: string | boolean | string[]) {
  // Read the secret lazily (at init time, after dotenv has loaded) rather than
  // at module load. A top-level read runs before index.ts calls dotenv.config()
  // because imports are hoisted, so the value would be undefined and crash boot.
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  io = new SocketIOServer(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    path: '/socket.io',
  });

  // Authenticate the handshake: the userId a socket joins MUST come from a
  // verified JWT, never from a client-supplied field. Otherwise anyone could
  // subscribe to another user's notification room by guessing their id.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, jwtSecret) as unknown as UserPayload;

      // Honour token invalidation and deactivation like the HTTP auth path: a
      // logged-out / password-changed / demoted / deactivated user's token must
      // NOT open a socket. prisma is imported lazily because this module is
      // loaded before dotenv runs (a top-level import would read env too early).
      if (decoded.tokenVersion !== undefined) {
        const { prisma } = await import('./prisma.js');
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { tokenVersion: true, isActive: true },
        });
        if (!user || !user.isActive || user.tokenVersion !== decoded.tokenVersion) {
          return next(new Error('Invalid or expired token'));
        }
      }

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
