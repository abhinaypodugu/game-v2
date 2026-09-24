// @catan/host: the authoritative game host (rooms, rules wiring, timers, bots)
// behind a transport-neutral hub. Runs under Node (socket.io) or in a browser
// tab (MemoryHub + WebRTC). Must stay free of Node-only APIs.

export { MemoryHub, type HubClientEndpoint, type HubServer, type HubSocket } from './hub';
export {
  noopLog,
  registerSocketHandlers,
  roomStatePayload,
  stopRoomTimers,
  type GameLogSink,
  type ServerContext,
} from './sockets';
export {
  DEFAULT_SETTINGS,
  RoomManager,
  SETTINGS_LIMITS,
  type Room,
  type RoomSettings,
  type Seat,
  type StoredGame,
} from './rooms';
export { BOT_NAMES, computeBotAction } from './bot';
export { sanitize, type OwnView, type PersonalSnapshot, type PublicPlayer } from './sanitize';
export type { TimerHandle } from './timers';
