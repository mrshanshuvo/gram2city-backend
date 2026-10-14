import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { MessageModel, UserModel } from '../db/models';
import { ChatMessage } from '../types/types';
import { config } from '../config';

export let io: Server;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: config.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`⚡ New connection: ${socket.id}`);

    // Join room for specific parcel tracking
    socket.on('join_parcel', (trackingId: string) => {
      socket.join(trackingId);
      console.log(`📍 Socket ${socket.id} joined tracking: ${trackingId}`);
    });

    // Handle rider location updates
    socket.on('rider_location_update', (data) => {
      const { trackingId, location } = data;
      io.to(trackingId).emit('location_received', {
        trackingId,
        location,
        timestamp: new Date().toISOString(),
      });
    });

    // Support Chat: Join conversation room
    socket.on('join_chat', async (conversationId: string, token?: string) => {
      if (token) {
        try {
          const decoded = await verifySocketToken(token);
          if (decoded.email) {
            socket.join(decoded.email);
            console.log(`👤 Socket ${socket.id} joined user room: ${decoded.email}`);

            // If the user has an admin or superAdmin role, join them to the shared 'admins' room
            const dbUser = await UserModel.findOne({
              email: decoded.email,
            }).lean();
            if (dbUser?.role === 'admin' || dbUser?.role === 'superAdmin') {
              socket.join('admins');
              console.log(`🛠️ Socket ${socket.id} joined admins room`);
            }
          }
        } catch {
          socket.emit('message_error', {
            message: 'Unauthorized: invalid join token',
          });
          return;
        }
      }
      socket.join(conversationId);
      console.log(`💬 Socket ${socket.id} joined chat room: ${conversationId}`);
    });

    // Support Chat: Handle messages
    socket.on('send_message', async (data) => {
      try {
        const token = data?.token as string | undefined;
        if (!token) {
          socket.emit('message_error', {
            message: 'Unauthorized: missing auth token',
          });
          return;
        }

        let decoded;
        try {
          decoded = await verifySocketToken(token);
        } catch {
          socket.emit('message_error', {
            message: 'Unauthorized: invalid token',
          });
          return;
        }

        if (!decoded.email) {
          socket.emit('message_error', {
            message: 'Unauthorized: missing email',
          });
          return;
        }

        let senderEmail = decoded.email;
        let senderRole = data.senderRole ?? 'user';

        const dbUser = await UserModel.findOne({ email: decoded.email }).lean();
        if (dbUser?.role === 'admin' || dbUser?.role === 'superAdmin') {
          senderEmail = 'admin@gram2city.com';
          senderRole = dbUser.role;
        }

        const chatMessage: ChatMessage = {
          senderEmail,
          senderName: data.senderName ?? decoded.email,
          senderRole,
          receiverEmail: data.receiverEmail,
          message: data.message,
          imageUrl: data.imageUrl || undefined,
          timestamp: new Date().toISOString(),
          isRead: false,
          conversationId: data.conversationId,
        };

        await MessageModel.create(chatMessage);
        let broadcast = io.to(data.conversationId).to('admins');
        if (chatMessage.receiverEmail) {
          broadcast = broadcast.to(chatMessage.receiverEmail);
        }
        broadcast.emit('receive_message', chatMessage);
      } catch (error) {
        console.error('Failed to process socket message:', error);
        socket.emit('message_error', {
          message: 'Failed to send message',
        });
      }
    });

    socket.on('typing', async (data) => {
      const token = data?.token as string | undefined;
      if (!token) return;
      try {
        const decoded = await verifySocketToken(token);
        io.to(data.conversationId).emit('user_typing', {
          senderEmail: decoded.email,
          conversationId: data.conversationId,
        });
      } catch {
        // ignore typing auth errors
      }
    });

    socket.on('mark_messages_read', async (data) => {
      const token = data?.token as string | undefined;
      if (!token) {
        socket.emit('message_error', {
          message: 'Unauthorized: missing read token',
        });
        return;
      }

      let decoded;
      try {
        decoded = await verifySocketToken(token);
      } catch {
        socket.emit('message_error', {
          message: 'Unauthorized: invalid read token',
        });
        return;
      }

      try {
        let readByEmail = decoded.email ?? data.readByEmail;
        const dbUser = await UserModel.findOne({ email: readByEmail }).lean();
        if (dbUser?.role === 'admin' || dbUser?.role === 'superAdmin') {
          readByEmail = 'admin@gram2city.com';
        }

        await MessageModel.updateMany(
          {
            conversationId: data.conversationId,
            receiverEmail: readByEmail,
            isRead: false,
          },
          { $set: { isRead: true } },
        );
        io.to(data.conversationId).emit('messages_marked_read', {
          conversationId: data.conversationId,
          readByEmail: readByEmail,
        });
      } catch (error) {
        console.error('Failed to mark messages read:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Disconnected: ${socket.id}`);
    });
  });

  return io;
};

async function verifySocketToken(token: string) {
  const { verifyJWT } = await import('../utils/jwt');
  return verifyJWT(token);
}
