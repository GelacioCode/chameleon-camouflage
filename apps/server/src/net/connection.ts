import { WebSocket, type RawData } from 'ws';
import {
  BUILD_ID,
  MAX_MESSAGE_BYTES,
  parseClientMessage,
  type ErrorCode,
  type ServerMessage,
} from '@chameleon/shared';
import type { Peer, Player, Room } from '../rooms/Room';
import type { RoomManager } from '../rooms/RoomManager';
import { TokenBucket } from './rateLimit';

const CONGESTED_BYTES = 256 * 1024;
const MAX_BUFFERED_BYTES = 1024 * 1024;
const MAX_STRIKES = 20;

export function handleConnection(ws: WebSocket, manager: RoomManager, now: () => number): void {
  let room: Room | null = null;
  let player: Player | null = null;
  let strikes = 0;
  const bucket = new TokenBucket(60, 120, now);

  const peer: Peer = {
    send(msg: ServerMessage) {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        ws.terminate();
        return;
      }
      ws.send(JSON.stringify(msg));
    },
    isCongested: () => ws.bufferedAmount > CONGESTED_BYTES,
  };

  const fail = (code: ErrorCode, message: string) => {
    peer.send({ t: 'error', code, message });
    if (++strikes > MAX_STRIKES) ws.close(1008, 'Too many invalid messages');
  };

  const detach = () => {
    if (room && player) room.disconnect(player, peer);
    room = null;
    player = null;
  };

  ws.on('message', (data: RawData, isBinary: boolean) => {
    if (isBinary) return fail('bad_message', 'Binary frames are not supported');
    if (!bucket.take()) return fail('rate_limited', 'Slow down');
    const raw = data.toString();
    if (raw.length > MAX_MESSAGE_BYTES) return fail('bad_message', 'Message too large');
    const msg = parseClientMessage(raw);
    if (!msg) return fail('bad_message', 'Invalid message');

    switch (msg.t) {
      case 'ping':
        peer.send({ t: 'pong', id: msg.id });
        return;
      case 'create_room':
      case 'join_room': {
        if (msg.build !== BUILD_ID) return fail('incompatible_build', 'Client is out of date; reload the page');
        if (room && player) room.leave(player);
        room = null;
        player = null;
        const target = msg.t === 'create_room' ? manager.create() : manager.get(msg.code);
        if (!target) return fail('room_not_found', 'Room not found');
        const resumed =
          msg.t === 'join_room' && msg.reconnectToken ? target.reconnect(peer, msg.reconnectToken) : null;
        const joined = resumed ?? target.join(peer, msg.nickname);
        if (typeof joined === 'string') return fail(joined, 'Room is full');
        room = target;
        player = joined;
        return;
      }
      case 'leave':
        if (room && player) room.leave(player);
        room = null;
        player = null;
        return;
      default:
        if (!room || !player) return fail('not_in_room', 'Join a room first');
        room.handle(player, msg);
    }
  });

  ws.on('close', detach);
  ws.on('error', detach);
}
