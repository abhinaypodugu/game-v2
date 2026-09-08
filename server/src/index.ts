// Server entrypoint: Express + Socket.io + room manager + JSONL log + sweeper.

import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { Server } from 'socket.io';
import { GameLog } from './jsonl';
import { RoomManager } from './rooms';
import { registerSocketHandlers, type ServerContext } from './sockets';

const app = express();
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }, // dev only; the client connects same-origin via proxy
});

const rooms = new RoomManager();
const log = new GameLog(join(process.cwd(), 'data', 'games'));

const ctx: ServerContext = {
  io,
  rooms,
  log,
  timers: new Map(),
  timerDeadlines: new Map(),
};

async function main(): Promise<void> {
  await log.init();
  registerSocketHandlers(ctx);

  // Idle sweeper: drop lobbies idle >30min and finished games >30min.
  setInterval(() => rooms.sweep(), 60_000).unref();

  const port = Number(process.env.PORT ?? 3001);
  httpServer.listen(port, () => {
    console.log(`catan-server listening on :${port}`);
  });
}

void main();

export { app, httpServer, io, ctx };
