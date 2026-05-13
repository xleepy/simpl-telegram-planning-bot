import express from 'express';
import http from 'http';
import { existsSync } from 'fs';
import { WebSocketServer } from 'ws';
import authRoutes from './routes/auth';
import listRoutes from './routes/lists';
import itemRoutes from './routes/items';
import { addClient, removeClient } from './ws/rooms';
import { verifyToken } from './middleware/jwt-auth';

function createServer(port: number): http.Server {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json());

  app.use('/api', authRoutes);
  app.use('/api/lists', listRoutes);
  app.use('/api/lists', itemRoutes);

  if (existsSync('public/index.html')) {
    app.use(express.static('public'));
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'public' });
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) {
      socket.destroy();
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const payload = verifyToken(token);

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
        const client = {
          ws,
          userId: payload.userId,
          chatInstance: payload.chatInstance,
          firstName: '',
        };

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'hello') {
              client.firstName = msg.firstName || '';
              addClient(client);
            }
          } catch {
            // ignore invalid messages
          }
        });

        ws.on('close', () => {
          removeClient(client);
        });

        ws.on('error', () => {
          removeClient(client);
        });
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });

  return server;
}

export { createServer };
