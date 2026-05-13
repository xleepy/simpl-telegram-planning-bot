import { WebSocket } from 'ws';

interface Client {
  ws: WebSocket;
  userId: string;
  chatInstance: string;
  firstName: string;
}

const rooms = new Map<string, Set<Client>>();

export function addClient(client: Client): void {
  if (!rooms.has(client.chatInstance)) {
    rooms.set(client.chatInstance, new Set());
  }
  rooms.get(client.chatInstance)!.add(client);

  broadcastPresence(client.chatInstance);
}

export function removeClient(client: Client): void {
  const room = rooms.get(client.chatInstance);
  if (!room) return;

  room.delete(client);
  if (room.size === 0) {
    rooms.delete(client.chatInstance);
  }

  broadcastPresence(client.chatInstance);
}

export function broadcast(chatInstance: string, message: object): void {
  const room = rooms.get(chatInstance);
  if (!room) return;

  const data = JSON.stringify(message);
  for (const client of room) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

function broadcastPresence(chatInstance: string): void {
  const room = rooms.get(chatInstance);
  const users = room
    ? Array.from(room).map((c) => ({
        userId: c.userId,
        firstName: c.firstName,
      }))
    : [];

  broadcast(chatInstance, { type: 'presence', users });
}

export function getPresence(chatInstance: string): { userId: string; firstName: string }[] {
  const room = rooms.get(chatInstance);
  if (!room) return [];

  return Array.from(room).map((c) => ({
    userId: c.userId,
    firstName: c.firstName,
  }));
}
