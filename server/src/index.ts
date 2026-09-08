import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }, // dev only; client connects via same-origin proxy
});

io.on('connection', (socket) => {
  socket.emit('hello', { message: 'catan-server' });
});

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => {
  console.log(`catan-server listening on :${port}`);
});

export { app, httpServer, io };
